import { HttpsError } from "firebase-functions/v2/https";

import {
  asRecord,
  documentId,
  minorUnits,
  optionalText,
} from "../../shared/validation";
import {
  MAX_DISTINCT_LINES,
  MAX_PAYMENTS,
  MAX_QTY_PER_LINE,
  PAYMENT_METHODS,
} from "./constants";
import type { InputLine, InputPayment, ParsedSaleInput } from "./types";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_-]{8,160}$/;
const KRA_PIN_PATTERN = /^[A-Z]\d{9}[A-Z]$/;

function parseLines(value: unknown): InputLine[] {
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.length > MAX_DISTINCT_LINES
  ) {
    throw new HttpsError(
      "invalid-argument",
      `lines must contain 1-${MAX_DISTINCT_LINES} entries.`,
    );
  }

  const seenProducts = new Set<string>();
  return value.map((raw, index) => {
    const line = asRecord(raw, `lines[${index}]`);
    const productId = documentId(line.productId, `lines[${index}].productId`);
    if (seenProducts.has(productId)) {
      throw new HttpsError(
        "invalid-argument",
        "Duplicate products must be combined into one sale line.",
      );
    }
    seenProducts.add(productId);

    if (
      typeof line.qty !== "number"
      || !Number.isSafeInteger(line.qty)
      || line.qty <= 0
      || line.qty > MAX_QTY_PER_LINE
    ) {
      throw new HttpsError(
        "invalid-argument",
        `lines[${index}].qty must be a positive integer.`,
      );
    }

    return {
      productId,
      qty: line.qty,
      discountMinor: line.discountMinor === undefined
        ? 0
        : minorUnits(line.discountMinor, `lines[${index}].discountMinor`),
    };
  });
}

function parsePayments(value: unknown): InputPayment[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PAYMENTS) {
    throw new HttpsError(
      "invalid-argument",
      `payments must contain 1-${MAX_PAYMENTS} entries.`,
    );
  }

  const providerReferences = new Set<string>();
  return value.map((raw, index) => {
    const payment = asRecord(raw, `payments[${index}]`);
    if (typeof payment.method !== "string" || !PAYMENT_METHODS.has(payment.method)) {
      throw new HttpsError(
        "invalid-argument",
        `payments[${index}].method is not supported.`,
      );
    }

    const reference = optionalText(
      payment.reference,
      `payments[${index}].reference`,
      160,
    );
    if (payment.method !== "cash" && reference) {
      const normalizedReference = reference.toUpperCase();
      if (providerReferences.has(normalizedReference)) {
        throw new HttpsError(
          "invalid-argument",
          "A verified provider reference can only settle one payment entry.",
        );
      }
      providerReferences.add(normalizedReference);
    }

    return {
      method: payment.method,
      amountMinor: minorUnits(
        payment.amountMinor,
        `payments[${index}].amountMinor`,
        false,
      ),
      reference,
    };
  });
}

export function parseSaleInput(value: unknown): ParsedSaleInput {
  const input = asRecord(value);
  if (
    typeof input.idempotencyKey !== "string"
    || !IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "idempotencyKey must contain 8-160 letters, numbers, colons, underscores, or hyphens.",
    );
  }

  const buyerKraPin = optionalText(input.buyerKraPin, "buyerKraPin", 32)?.toUpperCase() ?? null;
  if (buyerKraPin && !KRA_PIN_PATTERN.test(buyerKraPin)) {
    throw new HttpsError(
      "invalid-argument",
      "buyerKraPin must use the KRA PIN format A000000000A.",
    );
  }

  return {
    tenantId: documentId(input.tenantId, "tenantId"),
    branchId: documentId(input.branchId, "branchId"),
    deviceId: documentId(input.deviceId, "deviceId"),
    shiftId: documentId(input.shiftId, "shiftId"),
    staffId: documentId(input.staffId, "staffId"),
    customerId: documentId(input.customerId, "customerId"),
    idempotencyKey: input.idempotencyKey,
    tableNumber: optionalText(input.tableNumber, "tableNumber", 40),
    buyerKraPin,
    lines: parseLines(input.lines),
    payments: parsePayments(input.payments),
  };
}
