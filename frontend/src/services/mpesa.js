/**
 * M-Pesa STK push for the till.
 *
 * The push is raised by the backend, which holds the Daraja credentials, and
 * the result arrives on the mpesa_payments document that Safaricom's callback
 * writes. The till never decides for itself whether a customer paid - it only
 * ever reports what the backend has confirmed.
 */

import { callFunction, getFirebase } from './firebase';
import { toMinor } from './tender';

/** Safaricom gives the customer about a minute at the PIN prompt. */
const WAIT_MS = 90_000;

export class MpesaService {
  /**
   * Raises the push. The account reference is chosen server-side from the
   * tenant record, so the till cannot direct a payment to another merchant.
   */
  async initiateStkPush(phone, amountKes) {
    const amountMinor = toMinor(amountKes);
    if (amountMinor <= 0) {
      return { success: false, message: 'Enter an amount greater than zero.' };
    }
    if (amountMinor % 100 !== 0) {
      return { success: false, message: 'M-Pesa only charges whole shillings.' };
    }

    try {
      const data = await callFunction('initiateMpesaStk', { phone, amountMinor });
      return {
        success: true,
        checkoutRequestId: data.checkoutRequestId,
        customerMessage: data.customerMessage
      };
    } catch (error) {
      return { success: false, message: error.message || 'M-Pesa request failed.' };
    }
  }

  /**
   * Resolves once the payment is settled one way or the other.
   *
   * Returns status 'paid', 'failed', or 'pending'. Pending means nobody knows
   * yet - never treat it as either outcome.
   */
  async awaitResult(checkoutRequestId, onStatus) {
    const fb = await getFirebase();
    if (!fb) throw new Error('Firebase is not configured on this till.');

    const reference = fb.firestore.doc(fb.dbInstance, 'mpesa_payments', checkoutRequestId);

    const settled = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        stop();
        resolve(null);
      }, WAIT_MS);

      const stop = fb.firestore.onSnapshot(
        reference,
        (snapshot) => {
          const data = snapshot.data();
          if (!data || data.status === 'pending') return;
          clearTimeout(timer);
          stop();
          resolve(data);
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        }
      );
    });

    if (settled) {
      return {
        status: settled.status,
        receipt: settled.receipt || null,
        resultDesc: settled.resultDesc || ''
      };
    }

    // No callback inside the window. Ask Safaricom directly rather than
    // guessing: this is the case that would otherwise strand a real payment.
    if (onStatus) onStatus('Confirming with Safaricom...');
    const queried = await callFunction('queryMpesaStatus', { checkoutRequestId });
    return {
      status: queried.status,
      receipt: queried.receipt || null,
      resultDesc: ''
    };
  }
}
