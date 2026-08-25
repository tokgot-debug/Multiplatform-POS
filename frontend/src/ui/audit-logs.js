import { db } from '../db/schema';
import { state, showNotification } from '../context';
import { verifyAuditTrail } from '../db/index';

export class AuditLogsView {
  constructor(container) {
    this.container = container;
  }

  async load() {
    this.render();
    await this.populateLogs();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; color: var(--text-primary); max-width: 1200px; margin: 0 auto; font-family: var(--font-main);">
        
        <!-- Header Section -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--glass-shadow);">
          <div>
            <h2 style="margin: 0 0 6px 0; font-family: var(--font-display); font-size: 22px; font-weight: 800; color: #fff; letter-spacing: 0.5px;">Security Audit Trail</h2>
            <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">Cryptographically chained immutable ledger recording user actions and system changes.</p>
          </div>
          <button id="btn-verify-chain" style="background: var(--accent-amber); color: #000; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
            🔒 Verify Chain Integrity
          </button>
        </div>

        <!-- Filter bar -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px 24px; margin-bottom: 20px; display: flex; gap: 16px; flex-wrap: wrap; align-items: center; box-shadow: var(--glass-shadow);">
          <div style="flex: 1; min-width: 200px;">
            <label style="display: block; font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Search Description / ID</label>
            <input type="text" id="log-search" placeholder="Search logs..." style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px;">
          </div>
          
          <div style="width: 200px;">
            <label style="display: block; font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Filter by Action</label>
            <select id="log-filter-action" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px;">
              <option value="ALL">All Actions</option>
              <option value="LOGIN">User Logins</option>
              <option value="SALE_CHECKOUT">Till Sales</option>
              <option value="STOCK_DELIVERY">Stock Deliveries</option>
              <option value="STOCK_ADJUSTMENT">Stock Adjustments</option>
              <option value="APPROVE_REQUISITION">Requisition Approvals</option>
              <option value="DISPATCH_REQUISITION">Requisition Dispatches</option>
              <option value="SHIFT_OPEN">Shift Opens</option>
              <option value="SHIFT_CLOSE_Z">Shift Z-Reports</option>
              <option value="CASH_IN">Cash Inflow Adjustments</option>
              <option value="CASH_OUT">Cash Outflow Adjustments</option>
            </select>
          </div>

          <div style="width: 180px;">
            <label style="display: block; font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">Filter by User</label>
            <select id="log-filter-user" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px;">
              <option value="ALL">All Staff</option>
              <!-- Populated dynamically -->
            </select>
          </div>
        </div>

