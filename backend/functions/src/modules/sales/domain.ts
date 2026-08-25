import type { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import { inclusiveTax, safeSum } from "../../shared/money";
import { minorUnits } from "../../shared/validation";
import {
  DISCOUNT_ROLES,
  TAX_BASIS_POINTS,
  type SupportedTaxCode,
} from "./constants";
import type {
  InputLine,
  InputPayment,
  PreparedLine,
  SaleTotals,
} from "./types";

function supportedTaxCode(value: unknown, productId: string): SupportedTaxCode {
  if (
    typeof value !== "string"
    || !Object.prototype.hasOwnProperty.call(TAX_BASIS_POINTS, value)
  ) {
    throw new HttpsError(
      "failed-precondition",
      `Product ${productId} does not have a supported tax code.`,
    );
  }

  return value as SupportedTaxCode;
}

export function prepareSaleLines(
  requestedLines: readonly InputLine[],
  productDocuments: readonly DocumentSnapshot<DocumentData>[],
  tenantId: string,
): PreparedLine[] {
  return productDocuments.map((snapshot, index) => {
    const requested = requestedLines[index];
    const product = snapshot.data() ?? {};
    if (
      !snapshot.exists
      || product.tenantId !== tenantId
      || product.isActive !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        `Product ${requested.productId} is not active for this tenant.`,
      );
    }

    const unitPriceMinor = minorUnits(
      product.sellPriceMinor,
      `${requested.productId}.sellPriceMinor`,
    );
    const lineSubtotal = unitPriceMinor * requested.qty;
    if (!Number.isSafeInteger(lineSubtotal) || requested.discountMinor > lineSubtotal) {
      throw new HttpsError(
        "invalid-argument",
        `The discount or total for ${requested.productId} is invalid.`,
      );
    }

    const lineTotalMinor = lineSubtotal - requested.discountMinor;
    const taxCode = supportedTaxCode(product.taxCode, requested.productId);
    return {
      productId: requested.productId,
      sku: typeof product.sku === "string" ? product.sku : "",
      productName: typeof product.name === "string" ? product.name : "",
      qty: requested.qty,
      unitPriceMinor,
      discountMinor: requested.discountMinor,
      taxCode,
      taxMinor: inclusiveTax(lineTotalMinor, TAX_BASIS_POINTS[taxCode]),
      lineTotalMinor,
      isService: product.isService === true,
    };
  });
}

export function calculateSaleTotals(
  lines: readonly PreparedLine[],
  payments: readonly InputPayment[],
): SaleTotals {
  const subtotalMinor = safeSum(
    lines.map((line) => line.unitPriceMinor * line.qty),
    "subtotalMinor",
  );
  const discountMinor = safeSum(
    lines.map((line) => line.discountMinor),
    "discountMinor",
  );
  const taxMinor = safeSum(lines.map((line) => line.taxMinor), "taxMinor");
  const totalMinor = subtotalMinor - discountMinor;
  const paymentTotalMinor = safeSum(
    payments.map((payment) => payment.amountMinor),
    "payment total",
  );
  if (paymentTotalMinor !== totalMinor) {
    throw new HttpsError(
      "invalid-argument",
      "Payment amounts must exactly equal the sale total.",
    );
  }

  return { subtotalMinor, discountMinor, taxMinor, totalMinor };
}

export function assertDiscountPermission(
  lines: readonly PreparedLine[],
  staffRole: unknown,
): void {
  if (
    lines.some((line) => line.discountMinor > 0)
    && !DISCOUNT_ROLES.has(String(staffRole))
  ) {
    throw new HttpsError(
      "permission-denied",
      "This staff role cannot apply checkout discounts.",
    );
  }
}

export function assertAcceptedPayments(
  payments: readonly InputPayment[],
  settings: DocumentData,
): void {
  const acceptedMethods = Array.isArray(settings.acceptedPaymentMethods)
    ? settings.acceptedPaymentMethods
    : [];

  for (const payment of payments) {
    if (
      !acceptedMethods.includes(payment.method)
      || (payment.method === "cash" && settings.cashEnabled !== true)
    ) {
      throw new HttpsError(
        "failed-precondition",
        `${payment.method} is not enabled for this tenant.`,
      );
    }
  }
}
