import { db } from '../db/schema';
import { EtimsService } from './etims';
import { callFunction, firebaseConfigured, hasTenantSession, TENANT_ID } from './firebase';
import { mapPaymentMethod, toMinor } from './tender';

/**
 * Set VITE_DEMO_FISCAL=1 to drain the outbox through the bundled eTIMS
 * simulator instead of the real backend. The simulator invents KRA signatures,
 * so anything it produces is recorded as SIMULATED and must never be shown to a
 * taxpayer as proof of fiscalisation.
 */
const DEMO_FISCAL = import.meta.env.VITE_DEMO_FISCAL === '1';

export class SyncManager {
  constructor() {
    this.etims = new EtimsService();
    this.isSyncing = false;
    this.connectionStatus = 'ONLINE'; // 'ONLINE' or 'OFFLINE'
    this.onStatusChange = null; // Callback for UI state binding
    this.schedulerId = null;
  }

  setConnectionStatus(status) {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      if (this.onStatusChange) {
        this.onStatusChange(this.connectionStatus, 0);
      }
    }
  }

  /**
   * Builds the createSale payload for a locally recorded sale.
   * Returns null when the sale is missing something the backend requires, so
   * the row stays queued rather than being rejected in a loop.
   */
  async buildSalePayload(sale) {
    const lines = await db.sale_lines.where('sale_id').equals(sale.id).toArray();
    const payments = await db.payments.where('sale_id').equals(sale.id).toArray();
    if (lines.length === 0 || payments.length === 0) return null;

    const mappedPayments = [];
    for (const p of payments) {
      const method = mapPaymentMethod(p.method);
      if (!method) return null; // unknown tender: needs a human, not a retry
      mappedPayments.push({
        method,
        amountMinor: toMinor(p.amount),
        reference: p.reference || undefined
      });
    }

    if (!sale.customer_id || !sale.shift_id || !sale.device_id) return null;

    return {
      tenantId: sale.tenant_id || TENANT_ID,
      branchId: sale.branch_id,
      deviceId: sale.device_id,
      shiftId: sale.shift_id,
      staffId: sale.created_by || sale.staff_id || null,
      customerId: sale.customer_id,
      idempotencyKey: sale.sale_uuid,
      tableNumber: sale.table_no || undefined,
      buyerKraPin: sale.buyer_pin || undefined,
      lines: lines.map(l => ({
        productId: l.product_id,
        qty: l.qty,
        discountMinor: toMinor(l.discount)
      })),
      payments: mappedPayments
    };
  }

  /**
   * Drains locally queued sales to the trusted backend.
   *
   * A sale is only marked synced when the server confirms it. Anything else
   * leaves the row queued and visible in the sidebar counter - the till never
   * claims a sale reached KRA when it did not.
   */
  async syncOutbox() {
    if (this.isSyncing) return;
    if (this.connectionStatus === 'OFFLINE') return;

    this.isSyncing = true;

    try {
      const unsyncedSales = await db.sales
        .filter(s => s.synced_at === undefined || s.synced_at === null)
        .toArray();

      if (this.onStatusChange) {
        this.onStatusChange(this.connectionStatus, unsyncedSales.length);
      }
      if (unsyncedSales.length === 0) return;

      // No backend reachable: hold the queue. This is the normal state on a
      // till that has not been enrolled yet, so it is not an error.
      const canTransmit = DEMO_FISCAL || (firebaseConfigured && await hasTenantSession());
      if (!canTransmit) return;

      for (const sale of unsyncedSales) {
        if (this.connectionStatus === 'OFFLINE') break;
        await this.transmitSale(sale);
      }
    } catch (err) {
      console.error('Error during synchronization outbox:', err);
    } finally {
      this.isSyncing = false;
      const remaining = await db.sales
        .filter(s => s.synced_at === undefined || s.synced_at === null)
        .count();
      if (this.onStatusChange) {
        this.onStatusChange(this.connectionStatus, remaining);
      }
    }
  }

  async transmitSale(sale) {
    const payload = await this.buildSalePayload(sale);
    if (!payload) {
      await db.sales.update(sale.id, {
        fiscal_status: 'NEEDS_REVIEW',
        sync_error_msg: 'Sale is incomplete and cannot be submitted automatically.'
      });
      return;
    }

    if (DEMO_FISCAL) {
      await this.transmitSimulated(sale);
      return;
    }

    try {
      const result = await callFunction('createSale', payload);
      await db.transaction('rw', [db.sales, db.fiscal_records], async () => {
        await db.sales.update(sale.id, {
          synced_at: new Date().toISOString(),
          // The backend owns fiscal state; it starts pending until an eTIMS
          // worker confirms, so we do not invent FISCALIZED here.
          fiscal_status: (result && result.sale && result.sale.fiscalStatus) || 'PENDING',
          server_sale_id: result && result.sale ? result.sale.id : null,
          server_invoice_no: result && result.sale ? result.sale.invoiceNumber : null,
          sync_error_msg: null
        });
        if (result && result.sale && result.sale.invoiceNumber) {
          await db.fiscal_records.put({
            id: `srv-${sale.id}`,
            sale_id: sale.id,
            cu_invoice_no: result.sale.invoiceNumber,
            result_code: 'ACCEPTED',
            result_msg: result.replayed ? 'Idempotent replay of an existing sale.' : 'Accepted by backend.',
            submitted_at: sale.sold_at,
            confirmed_at: new Date().toISOString(),
            attempt_count: 1
          });
        }
      });
    } catch (err) {
      const permanent = err && typeof err.code === 'string'
        && /invalid-argument|permission-denied|failed-precondition/.test(err.code);
      await db.sales.update(sale.id, {
        fiscal_status: permanent ? 'TERMINAL_ERROR' : 'QUEUED',
        sync_error_msg: (err && err.message) || String(err)
      });
      if (!permanent) throw err; // stop the run; retry on the next tick
    }
  }

  /** Demo-only path. Everything it writes is labelled SIMULATED. */
  async transmitSimulated(sale) {
    const lines = await db.sale_lines.where('sale_id').equals(sale.id).toArray();
    const result = await this.etims.transmitSale(sale, lines);

    if (!result.success) {
      await db.sales.update(sale.id, {
        fiscal_status: 'TERMINAL_ERROR',
        sync_error_msg: result.message
      });
      return;
    }

    await db.transaction('rw', [db.sales, db.fiscal_records], async () => {
      await db.sales.update(sale.id, {
        synced_at: new Date().toISOString(),
        fiscal_status: 'SIMULATED'
      });
      await db.fiscal_records.put({
        id: `sim-${sale.id}`,
        sale_id: sale.id,
        cu_invoice_no: result.cu_invoice_no,
        cu_serial: result.cu_serial,
        receipt_signature: result.receipt_signature,
        internal_data: result.internal_data,
        qr_payload: result.qr_payload,
        result_code: 'SIMULATED',
        result_msg: 'DEMO ONLY - not submitted to KRA.',
        submitted_at: sale.sold_at,
        confirmed_at: result.confirmed_at,
        attempt_count: 1
      });
    });
  }

  startSyncScheduler() {
    if (this.schedulerId) return;
    this.schedulerId = setInterval(() => {
      this.syncOutbox().catch(() => {});
    }, 10000);
  }

  stopSyncScheduler() {
    if (this.schedulerId) clearInterval(this.schedulerId);
    this.schedulerId = null;
  }
}
