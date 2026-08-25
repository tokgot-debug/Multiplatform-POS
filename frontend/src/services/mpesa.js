/**
 * Safaricom M-Pesa Daraja API Integration Simulator
 * Simulates STK Push, C2B callback confirmations, and transaction queries.
 */

export class MpesaService {
  constructor() {
    this.pendingPayments = new Map();
  }

  /**
   * Triggers an STK Push (Lipa na M-Pesa Online) to a customer's phone.
   * Tendered phone numbers are validated to ensure compliance.
   */
  async initiateStkPush(phoneNumber, amount, accountRef) {
    // Validate phone number format (Kenyan formats: 07..., 01..., 254...)
    const numClean = phoneNumber.replace(/[\s\-\+]/g, '');
    const kenyaPhoneRegex = /^(?:254|0)?(7|1)\d{8}$/;
    
    if (!kenyaPhoneRegex.test(numClean)) {
      return {
        success: false,
        message: 'Invalid Kenyan phone number. Formats: 07XXXXXXXX or 2547XXXXXXXX.'
      };
    }

    // Format phone to 2547XXXXXXXX
    let formattedPhone = numClean;
    if (numClean.startsWith('0')) {
      formattedPhone = '254' + numClean.slice(1);
    } else if (!numClean.startsWith('254')) {
      formattedPhone = '254' + numClean;
    }

    const checkoutRequestId = `ws_CO_${new Date().getTime()}_${Math.floor(Math.random() * 9000 + 1000)}`;
    const merchantRequest = `mr_${Math.floor(Math.random() * 900000 + 100000)}`;
    
    // Store request state in pending mapping
    const pendingData = {
      phone: formattedPhone,
      amount,
      accountRef,
      checkoutRequestId,
      merchantRequest,
      status: 'PENDING',
      created_at: new Date().getTime()
    };
    this.pendingPayments.set(checkoutRequestId, pendingData);

    // Simulate Daraja instant response
    return {
      success: true,
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
      MerchantRequestID: merchantRequest,
      CheckoutRequestID: checkoutRequestId,
      CustomerMessage: 'Success. Please enter M-Pesa PIN on your phone.'
    };
  }

  /**
   * Simulates Safaricom's webhook callbacks.
   * Resolves the payment with a Success or Failure code.
   */
  async simulateCallback(checkoutRequestId, userWantsSuccess = true) {
    const payment = this.pendingPayments.get(checkoutRequestId);
    if (!payment) {
      return { success: false, message: 'Transaction ID not found.' };
    }

    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate user typing PIN on phone

    if (userWantsSuccess) {
      const mpesaReceipt = `QK${new Date().getTime().toString().slice(-4)}X${Math.floor(Math.random() * 90)}L${Math.floor(Math.random() * 90)}`;
      payment.status = 'SUCCESS';
      payment.mpesaReceipt = mpesaReceipt;
      payment.ResultCode = 0;
      payment.ResultDesc = 'The service request is processed successfully.';
      
      return {
        success: true,
        checkoutRequestId,
        mpesaReceipt,
        status: 'SUCCESS',
        amount: payment.amount,
        phone: payment.phone
      };
    } else {
      payment.status = 'FAILED';
      payment.ResultCode = 1032; // User cancelled transaction code
      payment.ResultDesc = 'Request cancelled by user.';
      
      return {
        success: false,
        checkoutRequestId,
        status: 'FAILED',
        errorCode: 1032,
        message: 'Request cancelled by user.'
      };
    }
  }

  /**
   * Check status of a payment ( Daraja Transaction Status Query )
   */
  async checkTransactionStatus(checkoutRequestId) {
    const payment = this.pendingPayments.get(checkoutRequestId);
    if (!payment) {
      return { success: false, message: 'Transaction not found.' };
    }

    // If still pending for more than 45 seconds, simulate a Safaricom timeout
    const elapsed = (new Date().getTime() - payment.created_at) / 1000;
    if (payment.status === 'PENDING' && elapsed > 45) {
      payment.status = 'TIMEOUT';
      payment.ResultCode = 1037;
      payment.ResultDesc = 'Transaction timed out.';
    }

    return {
      success: true,
      status: payment.status,
      mpesaReceipt: payment.mpesaReceipt || null,
      resultCode: payment.ResultCode || null,
      resultDesc: payment.ResultDesc || null
    };
  }
}
