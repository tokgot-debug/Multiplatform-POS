import { db } from '../db/schema';
import { state, showNotification } from '../context';
import { logAuditEvent } from '../db/index';

export class KDSView {
  constructor(container) {
    this.container = container;
    this.pollInterval = null;
    this.tickets = [];
  }

  async load() {
    this.render();
    await this.fetchTickets();
    this.startPolling();
  }

  unload() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  startPolling() {
    this.unload();
    this.pollInterval = setInterval(async () => {
      await this.fetchTickets();
    }, 4000);
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; color: var(--text-primary); font-family: var(--font-main);">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div>
            <h2 style="font-family: var(--font-display); font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px;">🍳 Kitchen Display System (KDS)</h2>
            <p style="color: var(--text-secondary); font-size: 13px;">Live order preparation pipeline for kitchen and bar staff.</p>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <span style="font-size: 12px; color: var(--text-muted);" id="kds-last-updated">Last sync: Just now</span>
            <button id="kds-refresh-btn" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: #fff; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
              🔄 Refresh
            </button>
          </div>
        </div>

        <!-- Filter Stats Bar -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
          <div style="background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Total Active Tickets</div>
            <strong id="kds-stat-total" style="font-size: 20px; color: #fff; font-family: var(--font-display);">0</strong>
          </div>
          <div style="background: rgba(244, 63, 94, 0.05); border: 1px solid rgba(244, 63, 94, 0.15); border-radius: 12px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; color: var(--accent-rose); text-transform: uppercase;">Pending Cook</div>
            <strong id="kds-stat-pending" style="font-size: 20px; color: var(--accent-rose); font-family: var(--font-display);">0</strong>
          </div>
          <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.15); border-radius: 12px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; color: var(--accent-amber); text-transform: uppercase;">Preparing</div>
            <strong id="kds-stat-preparing" style="font-size: 20px; color: var(--accent-amber); font-family: var(--font-display);">0</strong>
          </div>
          <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 12px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; color: var(--accent-green); text-transform: uppercase;">Ready to Serve</div>
            <strong id="kds-stat-ready" style="font-size: 20px; color: var(--accent-green); font-family: var(--font-display);">0</strong>
          </div>
        </div>

        <!-- Tickets Grid Layout -->
        <div id="kds-tickets-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; min-height: 300px;">
          <!-- Loaded dynamically -->
        </div>

      </div>
    `;

    document.getElementById('kds-refresh-btn').addEventListener('click', async () => {
      await this.fetchTickets();
      showNotification('KDS board updated.', 'success');
    });
  }

  async fetchTickets() {
    if (!state.currentTenant) return;

    try {
      // Find all active sales that are PENDING, PREPARING, or READY
      const sales = await db.sales
        .where('tenant_id')
        .equals(state.currentTenant.id)
        .filter(s => s.kds_status && s.kds_status !== 'SERVED')
        .toArray();

      // Sort by order date (oldest first for priority)
      sales.sort((a, b) => new Date(a.sold_at) - new Date(b.sold_at));

      // Play sound notification if new pending order is added
      if (this.tickets && sales.length > this.tickets.length) {
        const hasNewPending = sales.some(s => s.kds_status === 'PENDING' && !this.tickets.find(t => t.id === s.id));
        if (hasNewPending) {
          this.playChime();
        }
      }

      this.tickets = sales;

      // Update counters
      let pending = 0, preparing = 0, ready = 0;
      sales.forEach(s => {
        if (s.kds_status === 'PENDING') pending++;
        if (s.kds_status === 'PREPARING') preparing++;
        if (s.kds_status === 'READY') ready++;
      });

      document.getElementById('kds-stat-total').textContent = sales.length;
      document.getElementById('kds-stat-pending').textContent = pending;
      document.getElementById('kds-stat-preparing').textContent = preparing;
      document.getElementById('kds-stat-ready').textContent = ready;
      document.getElementById('kds-last-updated').textContent = `Last sync: ${new Date().toLocaleTimeString()}`;

      // Render the tickets grid
      const grid = document.getElementById('kds-tickets-container');
      if (sales.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 16px; padding: 60px; text-align: center; color: var(--text-secondary);">
            <span style="font-size: 40px; display: block; margin-bottom: 12px;">🎉</span>
            <h3 style="color: #fff; margin: 0 0 6px 0;">All Clear!</h3>
            <p style="font-size: 13px; margin: 0;">No pending kitchen or bar orders in the queue.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = '';
      for (const sale of sales) {
        const lines = await db.sale_lines.where('sale_id').equals(sale.id).toArray();
        const card = await this.createTicketCard(sale, lines);
        grid.appendChild(card);
      }

    } catch (err) {
      console.error(err);
    }
  }

  async createTicketCard(sale, lines) {
    const card = document.createElement('div');
    
    // Status styles
    let border = 'var(--border-color)';
    let headerBg = 'rgba(255,255,255,0.03)';
    let statusText = 'Pending';
    let statusColor = 'var(--accent-rose)';

    if (sale.kds_status === 'PREPARING') {
      border = 'rgba(245, 158, 11, 0.4)';
      headerBg = 'rgba(245, 158, 11, 0.05)';
      statusText = 'Preparing';
      statusColor = 'var(--accent-amber)';
    } else if (sale.kds_status === 'READY') {
      border = 'rgba(16, 185, 129, 0.4)';
      headerBg = 'rgba(16, 185, 129, 0.05)';
      statusText = 'Ready to Serve';
      statusColor = 'var(--accent-green)';
    }

    // Timer calculation
    const elapsedMs = new Date() - new Date(sale.sold_at);
    const elapsedMins = Math.floor(elapsedMs / 60000);
    const timerText = `${elapsedMins}m ago`;
    const isLate = elapsedMins >= 15;

    card.style.cssText = `
      background: var(--bg-element);
      border: 1px solid ${border};
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: var(--glass-shadow);
      transition: all 0.2s;
    `;

    // Fetch products names
    let linesHtml = '';
    for (const ln of lines) {
      const prod = await db.products.get(ln.product_id);
      if (prod && !prod.is_service) {
        linesHtml += `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
            <div style="font-size: 13px; color: #fff; font-weight: 600; display: flex; gap: 8px;">
              <span style="color: var(--accent-amber); font-weight: 800;">${ln.qty}x</span>
              <span>${prod.name}</span>
            </div>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <!-- Header -->
      <div style="background: ${headerBg}; padding: 12px 16px; border-bottom: 1px solid ${border}; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color: #fff; font-size: 14px; font-family: var(--font-display);">Tab / Table ${sale.table_no || 'Walk-in'}</strong>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Inv: #${sale.invoice_no}</div>
        </div>
        <span style="font-size: 11px; font-weight: 700; color: ${isLate ? 'var(--accent-rose)' : statusColor}; padding: 3px 8px; border-radius: 20px; background: rgba(255,255,255,0.02); text-transform: uppercase;">
          ${isLate ? '⏳ LATE' : statusText}
        </span>
      </div>

