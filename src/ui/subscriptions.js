import { db } from '../db/schema';
import { state, showNotification } from '../context';
import { logAuditEvent } from '../db/index';

export class SubscriptionsView {
  constructor(container) {
    this.container = container;
  }

  async load() {
    this.render();
    await this.loadTenantDetails();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; color: var(--text-primary); max-width: 1200px; margin: 0 auto; font-family: var(--font-main);">
        
        <!-- Header -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-family: var(--font-display); font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px;">💎 Subscription & License Center</h2>
          <p style="color: var(--text-secondary); font-size: 13px;">Manage your business license, renew subscription tiers, or register a new business instance.</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: flex-start;">
          
          <!-- Left Column: Current Status & Registration -->
          <div style="display: flex; flex-direction: column; gap: 24px;">
            
            <!-- Current Status Card -->
            <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--glass-shadow);">
              <h3 style="margin-top: 0; margin-bottom: 18px; font-size: 16px; color: #fff; display: flex; align-items: center; gap: 8px;">
                <span>🏢</span> Current Business License
              </h3>
              
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                <div>
                  <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Trading Name</div>
                  <strong id="sub-trading-name" style="color: #fff; font-size: 14px;">-</strong>
                </div>
                <div>
                  <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Legal Company Name</div>
                  <div id="sub-legal-name" style="color: var(--text-secondary); font-size: 13px;">-</div>
                </div>
                <div>
                  <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">KRA PIN</div>
                  <code id="sub-kra-pin" style="color: var(--text-secondary); font-size: 13px;">-</code>
                </div>
                <div>
                  <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Tenant ID</div>
                  <code id="sub-tenant-id" style="color: var(--text-secondary); font-size: 13px;">-</code>
                </div>
              </div>

              <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div>
                    <span id="sub-plan-badge" style="background: rgba(56, 189, 248, 0.15); color: var(--accent-cyan); font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">Bronze Standard</span>
                    <span id="sub-status-badge" style="background: rgba(16, 185, 129, 0.15); color: var(--accent-green); font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; margin-left: 6px;">Active</span>
                  </div>
                  <div style="font-size: 12px; color: var(--text-secondary);" id="sub-days-left">Calculating remaining time...</div>
                </div>
                
                <!-- Progress Bar -->
                <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; margin-bottom: 16px;">
                  <div id="sub-progress-bar" style="height: 100%; width: 0%; background: var(--accent-green); transition: width 0.5s ease;"></div>
                </div>
                <div style="font-size: 11px; color: var(--text-muted);">
                  Valid until: <span id="sub-expiry-date" style="color: var(--text-secondary); font-weight: 600;">-</span>
                </div>
              </div>
            </div>

