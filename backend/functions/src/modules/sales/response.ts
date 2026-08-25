import type { DocumentData } from "firebase-admin/firestore";

import { normalizeFirestoreValue } from "../../shared/firestore-values";
import type { SaleDependencies, SaleRecords } from "./types";

export function newSaleResponse(
  records: SaleRecords,
  dependencies: SaleDependencies,
): Record<string, unknown> {
  return {
    sale: publicSale(records.sale),
    lines: normalizeFirestoreValue(records.lines),
    payments: normalizeFirestoreValue(records.payments),
    stockBalances: normalizeFirestoreValue(dependencies.updatedBalances),
    replayed: false,
  };
}

export function publicSale(saleData: DocumentData): Record<string, unknown> {
  const {
    lineIds: _lineIds,
    paymentIds: _paymentIds,
    stockBalanceIds: _stockBalanceIds,
    stockBalanceSnapshots: _stockBalanceSnapshots,
    requestFingerprint: _requestFingerprint,
    ...sale
  } = saleData;
  return normalizeFirestoreValue(sale);
}