      <!-- Content -->
      <div style="padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 11px; color: var(--text-secondary); display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Waitstaff ID: ${sale.device_id.slice(-4).toUpperCase()}</span>
          <span style="font-weight: 600; color: ${isLate ? 'var(--accent-rose)' : 'var(--text-secondary)'}">${timerText}</span>
        </div>
        
        <div style="flex: 1; min-height: 80px; overflow-y: auto; max-height: 180px;">
          ${linesHtml}
        </div>
      </div>

      <!-- Action Button footer -->
      <div style="padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.1); display: flex; gap: 8px;">
        ${this.getActionButtons(sale)}
      </div>
    `;

    // Bind action events inside card
    const prepareBtn = card.querySelector('.btn-kds-prepare');
    if (prepareBtn) {
      prepareBtn.addEventListener('click', () => this.updateTicketStatus(sale.id, 'PREPARING'));
    }
    const readyBtn = card.querySelector('.btn-kds-ready');
    if (readyBtn) {
      readyBtn.addEventListener('click', () => this.updateTicketStatus(sale.id, 'READY'));
    }
    const serveBtn = card.querySelector('.btn-kds-serve');
    if (serveBtn) {
      serveBtn.addEventListener('click', () => this.updateTicketStatus(sale.id, 'SERVED'));
    }

    return card;
  }

  getActionButtons(sale) {
    if (sale.kds_status === 'PENDING') {
      return `
        <button class="btn-kds-prepare" style="width: 100%; background: var(--accent-amber); color: #000; border: none; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
          🍳 Start Preparing
        </button>
      `;
    }
    if (sale.kds_status === 'PREPARING') {
      return `
        <button class="btn-kds-ready" style="width: 100%; background: var(--accent-green); color: #fff; border: none; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
          ✅ Mark as Ready
        </button>
      `;
    }
    if (sale.kds_status === 'READY') {
      return `
        <button class="btn-kds-serve" style="width: 100%; background: var(--accent-cyan); color: #000; border: none; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s;">
          🍽️ Serve Tray
        </button>
      `;
    }
    return '';
  }

  async updateTicketStatus(saleId, nextStatus) {
    try {
      await db.sales.update(saleId, {
        kds_status: nextStatus
      });

      await logAuditEvent(
        state.currentTenant.id,
        state.currentUser?.id || 'kitchen',
        `KDS_UPDATE_${nextStatus}`,
        'SALE',
        saleId,
        null,
        JSON.stringify({ nextStatus })
      );

      showNotification(`Ticket updated to ${nextStatus}.`, 'success');
      await this.fetchTickets();
    } catch (err) {
      console.error(err);
      showNotification('Failed to update ticket: ' + err.message, 'error');
    }
  }

  playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime); // Mi Note
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // La Note
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  }
}
