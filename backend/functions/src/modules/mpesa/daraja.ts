/**
 * Safaricom Daraja wire helpers.
 *
 * Everything that speaks to Safaricom lives here so the triggers in index.ts
 * stay about auth, storage, and idempotency. The pure helpers take their inputs
 * as arguments (never off a secret) so they can be tested without a runtime.
 */

import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError } from "firebase-functions/v2/https";

// Sandbox is https://sandbox.safaricom.co.ke, production is
// https://api.safaricom.co.ke. Held as a secret purely so one mechanism sets
// every M-Pesa value; flipping sandbox to live is a set + redeploy, not a diff.
export const MPESA_BASE_URL = defineSecret("MPESA_BASE_URL");
export const MPESA_CONSUMER_KEY = defineSecret("MPESA_CONSUMER_KEY");
export const MPESA_CONSUMER_SECRET = defineSecret("MPESA_CONSUMER_SECRET");
export const MPESA_SHORTCODE = defineSecret("MPESA_SHORTCODE");
export const MPESA_PASSKEY = defineSecret("MPESA_PASSKEY");
export const MPESA_CALLBACK_URL = defineSecret("MPESA_CALLBACK_URL");

export const MPESA_SECRETS = [
  MPESA_BASE_URL,
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
];

const KENYAN_MSISDN = /^(?:254|0)?([17]\d{8})$/;

export interface StkCallback {
  checkoutRequestId: string;
  merchantRequestId: string | null;
  resultCode: number;
  resultDesc: string;
  receipt: string | null;
  amountMinor: number | null;
  phone: string | null;
}

/** Safaricom only accepts 2547XXXXXXXX / 2541XXXXXXXX on the wire. */
export function normalizePhone(raw: unknown): string {
  const digits = typeof raw === "string" ? raw.replace(/[\s+()-]/g, "") : "";
  const match = KENYAN_MSISDN.exec(digits);
  if (!match) {
    throw new HttpsError(
      "invalid-argument",
      "Enter the number as 07XXXXXXXX, 01XXXXXXXX, or 2547XXXXXXXX.",
    );
  }

  return `254${match[1]}`;
}

/**
 * Daraja stamps are Nairobi local time (UTC+3, no DST). The STK password is
 * built from this exact string, so both must come from one call or Safaricom
 * rejects the request as a bad password rather than a bad clock.
 */
export function darajaTimestamp(now: Date): string {
  const nairobi = new Date(now.getTime() + 3 * 60 * 60 * 1_000);
  return nairobi.toISOString().slice(0, 19).replace(/[-:T]/g, "");
}

export function stkPassword(
  shortcode: string,
  passkey: string,
  timestamp: string,
): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

/**
 * Reads the STK result Safaricom POSTs to the callback URL.
 *
 * A cancelled or failed push carries no CallbackMetadata at all, so anything
 * that reaches for the receipt before checking ResultCode crashes on every
 * declined payment. Returns null when the body is not an STK callback.
 */
export function parseStkCallback(body: unknown): StkCallback | null {
  const callback = (body as Record<string, any>)?.Body?.stkCallback;
  if (typeof callback !== "object" || callback === null) return null;
  if (typeof callback.CheckoutRequestID !== "string") return null;
  if (typeof callback.ResultCode !== "number") return null;

  const items: unknown[] = Array.isArray(callback.CallbackMetadata?.Item)
    ? callback.CallbackMetadata.Item
    : [];
  const item = (name: string): unknown =>
    (items as Record<string, unknown>[]).find((entry) => entry?.Name === name)?.Value;

  const amount = item("Amount");
  const phone = item("PhoneNumber");
  const receipt = item("MpesaReceiptNumber");

  return {
    checkoutRequestId: callback.CheckoutRequestID,
    merchantRequestId: typeof callback.MerchantRequestID === "string"
      ? callback.MerchantRequestID
      : null,
    resultCode: callback.ResultCode,
    resultDesc: typeof callback.ResultDesc === "string" ? callback.ResultDesc : "",
    receipt: typeof receipt === "string" ? receipt : null,
    // Daraja quotes whole shillings; the ledger is in cents throughout.
    amountMinor: typeof amount === "number" ? Math.round(amount * 100) : null,
    phone: phone === undefined || phone === null ? null : String(phone),
  };
}

