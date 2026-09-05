import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

import { FUNCTION_REGION } from "../../config/runtime";
import { db } from "../../lib/firebase";
import { deterministicId } from "../../shared/identifiers";
import { asRecord, minorUnits } from "../../shared/validation";
import {
  MPESA_SECRETS,
  normalizePhone,
  parseStkCallback,
  stkPush,
  stkQuery,
} from "./daraja";

/** Verified tenant and staff, or an error. Both callables need exactly this. */
function callerClaims(auth: { token: Record<string, unknown> } | undefined) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Start a till session first.");
  }

  const tenantId = typeof auth.token.tenant_id === "string" ? auth.token.tenant_id : null;
  const staffId = typeof auth.token.staff_id === "string" ? auth.token.staff_id : null;
  if (!tenantId || !staffId) {
    throw new HttpsError("permission-denied", "This session carries no staff claims.");
  }

  return { tenantId, staffId };
}

const PAYMENTS = "mpesa_payments";
// createSale will not accept an M-Pesa payment without a verified intent under
// this exact id, so settling a push has to write one in the same transaction.
const INTENTS = "payment_intents";
// Callbacks we cannot match to a push we sent are parked here rather than
// dropped. A payment Safaricom has already taken from a customer must never
// vanish because our own record was missing.
const UNMATCHED = "mpesa_unmatched";

/**
 * Records the settled push as a payment intent createSale can spend.
 *
 * The till puts the receipt number (falling back to the checkout request id)
 * in the payment's reference, so the intent is keyed on the same value or the
 * lookup misses and the sale is refused. Written inside the caller's
 * transaction so a paid payment and its spendable intent land together.
 */
function writeIntent(
  transaction: FirebaseFirestore.Transaction,
  input: { tenantId: string; reference: string; amountMinor: number; providerTransactionId: string },
) {
  const id = deterministicId("intent", `${input.tenantId}:${input.reference}`);
  transaction.set(db.collection(INTENTS).doc(id), {
    tenantId: input.tenantId,
    method: "mpesa",
    amountMinor: input.amountMinor,
    reference: input.reference,
    providerTransactionId: input.providerTransactionId,
    status: "verified",
    // createSale stamps this when it spends the intent; a truthy value here
    // is what stops one receipt funding two sales.
    consumedSaleId: null,
    createdAt: Timestamp.now(),
  });
}

/**
 * Sends an STK push for the amount on the till and records it as pending.
 *
 * The staff and tenant come from verified claims, never the request body, so a
 * till cannot raise a charge in another tenant's name. The client watches the
 * mpesa_payments document for the result; the callback below writes it.
 */
export const initiateMpesaStk = onCall(
  { region: FUNCTION_REGION, secrets: MPESA_SECRETS },
  async (request) => {
    const { tenantId, staffId } = callerClaims(request.auth);

    const input = asRecord(request.data, "Request data");
    const phone = normalizePhone(input.phone);
    const amountMinor = minorUnits(input.amountMinor, "amountMinor", false);
    if (amountMinor % 100 !== 0) {
      throw new HttpsError("invalid-argument", "M-Pesa only charges whole shillings.");
    }

    // On a shared shortcode the account reference is the only thing that routes
    // the money to this merchant, so it comes from the tenant record the server
    // owns, never from the till. A client-supplied reference would let one
    // tenant collect into another tenant's account.
    const tenant = await db.collection("tenants").doc(tenantId).get();
    const reference = tenant.get("mpesaAccountReference");
    if (typeof reference !== "string" || reference.length === 0 || reference.length > 12) {
      throw new HttpsError(
        "failed-precondition",
        "This tenant has no M-Pesa account reference. Set tenants/"
          + `${tenantId}.mpesaAccountReference to the account number issued for the shortcode.`,
      );
    }

    const result = await stkPush({
      phone,
      amountKes: amountMinor / 100,
      accountReference: reference,
      description: `POS ${reference}`,
    });

    await db.collection(PAYMENTS).doc(result.checkoutRequestId).set({
      checkoutRequestId: result.checkoutRequestId,
      merchantRequestId: result.merchantRequestId,
      tenantId,
      staffId,
      phone,
      amountMinor,
      reference,
      status: "pending",
      receipt: null,
      resultCode: null,
      resultDesc: null,
      requestedAt: Timestamp.now(),
      completedAt: null,
    });

    return {
      checkoutRequestId: result.checkoutRequestId,
      customerMessage: result.customerMessage,
    };
  },
);

/**
 * Asks Safaricom directly what happened to a push whose callback never arrived.
 *
 * Without this a lost callback strands the payment as pending forever, and the
 * cashier is left guessing in front of the customer. Safe to call repeatedly:
 * it settles the record only while it is still pending, so it can never
 * overwrite a result the callback already delivered.
 */
