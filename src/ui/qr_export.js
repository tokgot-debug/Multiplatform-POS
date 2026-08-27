import { db } from '../db/schema.js';
import { getStockOnHand } from '../db/index.js';
import { state, showNotification } from '../context.js';

export class QrToolsView {
  constructor(container) {
    this.container = container;
    this.activeTab = 'qr';
  }

  async load() {
    this.render();
    this.bindEvents();
    if (this.activeTab === 'alerts') await this.runAlertCheck();
  }

  render() {
    const t = this.activeTab;
    const rows = [
      '<div style="display:flex;height:calc(100vh - 130px);gap:0;overflow:hidden;">',
      '<div style="width:185px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border-color);display:flex;flex-direction:column;padding:12px 8px;gap:4px;">',
      '<button class="pane-nav-btn ' + (t === 'qr' ? 'active' : '') + '" data-qtab="qr">\uD83D\uDCF1 QR Menu</button>',
      '<button class="pane-nav-btn ' + (t === 'export' ? 'active' : '') + '" data-qtab="export">\uD83D\uDCCA Export Reports</button>',
      '<button class="pane-nav-btn ' + (t === 'alerts' ? 'active' : '') + '" data-qtab="alerts">\uD83D\uDD14 Stock Alerts</button>',
      '</div>',
      '<div style="flex:1;overflow-y:auto;padding:20px;">',

      // QR TAB
      '<div id="qt-qr" style="display:' + (t === 'qr' ? 'block' : 'none') + '">',
      '<div class="discount-section">',
      '<h3>\uD83D\uDCF1 Online Menu QR Code</h3>',
      '<p style="color:var(--text-secondary);font-size:13px;margin-bottom:20px;">Print and display this QR code on each table. Customers scan it to browse the full menu and place orders from their smartphone.</p>',
      '<div style="display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start;">',
      '<div>',
      '<div id="qr-canvas-wrap" style="background:#fff;padding:20px;border-radius:16px;display:inline-block;box-shadow:0 4px 24px rgba(0,0,0,0.5);min-width:200px;min-height:200px;display:flex;align-items:center;justify-content:center;">',
      '<div id="qr-actual"></div>',
      '</div>',
      '<div style="margin-top:12px;display:flex;gap:8px;">',
      '<button class="discount-save-btn" id="qr-download-btn">\u2B07\uFE0F Download PNG</button>',
      '<button class="sec-btn" id="qr-print-btn">\uD83D\uDDA8\uFE0F Print QR</button>',
      '</div>',
      '</div>',
      '<div style="flex:1;min-width:220px;">',
      '<div class="discount-field"><label>Menu URL</label><input type="text" id="qr-url-input" value="' + (window.location.origin + '/menu.html') + '" style="font-size:12px;"></div>',
      '<div class="discount-field"><label>QR Size</label><select id="qr-size-sel"><option value="160">Small</option><option value="220" selected>Medium</option><option value="300">Large</option></select></div>',
      '<button class="discount-save-btn" id="qr-regen-btn" style="width:100%;">\u21BB Regenerate</button>',
      '<div style="margin-top:20px;background:rgba(200,130,42,0.08);border:1px solid rgba(200,130,42,0.2);border-radius:10px;padding:16px;">',
      '<div style="font-size:11px;font-weight:700;color:var(--accent-amber);text-transform:uppercase;margin-bottom:8px;">How it works</div>',
      '<ul style="font-size:13px;color:var(--text-secondary);line-height:2;padding-left:18px;">',
      '<li>Print & display the QR at each table</li>',
      '<li>Customers scan with their phone camera</li>',
      '<li>They see full menu with images & prices</li>',
      '<li>They place orders directly from their phone</li>',
      '<li>Orders appear in your Orders tab</li>',
      '</ul>',
      '</div>',
      '</div>',
      '</div>',
      '</div>',
      '</div>',

      // EXPORT TAB
      '<div id="qt-export" style="display:' + (t === 'export' ? 'block' : 'none') + '">',
      '<div class="discount-section">',
      '<h3>\uD83D\uDCCA Export Reports</h3>',
      '<p style="color:var(--text-secondary);font-size:13px;margin-bottom:20px;">Download your business data for accounting, tax filing, or external analysis.</p>',
      '<div class="discount-form-grid">',
      '<div><label>Report Type</label><select id="exp-type"><option value="sales">Sales / Orders</option><option value="inventory">Stock Ledger</option><option value="discounts">Discount Rules</option></select></div>',
      '<div><label>Date Range</label><select id="exp-range"><option value="today">Today</option><option value="week">This Week</option><option value="month" selected>This Month</option><option value="all">All Time</option></select></div>',
      '</div>',
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">',
      '<button class="discount-save-btn" id="exp-csv-btn">\uD83D\uDCC4 Export CSV</button>',
      '<button class="sec-btn" id="exp-json-btn">\uD83D\uDCC1 Export JSON</button>',
      '<button class="sec-btn" id="exp-preview-btn">\uD83D\uDC41 Preview</button>',
      '</div>',
      '</div>',
      '<div class="discount-section" id="exp-preview-box" style="display:none;">',
      '<h3>Report Preview</h3>',
      '<div id="exp-preview-inner" style="overflow-x:auto;"></div>',
      '</div>',
      '</div>',

      // ALERTS TAB
      '<div id="qt-alerts" style="display:' + (t === 'alerts' ? 'block' : 'none') + '">',
      '<div class="discount-section">',
      '<h3>\u2699\uFE0F Alert Configuration</h3>',
      '<div class="discount-form-grid">',
      '<div><label>Low Stock Threshold (units)</label><input type="number" id="alert-threshold" value="' + (localStorage.getItem('pos_alert_threshold') || '10') + '" min="1"></div>',
      '<div><label>Alert On</label><select id="alert-freq"><option value="always" selected>Every Tab Visit</option><option value="login">Login Only</option></select></div>',
      '</div>',
      '<button class="discount-save-btn" id="save-alert-settings">Save & Check Now</button>',
      '</div>',
      '<div class="discount-section">',
      '<h3>\uD83D\uDD14 Current Stock Alerts</h3>',
      '<div id="alerts-list"><div style="text-align:center;padding:30px;color:var(--text-secondary);">Checking stock levels...</div></div>',
      '</div>',
      '</div>',

      '</div>',
      '</div>'
    ];
    this.container.innerHTML = rows.join('');
  }

