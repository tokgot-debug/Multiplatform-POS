import { db } from '../db/schema';
import { state } from '../context';

export class MpesaView {
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
        
        <!-- Top Cards -->
        <div style="display: flex; gap: 20px; margin-bottom: 24px;">
          <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; min-width: 200px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; letter-spacing: 0.5px;">TOTAL SUCCESSFUL</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--accent-green);" id="mpesa-total-success">KES 0</div>
          </div>
          <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; min-width: 200px;">
            <div style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; letter-spacing: 0.5px;">TOTAL CANCELLED/FAILED</div>
            <div style="font-size: 24px; font-weight: 800; color: var(--accent-rose);" id="mpesa-total-failed">KES 0</div>
          </div>
        </div>

        <!-- Payments Viewer Section -->
        <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
          
          <!-- Control Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid var(--border-color);">
            <div style="font-weight: 700; font-size: 16px; display: flex; align-items: center; gap: 8px;">
              <span style="color: #F59E0B;">💵</span> Payments Viewer
            </div>
            <div style="display: flex; gap: 12px;">
              <div style="position: relative;">
                <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">🔍</span>
                <input type="text" id="mpesa-search" placeholder="Search Phone/Reference..." style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px 8px 32px; color: var(--text-primary); font-family: var(--font-main); font-size: 13px; width: 250px;">
              </div>
              <select id="mpesa-status-filter" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px; color: var(--text-primary); font-family: var(--font-main); font-size: 13px;">
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          <!-- Table -->
          <div style="overflow-x: auto;">
            <table class="pos-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr>
                  <th style="padding: 12px 16px; font-size: 11px; color: var(--text-secondary);">DATE/TIME</th>
                  <th style="padding: 12px 16px; font-size: 11px; color: var(--text-secondary);">REFERENCE (ORDER ID)</th>
                  <th style="padding: 12px 16px; font-size: 11px; color: var(--text-secondary);">PHONE</th>
                  <th style="padding: 12px 16px; font-size: 11px; color: var(--text-secondary);">AMOUNT (KES)</th>
                  <th style="padding: 12px 16px; font-size: 11px; color: var(--text-secondary);">STATUS</th>
                  <th style="padding: 12px 16px; font-size: 11px; color: var(--text-secondary);">MESSAGE</th>
                </tr>
              </thead>
              <tbody id="mpesa-table-body">
                <!-- Rows injected here -->
              </tbody>
            </table>
          </div>

        </div>
      </div>
    `;

    document.getElementById('mpesa-search').addEventListener('input', () => this.populateData());
    document.getElementById('mpesa-status-filter').addEventListener('change', () => this.populateData());
  }

  async populateData() {
    const tbody = document.getElementById('mpesa-table-body');
    const search = document.getElementById('mpesa-search').value.toLowerCase();
    const filter = document.getElementById('mpesa-status-filter').value;
    
    // We will pull from db.payments for Mobile Money
    const payments = await db.payments.where('method').equals('Mobile Money').toArray();
    
    // Aggregate totals
    let successTotal = 0;
    let failedTotal = 0;
    
    const rowsHtml = [];
    
    // Sort descending by created_at
    payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    for (const p of payments) {
      // Logic for filtering
      const status = p.status || 'SUCCESS'; // Default to success if older records don't have it
      
      if (status === 'SUCCESS') successTotal += p.amount;
      else failedTotal += p.amount;

      if (filter !== 'ALL' && status !== filter) continue;
      
      const ref = (p.reference || 'N/A').toLowerCase();
      const phone = (p.metadata?.phone || 'N/A').toLowerCase();
      
      if (search && !ref.includes(search) && !phone.includes(search)) continue;

      const dateStr = new Date(p.created_at).toLocaleString('en-US', { 
        month: 'numeric', day: 'numeric', year: 'numeric', 
        hour: 'numeric', minute: 'numeric', hour12: true 
      });

      const badgeColor = status === 'SUCCESS' ? 'var(--accent-green)' : 'var(--accent-rose)';
      const badgeBg = status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)';

      rowsHtml.push(`
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 12px 16px; font-size: 13px; color: var(--text-muted);">${dateStr}</td>
          <td style="padding: 12px 16px; font-size: 13px; font-family: monospace; font-weight: 600;">
            <span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px;">${p.reference || p.id.split('-')[0].toUpperCase()}</span>
          </td>
          <td style="padding: 12px 16px; font-size: 13px; font-weight: 700;">${p.metadata?.phone || '-'}</td>
          <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #F59E0B;">${p.amount}</td>
          <td style="padding: 12px 16px;">
            <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 800;">${status}</span>
          </td>
          <td style="padding: 12px 16px; font-size: 12px; color: var(--text-muted);">${status === 'SUCCESS' ? 'The service request is processed successfully.' : 'Transaction failed or cancelled by user.'}</td>
        </tr>
      `);
    }

    if (rowsHtml.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">No Mpesa transactions found.</td></tr>`;
    } else {
      tbody.innerHTML = rowsHtml.join('');
    }

    document.getElementById('mpesa-total-success').innerText = `KES ${successTotal.toLocaleString()}`;
    document.getElementById('mpesa-total-failed').innerText = `KES ${failedTotal.toLocaleString()}`;
  }
}
