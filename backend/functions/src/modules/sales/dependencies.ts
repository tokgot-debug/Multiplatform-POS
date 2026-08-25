import { Timestamp, type Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import { db } from "../../lib/firebase";
import { deterministicId } from "../../shared/identifiers";
import type {
  ParsedSaleInput,
  PreparedLine,
  SaleDependencies,
} from "./types";

function stockBalanceId(branchId: string, productId: string): string {
  // This is an existing persistence contract. Changing it requires a data migration.
  return `${branchId}_${productId}_HOUSE`;
}

export async function loadSaleDependencies(
  transaction: Transaction,
  input: ParsedSaleInput,
  preparedLines: readonly PreparedLine[],
  timestamp: Timestamp,
): Promise<SaleDependencies> {
  const physicalLines = preparedLines.filter((line) => !line.isService);
  const balanceRefs = physicalLines.map((line) =>
    db.collection("stock_balances").doc(
      stockBalanceId(input.branchId, line.productId),
    ),
  );

  const digitalPayments = input.payments.filter(
    (payment) => payment.method !== "cash",
  );
  for (const payment of digitalPayments) {
    if (!payment.reference) {
      throw new HttpsError(
        "failed-precondition",
        `${payment.method} requires a verified provider reference.`,
      );
    }
  }
  const paymentIntentRefs = digitalPayments.map((payment) =>
    db.collection("payment_intents").doc(
      deterministicId("intent", `${input.tenantId}:${payment.reference}`),
    ),
  );

  const dependencyRefs = [...balanceRefs, ...paymentIntentRefs];
  const dependencyDocuments = dependencyRefs.length
    ? await transaction.getAll(...dependencyRefs)
    : [];
  const balanceDocuments = dependencyDocuments.slice(0, balanceRefs.length);
  const paymentIntentDocuments = dependencyDocuments.slice(balanceRefs.length);

  const updatedBalances = balanceDocuments.map((snapshot, index) => {
    const line = physicalLines[index];
    const balance = snapshot.data() ?? {};
    if (
      !snapshot.exists
      || balance.tenantId !== input.tenantId
      || balance.branchId !== input.branchId
      || balance.productId !== line.productId
      || balance.location !== "HOUSE"
    ) {
      throw new HttpsError(
        "failed-precondition",
        `A valid HOUSE balance is missing for ${line.productName}.`,
      );
    }
    if (
      typeof balance.qty !== "number"
      || !Number.isSafeInteger(balance.qty)
      || balance.qty < line.qty
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Insufficient house stock for ${line.productName}.`,
      );
    }

    return {
      id: snapshot.id,
      tenantId: input.tenantId,
      branchId: input.branchId,
      productId: line.productId,
      location: "HOUSE" as const,
      qty: balance.qty - line.qty,
      updatedAt: timestamp,
    };
  });

  paymentIntentDocuments.forEach((snapshot, index) => {
    const expected = digitalPayments[index];
    const intent = snapshot.data() ?? {};
    if (
      !snapshot.exists
      || intent.tenantId !== input.tenantId
      || intent.method !== expected.method
      || intent.amountMinor !== expected.amountMinor
      || intent.status !== "verified"
      || intent.consumedSaleId
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Payment reference for ${expected.method} is not verified or was already consumed.`,
      );
    }
  });

  return {
    physicalLines,
    digitalPayments,
    balanceRefs,
    paymentIntentRefs,
    paymentIntentDocuments,
    updatedBalances,
  };
}
