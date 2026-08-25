/**
 * eTIMS Integration Service (OSCU Client Simulator)
 * Bridges local client database operations with KRA eTIMS Sandbox endpoints.
 */

export class EtimsService {
  constructor(taxpayerPin, branchCode) {
    this.taxpayerPin = taxpayerPin || 'P051234567A';
    this.branchCode = branchCode || '00';
    this.controlUnitSerial = 'OSCU020004992';
  }

  /**
   * Helper to generate a realistic eTIMS invoice signature
   */
  generateSignature(saleUuid, grandTotal) {
    const raw = `${this.taxpayerPin}|${this.controlUnitSerial}|${saleUuid}|${grandTotal.toFixed(2)}`;
    // Simple mock signature hash representation
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return `KRA-OSCU-${Math.abs(hash).toString(16).toUpperCase()}-${new Date().getTime().toString().slice(-4)}`;
  }

  /**
   * Register a new item with eTIMS (mandatory before it can be sold)
   */
  async registerItem(product) {
    // Simulate KRA network latency
    await new Promise(resolve => setTimeout(resolve, 800));

    // Validation checks (eTIMS mandatory items)
    if (!product.item_cls_cd || product.item_cls_cd.length !== 8) {
      return {
        success: false,
        code: 'ERR_ITEM_CLASS_INVALID',
        message: 'eTIMS Item Classification Code must be exactly 8 digits.'
      };
    }

    if (!product.tax_code || !['A', 'B', 'C', 'E'].includes(product.tax_code)) {
      return {
        success: false,
        code: 'ERR_TAX_TYPE_INVALID',
        message: 'Invalid tax type code. Must be A (16%), B (8%), C (Exempt), or E (Zero-Rated).'
      };
    }

    return {
      success: true,
      code: '000',
      message: 'Item registered successfully in eTIMS ledger.',
      etims_item_code: `KE${product.sku}`,
      registered_at: new Date().toISOString()
    };
  }

  /**
   * Transmit a completed sale invoice to eTIMS
   */
  async transmitSale(sale, saleLines) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 900));

    // Validate Buyer KRA PIN if provided (must start with P followed by 9 digits and 1 letter)
    if (sale.buyer_pin) {
      const pinRegex = /^[A-Z]\d{9}[A-Z]$/i;
      if (!pinRegex.test(sale.buyer_pin)) {
        return {
          success: false,
          code: 'ERR_BUYER_PIN_MALFORMED',
          message: `Buyer KRA PIN '${sale.buyer_pin}' is invalid. Standard format: A000000000A.`
        };
      }
    }

    // Tax calculation validation checks
    let computedTax = 0;
    for (const line of saleLines) {
      let rate = 0.16;
      if (line.tax_code === 'B') rate = 0.08;
      else if (line.tax_code === 'C' || line.tax_code === 'E') rate = 0.00;
      
      const lineTax = (line.line_total - (line.line_total / (1 + rate)));
      computedTax += lineTax;
    }

    const totalDiff = Math.abs(computedTax - sale.tax_total);
    if (totalDiff > 1.00) {
      return {
        success: false,
        code: 'ERR_TAX_MATH_DIVERGENCE',
        message: 'Tax calculation total does not match client payload.'
      };
    }

    // Success response - OSCU local fiscal signature return
    const receiptSignature = this.generateSignature(sale.sale_uuid, sale.grand_total);
    const cuInvoiceNo = `KRA-${this.taxpayerPin}-${this.controlUnitSerial}-${new Date().getTime().toString().slice(-6)}`;
    
    // eTIMS Verification Link
    const qrPayload = `https://etims.kra.go.ke/query/verify?pin=${this.taxpayerPin}&cuNo=${cuInvoiceNo}&sig=${receiptSignature}&amt=${sale.grand_total.toFixed(2)}`;

    return {
      success: true,
      code: '000',
      message: 'Invoice successfully fiscalized.',
      cu_invoice_no: cuInvoiceNo,
      cu_serial: this.controlUnitSerial,
      receipt_signature: receiptSignature,
      qr_payload: qrPayload,
      internal_data: `OSCU_${new Date().getFullYear()}_TXN_${Math.floor(Math.random() * 100000)}`,
      confirmed_at: new Date().toISOString()
    };
  }

  /**
   * Submit Stock Adjustment / In / Out records (eTIMS stock ledger tracking)
   */
  async transmitStockMovement(movement, product) {
    await new Promise(resolve => setTimeout(resolve, 600));

    if (!product.etims_registered_at) {
      return {
        success: false,
        code: 'ERR_ITEM_UNREGISTERED',
        message: 'Cannot record stock movement. Product is not registered with eTIMS.'
      };
    }

    return {
      success: true,
      code: '000',
      message: 'eTIMS Stock movement reported successfully.',
      transmission_id: `STOCK-TXN-${crypto.randomUUID().slice(-8).toUpperCase()}`
    };
  }

  /**
   * Submit Purchase Invoicing (eTIMS trnsPurchaseSave) for 3-way matching Input VAT verification
   */
  async transmitPurchaseInvoice(supplier, po, grn, items) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!supplier.kra_pin) {
      return {
        success: false,
        code: 'ERR_SUPPLIER_PIN_MISSING',
        message: 'Cannot reconcile purchase with eTIMS. Supplier KRA PIN is missing.'
      };
    }

    return {
      success: true,
      code: '000',
      message: 'Purchase invoice reported and matched with supplier eTIMS declaration.',
      input_vat_matched: true,
      reconciliation_no: `KRA-RECON-${Math.floor(Math.random() * 900000 + 100000)}`
    };
  }
}
