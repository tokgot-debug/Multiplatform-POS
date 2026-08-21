import { db } from '../db/schema.js';
import { showNotification } from '../context.js';

export class FinanceView {
  constructor(container) {
    this.container = container;
    this.currentMetrics = null;
  }

  async load() {
    this.render();
    this.bindEvents();
    await this.loadMetrics();
  }

  render() {
    this.container.innerHTML = [
      '<style>',
      '.finance-shell { display: flex; gap: 16px; height: 100%; padding: 16px; box-sizing: border-box; overflow: hidden; }',
      '.finance-left { flex: 2; display: flex; flex-direction: column; gap: 16px; overflow-y: auto; }',
      '.finance-right { flex: 1; min-width: 280px; display: flex; flex-direction: column; background: linear-gradient(180deg, rgba(30,30,60,0.98) 0%, rgba(15,15,35,0.98) 100%); border-radius: 16px; border: 1px solid rgba(120,100,255,0.3); overflow: hidden; }',
      '.fin-card { background: var(--surface); border-radius: 12px; padding: 20px; }',
      '.fin-date-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }',
      '.fin-date-bar label { font-size: 13px; color: var(--text-secondary); }',
      '.fin-date-bar input[type=date] { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 13px; }',
      '.fin-load-btn { background: var(--accent); color: #000; border: none; padding: 9px 20px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 13px; }',
      '.metrics-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }',
      '.m-card { background: rgba(255,255,255,0.05); border-radius: 10px; padding: 16px; border-left: 4px solid var(--accent); }',
      '.m-card.green { border-left-color: #4caf50; }',
      '.m-card.blue { border-left-color: #2196f3; }',
      '.m-card.orange { border-left-color: #ff9800; }',
      '.m-card h5 { margin: 0 0 6px 0; font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }',
      '.m-card .m-val { margin: 0; font-size: 22px; font-weight: 700; }',
      /* AI Panel */
      '.ai-header { display: flex; align-items: center; gap: 10px; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }',
      '.ai-logo { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #6060ff, #a040ff); display: flex; align-items: center; justify-content: center; font-size: 16px; }',
      '.ai-title { font-size: 15px; font-weight: 700; color: #c0b0ff; }',
      '.ai-subtitle { font-size: 11px; color: rgba(255,255,255,0.4); }',
      '.ai-msgs { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }',
      '.ai-bubble { background: rgba(100,80,255,0.15); border-left: 3px solid #8060ff; border-radius: 0 8px 8px 0; padding: 10px 12px; font-size: 13px; color: rgba(255,255,255,0.85); line-height: 1.5; }',
      '.user-bubble { background: rgba(255,255,255,0.08); border-radius: 8px 8px 0 8px; padding: 10px 12px; font-size: 13px; align-self: flex-end; max-width: 85%; }',
      '.ai-typing { display: flex; gap: 4px; padding: 8px 12px; align-items: center; }',
      '.ai-typing span { width: 7px; height: 7px; background: #8060ff; border-radius: 50%; animation: aidot 1.2s infinite; }',
      '.ai-typing span:nth-child(2) { animation-delay: 0.2s; }',
      '.ai-typing span:nth-child(3) { animation-delay: 0.4s; }',
      '@keyframes aidot { 0%,80%,100%{opacity:0.3;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }',
      '.ai-input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid rgba(255,255,255,0.08); }',
      '.ai-input-row input { flex: 1; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 13px; outline: none; }',
      '.ai-input-row button { background: linear-gradient(135deg,#6060ff,#a040ff); color: #fff; border: none; padding: 0 16px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 13px; }',
      '.ai-suggest-chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 12px 8px; }',
      '.chip { background: rgba(120,80,255,0.2); border: 1px solid rgba(120,80,255,0.35); border-radius: 20px; padding: 4px 10px; font-size: 11px; cursor: pointer; color: #c0a0ff; white-space: nowrap; }',
      '.chip:hover { background: rgba(120,80,255,0.4); }',
      '@media(max-width:768px){ .finance-shell{flex-direction:column;} .finance-right{min-width:unset;height:400px;} }',
      '</style>',

      '<div class="finance-shell">',

      '  <div class="finance-left">',
      '    <div class="fin-card">',
      '      <h2 style="margin:0 0 14px 0;font-size:18px;">📊 Financial Report</h2>',
      '      <div class="fin-date-bar">',
      '        <label>From:</label>',
      '        <input type="date" id="fin-start" />',
      '        <label>To:</label>',
      '        <input type="date" id="fin-end" />',
      '        <button class="fin-load-btn" id="fin-load-btn">Load Report</button>',
      '      </div>',
      '    </div>',
      '    <div class="metrics-row">',
      '      <div class="m-card"><h5>Gross Revenue</h5><p class="m-val" id="fin-gross">KES 0</p></div>',
      '      <div class="m-card"><h5>Total Discounts</h5><p class="m-val" id="fin-disc">KES 0</p></div>',
      '      <div class="m-card green"><h5>Net Revenue</h5><p class="m-val" id="fin-net">KES 0</p></div>',
      '      <div class="m-card blue"><h5>Cash Sales</h5><p class="m-val" id="fin-cash">KES 0</p></div>',
      '      <div class="m-card green"><h5>M-Pesa Sales</h5><p class="m-val" id="fin-mpesa">KES 0</p></div>',
      '      <div class="m-card orange"><h5>Total Orders</h5><p class="m-val" id="fin-count">0</p></div>',
      '    </div>',
      '  </div>',

      '  <div class="finance-right">',
      '    <div class="ai-header">',
      '      <div class="ai-logo">✨</div>',
      '      <div><div class="ai-title">Vanbransa AI</div><div class="ai-subtitle">Offline Analytics Assistant</div></div>',
      '    </div>',
      '    <div class="ai-msgs" id="ai-msgs">',
      '      <div class="ai-bubble">Hello! I\'m your Vanbransa AI assistant. Load a date range and I\'ll analyze your financials. You can also ask me anything!</div>',
      '    </div>',
      '    <div class="ai-suggest-chips">',
      '      <div class="chip" data-q="performance">Performance</div>',
      '      <div class="chip" data-q="cash vs mpesa">Cash vs M-Pesa</div>',
      '      <div class="chip" data-q="discount">Discounts</div>',
      '      <div class="chip" data-q="insight">Insights</div>',
      '    </div>',
      '    <div class="ai-input-row">',
      '      <input type="text" id="ai-inp" placeholder="Ask about your business..." />',
      '      <button id="ai-send">Ask</button>',
      '    </div>',
      '  </div>',

      '</div>'
    ].join('\n');

    // Set default date = today
    const today = new Date().toISOString().slice(0, 10);
    const finStart = document.getElementById('fin-start');
    const finEnd = document.getElementById('fin-end');
    if (finStart) finStart.value = today;
    if (finEnd) finEnd.value = today;
  }