export const queryMpesaStatus = onCall(
  { region: FUNCTION_REGION, secrets: MPESA_SECRETS },
  async (request) => {
    const { tenantId } = callerClaims(request.auth);

    const input = asRecord(request.data, "Request data");
    const checkoutRequestId = typeof input.checkoutRequestId === "string"
      ? input.checkoutRequestId
      : "";
    if (checkoutRequestId.length === 0 || checkoutRequestId.length > 128) {
      throw new HttpsError("invalid-argument", "checkoutRequestId is required.");
    }

    const reference = db.collection(PAYMENTS).doc(checkoutRequestId);
    const snapshot = await reference.get();
    const record = snapshot.data();
    if (!snapshot.exists || record?.tenantId !== tenantId) {
      throw new HttpsError("not-found", "No such M-Pesa payment for this tenant.");
    }

    if (record.status !== "pending") {
      return { status: record.status, receipt: record.receipt ?? null };
    }

    const result = await stkQuery(checkoutRequestId);
    if (!result) return { status: "pending", receipt: null };

    const paid = result.resultCode === 0;

    // Re-read inside the transaction: the callback may have landed while the
    // query was in flight, and it is the better source of truth.
    return db.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      const data = current.data();
      if (data?.status !== "pending") {
        return { status: data?.status ?? "pending", receipt: data?.receipt ?? null };
      }

      transaction.update(reference, {
        status: paid ? "paid" : "failed",
        resultCode: result.resultCode,
        resultDesc: result.resultDesc,
        // The query endpoint never returns a receipt number, so a payment
        // settled this way has none unless the callback later lands.
        reconciledBy: "query",
        completedAt: Timestamp.now(),
      });

      if (paid) {
        // No receipt from this endpoint, so the intent is keyed on the checkout
        // request id - which is exactly what the till falls back to.
        writeIntent(transaction, {
          tenantId,
          reference: checkoutRequestId,
          amountMinor: Number(data?.amountMinor),
          providerTransactionId: checkoutRequestId,
        });
      }

      return { status: paid ? "paid" : "failed", receipt: null };
    });
  },
);

/**
 * Receives the STK result from Safaricom.
 *
 * Public and unauthenticated because Safaricom cannot present a credential, so
 * a callback is treated as a claim rather than proof: it is only applied to a
 * push this backend actually sent, for the exact amount that push asked for.
 * Anything else is parked in mpesa_unmatched for a human.
 *
 * ponytail: no Safaricom IP allowlist and no STK Query confirmation. Add the
 * query reconciliation if a forged callback for a matching amount is ever worth
 * the round trip.
 */
export const mpesaCallback = onRequest(
  { cors: false, region: FUNCTION_REGION, secrets: MPESA_SECRETS },
  async (request, response) => {
    // Safaricom retries anything that is not a fast 200, so every path that has
    // durably stored the result answers 0/Accepted. Only a failed write throws.
    const accept = () => response.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    if (request.method !== "POST") {
      response.set("Allow", "POST");
      response.status(405).json({ ResultCode: 1, ResultDesc: "Method not allowed" });
      return;
    }

    const callback = parseStkCallback(request.body);
    if (!callback) {
      // Retrying an unreadable body changes nothing, so stop the retries.
      logger.error("Unreadable M-Pesa callback", { body: request.body });
      accept();
      return;
    }

    const paid = callback.resultCode === 0;
    const reference = db.collection(PAYMENTS).doc(callback.checkoutRequestId);

    try {
      const quarantined = await db.runTransaction(async (transaction) => {
        const pending = await transaction.get(reference);
        const record = pending.data();

        const mismatched = paid
          && callback.amountMinor !== null
          && record?.amountMinor !== callback.amountMinor;

        if (!pending.exists || mismatched) {
          transaction.set(db.collection(UNMATCHED).doc(callback.checkoutRequestId), {
            reason: pending.exists ? "amount_mismatch" : "unknown_checkout_request",
            expectedAmountMinor: record?.amountMinor ?? null,
            callback,
            receivedAt: Timestamp.now(),
          });
          return true;
        }

        // Safaricom re-sends a delivered callback. Settle once.
        if (record?.status === "pending") {
          transaction.update(reference, {
            status: paid ? "paid" : "failed",
            receipt: callback.receipt,
            resultCode: callback.resultCode,
            resultDesc: callback.resultDesc,
            completedAt: Timestamp.now(),
          });

          if (paid) {
            writeIntent(transaction, {
              tenantId: String(record.tenantId),
              reference: callback.receipt ?? callback.checkoutRequestId,
              amountMinor: Number(record.amountMinor),
              providerTransactionId: callback.receipt ?? callback.checkoutRequestId,
            });
          }
        }

        return false;
      });

      if (quarantined) {
        logger.error("M-Pesa callback quarantined", { checkoutRequestId: callback.checkoutRequestId });
      }

      accept();
    } catch (error) {
      // Let Safaricom retry: the result is not stored anywhere yet.
      logger.error("M-Pesa callback write failed", error);
      response.status(500).json({ ResultCode: 1, ResultDesc: "Retry" });
    }
  },
);
