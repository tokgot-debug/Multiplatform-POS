import { db } from '../db/schema';
import { UsersView } from './users';
import { verifyAuditTrail } from '../db/index';
import { state, showNotification } from '../context';

export class SettingsView {
  constructor(container) {
    this.container = container;
  }

  async load() {
    this.activeTab = this.activeTab || 'general';
    this.render();
    this.bindEvents();
  }

  render() {
    const cashEnabled = localStorage.getItem('pos_cash_enabled') !== 'false';
    const isOwner = state.currentUser && (state.currentUser.role === 'Owner' || state.currentUser.role === 'Store Manager');
    const discounts = JSON.parse(localStorage.getItem('pos_discounts') || '[]');

    this.container.innerHTML = `
      <div style="display:flex;height:calc(100vh - 130px);gap:0;overflow:hidden;">

        <!-- Left sub-nav -->
        <div style="width:185px;flex-shrink:0;background:var(--surface);border-right:1px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;padding:12px 8px;gap:4px;">
          <button class="pane-nav-btn ${this.activeTab === 'general' ? 'active' : ''}" data-stab="general">⚙️ General</button>
          <button class="pane-nav-btn ${this.activeTab === 'payments' ? 'active' : ''}" data-stab="payments">💳 Payments</button>
          <button class="pane-nav-btn ${this.activeTab === 'discounts' ? 'active' : ''}" data-stab="discounts">🏷️ Discounts</button>
          <button class="pane-nav-btn ${this.activeTab === 'system' ? 'active' : ''}" data-stab="system">🔧 System</button>
          <button class="pane-nav-btn ${this.activeTab === 'staff' ? 'active' : ''}" data-stab="staff">👥 Staff &amp; Access</button>
          <button class="pane-nav-btn ${this.activeTab === 'audit' ? 'active' : ''}" data-stab="audit">🔒 Audit</button>
        </div>

        <!-- Right content -->
        <div style="flex:1;overflow-y:auto;padding:20px;">

          <!-- GENERAL TAB -->
          <div id="stab-general" style="display:${this.activeTab === 'general' ? 'block' : 'none'}">
            <div class="discount-section">
              <h3>🏪 General Information</h3>
              <div class="discount-form-grid">
                <div>
                  <label>Establishment Name</label>
                  <input type="text" id="set-establishment-name" value="${state.currentTenant ? state.currentTenant.trading_name : 'Vanbransa'}">
                </div>
                <div>
                  <label>Assigned Site ID</label>
                  <input type="text" value="a4e69a8b8344" readonly>
                </div>
                <div>
                  <label>Currency</label>
                  <input type="text" value="KES">
                </div>
                <div>
                  <label>Session Start Time</label>
                  <select>
                    <option>7:00 AM</option>
                    <option>8:00 AM</option>
                    <option>9:00 AM</option>
                  </select>
                </div>
              </div>
              <div class="discount-field">
                <label>Receipt Footer Message</label>
                <input type="text" value="Thank you for coming to Vanbransa!">
              </div>
              <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:8px;padding:14px;margin-bottom:16px;">
                <div style="font-size:10px;font-weight:800;color:var(--text-secondary);text-transform:uppercase;margin-bottom:4px;">License Expiry</div>
                <div style="font-size:14px;font-weight:700;">3/20/2027, 12:00:00 AM</div>
              </div>
              <button id="save-general-settings" class="discount-save-btn">Save General Settings</button>
            </div>
          </div>

          <!-- PAYMENTS SUB-TAB -->
          <div id="stab-payments" style="display:${this.activeTab === 'payments' ? 'block' : 'none'}">
            <div class="discount-section">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;">💳 Owner Payment Method Controls</h3>
                <span style="font-size:11px;padding:4px 10px;border-radius:6px;background:rgba(232,165,53,0.15);color:#e8a535;font-weight:700;">
                  ${isOwner ? '👑 Owner Privileges Active' : '🔒 Read Only (Requires Owner Role)'}
                </span>
              </div>
              <p style="font-size:12px;color:var(--text-secondary);margin:-8px 0 20px 0;">Configure accepted payment methods across all Vanbransa checkout tills and online ordering endpoints.</p>

              <!-- Cash Payment Control -->
              <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:18px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div style="font-weight:800;font-size:15px;color:#fff;display:flex;align-items:center;gap:10px;">
                      💵 Physical Cash Payments
                      <span id="payments-cash-badge" style="font-size:10px;padding:2px 8px;border-radius:12px;font-weight:800;background:${cashEnabled ? 'rgba(16,185,129,.15)' : 'rgba(244,63,94,.15)'};color:${cashEnabled ? 'var(--accent-green)' : 'var(--accent-rose)'};">
                        ${cashEnabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p style="font-size:12px;color:var(--text-secondary);margin-top:6px;max-width:520px;line-height:1.5;">
                      When disabled by the owner, cashiers will not see the Cash option at checkout, preventing cash sales and forcing digital/M-Pesa transactions.
                    </p>
                  </div>
                  ${isOwner ? `
                    <label style="position:relative;display:inline-block;width:50px;height:26px;flex-shrink:0;">
                      <input type="checkbox" id="payments-cash-toggle" style="opacity:0;width:0;height:0;" ${cashEnabled ? 'checked' : ''}>
                      <span id="payments-cash-slider" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${cashEnabled ? '#10b981' : '#374151'};border-radius:26px;transition:.3s;">
                        <span style="position:absolute;height:20px;width:20px;left:${cashEnabled ? '26px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:.3s;display:block;"></span>
                      </span>
                    </label>
                  ` : `<span style="font-size:11px;color:var(--text-muted);">Owner access only</span>`}
                </div>
              </div>

              <!-- M-Pesa Mobile Money Control -->
              <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:10px;padding:18px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div style="font-weight:800;font-size:15px;color:#fff;display:flex;align-items:center;gap:10px;">
                      📱 M-Pesa STK Push &amp; Mobile Money
                      <span style="font-size:10px;padding:2px 8px;border-radius:12px;font-weight:800;background:rgba(16,185,129,.15);color:var(--accent-green);">ENABLED</span>
                    </div>
                    <p style="font-size:12px;color:var(--text-secondary);margin-top:6px;max-width:520px;line-height:1.5;">
                      Direct Safaricom STK Push integration for instant mobile payment confirmation.
                    </p>
                  </div>
                  <span style="font-size:11px;color:#10b981;font-weight:700;">Always Active</span>
                </div>
              </div>

            </div>
          </div>

          <!-- DISCOUNTS TAB -->
          <div id="stab-discounts" style="display:${this.activeTab === 'discounts' ? 'block' : 'none'}">
            <div class="discount-section">
              <h3>🏷️ Create New Discount Rule</h3>
              <div class="discount-form-grid">
                <div>
                  <label>Discount Name</label>
                  <input type="text" id="disc-name" placeholder="e.g. VIP Member, Happy Hour">
                </div>
                <div>
                  <label>Applies To</label>
                  <select id="disc-type">
                    <option value="individual">Individual Customer</option>
                    <option value="group">Customer Group</option>
                    <option value="all">All Customers</option>
                  </select>
                </div>
                <div>
                  <label>Discount Value</label>
                  <input type="number" id="disc-value" placeholder="e.g. 10" min="0" max="100">
                </div>
                <div>
                  <label>Discount Type</label>
                  <select id="disc-kind">
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (KES)</option>
                  </select>
                </div>
              </div>
              <div class="discount-form-grid">
                <div>
                  <label>Customer / Group Name (optional)</label>
                  <input type="text" id="disc-target" placeholder="e.g. John Doe, Staff Group">
                </div>
                <div>
                  <label>Status</label>
                  <select id="disc-status">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <button class="discount-save-btn" id="disc-save-btn">+ Add Discount Rule</button>
            </div>

            <div class="discount-section">
              <h3>📋 Configured Discounts</h3>
              <table class="discount-table" id="discounts-list-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Applies To</th>
                    <th>Target</th>
                    <th>Value</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="discounts-list-body">
                  ${discounts.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding:24px;">No discount rules configured yet.</td></tr>' : discounts.map((d, i) => `
                    <tr>
                      <td style="font-weight:700;">${d.name}</td>
                      <td>${d.type === 'individual' ? '👤 Individual' : d.type === 'group' ? '👥 Group' : '🌍 All'}</td>
                      <td>${d.target || '—'}</td>
                      <td style="font-weight:700;color:var(--accent-cyan);">${d.kind === 'percent' ? d.value + '%' : 'KES ' + d.value}</td>
                      <td><span class="discount-badge ${d.status !== 'active' ? 'inactive' : ''}">${d.status.toUpperCase()}</span></td>
                      <td><button class="del-btn" data-disc-idx="${i}">Delete</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- SYSTEM TAB -->
          <div id="stab-system" style="display:${this.activeTab === 'system' ? 'block' : 'none'}">
            <div class="discount-section">
              <h3>🔧 System Configurations</h3>
              <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                  <div style="font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;">💵 Cash Payments
                    <span id="cash-status-badge" style="font-size:10px;padding:2px 8px;border-radius:12px;font-weight:700;background:${cashEnabled ? 'rgba(16,185,129,.15)' : 'rgba(244,63,94,.15)'};color:${cashEnabled ? 'var(--accent-green)' : 'var(--accent-rose)'};"
                    >${cashEnabled ? 'ENABLED' : 'DISABLED'}</span>
                  </div>
                  <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">When disabled, cashiers will not see the Cash option at checkout.</p>
                </div>
                ${isOwner ? `
                  <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;">
                    <input type="checkbox" id="cash-toggle" style="opacity:0;width:0;height:0;" ${cashEnabled ? 'checked' : ''}>
                    <span id="cash-toggle-slider" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${cashEnabled ? '#10b981' : '#374151'};border-radius:24px;transition:.3s;">
                      <span style="position:absolute;height:18px;width:18px;left:${cashEnabled ? '23px' : '3px'};bottom:3px;background:white;border-radius:50%;transition:.3s;display:block;"></span>
                    </span>
                  </label>` : `<span style="font-size:11px;color:var(--text-muted);">Owner access only</span>`}
              </div>
              <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border-color);border-radius:8px;padding:16px;">
                <div style="font-weight:700;font-size:14px;margin-bottom:12px;">🏛️ KRA eTIMS Credentials</div>
                <div style="margin-bottom:12px;">
                  <label style="font-size:11px;color:var(--text-secondary);">Taxpayer eTIMS PIN</label>
                  <input type="text" id="set-taxpayer-pin" value="${state.currentTenant ? state.currentTenant.kra_pin : ''}" style="width:100%;padding:8px;border-radius:4px;background:rgba(0,0,0,0.2);border:1px solid var(--border-color);color:#fff;margin-top:4px;">
                </div>
                <div style="margin-bottom:16px;">
                  <label style="font-size:11px;color:var(--text-secondary);">eTIMS Control Unit Serial (OSCU)</label>
                  <input type="text" value="OSCU020004992" readonly style="width:100%;padding:8px;border-radius:4px;background:rgba(0,0,0,0.2);border:1px solid var(--border-color);color:#fff;margin-top:4px;">
                </div>
                <button id="save-kra-settings" style="background:var(--accent-blue);color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:700;cursor:pointer;">Save KRA Config</button>
              </div>
            </div>
          </div>