async function darajaFetch(
  path: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const url = `${MPESA_BASE_URL.value()}${path}`;
  // Without a deadline a stalled Safaricom connection holds the instance until
  // the function times out, and the cashier is left staring at a spinner.
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const text = await response.text();

  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!response.ok || typeof payload !== "object" || payload === null) {
    logger.error("Daraja call failed", { path, status: response.status, body: text.slice(0, 500) });
    throw new HttpsError("unavailable", "M-Pesa is not responding. Take the payment another way.");
  }

  return payload as Record<string, unknown>;
}

// Daraja tokens live 3599s. Caching per warm instance keeps the customer from
// waiting on two round trips instead of one.
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function darajaToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const basic = Buffer.from(
    `${MPESA_CONSUMER_KEY.value()}:${MPESA_CONSUMER_SECRET.value()}`,
  ).toString("base64");
  const payload = await darajaFetch("/oauth/v1/generate?grant_type=client_credentials", {
    headers: { Authorization: `Basic ${basic}` },
  });

  const token = payload.access_token;
  if (typeof token !== "string" || token.length === 0) {
    throw new HttpsError("unavailable", "M-Pesa returned no access token.");
  }

  const ttlSeconds = Number(payload.expires_in);
  cachedToken = {
    value: token,
    expiresAt: Date.now()
      + (Number.isFinite(ttlSeconds) ? ttlSeconds : 3_599) * 1_000
      - 60_000,
  };

  return token;
}

/**
 * Reads a ResultCode, which the callback sends as a number and the query
 * endpoint as a string.
 *
 * Returns null for anything unreadable. This must never fall back to a bare
 * Number() cast: Number("") and Number(null) are both 0, and 0 is the code for
 * a successful payment, so an empty field would settle an unpaid sale as paid.
 */
export function parseResultCode(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Asks Safaricom what actually happened to a push.
 *
 * This is the reconciliation path for a callback that never arrived. Returns
 * null while Safaricom still reports the transaction as in flight, so a slow
 * customer is never recorded as a failure.
 */
export async function stkQuery(checkoutRequestId: string): Promise<{
  resultCode: number;
  resultDesc: string;
} | null> {
  const shortcode = MPESA_SHORTCODE.value();
  const timestamp = darajaTimestamp(new Date());

  const response = await fetch(`${MPESA_BASE_URL.value()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await darajaToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: stkPassword(shortcode, MPESA_PASSKEY.value(), timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  // Safaricom answers 500 with errorCode 500.001.1001 while the customer still
  // has the PIN prompt open. That is "not yet", not a failure.
  if (!response.ok || payload === null) {
    logger.info("STK query still in flight", {
      checkoutRequestId,
      status: response.status,
      body: text.slice(0, 300),
    });
    return null;
  }

  const resultCode = parseResultCode(payload.ResultCode);
  if (resultCode === null) return null;

  return { resultCode, resultDesc: String(payload.ResultDesc ?? "") };
}

export interface StkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
}

export async function stkPush(input: {
  phone: string;
  amountKes: number;
  accountReference: string;
  description: string;
}): Promise<StkPushResult> {
  const shortcode = MPESA_SHORTCODE.value();
  const timestamp = darajaTimestamp(new Date());

  const payload = await darajaFetch("/mpesa/stkpush/v1/processrequest", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await darajaToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: stkPassword(shortcode, MPESA_PASSKEY.value(), timestamp),
      Timestamp: timestamp,
      // 4567483 is a Paybill (confirmed on the organisation portal), so PartyB
      // is the same shortcode. A Buy Goods till would instead need
      // CustomerBuyGoodsOnline, PartyB set to the till, and BusinessShortCode
      // left as the head-office number.
      TransactionType: "CustomerPayBillOnline",
      Amount: input.amountKes,
      PartyA: input.phone,
      PartyB: shortcode,
      PhoneNumber: input.phone,
      // Sent per request, never left to a portal default, so a redeploy moves
      // every new transaction to the new endpoint at once.
      CallBackURL: MPESA_CALLBACK_URL.value(),
      AccountReference: input.accountReference,
      TransactionDesc: input.description,
    }),
  });

  if (payload.ResponseCode !== "0" || typeof payload.CheckoutRequestID !== "string") {
    logger.error("STK push refused", payload);
    throw new HttpsError(
      "unavailable",
      typeof payload.errorMessage === "string"
        ? payload.errorMessage
        : "M-Pesa refused the payment request.",
    );
  }

  return {
    checkoutRequestId: payload.CheckoutRequestID,
    merchantRequestId: String(payload.MerchantRequestID ?? ""),
    customerMessage: String(payload.CustomerMessage ?? "Enter your M-Pesa PIN on the phone."),
  };
}
