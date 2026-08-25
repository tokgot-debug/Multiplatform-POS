export const MAX_DISTINCT_LINES = 50;
export const MAX_PAYMENTS = 5;
export const MAX_QTY_PER_LINE = 10_000;

export const SELLING_ROLES = new Set([
  "owner",
  "store_manager",
  "cashier",
  "bar_staff",
]);

export const DISCOUNT_ROLES = new Set(["owner", "store_manager"]);

export const PAYMENT_METHODS = new Set([
  "cash",
  "mpesa",
  "card",
  "airtel_money",
  "bank_transfer",
]);

export const TAX_BASIS_POINTS = {
  A: 1_600,
  B: 800,
  C: 0,
  E: 0,
} as const;

export type SupportedTaxCode = keyof typeof TAX_BASIS_POINTS;
