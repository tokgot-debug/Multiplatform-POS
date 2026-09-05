import { Timestamp, type Transaction } from "firebase-admin/firestore";

import { db } from "../../lib/firebase";
import { safeSum } from "../../shared/money";
import { minorUnits } from "../../shared/validation";
import type {
  BaseSaleContext,
  ParsedSaleInput,
  SaleDependencies,
  SaleRecords,
} from "./types";

type WriteSaleRecordsOptions = {
  transaction: Transaction;
  input: ParsedSaleInput;
  context: BaseSaleContext;
  dependencies: SaleDependencies;
  records: SaleRecords;
  timestamp: Timestamp;
};

export function writeSaleRecords({
  transaction,
  input,
  context,
  dependencies,
  records,
  timestamp,
}: WriteSaleRecordsOptions): void {
  const saleId = String(records.sale.id);
  transaction.set(db.collection("sales").doc(saleId), records.sale);
  records.lines.forEach((line) => {
    transaction.set(db.collection("sale_lines").doc(String(line.id)), line);
  });
  records.payments.forEach((payment) => {
    transaction.set(db.collection("payments").doc(String(payment.id)), payment);
  });

  dependencies.updatedBalances.forEach((balance, index) => {
    transaction.update(dependencies.balanceRefs[index], {
      qty: balance.qty,
      updatedAt: timestamp,
    });
    const movementId = `${saleId}_movement_${String(index + 1).padStart(2, "0")}`;
    transaction.set(db.collection("stock_movements").doc(movementId), {
      id: movementId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      productId: balance.productId,
      location: "HOUSE",
      type: "SALE",
      qty: -dependencies.physicalLines[index].qty,
      balanceAfterQty: balance.qty,
      referenceType: "sale",
      referenceId: saleId,
      createdByStaffId: input.staffId,
      createdAt: timestamp,
    });
  });

  dependencies.paymentIntentRefs.forEach((intentRef) => {
    transaction.update(intentRef, {
      status: "consumed",
      consumedSaleId: saleId,
      consumedAt: timestamp,
    });
  });

  updateShiftCash(transaction, input, context, timestamp);
  transaction.set(context.refs.counter, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    value: context.counterValue + 1,
    updatedAt: timestamp,
  });
  transaction.set(db.collection("audit_logs").doc(`audit_${saleId}`), {
    id: `audit_${saleId}`,
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorStaffId: input.staffId,
    action: "sale.completed",
    entityType: "sale",
    entityId: saleId,
    metadata: {
      invoiceNumber: records.sale.invoiceNumber,
      totalMinor: records.sale.totalMinor,
    },
    createdAt: timestamp,
  });
}

function updateShiftCash(
  transaction: Transaction,
  input: ParsedSaleInput,
  context: BaseSaleContext,
  timestamp: Timestamp,
): void {
  const cashMinor = safeSum(
    input.payments
      .filter((payment) => payment.method === "cash")
      .map((payment) => payment.amountMinor),
    "cash total",
  );
  const currentExpectedCashMinor = minorUnits(
    context.shift.expectedCashMinor,
    "shift.expectedCashMinor",
  );
  transaction.update(context.refs.shift, {
    expectedCashMinor: safeSum(
      [currentExpectedCashMinor, cashMinor],
      "shift expected cash",
    ),
    updatedAt: timestamp,
  });
}
