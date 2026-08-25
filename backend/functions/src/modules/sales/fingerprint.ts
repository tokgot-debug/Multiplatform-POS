import { createHash } from "node:crypto";

import type { ParsedSaleInput } from "./types";

type FingerprintLine = Pick<
  ParsedSaleInput["lines"][number],
  "productId" | "qty" | "discountMinor"
>;

type FingerprintPayment = Pick<
  ParsedSaleInput["payments"][number],
  "method" | "amountMinor" | "reference"
>;

export type SaleFingerprintInput = Omit<ParsedSaleInput, "lines" | "payments"> & {
  lines: FingerprintLine[];
  payments: FingerprintPayment[];
};

export function saleRequestFingerprint(input: SaleFingerprintInput): string {
  return createHash("sha256")
    .update(JSON.stringify({
      tenantId: input.tenantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      shiftId: input.shiftId,
      staffId: input.staffId,
      customerId: input.customerId,
      idempotencyKey: input.idempotencyKey,
      tableNumber: input.tableNumber,
      buyerKraPin: input.buyerKraPin,
      lines: input.lines,
      payments: input.payments,
    }))
    .digest("hex");
}
