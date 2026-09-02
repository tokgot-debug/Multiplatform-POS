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
  "credit",
  "mpesa",
  "card",
  "airtel_money",
  "bank_transfer",
]);

/**
 * Methods settled by an outside provider, which must therefore present a
 * verified payment_intents document before a sale can consume them.
 *
 * Cash is settled at the drawer and credit is a receivable on the books, so
 * neither has a provider reference to verify. dependencies.ts and records.ts
 * both walk the intent documents positionally, so they have to agree on this
 * predicate exactly - it lives here rather than being spelled out twice.
 */
export function needsProviderIntent(method: string): boolean {
  return method !== "cash" && method !== "credit";
}

export const TAX_BASIS_POINTS = {
  A: 1_600,
  B: 800,
  C: 0,
  E: 0,
} as const;

export type SupportedTaxCode = keyof typeof TAX_BASIS_POINTS;