  bindEvents() {
    const loadBtn = document.getElementById('fin-load-btn');
    if (loadBtn) loadBtn.addEventListener('click', () => this.loadMetrics());

    const sendBtn = document.getElementById('ai-send');
    if (sendBtn) sendBtn.addEventListener('click', () => this.handleChat());

    const inp = document.getElementById('ai-inp');
    if (inp) {
      inp.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.handleChat();
      });
    }

    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.getAttribute('data-q');
        const input = document.getElementById('ai-inp');
        if (input) input.value = q;
        this.handleChat();
      });
    });
  }

  async loadMetrics() {
    const startEl = document.getElementById('fin-start');
    const endEl = document.getElementById('fin-end');
    if (!startEl || !endEl) return;

    const startStr = startEl.value;
    const endStr = endEl.value;
    if (!startStr || !endStr) return;

    const startTs = new Date(startStr + 'T00:00:00').getTime();
    const endTs = new Date(endStr + 'T23:59:59').getTime();

    try {
      const allOrders = await db.orders.toArray();
      const orders = allOrders.filter(o => {
        const ts = o.timestamp || 0;
        return ts >= startTs && ts <= endTs && o.status === 'COMPLETED';
      });

      let gross = 0, discounts = 0, cash = 0, mpesa = 0;

      for (const o of orders) {
        gross += (o.total || 0);
        discounts += (o.discount || 0);
        const method = (o.payment_method || '').toUpperCase();
        if (method === 'CASH') {
          cash += Math.max(0, (o.total || 0) - (o.discount || 0));
        } else if (method === 'MPESA') {
          mpesa += Math.max(0, (o.total || 0) - (o.discount || 0));
        } else if (method === 'SPLIT') {
          cash += (o.split_cash || 0);
          mpesa += (o.split_mpesa || 0);
        }
      }

      const net = gross - discounts;
      const fmt = v => 'KES ' + v.toLocaleString();

      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
      };

      set('fin-gross', fmt(gross));
      set('fin-disc', fmt(discounts));
      set('fin-net', fmt(net));
      set('fin-cash', fmt(cash));
      set('fin-mpesa', fmt(mpesa));
      set('fin-count', orders.length);

      this.currentMetrics = { net, gross, discounts, cash, mpesa, count: orders.length, startStr, endStr };
      this.addAIMsg('Data loaded for ' + startStr + ' to ' + endStr + '. Found ' + orders.length + ' completed orders totalling KES ' + net.toLocaleString() + '. Ask me anything!');

    } catch (err) {
      console.error('Finance load error:', err);
      showNotification('Error loading financial data', 'error');
    }
  }

  handleChat() {
    const inp = document.getElementById('ai-inp');
    if (!inp) return;
    const msg = inp.value.trim();
    if (!msg) return;
    inp.value = '';
    this.addUserMsg(msg);
    this.showTyping();
    setTimeout(() => {
      this.removeTyping();
      this.generateResponse(msg.toLowerCase());
    }, 700);
  }

  addUserMsg(text) {
    const area = document.getElementById('ai-msgs');
    if (!area) return;
    const d = document.createElement('div');
    d.className = 'user-bubble';
    d.innerText = text;
    area.appendChild(d);
    area.scrollTop = area.scrollHeight;
  }

  addAIMsg(text) {
    const area = document.getElementById('ai-msgs');
    if (!area) return;
    const d = document.createElement('div');
    d.className = 'ai-bubble';
    d.innerText = text;
    area.appendChild(d);
    area.scrollTop = area.scrollHeight;
  }

  showTyping() {
    const area = document.getElementById('ai-msgs');
    if (!area) return;
    const d = document.createElement('div');
    d.className = 'ai-typing';
    d.id = 'ai-typing-indicator';
    d.innerHTML = '<span></span><span></span><span></span>';
    area.appendChild(d);
    area.scrollTop = area.scrollHeight;
  }

  removeTyping() {
    const t = document.getElementById('ai-typing-indicator');
    if (t) t.remove();
  }

  generateResponse(q) {
    const m = this.currentMetrics;
    if (!m) {
      this.addAIMsg('Please select a date range and click "Load Report" first so I can analyze your data.');
      return;
    }

    if (q.includes('performance') || q.includes('summary') || q.includes('overview')) {
      this.addAIMsg('Performance Summary (' + m.startStr + ' to ' + m.endStr + '): You completed ' + m.count + ' orders with a net revenue of KES ' + m.net.toLocaleString() + '. Gross before discounts was KES ' + m.gross.toLocaleString() + '. Keep up the momentum!');

    } else if (q.includes('cash') || q.includes('mpesa') || q.includes('payment')) {
      const mpesaPct = m.net > 0 ? Math.round((m.mpesa / m.net) * 100) : 0;
      const cashPct = 100 - mpesaPct;
      this.addAIMsg('Payment Breakdown: Cash = KES ' + m.cash.toLocaleString() + ' (' + cashPct + '%) | M-Pesa = KES ' + m.mpesa.toLocaleString() + ' (' + mpesaPct + '%). ' + (m.mpesa > m.cash ? 'M-Pesa is dominant — great for reducing cash handling risk!' : 'Cash is higher — ensure your safe and float are well managed.'));

    } else if (q.includes('discount')) {
      const discPct = m.gross > 0 ? ((m.discounts / m.gross) * 100).toFixed(1) : 0;
      this.addAIMsg('Total discounts given: KES ' + m.discounts.toLocaleString() + ' (' + discPct + '% of gross revenue). ' + (m.discounts > m.gross * 0.15 ? 'Discounts are above 15% — consider reviewing your discount policy.' : 'Discount levels are healthy.'));

    } else if (q.includes('insight') || q.includes('advice') || q.includes('tip')) {
      const insights = [];
      if (m.count === 0) {
        insights.push('No completed orders found for this period. Ensure orders are being completed and not left open.');
      } else {
        const avgOrder = Math.round(m.net / m.count);
        insights.push('Average order value: KES ' + avgOrder.toLocaleString() + '. Upselling items like beverages can boost this significantly.');
      }
      if (m.mpesa > m.cash) {
        insights.push('M-Pesa dominates — verify all M-Pesa confirmations are being received promptly to avoid disputes.');
      } else {
        insights.push('Cash is dominant — conduct end-of-shift cash counts and compare against POS totals daily.');
      }
      this.addAIMsg(insights.join(' | '));

    } else if (q.includes('order') || q.includes('count')) {
      this.addAIMsg('Total completed orders: ' + m.count + '. Average value per order: KES ' + (m.count > 0 ? Math.round(m.net / m.count).toLocaleString() : '0') + '.');

    } else {
      this.addAIMsg('I can help with: "performance", "cash vs mpesa", "discounts", "insights", or "order count". What would you like to know?');
    }
  }
}