          <!-- AUDIT TAB -->
          <div id="stab-staff" style="display:${this.activeTab === 'staff' ? 'block' : 'none'}"></div>

          <div id="stab-audit" style="display:${this.activeTab === 'audit' ? 'block' : 'none'}">
            <div class="discount-section">
              <h3>🔒 Audit Ledger Verification</h3>
              <p style="font-size:13px;color:var(--text-secondary);margin:0 0 16px 0;">Verify the cryptographic hash chain of all system events to detect tampering.</p>
              <button id="verify-logs-btn" style="background:rgba(255,255,255,0.1);color:#fff;border:1px solid var(--border-color);padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer;">🔍 Verify Integrity</button>
              <div id="integrity-result-box" style="margin-top:16px;padding:14px;border-radius:8px;font-size:13px;" class="hidden"></div>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  /**
   * Staff management, moved out of its own sidebar entry.
   *
   * UsersView owns its markup and events, so it is mounted into the pane rather
   * than reimplemented here - there is one place that creates staff, and it is
   * the one already wired to createStaffUser.
   */
  mountStaffPane() {
    if (this.activeTab !== 'staff') return;
    const pane = document.getElementById('stab-staff');
    if (!pane) return;

    this.usersView = new UsersView(pane);
    this.usersView.load();
  }

