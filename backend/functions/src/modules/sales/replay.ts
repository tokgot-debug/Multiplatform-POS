import type {
  DocumentData,
  DocumentReference,
  Transaction,
} from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import { db } from "../../lib/firebase";
import { normalizeFirestoreValue } from "../../shared/firestore-values";
import { saleRequestFingerprint, type SaleFingerprintInput } from "./fingerprint";
import { publicSale } from "./response";
import type { ParsedSaleInput } from "./types";

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new HttpsError(
      "data-loss",
      `The idempotent sale has an invalid ${field}.`,
    );
  }
  return value;
}

function requiredInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new HttpsError(
      "data-loss",
      `The idempotent sale has an invalid ${field}.`,
    );
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value, field);
}

function fingerprintFromStoredSale(
  sale: DocumentData,
  lines: DocumentData[],
  payments: DocumentData[],
): string {
  const input: SaleFingerprintInput = {
    tenantId: requiredString(sale.tenantId, "tenantId"),
    branchId: requiredString(sale.branchId, "branchId"),
    deviceId: requiredString(sale.deviceId, "deviceId"),
    shiftId: requiredString(sale.shiftId, "shiftId"),
    staffId: requiredString(sale.staffId, "staffId"),
    customerId: requiredString(sale.customerId, "customerId"),
    idempotencyKey: requiredString(sale.idempotencyKey, "idempotencyKey"),
    tableNumber: nullableString(sale.tableNumber, "tableNumber"),
    buyerKraPin: nullableString(sale.buyerKraPin, "buyerKraPin"),
    lines: lines.map((line) => ({
      productId: requiredString(line.productId, "line.productId"),
      qty: requiredInteger(line.qty, "line.qty"),
      discountMinor: requiredInteger(line.discountMinor, "line.discountMinor"),
    })),
    payments: payments.map((payment) => ({
      method: requiredString(payment.method, "payment.method"),
      amountMinor: requiredInteger(payment.amountMinor, "payment.amountMinor"),
      reference: nullableString(payment.reference, "payment.reference"),
    })),
  };
  return saleRequestFingerprint(input);
}

function assertReplayOwner(sale: DocumentData, input: ParsedSaleInput): void {
  if (sale.tenantId !== input.tenantId || sale.staffId !== input.staffId) {
    throw new HttpsError(
      "already-exists",
      "This idempotency key is already owned by a different sale request.",
    );
  }
}

export async function replaySale(
  transaction: Transaction,
  sale: DocumentData,
  input: ParsedSaleInput,
  expectedFingerprint: string,
): Promise<Record<string, unknown>> {
  assertReplayOwner(sale, input);

  const storedFingerprint = sale.requestFingerprint;
  if (
    typeof storedFingerprint === "string"
    && storedFingerprint !== expectedFingerprint
  ) {
    throw new HttpsError(
      "already-exists",
      "This idempotency key was already used with different sale details.",
    );
  }

  const lineIds = stringArray(sale.lineIds);
  const paymentIds = stringArray(sale.paymentIds);
  const stockBalanceIds = stringArray(sale.stockBalanceIds);
  const refs: DocumentReference[] = [
    ...lineIds.map((id) => db.collection("sale_lines").doc(id)),
    ...paymentIds.map((id) => db.collection("payments").doc(id)),
    ...stockBalanceIds.map((id) => db.collection("stock_balances").doc(id)),
  ];
  const snapshots = refs.length ? await transaction.getAll(...refs) : [];
  if (snapshots.some((snapshot) => !snapshot.exists)) {
    throw new HttpsError(
      "data-loss",
      "The idempotent sale exists but related records are incomplete.",
    );
  }

  const lineEnd = lineIds.length;
  const paymentEnd = lineEnd + paymentIds.length;
  const lines = snapshots
    .slice(0, lineEnd)
    .map((snapshot) => snapshot.data() ?? {});
  const payments = snapshots
    .slice(lineEnd, paymentEnd)
    .map((snapshot) => snapshot.data() ?? {});

  if (
    typeof storedFingerprint !== "string"
    && fingerprintFromStoredSale(sale, lines, payments) !== expectedFingerprint
  ) {
    throw new HttpsError(
      "already-exists",
      "This legacy idempotency key was already used with different sale details.",
    );
  }

  const storedBalanceSnapshots = Array.isArray(sale.stockBalanceSnapshots)
    ? sale.stockBalanceSnapshots
    : null;
  const stockBalances = storedBalanceSnapshots
    && storedBalanceSnapshots.length === stockBalanceIds.length
    ? storedBalanceSnapshots
    : snapshots.slice(paymentEnd).map((snapshot) => snapshot.data() ?? {});

  return {
    sale: publicSale(sale),
    lines: normalizeFirestoreValue(lines),
    payments: normalizeFirestoreValue(payments),
    stockBalances: normalizeFirestoreValue(stockBalances),
    replayed: true,
  };
}
