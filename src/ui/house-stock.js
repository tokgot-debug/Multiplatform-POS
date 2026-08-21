import { db } from '../db/schema';
import { state, showNotification } from '../context';
import { getStoreStock, getHouseStock } from '../db/index';

export class HouseStockView {
  constructor(container) {
    this.container = container;
  }

  async load() {
    this.render();
    await this.populateData();
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; color: var(--text-primary); max-width: 1200px; margin: 0 auto;">
        
        <!-- Top Tabs & Search -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div style="display: flex; background: var(--bg-element); border-radius: 8px; padding: 4px;">
            <button style="background: var(--accent-blue); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;">House Stock</button>
          </div>
          
          <div style="display: flex; gap: 12px; align-items: center;">
            <div style="position: relative;">
              <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">🔍</span>
              <input type="text" id="house-search" placeholder="Search house stock..." style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px 8px 32px; color: var(--text-primary); font-family: var(--font-main); font-size: 13px; width: 250px;">
            </div>
            <button id="btn-request-stock" style="background: var(--accent-green); color: #000; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;">+ Request Stock</button>
          </div>
        </div>

        <!-- House Inventory Table -->
        <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
          <div style="overflow-x: auto;">
            <table class="pos-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary); width: 40%;">PRODUCT</th>
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary);">CATEGORY</th>
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary);">UOM</th>
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary); text-align: right;">HOUSE QUANTITY</th>
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary); text-align: right;">STATUS</th>
                </tr>
              </thead>
              <tbody id="house-table-body">
                <!-- Rows injected here -->
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Request Stock Modal -->
      <div id="request-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; align-items: center; justify-content: center;">
        <div style="background: var(--bg-panel); width: 400px; border-radius: 12px; border: 1px solid var(--border-color); overflow: hidden;">
          <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 16px; color: #fff;">Request Stock from Store</h3>
            <button id="close-req-modal" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 20px;">&times;</button>
          </div>
          <div style="padding: 24px;">
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Select Product</label>
              <select id="req-product" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; color: var(--text-primary); font-family: var(--font-main);"></select>
            </div>
            <div style="margin-bottom: 24px;">
              <label style="display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Quantity</label>
              <input type="number" id="req-qty" value="1" min="1" style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; color: var(--text-primary); font-family: var(--font-main);">
            </div>
            <button id="submit-request" style="width: 100%; background: var(--accent-blue); color: #fff; border: none; padding: 12px; border-radius: 6px; font-weight: 700; cursor: pointer;">Submit Request</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('house-search').addEventListener('input', () => this.populateData());
    
    // Modal logic
    const modal = document.getElementById('request-modal');
    document.getElementById('btn-request-stock').addEventListener('click', async () => {
      const role = state.currentUser?.role;
      if (role !== 'Bar Staff' && role !== 'Store Manager' && role !== 'Owner') {
        showNotification('Access Denied: Only Bar Staff, Managers, or Owners can request stock.', 'error');
        return;
      }
      await this.populateProductsDropdown();
      modal.style.display = 'flex';
    });
    document.getElementById('close-req-modal').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    document.getElementById('submit-request').addEventListener('click', () => this.submitRequisition());
  }

  async populateProductsDropdown() {
    const select = document.getElementById('req-product');
    const products = await db.products.where('is_service').equals(0).toArray();
    select.innerHTML = products.map(p => `<option value="${p.id}">${p.name} (${p.uom || 'Unit'})</option>`).join('');
  }

  async submitRequisition() {
    const productId = document.getElementById('req-product').value;
    const qty = parseInt(document.getElementById('req-qty').value, 10);
    
    if (!productId || isNaN(qty) || qty <= 0) {
      alert('Invalid product or quantity');
      return;
    }

    const reqId = crypto.randomUUID();
    await db.transaction('rw', db.requisitions, db.req_lines, async () => {
      await db.requisitions.add({
        id: reqId,
        tenant_id: state.currentTenant?.id || 't1',
        branch_id: state.currentBranch?.id || 'b1',
        status: 'PENDING',
        created_at: new Date().toISOString()
      });
      await db.req_lines.add({
        id: crypto.randomUUID(),
        req_id: reqId,
        product_id: productId,
        qty: qty
      });
    });

    showNotification('Requisition submitted to store.');
    document.getElementById('request-modal').style.display = 'none';
  }

  async populateData() {
    const tbody = document.getElementById('house-table-body');
    const search = document.getElementById('house-search').value.toLowerCase();
    
    const products = await db.products.where('is_service').equals(0).toArray();
    const categories = new Map((await db.categories.toArray()).map(c => [c.id, c.name]));
    
    const rowsHtml = [];

    for (const p of products) {
      if (search && !p.name.toLowerCase().includes(search)) continue;

      const houseStock = await getHouseStock(p.id, state.currentBranch?.id);
      
      // Only show items that have some house stock or are being tracked
      if (houseStock <= 0 && !search) continue;

      const categoryName = categories.get(p.category_id) || 'Uncategorized';
      
      let statusHtml = '';
      if (houseStock > 20) {
        statusHtml = '<span style="color: var(--accent-green); background: rgba(16,185,129,0.1); padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">IN STOCK</span>';
      } else if (houseStock > 0) {
        statusHtml = '<span style="color: #F59E0B; background: rgba(245,158,11,0.1); padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">LOW STOCK</span>';
      } else {
        statusHtml = '<span style="color: var(--accent-rose); background: rgba(244,63,94,0.1); padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">OUT OF STOCK</span>';
      }

      rowsHtml.push(`
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
            <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.1); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 16px;">
              📦
            </div>
            <span style="font-size: 13px; font-weight: 700; color: #fff;">${p.name.toUpperCase()}</span>
          </td>
          <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: var(--text-secondary);">${categoryName.toUpperCase()}</td>
          <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: var(--text-secondary);">${p.uom || 'UNIT'}</td>
          <td style="padding: 12px 16px; font-size: 14px; font-weight: 800; color: #fff; text-align: right;">${houseStock}</td>
          <td style="padding: 12px 16px; text-align: right;">
            ${statusHtml}
          </td>
        </tr>
      `);
    }

    if (rowsHtml.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 24px; text-align: center; color: var(--text-muted);">No stock found in House.</td></tr>`;
    } else {
      tbody.innerHTML = rowsHtml.join('');
    }
  }
}
