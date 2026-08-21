import { db } from '../db/schema';
import { EtimsService } from './etims';

export class SyncManager {
  constructor() {
    this.etims = new EtimsService();
    this.isSyncing = false;
    this.connectionStatus = 'ONLINE'; // 'ONLINE' or 'OFFLINE'
    this.onStatusChange = null; // Callback for UI state binding
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
   * Scans IndexedDB for unsynced sales and stock movements,
   * then drains the outbox queue in order.
   */
  async syncOutbox() {
    if (this.isSyncing) return;
    if (this.connectionStatus === 'OFFLINE') return;

    this.isSyncing = true;
    let syncedCount = 0;

    try {
      // 1. Query all unsynced sales (status = 'COMPLETED', synced_at = null)
      const unsyncedSales = await db.sales
        .filter(s => s.synced_at === undefined || s.synced_at === null)
        .toArray();

      if (this.onStatusChange) {
        this.onStatusChange(this.connectionStatus, unsyncedSales.length);
      }

      for (const sale of unsyncedSales) {
        if (this.connectionStatus === 'OFFLINE') break;

        // Fetch corresponding sale lines
        const lines = await db.sale_lines
          .where('sale_id')
          .equals(sale.id)
          .toArray();

        // Send to eTIMS service simulator (Idempotency check: server rejects duplicates by sale_uuid)
        const result = await this.etims.transmitSale(sale, lines);

        if (result.success) {
          await db.transaction('rw', [db.sales, db.fiscal_records], async () => {
            // Update sale with confirmed state
            await db.sales.update(sale.id, {
              synced_at: new Date().toISOString(),
              fiscal_status: 'FISCALIZED'
            });

            // Write eTIMS fiscal response record
            await db.fiscal_records.add({
              id: crypto.randomUUID(),
              sale_id: sale.id,
              cu_invoice_no: result.cu_invoice_no,
              cu_serial: result.cu_serial,
              receipt_signature: result.receipt_signature,
              internal_data: result.internal_data,
              qr_payload: result.qr_payload,
              result_code: result.code,
              result_msg: result.message,
              submitted_at: sale.sold_at,
              confirmed_at: result.confirmed_at,
              attempt_count: 1
            });
          });
          syncedCount++;
        } else {
          // Store terminal error code, or trigger warning state
          await db.sales.update(sale.id, {
            fiscal_status: 'TERMINAL_ERROR',
            sync_error_msg: result.message
          });
        }
      }

      // 2. Query and sync unsynced stock movements (eTIMS stock ledger tracking)
      const unsyncedMovements = await db.stock_movements
        .filter(m => m.synced_at === undefined || m.synced_at === null)
        .toArray();

      for (const mov of unsyncedMovements) {
        if (this.connectionStatus === 'OFFLINE') break;

        const product = await db.products.get(mov.product_id);
        if (product) {
          const res = await this.etims.transmitStockMovement(mov, product);
          if (res.success) {
            await db.stock_movements.update(mov.id, {
              synced_at: new Date().toISOString()
            });
          }
        }
      }

    } catch (err) {
      console.error('Error during synchronization outbox:', err);
    } finally {
      this.isSyncing = false;
      const remainingSales = await db.sales.filter(s => s.synced_at === undefined || s.synced_at === null).count();
      if (this.onStatusChange) {
        this.onStatusChange(this.connectionStatus, remainingSales);
      }
    }
  }

  /**
   * Periodically trigger queue syncing
   */
  startSyncScheduler() {
    setInterval(() => {
      this.syncOutbox();
    }, 10000);
  }
}