  bindEvents() {
    this.mountStaffPane();

    // Sub-tab switching
    this.container.querySelectorAll('[data-stab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeTab = e.currentTarget.getAttribute('data-stab');
        this.render();
        this.bindEvents();
      });
    });

    // General Settings Save
    const saveGenBtn = document.getElementById('save-general-settings');
    if (saveGenBtn) saveGenBtn.addEventListener('click', async () => {
      const name = document.getElementById('set-establishment-name').value;
      if (state.currentTenant && name) {
        state.currentTenant.trading_name = name;
        await db.tenants.update(state.currentTenant.id, { trading_name: name });
      }
      showNotification('General settings saved.', 'success');
    });

    // Discount Save
    const discSaveBtn = document.getElementById('disc-save-btn');
    if (discSaveBtn) discSaveBtn.addEventListener('click', () => {
      const name = document.getElementById('disc-name').value.trim();
      const type = document.getElementById('disc-type').value;
      const value = parseFloat(document.getElementById('disc-value').value);
      const kind = document.getElementById('disc-kind').value;
      const target = document.getElementById('disc-target').value.trim();
      const status = document.getElementById('disc-status').value;
      if (!name || isNaN(value) || value <= 0) {
        showNotification('Please enter a valid discount name and value.', 'error');
        return;
      }
      const discounts = JSON.parse(localStorage.getItem('pos_discounts') || '[]');
      discounts.push({ name, type, value, kind, target, status });
      localStorage.setItem('pos_discounts', JSON.stringify(discounts));
      showNotification('Discount rule "' + name + '" saved!', 'success');
      this.render();
      this.bindEvents();
    });

    // Discount Delete
    this.container.querySelectorAll('[data-disc-idx]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-disc-idx'));
        const discounts = JSON.parse(localStorage.getItem('pos_discounts') || '[]');
        discounts.splice(idx, 1);
        localStorage.setItem('pos_discounts', JSON.stringify(discounts));
        showNotification('Discount rule deleted.', 'warning');
        this.render();
        this.bindEvents();
      });
    });

    // Cash toggle (System tab)
    const toggle = document.getElementById('cash-toggle');
    if (toggle) {
      toggle.addEventListener('change', () => {
        const enabled = toggle.checked;
        localStorage.setItem('pos_cash_enabled', String(enabled));
        const badge  = document.getElementById('cash-status-badge');
        const slider = document.getElementById('cash-toggle-slider');
        if (badge) { badge.textContent = enabled ? 'ENABLED' : 'DISABLED'; badge.style.background = enabled ? 'rgba(16,185,129,.15)' : 'rgba(244,63,94,.15)'; badge.style.color = enabled ? 'var(--accent-green)' : 'var(--accent-rose)'; }
        if (slider) { slider.style.background = enabled ? '#10b981' : '#374151'; slider.querySelector('span').style.left = enabled ? '23px' : '3px'; }
        showNotification('Cash payments ' + (enabled ? 'enabled' : 'DISABLED') + '.', enabled ? 'success' : 'warning');
      });
    }

    // Cash toggle (Payments sub-tab)
    const payToggle = document.getElementById('payments-cash-toggle');
    if (payToggle) {
      payToggle.addEventListener('change', () => {
        const enabled = payToggle.checked;
        localStorage.setItem('pos_cash_enabled', String(enabled));
        const badge  = document.getElementById('payments-cash-badge');
        const slider = document.getElementById('payments-cash-slider');
        if (badge) {
          badge.textContent = enabled ? 'ENABLED' : 'DISABLED';
          badge.style.background = enabled ? 'rgba(16,185,129,.15)' : 'rgba(244,63,94,.15)';
          badge.style.color = enabled ? 'var(--accent-green)' : 'var(--accent-rose)';
        }
        if (slider) {
          slider.style.background = enabled ? '#10b981' : '#374151';
          slider.querySelector('span').style.left = enabled ? '26px' : '3px';
        }
        showNotification('Owner Payment Policy: Cash payments ' + (enabled ? 'ENABLED' : 'DISABLED') + '.', enabled ? 'success' : 'warning');
      });
    }

    // KRA settings
    const saveKra = document.getElementById('save-kra-settings');
    if (saveKra) saveKra.addEventListener('click', () => {
      const pin = document.getElementById('set-taxpayer-pin').value;
      if (!pin) return;
      if (state.currentTenant) { state.currentTenant.kra_pin = pin; db.tenants.update(state.currentTenant.id, { kra_pin: pin }); }
      showNotification('KRA Settings saved.', 'success');
    });

    // Verify Logs
    const verifyBtn = document.getElementById('verify-logs-btn');
    if (verifyBtn) verifyBtn.addEventListener('click', async () => {
      const res = await verifyAuditTrail();
      const box = document.getElementById('integrity-result-box');
      box.classList.remove('hidden');
      if (res.valid) {
        box.style.cssText = 'background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:var(--accent-green);padding:14px;border-radius:8px;font-size:13px;margin-top:16px;';
        box.innerHTML = '<b>Integrity Verified ✅</b> — ' + res.count + ' chained records validated with zero mismatches.';
        showNotification('Ledger integrity verified.', 'success');
      } else {
        box.style.cssText = 'background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.3);color:var(--accent-rose);padding:14px;border-radius:8px;font-size:13px;margin-top:16px;';
        box.innerHTML = '<b>⚠️ Integrity FAILED!</b> — ' + res.reason + ' (index: ' + res.brokenIndex + ').';
        showNotification('Ledger integrity compromised!', 'error');
      }
    });
  }
}