            <!-- Register New Tenant / Business Instance -->
            <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--glass-shadow);">
              <h3 style="margin-top: 0; margin-bottom: 6px; font-size: 16px; color: #fff; display: flex; align-items: center; gap: 8px;">
                <span>🚀</span> Register New Business Instance
              </h3>
              <p style="color: var(--text-secondary); font-size: 12px; margin-bottom: 20px;">Setting up a separate business counter? Create a new standalone tenant workspace. It comes with a 14-day free trial.</p>

              <form id="tenant-reg-form" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                <div style="grid-column: span 2;">
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Business Trading Name</label>
                  <input type="text" id="reg-trading-name" placeholder="e.g. Mama Fish Bistro" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none;">
                </div>
                
                <div>
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Legal Company Name</label>
                  <input type="text" id="reg-legal-name" placeholder="e.g. Mama Fish Ltd" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none;">
                </div>
                
                <div>
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">KRA PIN</label>
                  <input type="text" id="reg-kra-pin" placeholder="e.g. P059999999Z" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none;">
                </div>

                <div style="grid-column: span 2; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 8px; padding-top: 16px;">
                  <h4 style="margin: 0 0 12px 0; font-size: 13px; color: #fff;">Default Administrator Account</h4>
                </div>

                <div>
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Admin Name</label>
                  <input type="text" id="reg-admin-name" placeholder="e.g. Jane Doe" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none;">
                </div>

                <div>
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Phone Number</label>
                  <input type="tel" id="reg-admin-phone" placeholder="e.g. 0712345678" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none;">
                </div>

                <div>
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Email Address</label>
                  <input type="email" id="reg-admin-email" placeholder="e.g. admin@bistro.co.ke" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none;">
                </div>

                <div>
                  <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Login passcode / pin (4 digits)</label>
                  <input type="password" id="reg-admin-pin" placeholder="e.g. 1234" maxlength="4" minlength="4" required style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: #fff; font-size: 13px; outline: none; letter-spacing: 4px;">
                </div>

                <div style="grid-column: span 2; display: flex; justify-content: flex-end; margin-top: 12px;">
                  <button type="submit" style="background: var(--accent-green); color: #fff; border: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
                    🏢 Register &amp; Setup Workspace
                  </button>
                </div>
              </form>
            </div>

          </div>

          <!-- Right Column: Plans and Renewal Billing -->
          <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; box-shadow: var(--glass-shadow); display: flex; flex-direction: column; gap: 20px;">
            <h3 style="margin-top: 0; margin-bottom: 6px; font-size: 16px; color: #fff;">💰 Renew or Upgrade Plan</h3>
            <p style="color: var(--text-secondary); font-size: 12px;">Select a billing tier below and trigger an M-Pesa STK push simulation to renew instantly.</p>

            <div style="display: flex; flex-direction: column; gap: 12px;">
              
              <!-- Plan Item 1 -->
              <label class="plan-select-label" style="border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: rgba(255,255,255,0.01); transition: all 0.2s;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <input type="radio" name="billing-plan" value="Bronze Standard" data-price="3000" checked style="accent-color: var(--accent-amber);">
                  <div>
                    <strong style="color: #fff; font-size: 13px;">Bronze Standard</strong>
                    <div style="font-size: 11px; color: var(--text-secondary);">Up to 3 staff members</div>
                  </div>
                </div>
                <strong style="color: var(--accent-amber); font-size: 13px;">KES 3,000/mo</strong>
              </label>

              <!-- Plan Item 2 -->
              <label class="plan-select-label" style="border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: rgba(255,255,255,0.01); transition: all 0.2s;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <input type="radio" name="billing-plan" value="Silver Premium" data-price="5500" style="accent-color: var(--accent-amber);">
                  <div>
                    <strong style="color: #fff; font-size: 13px;">Silver Premium</strong>
                    <div style="font-size: 11px; color: var(--text-secondary);">Up to 10 staff members</div>
                  </div>
                </div>
                <strong style="color: var(--accent-amber); font-size: 13px;">KES 5,500/mo</strong>
              </label>

              <!-- Plan Item 3 -->
              <label class="plan-select-label" style="border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: rgba(255,255,255,0.01); transition: all 0.2s;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <input type="radio" name="billing-plan" value="Gold Enterprise" data-price="10000" style="accent-color: var(--accent-amber);">
                  <div>
                    <strong style="color: #fff; font-size: 13px;">Gold Enterprise</strong>
                    <div style="font-size: 11px; color: var(--text-secondary);">Unlimited staff, priority sync</div>
                  </div>
                </div>
                <strong style="color: var(--accent-amber); font-size: 13px;">KES 10,000/mo</strong>
              </label>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
              <label style="display: block; font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">M-Pesa Mobile Number</label>
              <input type="tel" id="billing-phone" placeholder="07XXXXXXXX" style="width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 12px; color: #fff; font-size: 13px; outline: none; font-family: monospace; margin-bottom: 14px;">
              
              <button id="btn-trigger-renewal" style="width: 100%; background: var(--accent-amber); color: #000; border: none; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span>📲</span> Pay &amp; Activate License
              </button>
            </div>

            <!-- Billing Info Alert -->
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; font-size: 11px; color: var(--text-muted); line-height: 1.4;">
              ⚠️ <strong>Auto-renewal Policy:</strong> Subscriptions are non-refundable and valid for 30 days. Payments are validated using our Sandbox payment router.
            </div>

          </div>

        </div>

      </div>

      <!-- M-Pesa STK Push Loader Overlay Modal -->
      <div id="mpesa-stk-modal" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 99999; justify-content: center; align-items: center; padding: 20px;">
        <div style="background: #18181b; border: 1px solid var(--border-color); border-radius: 16px; width: 100%; max-width: 380px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); text-align: center; padding: 32px 24px;">
          <div id="mpesa-loader-spinner" style="width: 50px; height: 50px; border: 4px solid rgba(16, 185, 129, 0.1); border-top-color: var(--accent-green); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
          <h4 id="mpesa-loader-title" style="color: #fff; font-size: 16px; margin: 0 0 10px 0;">Sending STK Push Request...</h4>
          <p id="mpesa-loader-desc" style="color: var(--text-secondary); font-size: 12px; margin: 0 0 20px 0;">Please check your phone for the M-Pesa PIN prompt.</p>
          <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;" id="mpesa-loader-details">KES 3,000.00 • Bronze Standard</div>
        </div>
      </div>

      <style>
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
  }

  async loadTenantDetails() {
    const tenant = state.currentTenant;
    if (!tenant) return;

    document.getElementById('sub-trading-name').textContent = tenant.trading_name || 'N/A';
    document.getElementById('sub-legal-name').textContent = tenant.legal_name || 'N/A';
    document.getElementById('sub-kra-pin').textContent = tenant.kra_pin || 'N/A';
    document.getElementById('sub-tenant-id').textContent = tenant.id || 'N/A';

    const plan = tenant.subscription_plan || 'Free Trial';
    const status = tenant.subscription_status || 'TRIAL';
    const expires = tenant.subscription_expires;

    document.getElementById('sub-plan-badge').textContent = plan;
    
    const statusBadge = document.getElementById('sub-status-badge');
    statusBadge.textContent = status;

    if (status === 'ACTIVE') {
      statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      statusBadge.style.color = 'var(--accent-green)';
    } else if (status === 'TRIAL') {
      statusBadge.style.background = 'rgba(56, 189, 248, 0.15)';
      statusBadge.style.color = 'var(--accent-cyan)';
    } else {
      statusBadge.style.background = 'rgba(244, 63, 94, 0.15)';
      statusBadge.style.color = 'var(--accent-rose)';
    }

    if (expires) {
      const expDate = new Date(expires);
      document.getElementById('sub-expiry-date').textContent = expDate.toLocaleString();

      const timeDiff = expDate - new Date();
      const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      const daysLeftText = document.getElementById('sub-days-left');
      const progressBar = document.getElementById('sub-progress-bar');

      if (daysLeft > 0) {
        daysLeftText.textContent = `${daysLeft} days remaining`;
        daysLeftText.style.color = 'var(--text-secondary)';
        
        // Calculate progress percentage out of 30 days
        const percent = Math.min(100, Math.max(0, (daysLeft / 30) * 100));
        progressBar.style.width = `${percent}%`;
        progressBar.style.background = daysLeft <= 5 ? 'var(--accent-rose)' : 'var(--accent-green)';
      } else {
        daysLeftText.textContent = 'Expired';
        daysLeftText.style.color = 'var(--accent-rose)';
        progressBar.style.width = '0%';
      }
    } else {
      document.getElementById('sub-expiry-date').textContent = 'Lifetime Trial';
      document.getElementById('sub-days-left').textContent = 'Active Trial';
      document.getElementById('sub-progress-bar').style.width = '100%';
    }

    // Set default phone value if user exists
    if (state.currentUser && state.currentUser.phone) {
      const billingPhone = document.getElementById('billing-phone');
      if (billingPhone && !billingPhone.value) {
        billingPhone.value = state.currentUser.phone;
      }
    }
  }

  bindEvents() {
    // 1. Plan switching UI highlights
    const planLabels = this.container.querySelectorAll('.plan-select-label');
    planLabels.forEach(label => {
      label.addEventListener('click', () => {
        planLabels.forEach(l => {
          l.style.borderColor = 'var(--border-color)';
          l.style.background = 'rgba(255,255,255,0.01)';
        });
        label.style.borderColor = 'var(--accent-cyan)';
        label.style.background = 'rgba(56, 189, 248, 0.03)';
      });
    });

    // 2. STK Push simulated payment triggers
    const payBtn = document.getElementById('btn-trigger-renewal');
    if (payBtn) {
      payBtn.addEventListener('click', async () => {
        const phone = document.getElementById('billing-phone').value.trim();
        if (!phone || phone.length < 10) {
          showNotification('Please enter a valid 10-digit mobile number.', 'error');
          return;
        }

        const selectedRadio = this.container.querySelector('input[name="billing-plan"]:checked');
        const planName = selectedRadio.value;
        const planPrice = parseInt(selectedRadio.getAttribute('data-price'));

        // Show Simulated M-Pesa Loader
        const modal = document.getElementById('mpesa-stk-modal');
        const loaderTitle = document.getElementById('mpesa-loader-title');
        const loaderDesc = document.getElementById('mpesa-loader-desc');
        const loaderDetails = document.getElementById('mpesa-loader-details');
        const loaderSpinner = document.getElementById('mpesa-loader-spinner');

        loaderTitle.textContent = 'Sending STK Push Request...';
        loaderDesc.textContent = 'Please check your phone for the M-Pesa PIN prompt.';
        loaderDetails.textContent = `KES ${planPrice.toLocaleString()}.00 • ${planName}`;
        loaderSpinner.style.animation = 'spin 1s linear infinite';
        loaderSpinner.style.borderTopColor = 'var(--accent-green)';
        
        modal.style.display = 'flex';
        modal.classList.add('active');

        // Stage 1: Send Request
        await new Promise(r => setTimeout(r, 2000));
        loaderTitle.textContent = 'Awaiting PIN Verification...';
        loaderDesc.textContent = 'Enter PIN on your simulated handset to authorize.';
        
        // Stage 2: Prompt PIN
        await new Promise(r => setTimeout(r, 2000));
        loaderTitle.textContent = 'Processing Payment...';
        loaderDesc.textContent = 'Verifying funds with Safaricom ledger...';

        // Stage 3: Complete transaction
        await new Promise(r => setTimeout(r, 1500));
        
        try {
          // Update active tenant details in database
          const tenant = state.currentTenant;
          const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // +30 days
          
          await db.tenants.update(tenant.id, {
            subscription_plan: planName,
            subscription_status: 'ACTIVE',
            subscription_expires: expiryDate
          });

          // Refresh memory context
          state.currentTenant.subscription_plan = planName;
          state.currentTenant.subscription_status = 'ACTIVE';
          state.currentTenant.subscription_expires = expiryDate;

          await logAuditEvent(
            tenant.id,
            state.currentUser?.id || 'owner',
            'RENEW_SUBSCRIPTION',
            'TENANT',
            tenant.id,
            null,
            JSON.stringify({ planName, expiryDate })
          );

          loaderSpinner.style.animation = 'none';
          loaderSpinner.style.borderTopColor = 'var(--accent-green)';
          loaderTitle.innerHTML = '<span style="color:var(--accent-green)">✔ Payment Successful</span>';
          loaderDesc.textContent = 'M-Pesa transaction complete. Subscription activated!';
          
          showNotification(`Subscription renewed to ${planName}!`, 'success');
          
          await new Promise(r => setTimeout(r, 2000));
          modal.style.display = 'none';
          modal.classList.remove('active');
          await this.load();
        } catch (err) {
          loaderTitle.textContent = 'Payment Failed';
          loaderDesc.textContent = err.message || 'Verification timed out.';
          await new Promise(r => setTimeout(r, 2000));
          modal.style.display = 'none';
          modal.classList.remove('active');
        }
      });
    }

    // 3. New Tenant Self-Registration form submission
    const regForm = document.getElementById('tenant-reg-form');
    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tradingName = document.getElementById('reg-trading-name').value.trim();
        const legalName = document.getElementById('reg-legal-name').value.trim();
        const kraPin = document.getElementById('reg-kra-pin').value.trim();
        const adminName = document.getElementById('reg-admin-name').value.trim();
        const adminPhone = document.getElementById('reg-admin-phone').value.trim();
        const adminEmail = document.getElementById('reg-admin-email').value.trim();
        const adminPin = document.getElementById('reg-admin-pin').value.trim();

        if (adminPin.length !== 4 || isNaN(parseInt(adminPin))) {
          showNotification('Admin PIN must be a 4-digit number.', 'error');
          return;
        }

        try {
          const newTenantId = `tenant-${crypto.randomUUID().slice(0, 8)}`;
          const newBranchId = `branch-${crypto.randomUUID().slice(0, 8)}`;
          const newUserId = `user-owner-${crypto.randomUUID().slice(0, 8)}`;
          const newDeviceId = `device-${crypto.randomUUID().slice(0, 8)}`;

          // Create in database inside a Dexie transaction
          await db.transaction('rw', db.tenants, db.branches, db.users, db.devices, async () => {
            // A. Create Tenant with 14-day Free Trial
            await db.tenants.add({
              id: newTenantId,
              legal_name: legalName,
              trading_name: tradingName,
              kra_pin: kraPin,
              etims_mode: 'OSCU',
              status: 'ACTIVE',
              subscription_plan: 'Trial Plan',
              subscription_status: 'TRIAL',
              subscription_expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              invite_code: `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
            });

            // B. Create Default Branch
            await db.branches.add({
              id: newBranchId,
              tenant_id: newTenantId,
              name: 'Main Counter',
              code: 'BH001',
              etims_bhf_id: '00',
              is_active: 1
            });

            // C. Create Owner User
            await db.users.add({
              id: newUserId,
              tenant_id: newTenantId,
              name: adminName,
              phone: adminPhone,
              email: adminEmail,
              pin: adminPin,
              status: 'ACTIVE',
              role: 'Owner'
            });

            // D. Create Device
            await db.devices.add({
              id: newDeviceId,
              tenant_id: newTenantId,
              branch_id: newBranchId,
              label: 'Till Device'
            });
          });

          await logAuditEvent(
            newTenantId,
            newUserId,
            'REGISTER_TENANT',
            'TENANT',
            newTenantId,
            null,
            JSON.stringify({ tradingName, legalName, adminName })
          );

          showNotification(`Workspace ${tradingName} successfully created!`, 'success');
          alert(`Workspace "${tradingName}" has been successfully set up with a 14-day trial.\n\nTo login:\n1. Choose your name "${adminName}" on the login screen.\n2. Enter the PIN you created.`);

          // Log out / lock app and force reload user dropdown on PIN screen
          state.currentUser = null;
          state.currentTenant = null;
          state.currentBranch = null;
          
          // Re-populate PIN screen users
          const select = document.getElementById('pin-user-select');
          if (select) {
            const users = await db.users.where('status').equals('ACTIVE').toArray();
            select.innerHTML = '';
            users.forEach(usr => {
              const option = document.createElement('option');
              option.value = usr.id;
              option.textContent = `${usr.name} (${usr.role})`;
              select.appendChild(option);
            });
          }

          // Lock POS shell back to login modal
          document.getElementById('pin-modal').classList.add('active');
          document.getElementById('pos-shell').classList.add('hidden');
          document.getElementById('pin-input').value = '';
          document.getElementById('pin-error').innerText = '';

        } catch (err) {
          console.error(err);
          showNotification('Registration failed: ' + err.message, 'error');
        }
      });
    }
  }
}
