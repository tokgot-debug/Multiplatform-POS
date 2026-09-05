/**
 * Pure tender helpers shared by the outbox.
 *
 * Kept free of Dexie and Firebase imports so the money conversion can be
 * exercised in a plain node test.
 */

/** Dexie stores KES as floats; the backend settles in integer minor units. */
export function toMinor(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  // Round the scaled value off the string form so 19.99 * 100 does not land
  // on 1998.9999999999998 and truncate a cent away.
  return Math.round(Number((value * 100).toFixed(4)));
}

/** Local tender codes -> the methods the backend will accept. */
const PAYMENT_METHOD_MAP = {
  CASH: 'cash',
  CREDIT: 'credit',
  MPESA: 'mpesa',
  CARD: 'card',
  AIRTEL: 'airtel_money',
  AIRTEL_MONEY: 'airtel_money',
  BANK: 'bank_transfer',
  BANK_TRANSFER: 'bank_transfer'
};

/** Returns null for an unrecognised tender so the caller can hold the sale. */
export function mapPaymentMethod(method) {
  return PAYMENT_METHOD_MAP[String(method || '').toUpperCase()] || null;
}
