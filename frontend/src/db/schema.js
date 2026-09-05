import Dexie from 'dexie';

/**
 * Tables are declared through Dexie's schema strings below rather than as
 * class fields, so TypeScript cannot see them. This annotation exposes them to
 * the ported TSX screens without a cast at every call site.
 *
 * @type {Dexie & Record<string, import('dexie').Table<any, any>>}
 */
export const db = new Dexie('POS_DB');

db.version(1).stores({
  tenants: 'id, legal_name, trading_name, kra_pin, etims_mode, status',
  branches: 'id, tenant_id, name, code, etims_bhf_id, is_active',
  devices: 'id, tenant_id, branch_id, label',
  users: 'id, tenant_id, phone, email, name, pin, status',
  products: 'id, tenant_id, sku, name, category_id, is_active, version',
  barcodes: 'barcode, product_id',
  sales: 'id, tenant_id, branch_id, device_id, shift_id, invoice_no, sale_uuid, customer_id, status, sold_at, synced_at, fiscal_status',
  sale_lines: 'id, sale_id, product_id',
  payments: 'id, sale_id, method, reference, provider_txn_id',
  fiscal_records: 'id, sale_id, cu_invoice_no, submitted_at',
  stock_movements: 'id, tenant_id, branch_id, product_id, batch_id, type, ref_id, created_at',
  batches: 'id, product_id, batch_no, expiry_date',
  stock_takes: 'id, branch_id, status, started_at',
  stock_take_lines: 'id, stock_take_id, product_id',
  suppliers: 'id, tenant_id, name, kra_pin',
  requisitions: 'id, tenant_id, branch_id, status',
  purchase_orders: 'id, tenant_id, supplier_id, order_no, status',
  po_lines: 'id, po_id, product_id',
  grns: 'id, po_id, branch_id, status',
  grn_lines: 'id, grn_id, product_id',
  customers: 'id, tenant_id, name, phone, kra_pin',
  audit_log: 'id, tenant_id, actor_id, action, entity_type, entity_id, created_at',
  shifts: 'id, branch_id, user_id, status, opened_at, closed_at',
  categories: 'id, name'
});

db.version(2).stores({
  products: 'id, tenant_id, sku, name, category_id, is_active, version, is_service',
  sales: 'id, tenant_id, branch_id, device_id, shift_id, invoice_no, sale_uuid, customer_id, status, sold_at, synced_at, fiscal_status, table_no'
});

db.version(3).stores({
  stock_movements: 'id, tenant_id, branch_id, product_id, batch_id, type, ref_id, location, [product_id+location], created_at',
  requisitions: 'id, tenant_id, branch_id, status, created_at',
  req_lines: 'id, req_id, product_id'
});

db.version(4).stores({
  expenses: 'id, tenant_id, branch_id, shift_id, category, amount, created_at'
});
