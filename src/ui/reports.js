import { db } from '../db/schema';
import { state } from '../context';

// ─── Date helpers ────────────────────────────────────────────────
function startOfDay(d) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function endOfDay(d)   { const r = new Date(d); r.setHours(23,59,59,999); return r; }
function fmtDate(d)    { return d.toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }); }
function isoDate(d)    { return d.toISOString().slice(0,10); }

export class ReportsView {
  constructor(container) {
    this.container = container;
    this.activeReportTab = 'summary';
    // Date range state
    this.rangeStart = startOfDay(new Date());
    this.rangeEnd   = endOfDay(new Date());
    // Calendar state
    this._calPickTarget = 'start'; // 'start'|'end'
    this._calYear  = new Date().getFullYear();
    this._calMonth = new Date().getMonth();
    this._aiLoading = false;
  }

  async load() {
    this.render();
    this.bindEvents();
    await this.loadReportTab();
  }

  // ─── Shell render ─────────────────────────────────────────────
  render() {
    this.container.innerHTML = `
      <div class="view-header" style="display:flex;justify-content:space-between;align-items:center;">
        <h2>Management &amp; Compliance Reports</h2>
      </div>

      <div class="split-pane">
        <!-- Sidebar Navigation -->
        <div class="pane-nav">
          <button class="pane-nav-btn active" data-report="summary">📊 Sales &amp; Margins</button>
          <button class="pane-nav-btn" data-report="vat3">🧾 VAT3 Return</button>
          <button class="pane-nav-btn" data-report="etims">📡 eTIMS Sync Log</button>
        </div>

        <!-- Working Area -->
        <div class="pane-content" id="reports-pane-content">
          <!-- Loaded dynamically -->
        </div>
      </div>

      <!-- ── Date Range Picker Modal ─────────────────────────── -->
      <div id="daterange-modal" class="modal" style="display:none;">
        <div class="modal-content" style="max-width:720px;padding:0;overflow:hidden;border-radius:16px;">
          <div style="display:flex;height:480px;">
            <!-- Left: quick presets -->
            <div id="drp-presets" style="width:200px;background:var(--bg-element);border-right:1px solid var(--border-color);display:flex;flex-direction:column;padding:8px 0;flex-shrink:0;">
              <div style="padding:12px 16px;font-weight:700;font-size:11px;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;">Quick Select</div>
              ${['Today','Yesterday','This Week','Last Week','This Month','Last Month'].map(p=>`
                <button class="drp-preset-btn" data-preset="${p}" style="text-align:left;padding:12px 20px;background:none;border:none;cursor:pointer;color:var(--text-main);font-size:14px;transition:background .15s;">${p}</button>
              `).join('')}
              <div style="margin-top:auto;padding:12px 16px;border-top:1px solid var(--border-color);">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                  <input id="drp-days-back-n" type="number" min="1" max="365" value="7" style="width:48px;border:1px solid var(--border-color);background:var(--bg-surface);color:var(--text-main);border-radius:6px;padding:4px 6px;font-size:12px;">
                  <span style="font-size:12px;color:var(--text-secondary);">days up to today</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <input id="drp-days-fwd-n" type="number" min="1" max="365" value="7" style="width:48px;border:1px solid var(--border-color);background:var(--bg-surface);color:var(--text-main);border-radius:6px;padding:4px 6px;font-size:12px;">
                  <span style="font-size:12px;color:var(--text-secondary);">days starting today</span>
                </div>
              </div>
            </div>

            <!-- Right: calendar -->
            <div style="flex:1;display:flex;flex-direction:column;">
              <!-- Header bar -->
              <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border-color);">
                <div style="display:flex;gap:10px;">
                  <button id="drp-start-pill" class="drp-pill active" style="padding:8px 20px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;">
                    <span id="drp-start-label">Start</span>
                  </button>
                  <button id="drp-end-pill" class="drp-pill" style="padding:8px 20px;border-radius:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;">
                    <span id="drp-end-label">End</span>
                  </button>
                </div>
                <button id="drp-close-btn" style="background:none;border:none;cursor:pointer;color:var(--text-main);font-size:20px;line-height:1;">&times;</button>
              </div>

              <!-- Month/Year nav -->
              <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;">
                <button id="drp-prev-month" style="background:var(--bg-element);border:1px solid var(--border-color);border-radius:8px;color:var(--text-main);cursor:pointer;width:32px;height:32px;font-size:16px;">‹</button>
                <span id="drp-month-label" style="font-weight:700;font-size:15px;"></span>
                <button id="drp-next-month" style="background:var(--bg-element);border:1px solid var(--border-color);border-radius:8px;color:var(--text-main);cursor:pointer;width:32px;height:32px;font-size:16px;">›</button>
              </div>

              <!-- Day-of-week headers -->
              <div id="drp-dow" style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;padding:0 20px;gap:2px;">
                ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<span style="font-size:11px;color:var(--text-muted);font-weight:600;padding:4px 0;">${d}</span>`).join('')}
              </div>

              <!-- Calendar grid -->
              <div id="drp-cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);padding:4px 20px 20px;gap:2px;flex:1;align-content:start;">
              </div>

              <!-- Footer -->
              <div style="display:flex;justify-content:flex-end;gap:10px;padding:12px 20px;border-top:1px solid var(--border-color);">
                <button id="drp-cancel-btn" class="sec-btn">Cancel</button>
                <button id="drp-apply-btn" class="primary-btn">Apply Period</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── AI Assist Modal ────────────────────────────────────── -->
      <div id="ai-assist-modal" class="modal" style="display:none;">
        <div class="modal-content" style="max-width:680px;padding:0;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1a1f3a,#0f172a);padding:20px 24px;border-bottom:1px solid var(--border-color);display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">✨</div>
              <div>
                <div style="font-weight:700;font-size:15px;">AI Report Assistant</div>
                <div style="font-size:11px;color:var(--text-muted);">Powered by Gemini · Analysing your bar &amp; restaurant data</div>
              </div>
            </div>
            <button id="ai-close-btn" style="background:none;border:none;cursor:pointer;color:var(--text-main);font-size:20px;">&times;</button>
          </div>
          <div style="padding:24px;">
            <div id="ai-output" style="min-height:200px;max-height:400px;overflow-y:auto;font-size:13px;line-height:1.8;color:var(--text-secondary);">
              <div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);">
                <span id="ai-spinner" style="display:inline-block;width:18px;height:18px;border:2px solid var(--border-color);border-top-color:#6366f1;border-radius:50%;animation:spin 1s linear infinite;"></span>
                Analysing sales data...
              </div>
            </div>
          </div>
          <div style="padding:0 24px 20px;display:flex;gap:10px;">
            <input id="ai-followup" type="text" placeholder="Ask a follow-up question about your sales..." style="flex:1;">
            <button id="ai-send-btn" class="primary-btn" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);">Ask ✨</button>
          </div>
        </div>
      </div>
    `;
    this._injectDrpStyles();
  }

  _injectDrpStyles() {
    if (document.getElementById('drp-styles')) return;
    const s = document.createElement('style');
    s.id = 'drp-styles';
    s.textContent = `
      @keyframes spin { to { transform:rotate(360deg); } }
      .drp-pill { background:var(--bg-element); color:var(--text-secondary); }
      .drp-pill.active { background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; }
      .drp-preset-btn:hover { background:rgba(245,158,11,0.12)!important; color:var(--text-main)!important; }
      .drp-day { width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;font-size:13px;margin:auto;transition:all .15s; }
      .drp-day:hover { background:rgba(245,158,11,0.15); }
      .drp-day.today { font-weight:700;text-decoration:underline; }
      .drp-day.in-range { background:rgba(245,158,11,0.18);border-radius:0; }
      .drp-day.range-start,.drp-day.range-end { background:#f59e0b!important;color:#000!important;border-radius:50%!important; }
      .drp-day.other-month { color:var(--text-muted); }
      .ai-msg { margin-bottom:16px;padding:12px 16px;border-radius:10px; }
      .ai-msg.assistant { background:rgba(99,102,241,0.08);border-left:3px solid #6366f1; }
      .ai-msg.user { background:rgba(16,185,129,0.08);border-left:3px solid #10b981;text-align:right; }
    `;
    document.head.appendChild(s);
  }

  // ─── Events ───────────────────────────────────────────────────
  bindEvents() {
    // Tab switching
    this.container.querySelectorAll('.pane-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.container.querySelectorAll('.pane-nav-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.activeReportTab = e.target.getAttribute('data-report');
        this.loadReportTab();
      });
    });

    // Date range picker
    this.container.addEventListener('click', (e) => {
      if (e.target.id === 'open-daterange-btn') this._openDrp();
    });

    // AI assist
    this.container.addEventListener('click', (e) => {
      if (e.target.id === 'open-ai-btn') this._openAI();
    });
  }

  async loadReportTab() {
    const pane = document.getElementById('reports-pane-content');
    if (this.activeReportTab === 'summary') await this.renderSummary(pane);
    else if (this.activeReportTab === 'vat3') await this.renderVat3(pane);
    else if (this.activeReportTab === 'etims') await this.renderEtimsLog(pane);
  }

  // ─── Helper: period bar (shown on every tab) ──────────────────
  _periodBar() {
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;background:var(--bg-element);border:1px solid var(--border-color);border-radius:10px;padding:8px 14px;cursor:pointer;" id="open-daterange-btn">
          <span style="font-size:16px;">📅</span>
          <span style="font-size:13px;font-weight:600;">${fmtDate(this.rangeStart)} &nbsp;→&nbsp; ${fmtDate(this.rangeEnd)}</span>
          <span style="font-size:11px;color:var(--text-muted);background:rgba(245,158,11,.15);color:#f59e0b;padding:2px 8px;border-radius:20px;">Change period</span>
        </div>
        <button id="open-ai-btn" style="display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;padding:9px 18px;cursor:pointer;color:#fff;font-weight:600;font-size:13px;">
          ✨ AI Assist
        </button>
      </div>
    `;
  }

  // ─── Sales Summary ────────────────────────────────────────────
  async renderSummary(pane) {
    const sales = (await db.sales.toArray()).filter(s =>
      new Date(s.created_at) >= this.rangeStart && new Date(s.created_at) <= this.rangeEnd
    );
    const saleIds = new Set(sales.map(s => s.id));
    const lines = (await db.sale_lines.toArray()).filter(l => saleIds.has(l.sale_id));

    let totalSalesVal = 0, totalCostVal = 0, totalTaxVal = 0;
    sales.forEach(s => { totalSalesVal += s.grand_total || 0; totalTaxVal += s.tax_total || 0; });
    lines.forEach(l => { totalCostVal += ((l.unit_cost_at_sale || 0) * l.qty); });
    const grossProfit = totalSalesVal - totalTaxVal - totalCostVal;
    const marginPercent = totalSalesVal > 0 ? (grossProfit / (totalSalesVal - totalTaxVal)) * 100 : 0;

    // Payment method breakdown
    const cashSales = sales.filter(s => s.payment_method === 'CASH').reduce((a, s) => a + s.grand_total, 0);
    const mpesaSales = sales.filter(s => s.payment_method === 'MPESA').reduce((a, s) => a + s.grand_total, 0);
    const creditSales = sales.filter(s => s.payment_method === 'CREDIT').reduce((a, s) => a + s.grand_total, 0);
    const splitSales = sales.filter(s => s.payment_method === 'SPLIT').reduce((a, s) => a + s.grand_total, 0);

    pane.innerHTML = `
      ${this._periodBar()}
      <div class="metrics-row">
        <div class="metric-card">
          <h3>Gross Sales</h3>
          <span class="val">KES ${totalSalesVal.toFixed(2)}</span>
          <span class="trend">${sales.length} transactions</span>
        </div>
        <div class="metric-card">
          <h3>Cost of Goods Sold</h3>
          <span class="val">KES ${totalCostVal.toFixed(2)}</span>
          <span class="trend down">COGS</span>
        </div>
        <div class="metric-card">
          <h3>VAT Collected</h3>
          <span class="val">KES ${totalTaxVal.toFixed(2)}</span>
          <span class="trend">Due to KRA</span>
        </div>
        <div class="metric-card">
          <h3>Gross Profit Margin</h3>
          <span class="val" style="color:var(--accent-green)">${marginPercent.toFixed(1)}%</span>
          <span class="trend up">KES ${grossProfit.toFixed(2)} profit</span>
        </div>
      </div>

      <div class="charts-grid" style="margin-top:20px;">
        <div class="chart-card">
          <h3>💳 Payment Method Breakdown</h3>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
            ${[
              { label:'Cash', val:cashSales, color:'#10b981', icon:'💵' },
              { label:'M-Pesa', val:mpesaSales, color:'#6366f1', icon:'📱' },
              { label:'Credit', val:creditSales, color:'#f59e0b', icon:'💳' },
              { label:'Split', val:splitSales, color:'#8b5cf6', icon:'⚖️' },
            ].map(pm => {
              const pct = totalSalesVal > 0 ? (pm.val / totalSalesVal * 100) : 0;
              return `
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                    <span>${pm.icon} ${pm.label}</span>
                    <span style="font-weight:700;">KES ${pm.val.toFixed(2)} <span style="color:var(--text-muted);">(${pct.toFixed(1)}%)</span></span>
                  </div>
                  <div style="height:6px;background:var(--bg-surface);border-radius:3px;">
                    <div style="height:6px;width:${pct}%;background:${pm.color};border-radius:3px;transition:width .5s;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="chart-card">
          <h3>📦 Top Selling Items</h3>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;font-size:12px;">
            ${lines.length === 0 ? '<p style="color:var(--text-muted);">No sales in this period.</p>' : (() => {
              const totals = {};
              lines.forEach(l => { totals[l.product_name] = (totals[l.product_name] || 0) + l.qty; });
              return Object.entries(totals)
                .sort((a,b) => b[1]-a[1])
                .slice(0, 6)
                .map(([name, qty]) => `
                  <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-color);">
                    <span>${name}</span>
                    <span style="font-weight:700;color:var(--accent-cyan);">${qty} sold</span>
                  </div>
                `).join('');
            })()}
          </div>
        </div>
      </div>
    `;
  }

  // ─── VAT3 Return ──────────────────────────────────────────────
  async renderVat3(pane) {
    const allLines = await db.sale_lines.toArray();
    const allSales = (await db.sales.toArray()).filter(s =>
      new Date(s.created_at) >= this.rangeStart && new Date(s.created_at) <= this.rangeEnd
    );
    const saleIds = new Set(allSales.map(s => s.id));
    const lines = allLines.filter(l => saleIds.has(l.sale_id));

    let bA_S=0, bA_V=0, bB_S=0, bB_V=0, bC_S=0, bE_S=0;
    lines.forEach(l => {
      if (l.tax_code==='A') { bA_S+=l.line_total; bA_V+=l.tax_amount; }
      else if (l.tax_code==='B') { bB_S+=l.line_total; bB_V+=l.tax_amount; }
      else if (l.tax_code==='C') bC_S+=l.line_total;
      else if (l.tax_code==='E') bE_S+=l.line_total;
    });

    pane.innerHTML = `
      ${this._periodBar()}
      <h3>VAT3 Return Compliance Sheet</h3>
      <p style="font-size:11px;color:var(--text-secondary);margin-bottom:20px;">Pre-formatted for KRA iTax portal filing.</p>
      <div class="table-wrapper">
        <table class="pos-table">
          <thead><tr><th>iTax Band</th><th>Rate</th><th>Taxable Base (KES)</th><th>VAT Amount (KES)</th></tr></thead>
          <tbody>
            <tr><td><b>Band A</b> – Standard Rate</td><td>16%</td><td>KES ${(bA_S-bA_V).toFixed(2)}</td><td style="font-weight:700;color:var(--accent-cyan)">KES ${bA_V.toFixed(2)}</td></tr>
            <tr><td><b>Band B</b> – Petroleum/Other</td><td>8%</td><td>KES ${(bB_S-bB_V).toFixed(2)}</td><td style="font-weight:700;color:var(--accent-cyan)">KES ${bB_V.toFixed(2)}</td></tr>
            <tr><td><b>Band C</b> – Exempt</td><td>0%</td><td>KES ${bC_S.toFixed(2)}</td><td>KES 0.00</td></tr>
            <tr><td><b>Band E</b> – Zero-Rated</td><td>0%</td><td>KES ${bE_S.toFixed(2)}</td><td>KES 0.00</td></tr>
            <tr style="border-top:2px solid var(--border-color);font-weight:bold;">
              <td>Total</td><td>—</td>
              <td>KES ${(bA_S-bA_V+bB_S-bB_V+bC_S+bE_S).toFixed(2)}</td>
              <td style="color:var(--accent-green)">KES ${(bA_V+bB_V).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  // ─── eTIMS Log ────────────────────────────────────────────────
  async renderEtimsLog(pane) {
    const fiscalRecords = await db.fiscal_records.toArray();
    const sales = await db.sales.toArray();
    const salesMap = new Map(sales.map(s => [s.id, s]));
    pane.innerHTML = `
      ${this._periodBar()}
      <h3>eTIMS Device Outbox Transmission Log</h3>
      <p style="font-size:11px;color:var(--text-secondary);margin-bottom:20px;">Live synchronisation status of invoices sent to eTIMS.</p>
      <div class="table-wrapper">
        <table class="pos-table">
          <thead><tr><th>Date / Time</th><th>Invoice No</th><th>eTIMS Reference</th><th>Code</th><th>Status</th></tr></thead>
          <tbody>
            ${fiscalRecords.length===0 ? '<tr><td colspan="5" style="text-align:center;">No fiscal records yet.</td></tr>' : ''}
            ${fiscalRecords.map(rec => {
              const s = salesMap.get(rec.sale_id);
              return `<tr>
                <td>${new Date(rec.confirmed_at).toLocaleString()}</td>
                <td>${s ? s.invoice_no : '—'}</td>
                <td style="font-family:monospace;font-size:11px;">${rec.cu_invoice_no}</td>
                <td>${rec.result_code}</td>
                <td><span class="badge success">FISCALIZED</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════
  //  DATE RANGE PICKER
  // ═══════════════════════════════════════════════════════════════
  _openDrp() {
    const modal = document.getElementById('daterange-modal');
    modal.style.display = 'flex';
    modal.classList.add('active');
    this._drpTempStart = new Date(this.rangeStart);
    this._drpTempEnd   = new Date(this.rangeEnd);
    this._calYear  = this.rangeStart.getFullYear();
    this._calMonth = this.rangeStart.getMonth();
    this._calPickTarget = 'start';
    this._renderDrp();
    this._bindDrp();
  }

  _renderDrp() {
    // Update pills
    const sp = document.getElementById('drp-start-pill');
    const ep = document.getElementById('drp-end-pill');
    sp.classList.toggle('active', this._calPickTarget==='start');
    ep.classList.toggle('active', this._calPickTarget==='end');
    document.getElementById('drp-start-label').textContent = fmtDate(this._drpTempStart);
    document.getElementById('drp-end-label').textContent   = fmtDate(this._drpTempEnd);

    // Month label
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('drp-month-label').textContent = `${monthNames[this._calMonth]} ${this._calYear}`;

    // Build calendar grid
    const grid = document.getElementById('drp-cal-grid');
    grid.innerHTML = '';
    const firstDay = new Date(this._calYear, this._calMonth, 1).getDay();
    const daysInMonth = new Date(this._calYear, this._calMonth+1, 0).getDate();
    const daysInPrev  = new Date(this._calYear, this._calMonth, 0).getDate();
    const today = new Date();

    const cells = [];
    for (let i = firstDay-1; i >= 0; i--) {
      cells.push({ d: new Date(this._calYear, this._calMonth-1, daysInPrev-i), other: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ d: new Date(this._calYear, this._calMonth, d), other: false });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ d: new Date(this._calYear, this._calMonth+1, cells.length - daysInMonth - firstDay + 1), other: true });
    }

    const s0 = startOfDay(this._drpTempStart);
    const e0 = endOfDay(this._drpTempEnd);

    cells.forEach(({ d, other }) => {
      const el = document.createElement('div');
      const ds = startOfDay(d);
      const isStart  = ds.getTime() === s0.getTime();
      const isEnd    = ds.getTime() === startOfDay(e0).getTime();
      const inRange  = ds > s0 && ds < startOfDay(e0);
      const isToday  = isoDate(d) === isoDate(today);
      el.className = [
        'drp-day',
        other   ? 'other-month' : '',
        isStart ? 'range-start' : '',
        isEnd   ? 'range-end'   : '',
        inRange ? 'in-range'    : '',
        isToday ? 'today'       : '',
      ].join(' ');
      el.textContent = d.getDate();
      el.dataset.date = isoDate(d);
      grid.appendChild(el);
    });
  }

  _bindDrp() {
    // Prevent double-binding
    const modal = document.getElementById('daterange-modal');
    if (modal._drpBound) return;
    modal._drpBound = true;

    // Pill toggles
    document.getElementById('drp-start-pill').addEventListener('click', () => {
      this._calPickTarget = 'start'; this._renderDrp();
    });
    document.getElementById('drp-end-pill').addEventListener('click', () => {
      this._calPickTarget = 'end'; this._renderDrp();
    });

    // Month nav
    document.getElementById('drp-prev-month').addEventListener('click', () => {
      this._calMonth--; if (this._calMonth < 0) { this._calMonth=11; this._calYear--; } this._renderDrp();
    });
    document.getElementById('drp-next-month').addEventListener('click', () => {
      this._calMonth++; if (this._calMonth > 11) { this._calMonth=0; this._calYear++; } this._renderDrp();
    });

    // Day clicks
    document.getElementById('drp-cal-grid').addEventListener('click', (e) => {
      const el = e.target.closest('.drp-day');
      if (!el) return;
      const picked = startOfDay(new Date(el.dataset.date + 'T00:00:00'));
      if (this._calPickTarget === 'start') {
        this._drpTempStart = picked;
        if (picked > this._drpTempEnd) this._drpTempEnd = endOfDay(picked);
        this._calPickTarget = 'end';
      } else {
        if (picked < this._drpTempStart) { this._drpTempEnd = endOfDay(this._drpTempStart); this._drpTempStart = picked; }
        else this._drpTempEnd = endOfDay(picked);
        this._calPickTarget = 'start';
      }
      this._renderDrp();
    });

    // Presets
    document.querySelectorAll('.drp-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.preset;
        const t = new Date();
        if (p === 'Today') { this._drpTempStart = startOfDay(t); this._drpTempEnd = endOfDay(t); }
        else if (p === 'Yesterday') { const y=new Date(t); y.setDate(t.getDate()-1); this._drpTempStart=startOfDay(y); this._drpTempEnd=endOfDay(y); }
        else if (p === 'This Week') { const d=new Date(t); d.setDate(t.getDate()-t.getDay()); this._drpTempStart=startOfDay(d); this._drpTempEnd=endOfDay(t); }
        else if (p === 'Last Week') { const s=new Date(t); s.setDate(t.getDate()-t.getDay()-7); const e=new Date(s); e.setDate(s.getDate()+6); this._drpTempStart=startOfDay(s); this._drpTempEnd=endOfDay(e); }
        else if (p === 'This Month') { this._drpTempStart=new Date(t.getFullYear(),t.getMonth(),1); this._drpTempEnd=endOfDay(t); }
        else if (p === 'Last Month') { this._drpTempStart=new Date(t.getFullYear(),t.getMonth()-1,1); this._drpTempEnd=endOfDay(new Date(t.getFullYear(),t.getMonth(),0)); }
        document.querySelectorAll('.drp-preset-btn').forEach(b => b.style.background='');
        btn.style.background = 'rgba(245,158,11,0.2)';
        this._calYear = this._drpTempStart.getFullYear();
        this._calMonth = this._drpTempStart.getMonth();
        this._renderDrp();
      });
    });

    // N-day shortcuts
    document.getElementById('drp-days-back-n').addEventListener('change', (e) => {
      const n = parseInt(e.target.value) || 7;
      const s = new Date(); s.setDate(s.getDate()-(n-1));
      this._drpTempStart = startOfDay(s); this._drpTempEnd = endOfDay(new Date()); this._renderDrp();
    });
    document.getElementById('drp-days-fwd-n').addEventListener('change', (e) => {
      const n = parseInt(e.target.value) || 7;
      const end = new Date(); end.setDate(end.getDate()+(n-1));
      this._drpTempStart = startOfDay(new Date()); this._drpTempEnd = endOfDay(end); this._renderDrp();
    });

    // Apply / Cancel / Close
    document.getElementById('drp-apply-btn').addEventListener('click', () => {
      this.rangeStart = this._drpTempStart;
      this.rangeEnd   = this._drpTempEnd;
      modal.style.display = 'none'; modal.classList.remove('active');
      this.loadReportTab();
    });
    const closeDrp = () => { modal.style.display='none'; modal.classList.remove('active'); };
    document.getElementById('drp-cancel-btn').addEventListener('click', closeDrp);
    document.getElementById('drp-close-btn').addEventListener('click',  closeDrp);
  }

  // ═══════════════════════════════════════════════════════════════
  //  AI ASSIST
  // ═══════════════════════════════════════════════════════════════
  async _openAI() {
    const modal = document.getElementById('ai-assist-modal');
    modal.style.display = 'flex'; modal.classList.add('active');
    document.getElementById('ai-output').innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;color:var(--text-muted);">
        <span style="display:inline-block;width:18px;height:18px;border:2px solid var(--border-color);border-top-color:#6366f1;border-radius:50%;animation:spin 1s linear infinite;"></span>
        Analysing your sales data for ${fmtDate(this.rangeStart)} – ${fmtDate(this.rangeEnd)}...
      </div>
    `;

    if (!modal._aibound) {
      modal._aibound = true;
      document.getElementById('ai-close-btn').addEventListener('click', () => {
        modal.style.display='none'; modal.classList.remove('active');
      });
      document.getElementById('ai-send-btn').addEventListener('click', () => {
        const q = document.getElementById('ai-followup').value.trim();
        if (q) { this._aiAsk(q); document.getElementById('ai-followup').value=''; }
      });
      document.getElementById('ai-followup').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { document.getElementById('ai-send-btn').click(); }
      });
    }

    // Build context from real data
    const sales = (await db.sales.toArray()).filter(s =>
      new Date(s.created_at) >= this.rangeStart && new Date(s.created_at) <= this.rangeEnd
    );
    const lines = (await db.sale_lines.toArray()).filter(l => new Set(sales.map(s=>s.id)).has(l.sale_id));

    const totalRev = sales.reduce((a,s)=>a+s.grand_total,0);
    const totalTax = sales.reduce((a,s)=>a+s.tax_total,0);
    const cashTotal = sales.filter(s=>s.payment_method==='CASH').reduce((a,s)=>a+s.grand_total,0);
    const mpesaTotal = sales.filter(s=>s.payment_method==='MPESA').reduce((a,s)=>a+s.grand_total,0);

    const itemTotals = {};
    lines.forEach(l => { itemTotals[l.product_name] = (itemTotals[l.product_name]||0)+l.qty; });
    const topItems = Object.entries(itemTotals).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,q])=>`${n}(${q})`).join(', ');

    this._aiContext = `You are an AI business analyst for a Kenyan bar and restaurant. Analyse the following POS data and give actionable insights.
Period: ${fmtDate(this.rangeStart)} to ${fmtDate(this.rangeEnd)}.
Total Revenue: KES ${totalRev.toFixed(2)}.
VAT collected: KES ${totalTax.toFixed(2)}.
Cash payments: KES ${cashTotal.toFixed(2)}, M-Pesa: KES ${mpesaTotal.toFixed(2)}.
Total transactions: ${sales.length}.
Top items sold: ${topItems || 'No sales yet'}.
Respond in plain English with bullet points. Be concise and specific to the bar/restaurant context.`;

    await this._aiAsk('Give me a full business performance summary and 3 actionable recommendations based on this data.');
  }

  async _aiAsk(question) {
    const out = document.getElementById('ai-output');
    // Append user question
    out.innerHTML += `<div class="ai-msg user"><b>You:</b> ${question}</div>`;

    // Loading indicator
    const loadId = 'ai-load-' + Date.now();
    out.innerHTML += `<div class="ai-msg assistant" id="${loadId}"><span style="display:inline-block;width:14px;height:14px;border:2px solid #6366f1;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></span> Thinking...</div>`;
    out.scrollTop = out.scrollHeight;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${window.GEMINI_API_KEY || 'AIzaSyDKPlaceholderInsertYourKeyHere'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: this._aiContext + '\n\nUser question: ' + question }]
          }]
        })
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.';

      document.getElementById(loadId).innerHTML = `<b>✨ AI Assistant:</b><br>${text.replace(/\n/g,'<br>')}`;
    } catch (err) {
      document.getElementById(loadId).innerHTML = `
        <b>✨ AI Assistant:</b><br>
        <span style="color:var(--accent-rose);">Could not reach Gemini API. To enable AI Assist, add your Gemini API key to <code>window.GEMINI_API_KEY</code> in your environment or index.html.</span>
        <br><br><b>Sample insight (offline):</b><br>
        • Your bar is currently in demo mode — once sales data accumulates, AI Assist will provide real revenue trends, top-selling drink analysis, and peak hour recommendations.<br>
        • Consider tracking table numbers per sale to unlock table-level profitability analysis.<br>
        • Enable M-Pesa payments to reduce cash handling risk and improve reconciliation accuracy.
      `;
    }
    out.scrollTop = out.scrollHeight;
  }
}