  bindEvents() {
    this.container.querySelectorAll('[data-qtab]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        this.activeTab = e.currentTarget.getAttribute('data-qtab');
        this.render();
        this.bindEvents();
        if (this.activeTab === 'qr') this.generateQR();
        if (this.activeTab === 'alerts') await this.runAlertCheck();
      });
    });

    if (this.activeTab === 'qr') {
      this.generateQR();
      const regen = document.getElementById('qr-regen-btn');
      if (regen) regen.addEventListener('click', () => this.generateQR());
      const dl = document.getElementById('qr-download-btn');
      if (dl) dl.addEventListener('click', () => this.downloadQR());
      const pr = document.getElementById('qr-print-btn');
      if (pr) pr.addEventListener('click', () => this.printQR());
    }

    if (this.activeTab === 'export') {
      const csv = document.getElementById('exp-csv-btn');
      if (csv) csv.addEventListener('click', () => this.exportData('csv'));
      const json = document.getElementById('exp-json-btn');
      if (json) json.addEventListener('click', () => this.exportData('json'));
      const prev = document.getElementById('exp-preview-btn');
      if (prev) prev.addEventListener('click', () => this.exportData('preview'));
    }

    if (this.activeTab === 'alerts') {
      const save = document.getElementById('save-alert-settings');
      if (save) save.addEventListener('click', async () => {
        const val = document.getElementById('alert-threshold').value;
        localStorage.setItem('pos_alert_threshold', val);
        showNotification('Alert threshold: ' + val + ' units saved.', 'success');
        await this.runAlertCheck();
      });
    }
  }

  async generateQR() {
    const urlEl = document.getElementById('qr-url-input');
    const sizeEl = document.getElementById('qr-size-sel');
    const inputUrl = urlEl ? urlEl.value.trim() : (window.location.origin + '/menu.html');
    const size = parseInt(sizeEl ? sizeEl.value : '220');

    // Fetch and encode menu data
    let encodedUrl = inputUrl;
    try {
      const activeProducts = await db.products.where('is_active').equals(1).toArray();
      const categories = await db.categories.toArray();
      
      const categoryMap = {};
      categories.forEach(c => {
        categoryMap[c.id] = c.name;
      });

      // Map into a compact format: [id, sku, name, sell_price, category_id, uom, image_data]
      const serializedProducts = activeProducts.map(p => [
        p.id,
        p.sku,
        p.name,
        p.sell_price,
        p.category_id,
        p.uom,
        p.image_data || ''
      ]);

      const payload = {
        c: categoryMap,
        p: serializedProducts
      };

      const jsonStr = JSON.stringify(payload);
      const utf8B64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));

      // Set as hash fragment so we don't hit size limits on server HTTP requests
      const baseUrl = inputUrl.split('#')[0].split('?')[0];
      encodedUrl = `${baseUrl}#m=${utf8B64}`;
    } catch (err) {
      console.error('Error encoding menu data into QR URL:', err);
    }

    const renderQR = () => {
      const wrap = document.getElementById('qr-actual');
      if (!wrap) return;
      wrap.innerHTML = '';
      try {
        new QRCode(wrap, {
          text: encodedUrl, width: size, height: size,
          colorDark: '#1a0c04', colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.L // Low error correction to allow larger payloads in the same size
        });
      } catch (e) {
        wrap.innerHTML = '<div style="width:' + size + 'px;height:' + size + 'px;display:flex;align-items:center;justify-content:center;background:#f5f0e8;border-radius:8px;font-size:13px;color:#666;text-align:center;padding:20px;">QR library loading...</div>';
      }
    };

    if (window.QRCode) {
      renderQR();
    } else {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      s.onload = renderQR;
      s.onerror = () => showNotification('QR library failed to load. Check internet connection.', 'error');
      document.head.appendChild(s);
    }
  }

  downloadQR() {
    const img = document.querySelector('#qr-actual img');
    if (!img) { showNotification('QR not ready yet — wait a moment.', 'error'); return; }
    const a = document.createElement('a');
    a.download = 'vanbransa-menu-qr.png';
    a.href = img.src;
    a.click();
    showNotification('QR Code downloaded!', 'success');
  }

  printQR() {
    const wrap = document.getElementById('qr-canvas-wrap');
    if (!wrap) return;
    const win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><title>Titanium Menu QR</title></head>');
    win.document.write('<body style="text-align:center;padding:60px;font-family:sans-serif;background:#fff;">');
    win.document.write('<h2 style="margin-bottom:8px;color:#1a0c04;">Scan to View Our Menu</h2>');
    win.document.write('<p style="color:#666;margin-bottom:28px;font-size:14px;">Vanbransa Lounge — Browse &amp; Order from your phone</p>');
    win.document.write(wrap.outerHTML);
    win.document.write('<p style="margin-top:28px;color:#999;font-size:11px;">Powered by Vanbransa POS</p>');
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => win.print(), 600);
  }

  // ── EXPORT ──
  async exportData(format) {
    const type = document.getElementById('exp-type') ? document.getElementById('exp-type').value : 'sales';
    const range = document.getElementById('exp-range') ? document.getElementById('exp-range').value : 'month';
    let rows = [], headers = [];
    const now = Date.now();
    const DAY = 86400000;
    const fromTs = range === 'today' ? now - DAY : range === 'week' ? now - 7 * DAY : range === 'month' ? now - 30 * DAY : 0;

    try {
      if (type === 'sales') {
        headers = ['Order Ref', 'Table', 'Total (KES)', 'Payment', 'Status', 'Date'];
        const sales = await db.sales.toArray().catch(() => []);
        const filtered = sales.filter(s => new Date(s.sold_at).getTime() > fromTs);
        const allPayments = await db.payments.toArray().catch(() => []);
        const payMap = new Map(allPayments.map(p => [p.sale_id, p]));
        rows = filtered.map(s => {
          const pm = payMap.get(s.id);
          const method = pm ? pm.method : 'CASH';
          return [s.invoice_no || s.id, s.table_no || '-', Number(s.grand_total || 0).toFixed(2), method, s.status || '-', new Date(s.sold_at).toLocaleString()];
        });
      } else if (type === 'inventory') {
        headers = ['SKU', 'Product Name', 'Category', 'UOM', 'Sell Price (KES)', 'Active'];
        const prods = await db.products.toArray();
        const cats = new Map((await db.categories.toArray()).map(c => [c.id, c.name]));
        rows = prods.map(p => [p.sku, p.name, cats.get(p.category_id) || 'General', p.uom, Number(p.sell_price).toFixed(2), p.is_active ? 'Yes' : 'No']);
      } else if (type === 'discounts') {
        headers = ['Name', 'Applies To', 'Target', 'Value', 'Type', 'Status'];
        const discs = JSON.parse(localStorage.getItem('pos_discounts') || '[]');
        rows = discs.map(d => [d.name, d.type, d.target || '-', d.value, d.kind === 'percent' ? '%' : 'KES Fixed', d.status]);
      }
    } catch (e) {
      showNotification('Export error: ' + e.message, 'error');
      return;
    }

    if (format === 'csv') {
      const csv = [headers.join(','), ...rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vanbransa_' + type + '_' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      showNotification('CSV exported: ' + rows.length + ' rows.', 'success');
    } else if (format === 'json') {
      const data = rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vanbransa_' + type + '_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      showNotification('JSON exported: ' + rows.length + ' records.', 'success');
    } else {
      // Preview
      const box = document.getElementById('exp-preview-box');
      const inner = document.getElementById('exp-preview-inner');
      if (!box || !inner) return;
      box.style.display = 'block';
      let tbl = '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>';
      headers.forEach(h => {
        tbl += '<th style="text-align:left;padding:8px 10px;background:rgba(200,130,42,0.1);border-bottom:1px solid var(--border-color);font-size:11px;text-transform:uppercase;color:var(--text-secondary);">' + h + '</th>';
      });
      tbl += '</tr></thead><tbody>';
      if (!rows.length) {
        tbl += '<tr><td colspan="' + headers.length + '" style="text-align:center;padding:24px;color:var(--text-secondary);">No data for selected range.</td></tr>';
      } else {
        rows.slice(0, 50).forEach(r => {
          tbl += '<tr>';
          r.forEach(v => { tbl += '<td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.04);">' + v + '</td>'; });
          tbl += '</tr>';
        });
      }
      tbl += '</tbody></table>';
      if (rows.length > 50) tbl += '<div style="padding:8px 10px;font-size:12px;color:var(--text-secondary);">Showing 50 of ' + rows.length + ' rows. Export CSV/JSON for full data.</div>';
      inner.innerHTML = tbl;
      showNotification('Preview: ' + rows.length + ' rows found.', 'success');
    }
  }

  // ── STOCK ALERTS ──
  async runAlertCheck() {
    const threshold = parseInt(localStorage.getItem('pos_alert_threshold') || '10');
    const list = document.getElementById('alerts-list');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary);">Scanning all stock levels...</div>';

    try {
      const products = await db.products.where('is_active').equals(1).toArray();
      const branchId = state.currentBranch ? state.currentBranch.id : 1;
      const alerts = [];

      for (const prod of products) {
        if (prod.is_service) continue;
        const stock = await getStockOnHand(prod.id, branchId);
        if (stock <= threshold) alerts.push({ prod, stock, critical: stock <= 0 });
      }

      if (alerts.length === 0) {
        list.innerHTML = [
          '<div style="text-align:center;padding:40px;">',
          '<div style="font-size:48px;margin-bottom:12px;">\u2705</div>',
          '<div style="font-weight:700;font-size:16px;color:var(--accent-green);">All stock levels are healthy!</div>',
          '<div style="color:var(--text-secondary);font-size:13px;margin-top:8px;">No items below ' + threshold + ' units threshold.</div>',
          '</div>'
        ].join('');
        return;
      }

      const rows2 = alerts.sort((a, b) => a.stock - b.stock).map(({ prod, stock, critical }) => {
        const color = critical ? 'var(--accent-rose)' : 'var(--accent-amber)';
        const label = critical ? '\uD83D\uDED1 OUT OF STOCK' : '\u26A0\uFE0F LOW STOCK';
        const bg = critical ? 'rgba(192,74,53,0.08)' : 'rgba(232,165,53,0.06)';
        return '<tr style="background:' + bg + ';">' +
          '<td style="font-weight:700;">' + prod.name + '</td>' +
          '<td style="font-family:monospace;font-size:12px;">' + prod.sku + '</td>' +
          '<td style="font-weight:800;font-size:18px;color:' + color + ';">' + stock + '</td>' +
          '<td><span style="font-size:12px;font-weight:700;color:' + color + ';">' + label + '</span></td>' +
          '</tr>';
      });

      list.innerHTML = [
        '<div style="margin-bottom:14px;padding:12px 14px;background:rgba(192,74,53,0.08);border:1px solid rgba(192,74,53,0.2);border-radius:10px;font-size:13px;color:var(--accent-rose);">',
        '\uD83D\uDD14 <strong>' + alerts.length + ' item(s)</strong> need restocking (threshold: ' + threshold + ' units)',
        '</div>',
        '<table class="discount-table">',
        '<thead><tr><th>Product</th><th>SKU</th><th>On Hand</th><th>Status</th></tr></thead>',
        '<tbody>' + rows2.join('') + '</tbody>',
        '</table>'
      ].join('');

      const criticals = alerts.filter(a => a.critical);
      if (criticals.length > 0) {
        showNotification('URGENT: ' + criticals.length + ' item(s) are OUT OF STOCK!', 'error');
      } else {
        showNotification(alerts.length + ' items are running low on stock.', 'warning');
      }
    } catch (e) {
      list.innerHTML = '<div style="color:var(--accent-rose);padding:20px;">Error: ' + e.message + '</div>';
    }
  }
}
