import { db } from '../db/schema';
import { state, showNotification } from '../context';
import { logAuditEvent, getStoreStock } from '../db/index';

export class ProcurementView {
  constructor(container) {
    this.container = container;
  }

  async load() {
    this.render();
    await this.loadSuppliers();
    await this.loadProductsDropdown();
    await this.loadActivePOs();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; color: var(--text-primary); max-width: 1200px; margin: 0 auto; font-family: var(--font-main);">
        
        <!-- Header -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-family: var(--font-display); font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px;">📦 Procurement &amp; Supplier Management</h2>
          <p style="color: var(--text-secondary); font-size: 13px;">Manage product cost pricing, draft purchase orders (PO), and approve goods received notes (GRN) to increase store inventory.</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: flex-start;">
          
          <!-- Left Column: Draft PO & Active POs -->
          <div style="display: flex; flex-direction: column; gap: 24px;">
            
            <!-- Active PO Registry -->
            <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--glass-shadow);">
              <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 15px; color: #fff;">📦 Open Purchase Orders &amp; GRN Intake</h3>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                  <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); color: var(--text-secondary);">
                      <th style="padding: 10px 8px;">Order No</th>
                      <th style="padding: 10px 8px;">Supplier</th>
                      <th style="padding: 10px 8px;">Items</th>
                      <th style="padding: 10px 8px;">Status</th>
                      <th style="padding: 10px 8px; text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody id="po-registry-body">
                    <!-- Loaded dynamically -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Draft Purchase Order Builder -->
            <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--glass-shadow);">
              <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 15px; color: #fff;">✍️ Draft New Purchase Order</h3>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                <div>
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Select Supplier</label>
                  <select id="po-supplier-select" style="width: 100%; background: rgba(3,7,18,0.4); border: 1px solid var(--border-color); color: #fff; padding: 8px 12px; border-radius: 6px; outline: none;">
                    <!-- Loaded dynamically -->
                  </select>
                </div>
                <div>
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">PO Reference No</label>
                  <input type="text" id="po-ref-no" placeholder="e.g. PO-2026-001" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none; font-family: monospace;">
                </div>
              </div>

              <!-- Product Line Adder -->
              <div style="border: 1px dashed var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 16px; background: rgba(255,255,255,0.01);">
                <h4 style="margin: 0 0 10px 0; font-size: 12px; color: #fff;">Add Line Item</h4>
                <div style="display: grid; grid-template-columns: 1fr 100px 120px 80px; gap: 10px; align-items: flex-end;">
                  <div>
                    <label style="display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Product</label>
                    <select id="po-product-select" style="width: 100%; background: rgba(3,7,18,0.4); border: 1px solid var(--border-color); color: #fff; padding: 6px; border-radius: 4px; outline: none; font-size: 12px;"></select>
                  </div>
                  <div>
                    <label style="display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Qty (Units)</label>
                    <input type="number" id="po-line-qty" value="10" min="1" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px; color: #fff; font-size: 12px; outline: none; text-align: center;">
                  </div>
                  <div>
                    <label style="display: block; font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Purchase Cost (KES)</label>
                    <input type="number" id="po-line-cost" value="100" min="1" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; padding: 6px; color: #fff; font-size: 12px; outline: none; text-align: center;">
                  </div>
                  <button type="button" id="btn-add-po-line" style="background: rgba(56, 189, 248, 0.15); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); font-weight: 700; padding: 7px; border-radius: 4px; font-size: 12px; cursor: pointer;">
                    ➕ Add
                  </button>
                </div>
              </div>

              <!-- Draft Lines Table -->
              <div style="margin-bottom: 16px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
                  <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); color: var(--text-secondary);">
                      <th style="padding: 6px;">Product</th>
                      <th style="padding: 6px; text-align: center;">Qty</th>
                      <th style="padding: 6px; text-align: right;">Unit Cost</th>
                      <th style="padding: 6px; text-align: right;">Total Cost</th>
                      <th style="padding: 6px; text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody id="po-draft-lines">
                    <!-- Added lines show here -->
                  </tbody>
                </table>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 12px;">
                <button type="button" id="btn-submit-po" style="background: var(--accent-green); color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                  💾 Create &amp; Log Purchase Order
                </button>
              </div>

            </div>

          </div>

          <!-- Right Column: Supplier Administration -->
          <div style="display: flex; flex-direction: column; gap: 24px;">
            
            <!-- Register Supplier Card -->
            <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--glass-shadow);">
              <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 15px; color: #fff;">🏢 Register Supplier</h3>
              <form id="supplier-reg-form" style="display: flex; flex-direction: column; gap: 12px;">
                <div>
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Supplier / Distributor Name</label>
                  <input type="text" id="sup-name" placeholder="e.g. East African Breweries" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none;">
                </div>
                <div>
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">KRA PIN</label>
                  <input type="text" id="sup-kra" placeholder="e.g. P051234567A" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none;">
                </div>
                <button type="submit" style="background: var(--accent-cyan); color: #000; border: none; padding: 10px; border-radius: 6px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s; margin-top: 6px;">
                  ➕ Save Supplier Profile
                </button>
              </form>
            </div>

            <!-- Suppliers Directory list -->
            <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--glass-shadow);">
              <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 15px; color: #fff;">📋 Registered Suppliers</h3>
              <div style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;" id="suppliers-list-container">
                <!-- Loaded dynamically -->
              </div>
            </div>

          </div>

        </div>

      </div>
    `;

    this.draftLines = [];
  }

  async loadSuppliers() {
    if (!state.currentTenant) return;

    const suppliers = await db.suppliers.where('tenant_id').equals(state.currentTenant.id).toArray();
    
    // Populate select
    const select = document.getElementById('po-supplier-select');
    select.innerHTML = '';
    suppliers.forEach(sup => {
      const opt = document.createElement('option');
      opt.value = sup.id;
      opt.textContent = sup.name;
      select.appendChild(opt);
    });

    // Populate list
    const list = document.getElementById('suppliers-list-container');
    if (suppliers.length === 0) {
      list.innerHTML = `<div style="font-size:12px;color:var(--text-muted);text-align:center;">No suppliers registered yet.</div>`;
      return;
    }

    list.innerHTML = '';
    suppliers.forEach(sup => {
      const item = document.createElement('div');
      item.style.cssText = `
        background: rgba(255,255,255,0.01);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      `;
      item.innerHTML = `
        <div>
          <strong style="color:#fff;font-size:13px;">${sup.name}</strong>
          <div style="font-size:11px;color:var(--text-muted);font-family:monospace;margin-top:2px;">KRA PIN: ${sup.kra_pin}</div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  async loadProductsDropdown() {
    if (!state.currentTenant) return;

    const products = await db.products.where('tenant_id').equals(state.currentTenant.id).toArray();
    const select = document.getElementById('po-product-select');
    select.innerHTML = '';
    products.forEach(p => {
      if (!p.is_service) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} (SKU: ${p.sku})`;
        select.appendChild(opt);
      }
    });
  }

  async loadActivePOs() {
    if (!state.currentTenant) return;

    const pos = await db.purchase_orders.where('tenant_id').equals(state.currentTenant.id).toArray();
    pos.sort((a,b) => b.order_no.localeCompare(a.order_no));

    const tbody = document.getElementById('po-registry-body');
    if (pos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">No PO records found.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    for (const po of pos) {
      const supplier = await db.suppliers.get(po.supplier_id);
      const lines = await db.po_lines.where('po_id').equals(po.id).toArray();
      const statusBadgeColor = po.status === 'RECEIVED' ? 'var(--accent-green)' : 'var(--accent-amber)';

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
      tr.innerHTML = `
        <td style="padding:10px 8px;font-family:monospace;color:#fff;">${po.order_no}</td>
        <td style="padding:10px 8px;">${supplier ? supplier.name : 'N/A'}</td>
        <td style="padding:10px 8px;color:var(--text-secondary);">${lines.length} lines</td>
        <td style="padding:10px 8px;">
          <span style="font-size:11px;font-weight:700;color:${statusBadgeColor};text-transform:uppercase;">${po.status}</span>
        </td>
        <td style="padding:10px 8px;text-align:right;">
          ${po.status === 'PENDING' ? `
            <button class="btn-receive-grn" data-po-id="${po.id}" style="background:var(--accent-green);color:#fff;border:none;padding:5px 10px;border-radius:4px;font-size:11px;font-weight:800;cursor:pointer;">
              ✔️ Receive &amp; GRN
            </button>
          ` : '<span style="font-size:12px;color:var(--text-muted);">Asset Cleared</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Bind GRN action
    tbody.querySelectorAll('.btn-receive-grn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const poId = btn.getAttribute('data-po-id');
        await this.receiveGoods(poId);
      });
    });
  }

  bindEvents() {
    // 1. Supplier registry
    const supForm = document.getElementById('supplier-reg-form');
    if (supForm) {
      supForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('sup-name').value.trim();
        const kra = document.getElementById('sup-kra').value.trim();

        try {
          const supplierId = `sup-${crypto.randomUUID().slice(0,8)}`;
          await db.suppliers.add({
            id: supplierId,
            tenant_id: state.currentTenant.id,
            name,
            kra_pin: kra
          });

          await logAuditEvent(state.currentTenant.id, state.currentUser.id, 'CREATE_SUPPLIER', 'SUPPLIER', supplierId);
          showNotification('Supplier registered.', 'success');
          supForm.reset();
          await this.loadSuppliers();
        } catch (err) {
          showNotification(err.message, 'error');
        }
      });
    }

    // 2. Add PO Line
    const addLineBtn = document.getElementById('btn-add-po-line');
    if (addLineBtn) {
      addLineBtn.addEventListener('click', async () => {
        const prodId = document.getElementById('po-product-select').value;
        const qty = parseInt(document.getElementById('po-line-qty').value) || 0;
        const cost = parseFloat(document.getElementById('po-line-cost').value) || 0;

        if (!prodId || qty <= 0 || cost <= 0) {
          showNotification('Please enter a valid product, quantity, and cost price.', 'error');
          return;
        }

        const prod = await db.products.get(prodId);
        if (!prod) return;

        // Check if duplicate line
        const existingIdx = this.draftLines.findIndex(l => l.product_id === prodId);
        if (existingIdx !== -1) {
          this.draftLines[existingIdx].qty += qty;
        } else {
          this.draftLines.push({
            product_id: prodId,
            product_name: prod.name,
            qty,
            cost_price: cost
          });
        }

        this.renderDraftLines();
      });
    }

    // 3. Submit PO
    const submitBtn = document.getElementById('btn-submit-po');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const supplierId = document.getElementById('po-supplier-select').value;
        const refNo = document.getElementById('po-ref-no').value.trim();

        if (!supplierId || this.draftLines.length === 0 || !refNo) {
          showNotification('Please select a supplier, enter a reference no, and add draft line items.', 'warning');
          return;
        }

        try {
          const poId = `po-${crypto.randomUUID().slice(0,8)}`;
          
          await db.transaction('rw', db.purchase_orders, db.po_lines, async () => {
            await db.purchase_orders.add({
              id: poId,
              tenant_id: state.currentTenant.id,
              supplier_id: supplierId,
              order_no: refNo,
              status: 'PENDING',
              created_at: new Date().toISOString()
            });

            for (const line of this.draftLines) {
              await db.po_lines.add({
                id: `pol-${crypto.randomUUID().slice(0,8)}`,
                po_id: poId,
                product_id: line.product_id,
                qty: line.qty,
                cost_price: line.cost_price
              });
            }
          });

          await logAuditEvent(state.currentTenant.id, state.currentUser.id, 'CREATE_PO', 'PURCHASE_ORDER', poId);
          showNotification('Purchase order created successfully.', 'success');
          
          this.draftLines = [];
          this.renderDraftLines();
          document.getElementById('po-ref-no').value = '';
          await this.loadActivePOs();

        } catch (err) {
          console.error(err);
          showNotification('Failed to save PO: ' + err.message, 'error');
        }
      });
    }
  }

  renderDraftLines() {
    const tbody = document.getElementById('po-draft-lines');
    tbody.innerHTML = '';

    if (this.draftLines.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;color:var(--text-muted);padding:10px;">Draft is empty. Add a line above.</td>
        </tr>
      `;
      return;
    }

    this.draftLines.forEach((line, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
      const total = line.qty * line.cost_price;
      tr.innerHTML = `
        <td style="padding:6px;">${line.product_name}</td>
        <td style="padding:6px;text-align:center;">${line.qty}</td>
        <td style="padding:6px;text-align:right;">KES ${line.cost_price.toFixed(2)}</td>
        <td style="padding:6px;text-align:right;">KES ${total.toFixed(2)}</td>
        <td style="padding:6px;text-align:right;">
          <button class="btn-remove-po-line" data-idx="${idx}" style="background:transparent;border:none;color:var(--accent-rose);cursor:pointer;font-size:12px;">❌ Remove</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-remove-po-line').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'));
        this.draftLines.splice(idx, 1);
        this.renderDraftLines();
      });
    });
  }

  async receiveGoods(poId) {
    try {
      const po = await db.purchase_orders.get(poId);
      if (!po || po.status === 'RECEIVED') return;

      const lines = await db.po_lines.where('po_id').equals(poId).toArray();

      await db.transaction('rw', [db.purchase_orders, db.stock_movements, db.products], async () => {
        // A. Set PO status to RECEIVED
        await db.purchase_orders.update(poId, { status: 'RECEIVED' });

        // B. Loop lines to record stock in and update Cost Price dynamically (WAC)
        for (const line of lines) {
          const product = await db.products.get(line.product_id);
          if (!product) continue;

          // 1. Get current physical stock balance inside store location
          const currentStock = await getStoreStock(line.product_id, state.currentBranch.id);

          // 2. Compute Weighted Average Cost (WAC)
          let newCost = line.cost_price;
          if (product.cost_price && currentStock > 0) {
            newCost = ((currentStock * product.cost_price) + (line.qty * line.cost_price)) / (currentStock + line.qty);
          }

          // 3. Update product registry average cost price
          await db.products.update(line.product_id, {
            cost_price: parseFloat(newCost.toFixed(2))
          });

          // 4. Register double-entry STOCK_IN movement into the Store location
          await db.stock_movements.add({
            id: `mov-${crypto.randomUUID().slice(0, 8)}`,
            tenant_id: state.currentTenant.id,
            branch_id: state.currentBranch.id,
            product_id: line.product_id,
            batch_id: 'default',
            type: 'STOCK_IN',
            qty: line.qty,
            ref_id: poId,
            location: 'store',
            created_at: new Date().toISOString()
          });
        }
      });

      await logAuditEvent(state.currentTenant.id, state.currentUser?.id || 'procurement', 'RECEIVE_GRN', 'PURCHASE_ORDER', poId);
      showNotification('GRN processed. Store stock increased & Weighted Average Costs updated.', 'success');
      await this.loadActivePOs();

    } catch (err) {
      console.error(err);
      showNotification('Failed to receive goods: ' + err.message, 'error');
    }
  }
}
