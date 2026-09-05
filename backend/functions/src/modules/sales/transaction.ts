import { Timestamp } from "firebase-admin/firestore";

import { db } from "../../lib/firebase";
import { deterministicId } from "../../shared/identifiers";
import { loadBaseSaleContext } from "./base-context";
import { loadSaleDependencies } from "./dependencies";
import {
  assertAcceptedPayments,
  assertDiscountPermission,
  calculateSaleTotals,
  prepareSaleLines,
} from "./domain";
import { saleRequestFingerprint } from "./fingerprint";
import { writeSaleRecords } from "./persistence";
import { buildSaleRecords } from "./records";
import { replaySale } from "./replay";
import { newSaleResponse } from "./response";
import type { ParsedSaleInput } from "./types";

export async function executeCreateSale(
  input: ParsedSaleInput,
): Promise<Record<string, unknown>> {
  const saleId = deterministicId(
    "sale",
    `${input.tenantId}:${input.idempotencyKey}`,
  );
  const requestFingerprint = saleRequestFingerprint(input);
  const saleRef = db.collection("sales").doc(saleId);

  return db.runTransaction(async (transaction) => {
    const existingSale = await transaction.get(saleRef);
    if (existingSale.exists) {
      return replaySale(
        transaction,
        existingSale.data() ?? {},
        input,
        requestFingerprint,
      );
    }

    const context = await loadBaseSaleContext(transaction, input);
    const preparedLines = prepareSaleLines(
      input.lines,
      context.productDocuments,
      input.tenantId,
    );
    assertDiscountPermission(preparedLines, context.staff.role);
    const totals = calculateSaleTotals(preparedLines, input.payments);
    assertAcceptedPayments(input.payments, context.settings);

    const timestamp = Timestamp.now();
    const dependencies = await loadSaleDependencies(
      transaction,
      input,
      preparedLines,
      timestamp,
    );
    const records = buildSaleRecords({
      saleId,
      requestFingerprint,
      input,
      context,
      preparedLines,
      totals,
      dependencies,
      timestamp,
    });
    writeSaleRecords({
      transaction,
      input,
      context,
      dependencies,
      records,
      timestamp,
    });

    return newSaleResponse(records, dependencies);
  });
}