        <!-- Audit Table -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; box-shadow: var(--glass-shadow);">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-color); background: rgba(0,0,0,0.3);">
                <th style="padding: 16px 20px; font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; width: 180px;">Timestamp</th>
                <th style="padding: 16px 20px; font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; width: 160px;">Staff Member</th>
                <th style="padding: 16px 20px; font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; width: 180px;">Action / Event</th>
                <th style="padding: 16px 20px; font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase;">Activity Details</th>
                <th style="padding: 16px 20px; font-size: 11px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; width: 140px; text-align: right;">Block Hash</th>
              </tr>
            </thead>
            <tbody id="audit-table-body">
              <!-- Logs populated dynamically -->
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async populateLogs() {
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;
    
    const searchVal = document.getElementById('log-search').value.toLowerCase();
    const actionVal = document.getElementById('log-filter-action').value;
    const userVal = document.getElementById('log-filter-user').value;

    const allUsers = await db.users.toArray();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // Populate user filter dropdown once if empty
    const userSelect = document.getElementById('log-filter-user');
    if (userSelect && userSelect.children.length === 1) {
      allUsers.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.name} (${u.role})`;
        userSelect.appendChild(opt);
      });
    }

    const logs = await db.audit_log.orderBy('created_at').reverse().toArray();
    const filtered = [];

    for (const log of logs) {
      // 1. Action filter
      if (actionVal !== 'ALL' && log.action !== actionVal) continue;

      // 2. User filter
      if (userVal !== 'ALL' && log.actor_id !== userVal) continue;

      const actor = userMap.get(log.actor_id);
      const actorName = actor ? actor.name : (log.actor_id === 'system' ? 'SYSTEM' : 'Unknown (' + log.actor_id + ')');
      const actorRole = actor ? actor.role : '';

      // Create a human readable detail description
      let details = `Performed action on ${log.entity_type} ID: ${log.entity_id}`;
      
      if (log.action === 'LOGIN') {
        details = `Logged into Till Session successfully.`;
      } else if (log.action === 'SALE_CHECKOUT') {
        details = `Finalized sale order checkout. Sale ID: ${log.entity_id.split('-')[0].toUpperCase()}`;
      } else if (log.action === 'STOCK_DELIVERY') {
        const after = log.after_json ? JSON.parse(log.after_json) : null;
        const delta = after ? after.delta : 0;
        details = `Received incoming supplier stock delivery of +${delta} units (Location: ${after?.location || 'STORE'}). Reason: ${after?.reason || ''}`;
      } else if (log.action === 'STOCK_ADJUSTMENT') {
        const after = log.after_json ? JSON.parse(log.after_json) : null;
        const delta = after ? after.delta : 0;
        details = `Adjusted physical stock level by ${delta > 0 ? '+' : ''}${delta} units (Location: ${after?.location || 'STORE'}). Reason: ${after?.reason || ''}`;
      } else if (log.action === 'APPROVE_REQUISITION') {
        details = `Approved pending house stock requisition ID: ${log.entity_id.split('-')[0].toUpperCase()}`;
      } else if (log.action === 'DISPATCH_REQUISITION') {
        details = `Issued and dispatched requisition stock to counter. Requisition ID: ${log.entity_id.split('-')[0].toUpperCase()}`;
      } else if (log.action === 'SHIFT_OPEN') {
        details = `Opened a new cashier shift session (Shift ID: ${log.entity_id.split('-')[0].toUpperCase()}).`;
      } else if (log.action === 'SHIFT_CLOSE_Z') {
        const after = log.after_json ? JSON.parse(log.after_json) : null;
        details = `Closed shifts, generated Z-Report. Counted cash KES ${after?.countedCash || 0} (Variance KES ${after?.cashVariance || 0}).`;
      } else if (log.action === 'CASH_IN') {
        const after = log.after_json ? JSON.parse(log.after_json) : null;
        details = `Deposited cash float of KES ${after?.amount || 0}. Reason: ${after?.reason || ''}`;
      } else if (log.action === 'CASH_OUT') {
        const after = log.after_json ? JSON.parse(log.after_json) : null;
        details = `Paid out cash from drawer KES ${after?.amount || 0}. Reason: ${after?.reason || ''}`;
      } else if (log.action === 'SEED_DB') {
        details = `Database seeded / initialized.`;
      }

      // 3. Search filter
      if (searchVal && !details.toLowerCase().includes(searchVal) && !actorName.toLowerCase().includes(searchVal) && !log.action.toLowerCase().includes(searchVal)) {
        continue;
      }

      filtered.push({ log, actorName, actorRole, details });
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 32px; text-align: center; color: var(--text-muted);">No matching audit log entries found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(({ log, actorName, actorRole, details }) => {
      let badgeBg = 'rgba(255,255,255,0.06)';
      let badgeColor = '#fff';
      if (log.action.includes('SALE')) {
        badgeBg = 'rgba(16,185,129,0.1)';
        badgeColor = '#10b981';
      } else if (log.action.includes('STOCK')) {
        badgeBg = 'rgba(245,158,11,0.1)';
        badgeColor = '#F59E0B';
      } else if (log.action.includes('REQUISITION')) {
        badgeBg = 'rgba(59,130,246,0.1)';
        badgeColor = '#3b82f6';
      } else if (log.action.includes('SHIFT') || log.action.includes('CASH')) {
        badgeBg = 'rgba(139,92,246,0.1)';
        badgeColor = '#8b5cf6';
      }

      return `
        <tr style="border-bottom: 1px solid var(--border-color); font-size: 13px;">
          <td style="padding: 14px 20px; color: var(--text-secondary);">${new Date(log.created_at).toLocaleString()}</td>
          <td style="padding: 14px 20px; font-weight: 700; color: #fff;">
            ${actorName}
            <div style="font-size: 10px; color: var(--text-secondary); font-weight: normal; margin-top: 2px;">${actorRole || 'System Event'}</div>
          </td>
          <td style="padding: 14px 20px;">
            <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid rgba(255,255,255,0.02);">
              ${log.action}
            </span>
          </td>
          <td style="padding: 14px 20px; color: var(--text-primary); line-height: 1.4;">${details}</td>
          <td style="padding: 14px 20px; text-align: right;">
            <code style="font-family: monospace; font-size: 11px; color: var(--accent-amber); background: rgba(232,165,53,0.06); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(232,165,53,0.15);">
              ${log.hash ? log.hash.slice(0, 8) : '00000000'}
            </code>
          </td>
        </tr>
      `;
    }).join('');
  }

  bindEvents() {
    document.getElementById('log-search').addEventListener('input', () => this.populateLogs());
    document.getElementById('log-filter-action').addEventListener('change', () => this.populateLogs());
    document.getElementById('log-filter-user').addEventListener('change', () => this.populateLogs());

    document.getElementById('btn-verify-chain').addEventListener('click', async () => {
      const btn = document.getElementById('btn-verify-chain');
      btn.disabled = true;
      btn.textContent = '🔒 Verifying chain...';
      
      try {
        const result = await verifyAuditTrail();
        if (result.valid) {
          showNotification(`✓ Hash Integrity Verified! Checked ${result.count} audit blocks. Security state is fully secure.`, 'success');
          alert(`Cryptographic Audit Chain Integrity: SECURE\n\n- recalculation matches Dexie blockchain chain\n- verified logs count: ${result.count}\n- zero integrity failures detected.`);
        } else {
          showNotification(`⚠ Cryptographic Chain Broker at index ${result.brokenIndex}! ${result.reason}`, 'error');
          alert(`Warning: Security integrity violation detected!\n\n${result.reason}`);
        }
      } catch (err) {
        showNotification('Verification failed: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '🔒 Verify Chain Integrity';
      }
    });
  }
}
