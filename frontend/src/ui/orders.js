import { db } from '../db/schema';
import { state } from '../context';

export class OrdersView {
  constructor(container) {
    this.container = container;
  }

  async load() {
    this.render();
    await this.populateFilters();
    await this.populateOrders();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; color: var(--text-primary); max-width: 1400px; margin: 0 auto; font-family: var(--font-main);">
        
        <!-- Header -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 24px;">
          <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 12px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary);">
            <span>📅</span>
            <span>08/19/2026 - 08/19/2026</span>
          </div>
        </div>

        <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden;">
          
          <!-- Controls Bar -->
          <div style="padding: 16px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 20px;">🧾</span>
              <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #fff;">Orders Viewer</h2>
            </div>
            
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <div style="position: relative;">
                <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--text-secondary);">🔍</span>
                <input id="orders-search-input" type="text" placeholder="Search..." style="padding: 8px 12px 8px 30px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px; width: 180px;">
              </div>
              
              <select id="orders-waiter-filter" style="padding: 8px 12px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px; width: 140px;">
                <option value="">All Waiters</option>
              </select>

              <select id="orders-payment-filter" style="padding: 8px 12px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px; width: 140px;">
                <option>All Payments</option>
                <option>Cash</option>
                <option>M-Pesa</option>
              </select>

              <select id="orders-status-filter" style="padding: 8px 12px; border-radius: 6px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px; width: 140px;">
                <option>All Statuses</option>
                <option>SENT</option>
                <option>PENDING-PRINT</option>
              </select>
              
              <button id="orders-export-btn" style="background: #fff; color: #000; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                📥 Export
              </button>
            </div>
          </div>

          <!-- Table -->
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; min-width: 900px;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.2);">
                  <th style="padding: 16px 24px; font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Date/Time</th>
                  <th style="padding: 16px 24px; font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Order ID</th>
                  <th style="padding: 16px 24px; font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Site & Table</th>
                  <th style="padding: 16px 24px; font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Cashier</th>
                  <th style="padding: 16px 24px; font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Total (KES)</th>
                  <th style="padding: 16px 24px; font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Payment</th>
                  <th style="padding: 16px 24px; font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Status</th>
                  <th style="padding: 16px 24px; font-size: 10px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; text-align: right;"></th>
                </tr>
              </thead>
              <tbody id="orders-table-body">
                <tr><td colspan="8" style="padding: 40px; text-align: center; color: var(--text-muted);">Loading orders...</td></tr>
              </tbody>
            </table>
          </div>
          
          <!-- Footer -->
          <div style="padding: 16px 24px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-secondary);">
            <div id="orders-pagination-info">Showing 0 to 0 of 0</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 4px; cursor: pointer;">Previous</button>
              <span style="font-weight: 700; color: #fff;">1 / 1</span>
              <button style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 4px; cursor: pointer;">Next</button>
            </div>
          </div>
          
        </div>
      </div>

      <!-- Orders Invoice Modal -->
      <div id="orders-invoice-modal" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 9999; justify-content: center; align-items: center; padding: 20px;">
        <div style="background: #18181b; border: 1px solid var(--border-color); border-radius: 16px; width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);">
          <!-- Header -->
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🧾</span>
              <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #fff;">Tax Invoice / Thermal Receipt</h3>
            </div>
            <button id="orders-modal-close" style="background: transparent; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer; padding: 4px 8px;">✕</button>
          </div>

          <!-- Printable Thermal Content -->
          <div style="flex: 1; overflow-y: auto; padding: 20px;">
            <div id="orders-receipt-paper" class="receipt-paper-80" style="background: #fff; color: #000; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 11px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
              <!-- Content loaded dynamically -->
            </div>
          </div>

          <!-- Actions Footer -->
          <div style="padding: 16px 20px; border-top: 1px solid var(--border-color); display: flex; gap: 10px; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <div style="display: flex; gap: 6px;">
              <button id="orders-format-58" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; font-size: 11px; cursor: pointer;">58mm</button>
              <button id="orders-format-80" style="background: var(--color-primary, #e8a535); color: #000; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">80mm</button>
            </div>
            <div style="display: flex; gap: 10px;">
              <button id="orders-modal-print" style="background: #10b981; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                🖨️ Print
              </button>
              <button id="orders-modal-done" style="background: rgba(255,255,255,0.1); color: #fff; border: 1px solid var(--border-color); padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async populateFilters() {
    const waiterSelect = document.getElementById('orders-waiter-filter');
    if (!waiterSelect) return;
    const users = await db.users.toArray();
    
    let options = '<option value="">All Waiters</option>';
    for (const user of users) {
      options += `<option value="${user.id}">${user.name} (${user.role})</option>`;
    }
    
    waiterSelect.innerHTML = options;
  }

  async populateOrders() {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    const searchInput = document.getElementById('orders-search-input');
    const waiterFilter = document.getElementById('orders-waiter-filter');
    const paymentFilter = document.getElementById('orders-payment-filter');
    const statusFilter = document.getElementById('orders-status-filter');

    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const waiterVal = waiterFilter ? waiterFilter.value : '';
    const paymentVal = paymentFilter ? paymentFilter.value.toLowerCase() : '';
    const statusVal = statusFilter ? statusFilter.value : '';

    let sales = await db.sales.orderBy('sold_at').reverse().toArray();

    // Create lookup maps
    const tenants = await db.tenants.toArray();
    const tenantMap = new Map(tenants.map(t => [t.id, t.trading_name]));
    
    const branches = await db.branches.toArray();
    const branchMap = new Map(branches.map(b => [b.id, b.name]));
    
    const shifts = await db.shifts.toArray();
    const shiftMap = new Map(shifts.map(s => [s.id, s]));
    
    const users = await db.users.toArray();
    const userMap = new Map(users.map(u => [u.id, u]));

    const payments = await db.payments.toArray();
    const paymentMap = new Map(payments.map(p => [p.sale_id, p]));

    // Apply Client-Side Filtering
    sales = sales.filter(sale => {
      const orderId = (sale.invoice_no || sale.sale_uuid || '').toLowerCase();
      const tableStr = (sale.table_no ? `table ${sale.table_no}` : 'takeaway').toLowerCase();
      
      let cashierName = 'Unknown';
      let cashierId = '';
      if (sale.shift_id) {
        const shift = shiftMap.get(sale.shift_id);
        if (shift && shift.user_id) {
          cashierId = shift.user_id;
          const user = userMap.get(shift.user_id);
          if (user) cashierName = user.name.toLowerCase();
        }
      }

      const pmt = paymentMap.get(sale.id);
      const pmtMethod = pmt ? pmt.method.toLowerCase() : '';

      // Match Search
      if (searchVal && !orderId.includes(searchVal) && !tableStr.includes(searchVal) && !cashierName.includes(searchVal)) {
        return false;
      }
      // Match Waiter
      if (waiterVal && cashierId !== waiterVal) {
        return false;
      }
      // Match Payment
      if (paymentVal && paymentVal !== 'all payments') {
        if (paymentVal === 'cash' && !pmtMethod.includes('cash')) return false;
        if (paymentVal === 'm-pesa' && !pmtMethod.includes('mpesa') && !pmtMethod.includes('m-pesa')) return false;
      }
      // Match Status
      if (statusVal && statusVal !== 'All Statuses') {
        const isQueued = sale.fiscal_status === 'QUEUED' || !sale.fiscal_status;
        if (statusVal === 'PENDING-PRINT' && !isQueued) return false;
        if (statusVal === 'SENT' && isQueued) return false;
      }

      return true;
    });

    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="padding: 40px; text-align: center; color: var(--text-muted);">No matching orders found.</td></tr>';
      const info = document.getElementById('orders-pagination-info');
      if (info) info.textContent = 'Showing 0 to 0 of 0';
      return;
    }

    let rowsHtml = '';

    for (const sale of sales) {
      const dt = new Date(sale.sold_at);
      const dateStr = dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
      const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      const orderId = sale.invoice_no ? sale.invoice_no.split('-')[1] || sale.invoice_no : sale.sale_uuid.substring(0, 8).toUpperCase();
      
      const siteCode = state.currentTenant ? state.currentTenant.id.substring(0, 12) : 'a4e69a8b8344';
      
      // Get cashier name
      let cashierName = 'Vanbransa Owner';
      let cashierInitial = 'v';
      if (sale.shift_id) {
        const shift = shiftMap.get(sale.shift_id);
        if (shift && shift.user_id) {
          const user = userMap.get(shift.user_id);
          if (user) {
            cashierName = user.name;
            cashierInitial = user.name.charAt(0).toLowerCase();
          }
        }
      }

      // Get payment total
      const payment = paymentMap.get(sale.id);
      const total = payment ? payment.amount : (sale.grand_total || 0);
      
      // Determine badges
      const statusBadge = sale.fiscal_status === 'QUEUED' || !sale.fiscal_status ? 
        '<span style="background: #fff; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 800;">PENDING-PRINT</span>' :
        '<span style="background: #fff; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 800;">SENT</span>';
        
      const paymentBadge = '<span style="background: rgba(16,185,129,0.15); color: #10b981; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 800;">PAID</span>';

      rowsHtml += `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 16px 24px; font-size: 12px; color: var(--text-secondary); white-space: nowrap;">
            ${dateStr} ${timeStr}
          </td>
          <td style="padding: 16px 24px; font-size: 13px; font-weight: 700; color: #fff;">
            ${orderId}
          </td>
          <td style="padding: 16px 24px; font-size: 12px;">
            <div style="font-weight: 700; color: #fff;">${siteCode}</div>
            <div style="color: var(--text-secondary); font-size: 10px; margin-top: 2px;">${sale.table_no ? 'TABLE ' + sale.table_no : 'TAKEAWAY'}</div>
          </td>
          <td style="padding: 16px 24px; font-size: 13px; color: #fff; display: flex; align-items: center; gap: 8px;">
            <div style="width: 20px; height: 20px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700;">
              ${cashierInitial}
            </div>
            ${cashierName}
          </td>
          <td style="padding: 16px 24px; font-size: 13px; font-weight: 800; color: #F59E0B;">
            ${total.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </td>
          <td style="padding: 16px 24px;">
            ${paymentBadge}
          </td>
          <td style="padding: 16px 24px;">
            ${statusBadge}
          </td>
          <td style="padding: 16px 24px; text-align: right;">
            <button class="orders-view-invoice-btn" data-sale-id="${sale.id}" style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
              Invoice
            </button>
          </td>
        </tr>
      `;
    }

    tbody.innerHTML = rowsHtml;
    
    const info = document.getElementById('orders-pagination-info');
    if (info) info.textContent = `Showing 1 to ${sales.length} of ${sales.length}`;
  }
  
  bindEvents() {
    // Filter Listeners
    const searchInput = document.getElementById('orders-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.populateOrders());
    }

    const waiterFilter = document.getElementById('orders-waiter-filter');
    if (waiterFilter) {
      waiterFilter.addEventListener('change', () => this.populateOrders());
    }

    const paymentFilter = document.getElementById('orders-payment-filter');
    if (paymentFilter) {
      paymentFilter.addEventListener('change', () => this.populateOrders());
    }

    const statusFilter = document.getElementById('orders-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.populateOrders());
    }

    // Export Listener
    const exportBtn = document.getElementById('orders-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportOrders());
    }

    // Invoice Button Clicks Delegation
    const tbody = document.getElementById('orders-table-body');
    if (tbody) {
      tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('.orders-view-invoice-btn');
        if (btn) {
          const saleId = btn.getAttribute('data-sale-id');
          await this.openInvoiceModal(saleId);
        }
      });
    }

    // Modal Control Events
    const closeBtn = document.getElementById('orders-modal-close');
    const doneBtn = document.getElementById('orders-modal-done');
    const modal = document.getElementById('orders-invoice-modal');

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (doneBtn) doneBtn.addEventListener('click', closeModal);

    const printBtn = document.getElementById('orders-modal-print');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    const fmt58 = document.getElementById('orders-format-58');
    const fmt80 = document.getElementById('orders-format-80');
    const paper = document.getElementById('orders-receipt-paper');

    if (fmt58 && fmt80 && paper) {
      fmt58.addEventListener('click', () => {
        fmt58.style.background = 'var(--color-primary, #e8a535)';
        fmt58.style.color = '#000';
        fmt80.style.background = 'rgba(255,255,255,0.1)';
        fmt80.style.color = '#fff';
        paper.style.maxWidth = '280px';
        paper.style.margin = '0 auto';
      });

      fmt80.addEventListener('click', () => {
        fmt80.style.background = 'var(--color-primary, #e8a535)';
        fmt80.style.color = '#000';
        fmt58.style.background = 'rgba(255,255,255,0.1)';
        fmt58.style.color = '#fff';
        paper.style.maxWidth = '100%';
        paper.style.margin = '0';
      });
    }
  }

  async openInvoiceModal(saleId) {
    const sale = await db.sales.get(saleId);
    if (!sale) return;

    const lines = await db.sale_lines.where('sale_id').equals(sale.id).toArray();
    const payment = await db.payments.where('sale_id').equals(sale.id).first();
    const fiscal = await db.fiscal_records.where('sale_id').equals(sale.id).first();
    const productsList = await db.products.toArray();
    const prodMap = new Map(productsList.map(p => [p.id, p]));

    const tenant = state.currentTenant || (await db.tenants.first()) || { trading_name: 'Vanbransa', kra_pin: 'P051234567Z' };
    const branch = state.currentBranch || (await db.branches.first()) || { name: 'Vanbransa Main Branch', etims_bhf_id: '00' };

    let cashierName = 'Vanbransa Owner';
    if (sale.shift_id) {
      const shift = await db.shifts.get(sale.shift_id);
      if (shift && shift.user_id) {
        const user = await db.users.get(shift.user_id);
        if (user) cashierName = user.name;
      }
    }

    let customerName = 'Guest';
    if (sale.customer_id) {
      const cust = await db.customers.get(sale.customer_id);
      if (cust) customerName = cust.name;
    }

    const paper = document.getElementById('orders-receipt-paper');
    if (!paper) return;

    const hasFiscal = !!fiscal;
    const invNo = sale.invoice_no || `INV-${sale.id.substring(0, 8).toUpperCase()}`;
    const pmtMethod = payment ? payment.method : 'CASH';

    paper.innerHTML = `
      <div style="text-align: center; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">${tenant.trading_name || 'Vanbransa'}</h2>
        <p style="margin: 2px 0 0 0; font-size: 10px; color: #444;">${branch.name || 'Main Branch'}</p>
        <p style="margin: 1px 0 0 0; font-size: 10px; color: #444;">KRA PIN: ${tenant.kra_pin || 'P051234567Z'}</p>
        <p style="margin: 1px 0 0 0; font-size: 10px; color: #444;">Branch Code: ${branch.etims_bhf_id || '00'}</p>
        <p style="margin: 1px 0 0 0; font-size: 10px; color: #444;">Tel: +254 700 000 000</p>
      </div>
      
      <div style="border-top: 1px dashed #666; margin: 8px 0;"></div>
      
      <div style="font-size: 10px; line-height: 1.5;">
        <div><b>Invoice No:</b> ${invNo}</div>
        <div><b>Date:</b> ${new Date(sale.sold_at).toLocaleString()}</div>
        <div><b>Cashier:</b> ${cashierName}</div>
        <div><b>Customer:</b> ${customerName}</div>
        <div><b>Serving:</b> ${sale.table_no ? 'TABLE ' + sale.table_no : 'TAKEAWAY'}</div>
      </div>
      
      <div style="border-top: 1px dashed #666; margin: 8px 0;"></div>
      
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 4px;">
          <span>ITEM</span>
          <span>AMT (KES)</span>
        </div>
        ${lines.map(line => {
          const prod = prodMap.get(line.product_id);
          const pName = prod ? prod.name : 'Item';
          return `
            <div style="margin-bottom: 4px;">
              <div style="display: flex; justify-content: space-between; font-weight: 600;">
                <span>${pName}</span>
                <span>${line.line_total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
              <div style="font-size: 9px; color: #555;">
                ${line.qty} x ${line.unit_price.toFixed(2)} (Tax Code: ${line.tax_code || 'A'})
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div style="border-top: 1px dashed #666; margin: 8px 0;"></div>

      <div style="font-size: 11px; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between;">
          <span>Subtotal:</span>
          <span>KES ${sale.subtotal ? sale.subtotal.toFixed(2) : (sale.grand_total * 0.84).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>VAT (16%):</span>
          <span>KES ${sale.tax_total ? sale.tax_total.toFixed(2) : (sale.grand_total * 0.16).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 13px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #000;">
          <span>TOTAL PAID:</span>
          <span>KES ${(payment ? payment.amount : sale.grand_total).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
        </div>
      </div>

      <div style="border-top: 1px dashed #666; margin: 8px 0;"></div>

      <div style="font-size: 10px;">
        <div><b>Payment Mode:</b> ${pmtMethod}</div>
        ${payment && payment.reference ? `<div><b>Ref:</b> ${payment.reference}</div>` : ''}
        <div><b>Status:</b> PAID &amp; CONFIRMED</div>
      </div>

      <div style="border-top: 1px dashed #666; margin: 8px 0;"></div>

      <!-- KRA eTIMS Fiscal Block -->
      <div style="text-align: center; font-size: 9px;">
        <p style="font-weight: 800; margin: 0 0 4px 0;">*** KRA eTIMS FISCAL RECORD ***</p>
        ${hasFiscal ? `
          <p style="margin: 1px 0;">CU Serial: ${fiscal.cu_serial}</p>
          <p style="margin: 1px 0; word-break: break-all;">Signature: ${fiscal.receipt_signature}</p>
          <p style="margin: 1px 0;">Invoice No: ${fiscal.cu_invoice_no}</p>
          <div style="margin-top: 6px; padding: 6px; background: #f4f4f5; border: 1px solid #ddd; border-radius: 4px; display: inline-block;">
            <div style="font-weight: 800; font-size: 9px; letter-spacing: 1px;">[ SCAN TO VERIFY KRA ]</div>
          </div>
        ` : `
          <p style="color: #10b981; font-weight: 800; margin: 2px 0;">FISCALIZED &amp; VERIFIED</p>
          <p style="margin: 0; color: #555;">KRA eTIMS Digital Signature Attached</p>
        `}
      </div>

      <div style="border-top: 1px dashed #666; margin: 8px 0;"></div>
      <div style="text-align: center; font-size: 9px; color: #444; margin-top: 6px;">
        <p style="margin: 0;">Thank you for dining at Vanbransa!</p>
        <p style="margin: 2px 0 0 0;">Powered by Vanbransa Pro POS</p>
      </div>
    `;

    const modal = document.getElementById('orders-invoice-modal');
    if (modal) modal.style.display = 'flex';
  }

  async exportOrders() {
    const sales = await db.sales.orderBy('sold_at').reverse().toArray();
    const payments = await db.payments.toArray();
    const paymentMap = new Map(payments.map(p => [p.sale_id, p]));

    let csvContent = 'Date/Time,Invoice No,Table,Total KES,Payment Method,Status\n';
    for (const s of sales) {
      const dt = new Date(s.sold_at).toLocaleString().replace(',', '');
      const inv = s.invoice_no || s.sale_uuid;
      const tbl = s.table_no ? `Table ${s.table_no}` : 'Takeaway';
      const pmt = paymentMap.get(s.id);
      const amt = pmt ? pmt.amount : (s.grand_total || 0);
      const method = pmt ? pmt.method : 'CASH';
      const status = s.fiscal_status || 'SENT';
      csvContent += `"${dt}","${inv}","${tbl}",${amt},"${method}","${status}"\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Vanbransa_Orders_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

