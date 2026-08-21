import { db } from '../db/schema';
import { logAuditEvent } from '../db/index';
import { state, showNotification } from '../context';

export class ProcurementView {
  constructor(container) {
    this.container = container;
    this.activeSubTab = 'requisitions'; // requisitions, orders, grns
  }

  async load() {
    this.render();
    this.bindEvents();
    await this.loadSubTab();
  }

  render() {
    this.container.innerHTML = `
      <div class="view-header">
        <h2>Procurement & Supplier Management</h2>
      </div>

      <div class="split-pane">
        <!-- Sidebar Navigation -->
        <div class="pane-nav">
          <button class="pane-nav-btn active" data-sub="requisitions">Requisitions</button>
          <button class="pane-nav-btn" data-sub="orders">Purchase Orders</button>
          <button class="pane-nav-btn" data-sub="grns">Goods Receipts (GRNs)</button>
        </div>

        <!-- Working Area -->
        <div class="pane-content" id="procurement-pane-content">
          <!-- Loaded dynamically -->
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.container.querySelectorAll('.pane-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.container.querySelectorAll('.pane-nav-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.activeSubTab = e.target.getAttribute('data-sub');
        this.loadSubTab();
      });
    });
  }

  async loadSubTab() {
    const pane = document.getElementById('procurement-pane-content');
    
    if (this.activeSubTab === 'requisitions') {
      await this.renderRequisitions(pane);
    } else if (this.activeSubTab === 'orders') {
      await this.renderOrders(pane);
    } else if (this.activeSubTab === 'grns') {
      await this.renderGrns(pane);
    }
  }

  async renderRequisitions(pane) {
    const list = await db.requisitions.toArray();
    
    pane.innerHTML = `
      <div class="control-bar">
        <button class="primary-btn" id="new-req-btn">+ Create Requisition</button>
      </div>

      <div class="table-wrapper">
        <table class="pos-table">
          <thead>
            <tr>
              <th>Item Requested</th>
              <th>Qty</th>
              <th>Justification</th>
              <th>Created By</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="reqs-tbody">
            ${list.length === 0 ? '<tr><td colspan="6" style="text-align:center;">No requisitions raised.</td></tr>' : ''}
            ${list.map(r => `
              <tr>
                <td style="font-weight:600;">${r.item}</td>
                <td>${r.qty}</td>
                <td>${r.justification}</td>
                <td>Wanjiku Kamau</td>
                <td>
                  <span class="badge ${r.status === 'APPROVED' ? 'success' : (r.status === 'REJECTED' ? 'danger' : 'warning')}">
                    ${r.status}
                  </span>
                </td>
                <td>
                  ${r.status === 'PENDING' ? `
                    <button class="primary-btn approve-req-btn" data-id="${r.id}" style="padding:4px 8px;font-size:10px;">Approve</button>
                  ` : `<span style="color:var(--text-muted)">Closed</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('new-req-btn').addEventListener('click', async () => {
      const item = prompt('Enter Item Name or SKU:');
      if (!item) return;
      const qty = parseInt(prompt('Quantity:'));
      if (isNaN(qty)) return;
      const justification = prompt('Justification / Need-by date:');

      await db.requisitions.add({
        id: crypto.randomUUID(),
        tenant_id: state.currentTenant.id,
        branch_id: state.currentBranch.id,
        item,
        qty,
        justification: justification || 'Stock replenishment',
        status: 'PENDING',
        created_by: state.currentUser.id
      });

      showNotification('Requisition submitted for approval.', 'success');
      this.loadSubTab();
    });

    pane.querySelectorAll('.approve-req-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const reqId = e.target.getAttribute('data-id');
        const req = await db.requisitions.get(reqId);
        
        // NO SELF-APPROVAL ENFORCED SERVER/DB LAYER
        if (req.created_by === state.currentUser.id) {
          showNotification('Dual Control rule breached. You cannot approve your own requisitions.', 'error');
          return;
        }

        await db.requisitions.update(reqId, {
          status: 'APPROVED',
          approved_by: state.currentUser.id
        });

        await logAuditEvent(state.currentTenant.id, state.currentUser.id, 'APPROVE_REQUISITION', 'REQUISITION', reqId);
        showNotification('Requisition approved.', 'success');
        this.loadSubTab();
      });
    });
  }

  async renderOrders(pane) {
    const list = await db.purchase_orders.toArray();
    const suppliers = new Map((await db.suppliers.toArray()).map(s => [s.id, s.name]));

    pane.innerHTML = `
      <div class="control-bar">
        <button class="primary-btn" id="new-po-btn">+ Raise PO</button>
      </div>

      <div class="table-wrapper">
        <table class="pos-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Total Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="po-tbody">
            ${list.length === 0 ? '<tr><td colspan="5" style="text-align:center;">No Purchase Orders raised.</td></tr>' : ''}
            ${list.map(po => `
              <tr>
                <td style="font-family:monospace;font-weight:600;">${po.order_no}</td>
                <td>${suppliers.get(po.supplier_id) || 'Unknown Supplier'}</td>
                <td>KES ${po.total_amount.toFixed(2)}</td>
                <td>
                  <span class="badge ${po.status === 'APPROVED' ? 'success' : 'warning'}">${po.status}</span>
                </td>
                <td>
                  ${po.status === 'PENDING' ? `
                    <button class="primary-btn approve-po-btn" data-id="${po.id}" style="padding:4px 8px;font-size:10px;">Approve PO</button>
                  ` : `<span style="color:var(--text-muted)">Closed</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('new-po-btn').addEventListener('click', async () => {
      const suppliersList = await db.suppliers.toArray();
      if (suppliersList.length === 0) {
        showNotification('Please add suppliers in the Admin view first.', 'error');
        return;
      }

      const orderNo = `PO-2026-${Math.floor(Math.random() * 9000 + 1000)}`;
      const amount = parseFloat(prompt('Estimated total order value (KES):')) || 0;
      
      await db.purchase_orders.add({
        id: crypto.randomUUID(),
        tenant_id: state.currentTenant.id,
        supplier_id: suppliersList[0].id,
        order_no: orderNo,
        total_amount: amount,
        status: 'PENDING',
        created_by: state.currentUser.id
      });

      showNotification('Purchase Order created in PENDING state.', 'success');
      this.loadSubTab();
    });

    pane.querySelectorAll('.approve-po-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const poId = e.target.getAttribute('data-id');
        const po = await db.purchase_orders.get(poId);

        // SECURE SELF-APPROVAL CHECK
        if (po.created_by === state.currentUser.id) {
          showNotification('Dual Control check failed. Requester cannot approve this PO.', 'error');
          return;
        }

        await db.purchase_orders.update(poId, {
          status: 'APPROVED',
          approved_by: state.currentUser.id
        });

        await logAuditEvent(state.currentTenant.id, state.currentUser.id, 'APPROVE_PO', 'PURCHASE_ORDER', poId);
        showNotification('Purchase Order approved.', 'success');
        this.loadSubTab();
      });
    });
  }

  async renderGrns(pane) {
    const list = await db.grns.toArray();
    const poList = await db.purchase_orders.toArray();
    const poMap = new Map(poList.map(po => [po.id, po]));

    pane.innerHTML = `
      <div class="control-bar">
        <button class="primary-btn" id="receive-goods-btn">Receive Goods (GRN)</button>
      </div>

      <div class="table-wrapper">
        <table class="pos-table">
          <thead>
            <tr>
              <th>GRN Date</th>
              <th>Linked PO</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="grns-tbody">
            ${list.length === 0 ? '<tr><td colspan="3" style="text-align:center;">No goods received notes found.</td></tr>' : ''}
            ${list.map(g => {
              const po = poMap.get(g.po_id);
              return `
                <tr>
                  <td>${new Date(g.received_date).toLocaleDateString()}</td>
                  <td style="font-family:monospace;">${po ? po.order_no : 'Unknown PO'}</td>
                  <td><span class="badge success">${g.status}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('receive-goods-btn').addEventListener('click', async () => {
      const poNum = prompt('Enter Approved PO Number (e.g. PO-2026-XXXX):');
      const po = await db.purchase_orders.where('order_no').equals(poNum).first();
      
      if (!po || po.status !== 'APPROVED') {
        showNotification('Approved PO not found.', 'error');
        return;
      }

      const products = await db.products.where('is_service').equals(0).toArray();
      if (products.length === 0) return;

      const grnId = crypto.randomUUID();
      const product = products[0]; // Auto pick first item for demo atomic post
      const qty = parseInt(prompt(`Enter quantity received for ${product.name}:`)) || 0;
      
      if (qty <= 0) return;

      // ATOMIC TRANSACTION: Writing GRN + Posting stock movements atomically
      await db.transaction('rw', [db.grns, db.grn_lines, db.stock_movements], async () => {
        await db.grns.add({
          id: grnId,
          po_id: po.id,
          branch_id: state.currentBranch.id,
          received_date: new Date().toISOString(),
          status: 'POSTED',
          created_by: state.currentUser.id
        });

        await db.grn_lines.add({
          id: crypto.randomUUID(),
          grn_id: grnId,
          product_id: product.id,
          qty_received: qty,
          batch_id: null
        });

        // Atomic post stock movements ledger!
        await db.stock_movements.add({
          id: crypto.randomUUID(),
          tenant_id: state.currentTenant.id,
          branch_id: state.currentBranch.id,
          product_id: product.id,
          batch_id: null,
          type: 'PURCHASE_RECEIPT',
          qty: qty,
          unit_cost: product.cost_price,
          ref_type: 'GRN',
          ref_id: grnId,
          reason: 'Landed supplier delivery',
          created_by: state.currentUser.id,
          created_at: new Date().toISOString()
        });

        await logAuditEvent(state.currentTenant.id, state.currentUser.id, 'GRN_RECEIVE_ATOMIC', 'GRN', grnId);
      });

      // Triggers background sync for stock adjustments to eTIMS
      state.syncManager.syncOutbox();

      showNotification('GRN posted. Stock updated atomically.', 'success');
      this.loadSubTab();
    });
  }
}
