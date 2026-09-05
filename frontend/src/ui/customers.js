import { db } from '../db/schema';
import { state, showNotification } from '../context';
import { logAuditEvent } from '../db/index';

export class CustomersView {
  constructor(container) {
    this.container = container;
  }

  async load() {
    this.render();
    await this.loadCustomers();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; color: var(--text-primary); max-width: 1200px; margin: 0 auto; font-family: var(--font-main);">
        
        <!-- Header -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-family: var(--font-display); font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px;">👥 CRM, Loyalty &amp; BNPL Credit Tabs</h2>
          <p style="color: var(--text-secondary); font-size: 13px;">Manage customer directory, track loyalty points, set Buy-Now-Pay-Later (BNPL) credit limits, and reconcile credit accounts.</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: flex-start;">
          
          <!-- Left Column: Customers Registry -->
          <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--glass-shadow);">
            <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 15px; color: #fff;">👥 Customer Accounts Directory</h3>
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); color: var(--text-secondary);">
                    <th style="padding: 10px 8px;">Customer Name</th>
                    <th style="padding: 10px 8px;">Phone</th>
                    <th style="padding: 10px 8px;">Loyalty Points</th>
                    <th style="padding: 10px 8px;">Outstanding Tab</th>
                    <th style="padding: 10px 8px;">Credit Limit</th>
                    <th style="padding: 10px 8px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody id="customers-registry-body">
                  <!-- Loaded dynamically -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- Right Column: Add New Customer -->
          <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--glass-shadow); display: flex; flex-direction: column; gap: 16px;">
            <h3 style="margin-top: 0; margin-bottom: 4px; font-size: 15px; color: #fff;">➕ Add New Customer Profile</h3>
            <p style="color: var(--text-secondary); font-size: 12px; margin: 0;">Create a profile to enable loyalty points accrual and tab credit limit allocation.</p>

            <form id="customer-reg-form" style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Full Name</label>
                <input type="text" id="cust-name" placeholder="e.g. John Mwangi" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Phone Number</label>
                <input type="tel" id="cust-phone" placeholder="07XXXXXXXX" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none; font-family: monospace;">
              </div>
              <div>
                <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">KRA PIN (Optional)</label>
                <input type="text" id="cust-kra" placeholder="e.g. A001234567Z" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none; font-family: monospace;">
              </div>
              <div>
                <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">BNPL Credit Limit (KES)</label>
                <input type="number" id="cust-limit" value="10000" min="0" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none; text-align: center;">
              </div>
              
              <button type="submit" style="background: var(--accent-cyan); color: #000; border: none; padding: 10px; border-radius: 6px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s; margin-top: 6px;">
                💾 Register Customer Profile
              </button>
            </form>
          </div>

        </div>

      </div>

      <!-- Simulated Repay Modal Loader -->
      <div id="repay-modal" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 99999; justify-content: center; align-items: center; padding: 20px;">
        <div style="background: #18181b; border: 1px solid var(--border-color); border-radius: 16px; width: 100%; max-width: 380px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); text-align: center; padding: 32px 24px;">
          <div id="repay-loader-spinner" style="width: 50px; height: 50px; border: 4px solid rgba(16, 185, 129, 0.1); border-top-color: var(--accent-green); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
          <h4 id="repay-loader-title" style="color: #fff; font-size: 16px; margin: 0 0 10px 0;">Processing Credit Repayment...</h4>
          <p id="repay-loader-desc" style="color: var(--text-secondary); font-size: 12px; margin: 0 0 20px 0;">Reconciling customer ledger statement...</p>
        </div>
      </div>

      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
  }

  async loadCustomers() {
    if (!state.currentTenant) return;

    try {
      const customers = await db.customers.where('tenant_id').equals(state.currentTenant.id).toArray();
      const tbody = document.getElementById('customers-registry-body');

      if (customers.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">No customer profiles registered.</td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = '';
      customers.forEach(cust => {
        const balance = cust.credit_balance || 0;
        const limit = cust.credit_limit || 0;
        const points = cust.loyalty_points || 0;

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
        tr.innerHTML = `
          <td style="padding:10px 8px;font-weight:600;color:#fff;">${cust.name}</td>
          <td style="padding:10px 8px;font-family:monospace;">${cust.phone}</td>
          <td style="padding:10px 8px;color:var(--accent-amber);font-weight:700;">★ ${points} pts</td>
          <td style="padding:10px 8px;color:${balance > 0 ? 'var(--accent-rose)' : 'var(--text-secondary)'};font-weight:600;">
            KES ${balance.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </td>
          <td style="padding:10px 8px;color:var(--text-secondary);">
            KES ${limit.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </td>
          <td style="padding:10px 8px;text-align:right;">
            ${balance > 0 ? `
              <button class="btn-repay-tab" data-cust-id="${cust.id}" data-balance="${balance}" style="background:var(--accent-cyan);color:#000;border:none;padding:5px 10px;border-radius:4px;font-size:11px;font-weight:800;cursor:pointer;">
                💵 Repay Tab
              </button>
            ` : '<span style="font-size:11px;color:var(--accent-green);font-weight:700;">Clear Tab</span>'}
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Bind actions
      tbody.querySelectorAll('.btn-repay-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
          const custId = btn.getAttribute('data-cust-id');
          const maxBalance = parseFloat(btn.getAttribute('data-balance'));
          await this.repayCustomerTab(custId, maxBalance);
        });
      });

    } catch (err) {
      console.error(err);
    }
  }

  bindEvents() {
    const regForm = document.getElementById('customer-reg-form');
    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        const kra = document.getElementById('cust-kra').value.trim();
        const limit = parseFloat(document.getElementById('cust-limit').value) || 0;

        try {
          const customerId = `cust-${crypto.randomUUID().slice(0,8)}`;
          await db.customers.add({
            id: customerId,
            tenant_id: state.currentTenant.id,
            name,
            phone,
            kra_pin: kra,
            credit_limit: limit,
            credit_balance: 0,
            loyalty_points: 0
          });

          await logAuditEvent(state.currentTenant.id, state.currentUser.id, 'CREATE_CUSTOMER', 'CUSTOMER', customerId);
          showNotification('Customer profile registered successfully.', 'success');
          
          regForm.reset();
          await this.loadCustomers();
        } catch (err) {
          showNotification('Failed to create customer: ' + err.message, 'error');
        }
      });
    }
  }

  async repayCustomerTab(custId, maxBalance) {
    const amountStr = prompt(`Enter repayment amount (Max: KES ${maxBalance.toLocaleString()}):`, maxBalance);
    if (amountStr === null) return;

    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0 || amt > maxBalance) {
      showNotification('Please enter a valid repayment amount.', 'warning');
      return;
    }

    // Show simulated repayment loader overlay
    const modal = document.getElementById('repay-modal');
    const title = document.getElementById('repay-loader-title');
    const desc = document.getElementById('repay-loader-desc');
    const spinner = document.getElementById('repay-loader-spinner');

    title.textContent = 'Processing Credit Repayment...';
    desc.textContent = 'Allocating electronic payment funds to customer credit statement...';
    spinner.style.animation = 'spin 1s linear infinite';

    modal.style.display = 'flex';
    modal.classList.add('active');

    await new Promise(r => setTimeout(r, 2000));
    title.textContent = 'Updating Customer Ledger...';
    desc.textContent = 'Reducing outstanding tab and recording transaction event...';

    await new Promise(r => setTimeout(r, 1500));

    try {
      const cust = await db.customers.get(custId);
      if (!cust) throw new Error('Customer not found');

      const nextBalance = Math.max(0, (cust.credit_balance || 0) - amt);

      // Perform DB updates in transaction
      await db.transaction('rw', [db.customers, db.payments], async () => {
        await db.customers.update(custId, {
          credit_balance: nextBalance
        });

        // Add a mock payout/payment line record
        await db.payments.add({
          id: `pay-repay-${crypto.randomUUID().slice(0, 8)}`,
          sale_id: `repay-${custId}`,
          method: 'CASH',
          amount: amt,
          reference: 'CREDIT_REPAY',
          provider_txn_id: 'CREDIT_REPAY',
          verified: 1,
          received_at: new Date().toISOString()
        });
      });

      await logAuditEvent(
        state.currentTenant.id,
        state.currentUser?.id || 'cashier',
        'REPAY_CUSTOMER_TAB',
        'CUSTOMER',
        custId,
        null,
        JSON.stringify({ amt, nextBalance })
      );

      spinner.style.animation = 'none';
      title.innerHTML = '<span style="color:var(--accent-green)">✔ Tab Reconciled</span>';
      desc.textContent = `Successfully credited KES ${amt.toLocaleString()} to ${cust.name}'s account.`;
      
      showNotification('Tab repayment updated successfully.', 'success');

      await new Promise(r => setTimeout(r, 2000));
      modal.style.display = 'none';
      modal.classList.remove('active');
      await this.loadCustomers();
    } catch (err) {
      console.error(err);
      spinner.style.animation = 'none';
      title.textContent = 'Repayment Failed';
      desc.textContent = err.message;
      await new Promise(r => setTimeout(r, 2000));
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }
}
