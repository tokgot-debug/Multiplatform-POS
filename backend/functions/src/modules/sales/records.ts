import { randomUUID } from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";

import { needsProviderIntent } from "./constants";
import type {
  BaseSaleContext,
  ParsedSaleInput,
  PreparedLine,
  SaleDependencies,
  SaleRecords,
  SaleTotals,
} from "./types";

type BuildSaleRecordsOptions = {
  saleId: string;
  requestFingerprint: string;
  input: ParsedSaleInput;
  context: BaseSaleContext;
  preparedLines: PreparedLine[];
  totals: SaleTotals;
  dependencies: SaleDependencies;
  timestamp: Timestamp;
};

export function buildSaleRecords({
  saleId,
  requestFingerprint,
  input,
  context,
  preparedLines,
  totals,
  dependencies,
  timestamp,
}: BuildSaleRecordsOptions): SaleRecords {
  const nextSequence = context.counterValue + 1;
  const lineIds = preparedLines.map(
    (_, index) => `${saleId}_line_${String(index + 1).padStart(2, "0")}`,
  );
  const paymentIds = input.payments.map(
    (_, index) => `${saleId}_payment_${String(index + 1).padStart(2, "0")}`,
  );
  const stockBalanceIds = dependencies.balanceRefs.map((ref) => ref.id);
  const sale = {
    id: saleId,
    tenantId: input.tenantId,
    branchId: input.branchId,
    deviceId: input.deviceId,
    shiftId: input.shiftId,
    staffId: input.staffId,
    customerId: input.customerId,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint,
    invoiceNumber: `INV-${String(context.branch.code)}-${String(nextSequence).padStart(6, "0")}`,
    saleUuid: randomUUID(),
    status: "completed",
    tableNumber: input.tableNumber,
    buyerKraPin: input.buyerKraPin,
    ...totals,
    fiscalStatus: context.tenant.etimsMode === "none" ? "not_required" : "pending",
    soldAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    lineIds,
    paymentIds,
    stockBalanceIds,
    // Idempotent replays must return the balance produced by this sale, not a
    // later mutable balance after more sales have completed.
    stockBalanceSnapshots: dependencies.updatedBalances,
  };
  const lines = preparedLines.map((line, index) => ({
    id: lineIds[index],
    tenantId: input.tenantId,
    saleId,
    productId: line.productId,
    sku: line.sku,
    productName: line.productName,
    qty: line.qty,
    unitPriceMinor: line.unitPriceMinor,
    discountMinor: line.discountMinor,
    taxCode: line.taxCode,
    taxMinor: line.taxMinor,
    lineTotalMinor: line.lineTotalMinor,
    createdAt: timestamp,
  }));

  let digitalPaymentIndex = 0;
  const payments = input.payments.map((payment, index) => {
    const fromProvider = needsProviderIntent(payment.method);
    const intent = fromProvider
      ? dependencies.paymentIntentDocuments[digitalPaymentIndex++]
      : undefined;
    return {
      id: paymentIds[index],
      tenantId: input.tenantId,
      saleId,
      method: payment.method,
      amountMinor: payment.amountMinor,
      reference: payment.reference,
      providerTransactionId: fromProvider
        ? String(intent?.data()?.providerTransactionId ?? "")
        : null,
      status: "completed",
      paidAt: timestamp,
      createdAt: timestamp,
    };
  });

  return { sale, lines, payments };
}
