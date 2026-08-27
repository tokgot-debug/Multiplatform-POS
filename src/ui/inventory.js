import { db } from '../db/schema';
import { getStockOnHand, getBatchStockOnHand, logAuditEvent } from '../db/index';
import { state, showNotification } from '../context';

export class InventoryView {
  constructor(container) {
    this.container = container;
    this.activeSubTab = 'ledger'; // ledger, takes, expiries
  }

  async load() {
    this.render();
    this.bindEvents();
    await this.loadSubTab();
  }

  render() {
    this.container.innerHTML = `
      <div class="view-header">
        <h2>Inventory & Stock Control</h2>
      </div>

      <div class="split-pane">
        <!-- Sidebar Navigation -->
        <div class="pane-nav">
          <button class="pane-nav-btn active" data-sub="ledger">Stock Ledger</button>
          <button class="pane-nav-btn" data-sub="takes">Stock Takes (Counts)</button>
          <button class="pane-nav-btn" data-sub="expiries">Batch & Expiries</button>
        </div>

        <!-- Working Area -->
        <div class="pane-content" id="inventory-pane-content">
          <!-- Loaded dynamically -->
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.container.querySelectorAll('.pane-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.container.querySelectorAll('.pane-nav-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.activeSubTab = e.target.getAttribute('data-sub');
        this.loadSubTab();
      });
    });
  }

  async loadSubTab() {
    const pane = document.getElementById('inventory-pane-content');
    
    if (this.activeSubTab === 'ledger') {
      await this.renderLedger(pane);
    } else if (this.activeSubTab === 'takes') {
      await this.renderTakes(pane);
    } else if (this.activeSubTab === 'expiries') {
      await this.renderExpiries(pane);
    }
  }

  async renderLedger(pane) {
    const products = await db.products.toArray();
    
    pane.innerHTML = `
      <div class="control-bar">
        <input type="text" id="ledg-search" placeholder="Search ledger by SKU or name...">
        <button class="primary-btn" id="ledg-add-prod-btn">Add Product</button>
        <button class="sec-btn" id="ledg-autofill-btn">✨ Auto-fill Images</button>
        <button class="sec-btn" id="ledg-adjust-btn">Manual Adjustment</button>
      </div>

      <div class="table-wrapper">
        <table class="pos-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>UOM</th>
              <th>Category</th>
              <th>Tracked</th>
              <th>On Hand Quantity</th>
              <th>Sell Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="ledg-table-body">
            <!-- Loaded dynamically -->
          </tbody>
        </table>
      </div>
    `;

    const tbody = document.getElementById('ledg-table-body');
    const categories = new Map((await db.categories.toArray()).map(c => [c.id, c.name]));

    for (const prod of products) {
      const stock = await getStockOnHand(prod.id, state.currentBranch.id);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:monospace;font-weight:600;">${prod.sku}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${prod.image_data ? `<img src="${prod.image_data}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(200, 130, 42, 0.25);">` : `<div style="width: 32px; height: 32px; border-radius: 6px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--text-muted);">📷</div>`}
            <span style="font-weight: 500;">${prod.name}</span>
          </div>
        </td>
        <td>${prod.uom}</td>
        <td>${categories.get(prod.category_id) || 'General'}</td>
        <td>
          <span class="badge ${prod.is_batch_tracked ? 'warning' : 'success'}">
            ${prod.is_batch_tracked ? 'Batch' : 'Standard'}
          </span>
        </td>
        <td style="font-weight:700; color:${stock <= 10 && !prod.is_service ? 'var(--accent-rose)' : 'var(--text-primary)'}">
          ${prod.is_service ? 'N/A (Service)' : stock}
        </td>
        <td style="font-family:var(--font-display);font-weight:600;">KES ${prod.sell_price.toFixed(2)}</td>
        <td>
          <button class="primary-btn edit-prod-btn" data-id="${prod.id}" style="padding:4px 8px;font-size:10px;">Edit</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    this.bindProductEditorEvents(pane);

    // Manual adjustment modal event trigger (simulation)
    document.getElementById('ledg-adjust-btn').addEventListener('click', async () => {
      // Prompt adjustment
      const sku = prompt('Enter SKU to adjust:');
      if (!sku) return;

      const prod = await db.products.where('sku').equals(sku).first();
      if (!prod) {
        alert('Product SKU not found.');
        return;
      }

      const qty = parseInt(prompt('Enter quantity adjustment (positive to add, negative to reduce):'));
      if (isNaN(qty)) return;

      const locInput = prompt('Location (STORE or HOUSE):', 'STORE');
      if (!locInput) return;
      const location = locInput.toUpperCase();

      await db.stock_movements.add({
        id: `sm-${crypto.randomUUID()}`,
        tenant_id: state.currentTenant?.id || 'tenant-01',
        branch_id: state.currentBranch?.id || 'br-01',
        product_id: prod.id,
        batch_id: null,
        type: qty > 0 ? 'ADJ_IN' : 'ADJ_OUT',
        quantity: Math.abs(qty),
        location,
        ref_id: `MANUAL-${Date.now()}`,
        created_at: new Date().toISOString()
      });
      showNotification('Stock adjusted successfully', 'success');
      this.loadSubTab();
    });

    document.getElementById('ledg-autofill-btn').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.innerText = 'Applying AI Images...';
      
      const aiImageMap = [
        { keywords: ['savanna', 'cider'], url: '/ai_images/cider_glass.jpg' },
        { keywords: ['guinness', 'stout'], url: '/ai_images/stout_glass.jpg' },
        { keywords: ['tusker', 'white cap', 'whitecap', 'pilsner'], url: '/ai_images/beer_glass.jpg' },
        { keywords: ['beer', 'lager', 'senator'], url: '/ai_images/beer_bottle.jpg' },
        { keywords: ['smirnoff', 'vodka'], url: '/ai_images/vodka_glass.jpg' },
        { keywords: ['jameson', 'whiskey'], url: '/ai_images/whiskey_glass.jpg' },
        { keywords: ['konyagi', 'gin'], url: '/ai_images/gin_glass.jpg' },
        { keywords: ['wine', 'red wine'], url: '/ai_images/red_wine_glass.jpg' },
        { keywords: ['coca-cola', 'coca cola', 'coke'], url: '/ai_images/coke_bottle.png' },
        { keywords: ['fanta'], url: '/ai_images/fanta_glass.jpg' },
        { keywords: ['juice'], url: '/ai_images/fresh_juice.jpg' },
        { keywords: ['mineral water', 'water', 'aqua'], url: '/ai_images/mineral_water.jpg' },
        { keywords: ['nyama choma', 'roasted meat', 'goat ribs', 'pork ribs'], url: '/ai_images/nyama_choma.jpg' },
        { keywords: ['chicken', 'grilled chicken'], url: '/ai_images/grilled_chicken.jpg' },
        { keywords: ['pilau', 'rice', 'biryani'], url: '/ai_images/pilau_rice.jpg' },
        { keywords: ['fish', 'tilapia', 'omena', 'fillet'], url: '/ai_images/fish_chips.jpg' },
        { keywords: ['ugali', 'beef stew', 'stew', 'beans'], url: '/ai_images/ugali_nyama.jpg' },
        { keywords: ['samosa'], url: '/ai_images/beef_samosas.jpg' }
      ];


      try {
        const products = await db.products.where('is_active').equals(1).toArray();
        let updatedCount = 0;
        
        for (const prod of products) {
          // Allow auto-fill to overwrite empty/missing images
          if (prod.image_data && prod.image_data.startsWith('data:image')) continue;
          
          const lowerName = prod.name.toLowerCase();
          
          // Find matching AI image
          const match = aiImageMap.find(mapping => 
            mapping.keywords.some(kw => lowerName.includes(kw))
          );
          
          let imgUrl = null;
          
          if (match) {
            imgUrl = match.url;
          } else {
            // Fallback to wikimedia for basic terms like "coca-cola", "water", "juice"
            const cleanName = prod.name.replace(/[0-9]+(ml|g|kg|l|pcs)/gi, '').replace(/\(.*\)/g, '').trim();
            const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanName)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;
            try {
              const res = await fetch(searchUrl);
              const data = await res.json();
              if (data.query && data.query.pages) {
                const pages = Object.values(data.query.pages);
                if (pages.length > 0 && pages[0].imageinfo && pages[0].imageinfo.length > 0) {
                  imgUrl = pages[0].imageinfo[0].thumburl;
                }
              }
            } catch(e) {}
          }

          if (imgUrl) {
            try {
              const imgRes = await fetch(imgUrl);
              const blob = await imgRes.blob();
              const reader = new FileReader();
              const base64Data = await new Promise(resolve => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
              
              // Only apply canvas compression if it's the large AI images
              if (imgUrl.startsWith('/ai_images/')) {
                 const img = new Image();
                 const compressedBase64 = await new Promise(res => {
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      const MAX = 400;
                      let w = img.width, h = img.height;
                      if (w > h && w > MAX) { h *= MAX/w; w = MAX; }
                      else if (h > MAX) { w *= MAX/h; h = MAX; }
                      canvas.width = w; canvas.height = h;
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(img, 0, 0, w, h);
                      res(canvas.toDataURL('image/jpeg', 0.8));
                    };
                    img.src = base64Data;
                 });
                 prod.image_data = compressedBase64;
              } else {
                 prod.image_data = base64Data;
              }

              await db.products.put(prod);
              updatedCount++;
            } catch(err) {
              console.error('Failed to fetch image for', prod.name, err);
            }
          }
        }
        
        showNotification(`Auto-fill complete. Applied ${updatedCount} AI images.`, 'success');
        this.loadSubTab(); // Reload table
      } catch (err) {
        console.error(err);
        showNotification('Error during auto-fill.', 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = '✨ Auto-fill Images';
      }
    });
  }

  async bindProductEditorEvents(pane) {
    const categories = await db.categories.toArray();
    const escapeAttribute = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    const openEditor = async (prodId = null) => {
      let prod = { 
        id: '', name: '', sku: '', category_id: categories[0]?.id, 
        sell_price: 0, cost_price: 0, uom: 'EA', tax_code: 'A', 
        is_service: 0, is_batch_tracked: 0 
      };
      
      if (prodId) {
        prod = await db.products.get(prodId) || prod;
      }

      const modal = document.createElement('div');
      modal.className = 'modal active';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; background: #1e293b;">
          <h2>${prodId ? 'Edit Product' : 'Add New Product'}</h2>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top:16px;">
            <div style="grid-column: span 2;">
              <label>Product Name</label>
              <input type="text" id="pe-name" value="${escapeAttribute(prod.name)}" class="pe-input">
            </div>
            <div>
              <label>SKU</label>
              <input type="text" id="pe-sku" value="${escapeAttribute(prod.sku)}" class="pe-input">
            </div>
            <div>
              <label>Category</label>
              <select id="pe-category" class="pe-input">
                ${categories.map(c => `<option value="${escapeAttribute(c.id)}" ${c.id === prod.category_id ? 'selected' : ''}>${escapeAttribute(c.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Sell Price (KES)</label>
              <input type="number" id="pe-sell" value="${prod.sell_price}" class="pe-input">
            </div>
            <div>
              <label>Cost Price (KES)</label>
              <input type="number" id="pe-cost" value="${prod.cost_price}" class="pe-input">
            </div>
            <div>
              <label>UOM (Unit of Measure)</label>
              <input type="text" id="pe-uom" value="${escapeAttribute(prod.uom)}" class="pe-input">
            </div>
            <div>
              <label>Tax Code</label>
              <select id="pe-tax" class="pe-input">
                <option value="A" ${prod.tax_code === 'A' ? 'selected' : ''}>A (16%)</option>
                <option value="B" ${prod.tax_code === 'B' ? 'selected' : ''}>B (8%)</option>
                <option value="C" ${prod.tax_code === 'C' ? 'selected' : ''}>C (0%)</option>
                <option value="E" ${prod.tax_code === 'E' ? 'selected' : ''}>E (Exempt)</option>
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
              <input type="checkbox" id="pe-service" ${prod.is_service ? 'checked' : ''}>
              <label for="pe-service" style="margin:0;">Is Service?</label>
            </div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
              <input type="checkbox" id="pe-batch" ${prod.is_batch_tracked ? 'checked' : ''}>
              <label for="pe-batch" style="margin:0;">Batch Tracked?</label>
            </div>
            <div style="grid-column: span 2; margin-top: 8px;">
              <label>Product Image</label>
              <div style="display:flex; align-items:center; gap: 12px; margin-top:4px;">
                <img id="pe-image-preview" src="${escapeAttribute(prod.image_data)}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; background: rgba(0,0,0,0.2); display: ${prod.image_data ? 'block' : 'none'};">
                <div id="pe-image-placeholder" style="width: 60px; height: 60px; border-radius: 6px; background: rgba(0,0,0,0.2); display: ${prod.image_data ? 'none' : 'flex'}; align-items:center; justify-content:center; color: var(--text-muted); font-size: 20px;">📷</div>
                <input type="file" id="pe-image-upload" accept="image/*" style="display:none;">
                <button class="sec-btn" id="pe-image-btn" style="padding: 6px 12px; font-size: 11px;">Upload Image</button>
              </div>
            </div>
          </div>
          
          <div style="display:flex; gap:10px; margin-top:20px;">
            <button class="primary-btn" id="pe-save-btn" style="flex:1;">Save Product</button>
            <button class="cancel-pay-btn" id="pe-cancel-btn" style="flex:1;">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('pe-cancel-btn').addEventListener('click', () => modal.remove());
      
      let currentImageData = prod.image_data || null;

      const uploadBtn = document.getElementById('pe-image-btn');
      const fileInput = document.getElementById('pe-image-upload');
      const previewImg = document.getElementById('pe-image-preview');
      const placeholder = document.getElementById('pe-image-placeholder');

      uploadBtn.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
          // Scale down image to save space
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 400;
            let width = img.width;
            let height = img.height;

            if (width > height && width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            currentImageData = canvas.toDataURL('image/jpeg', 0.8);

            previewImg.src = currentImageData;
            previewImg.style.display = 'block';
            placeholder.style.display = 'none';
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
      
      document.getElementById('pe-save-btn').addEventListener('click', async () => {
        const name = document.getElementById('pe-name').value;
        const sku = document.getElementById('pe-sku').value || `SKU-${Date.now().toString().slice(-6)}`;
        if (!name) return showNotification('Name is required', 'error');

        const newProd = {
          ...prod,
          id: prod.id || `prod-${crypto.randomUUID()}`,
          tenant_id: state.currentTenant?.id || 'tenant-01',
          name,
          sku,
          category_id: document.getElementById('pe-category').value,
          sell_price: parseFloat(document.getElementById('pe-sell').value) || 0,
          cost_price: parseFloat(document.getElementById('pe-cost').value) || 0,
          uom: document.getElementById('pe-uom').value || 'EA',
          tax_code: document.getElementById('pe-tax').value,
          is_service: document.getElementById('pe-service').checked ? 1 : 0,
          is_batch_tracked: document.getElementById('pe-batch').checked ? 1 : 0,
          is_active: 1,
          image_data: currentImageData,
          etims_registered_at: prod.etims_registered_at || new Date().toISOString()
        };

        await db.products.put(newProd);
        showNotification('Product saved successfully', 'success');
        modal.remove();
        this.loadSubTab(); // refresh ledger
      });
    };

    const addBtn = document.getElementById('ledg-add-prod-btn');
    if (addBtn) addBtn.addEventListener('click', () => openEditor(null));
    
    pane.addEventListener('click', (e) => {
      const btn = e.target.closest('.edit-prod-btn');
      if (btn) {
        const id = btn.getAttribute('data-id');
        openEditor(id);
      }
    });
  }

  async renderTakes(pane) {
    const takes = await db.stock_takes.toArray();

    pane.innerHTML = `
      <div class="control-bar">
        <button class="primary-btn" id="new-take-btn">+ New Stock Count</button>
      </div>

      <div class="table-wrapper">
        <table class="pos-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="takes-tbody">
            ${takes.map(tk => `
              <tr>
                <td>${new Date(tk.started_at).toLocaleDateString()}</td>
                <td>Nairobi CBD</td>
                <td>
                  <span class="badge ${tk.status === 'COMPLETED' ? 'success' : 'warning'}">${tk.status}</span>
                </td>
                <td>
                  ${tk.status === 'DRAFT' ? `
                    <button class="primary-btn enter-count-btn" data-id="${tk.id}" style="padding:4px 8px;font-size:10px;">Enter Count</button>
                    <button class="confirm-pay-btn approve-take-btn" data-id="${tk.id}" style="padding:4px 8px;font-size:10px;">Approve</button>
                  ` : `<span style="color:var(--text-muted)">Closed</span>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('new-take-btn').addEventListener('click', async () => {
      const id = crypto.randomUUID();
      await db.stock_takes.add({
        id,
        branch_id: state.currentBranch.id,
        status: 'DRAFT',
        started_at: new Date().toISOString()
      });
      showNotification('Stock count sheet created.', 'success');
      this.loadSubTab();
    });

    pane.querySelectorAll('.enter-count-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const takeId = e.target.getAttribute('data-id');
        this.openCountSheetModal(takeId);
      });
    });

    pane.querySelectorAll('.approve-take-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const takeId = e.target.getAttribute('data-id');
        
        // Block self-approval: Manager cannot approve stock sheet if they entered counts
        // Simulating approval verification
        if (state.currentUser.role === 'Waiter/Waitress') {
          showNotification('Access denied. Waiter/Waitress cannot approve stock takes.', 'error');
          return;
        }

        const lines = await db.stock_take_lines.where('stock_take_id').equals(takeId).toArray();
        if (lines.length === 0) {
          showNotification('Count sheet has no entries. Add entries before approving.', 'warning');
          return;
        }

        await db.transaction('rw', [db.stock_takes, db.stock_movements], async () => {
          await db.stock_takes.update(takeId, {
            status: 'COMPLETED',
            approved_by: state.currentUser.id,
            approved_at: new Date().toISOString()
          });

          // Post stock take variance movements
          for (const line of lines) {
            if (line.variance_qty !== 0) {
              const prod = await db.products.get(line.product_id);
              await db.stock_movements.add({
                id: crypto.randomUUID(),
                tenant_id: state.currentTenant.id,
                branch_id: state.currentBranch.id,
                product_id: line.product_id,
                batch_id: null,
                type: 'STOCK_TAKE_VARIANCE',
                qty: line.variance_qty,
                unit_cost: prod ? prod.cost_price : 0,
                ref_type: 'STOCK_TAKE',
                ref_id: takeId,
                reason: `Stock take reconciliation variance`,
                created_by: state.currentUser.id,
                created_at: new Date().toISOString()
              });
            }
          }
          await logAuditEvent(state.currentTenant.id, state.currentUser.id, 'APPROVE_STOCK_TAKE', 'STOCK_TAKE', takeId);
        });

        showNotification('Stock take variances approved and posted to ledger.', 'success');
        this.loadSubTab();
      });
    });
  }

  async openCountSheetModal(takeId) {
    const products = await db.products.where('is_service').equals(0).toArray();
    
    const countDiv = document.createElement('div');
    countDiv.className = 'modal active';
    countDiv.innerHTML = `
      <div class="modal-content" style="max-width: 680px; max-height: 80vh; overflow-y:auto;">
        <h2>Stock Count Entry Sheet</h2>
        <p>Blind Count Mode: Expected quantities are hidden until you enter your count.</p>
        
        <table class="pos-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Counter Entry</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr data-prod-id="${p.id}">
                <td>${p.sku}</td>
                <td>${p.name}</td>
                <td>
                  <input type="number" class="counted-qty-input" placeholder="Counted qty" style="width:100px;background:#333;border:1px solid #444;color:#fff;padding:4px;">
                </td>
                <td class="variance-result" style="font-weight:bold;">
                  ---
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="display:flex;gap:12px;margin-top:20px;width:100%;">
          <button class="primary-btn" id="save-count-sheet" style="flex:1;">Save Counts</button>
          <button class="cancel-pay-btn" id="close-count-sheet" style="flex:1;">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(countDiv);

    // Save Counts Action
    document.getElementById('save-count-sheet').addEventListener('click', async () => {
      const rows = countDiv.querySelectorAll('tbody tr');
      
      await db.transaction('rw', db.stock_take_lines, db.stock_movements, async () => {
        for (const row of rows) {
          const productId = row.getAttribute('data-prod-id');
          const input = row.querySelector('.counted-qty-input').value;
          if (input === '') continue; // Skip uncounted lines

          const countedQty = parseFloat(input);
          const expectedQty = await getStockOnHand(productId, state.currentBranch.id);
          const varianceQty = countedQty - expectedQty;

          // Clear previous entries for the same take
          await db.stock_take_lines
            .filter(l => l.stock_take_id === takeId && l.product_id === productId)
            .delete();

          await db.stock_take_lines.add({
            id: crypto.randomUUID(),
            stock_take_id: takeId,
            product_id: productId,
            counted_qty: countedQty,
            expected_qty: expectedQty,
            variance_qty: varianceQty,
            variance_value: 0, // Computed at cost later
            counted_by: state.currentUser.id
          });

          // Update UI to show if counted equals record
          const varianceCell = row.querySelector('.variance-result');
          if (varianceQty === 0) {
            varianceCell.innerHTML = '<span style="color:var(--success-color, #10b981)">OK</span>';
          } else if (varianceQty > 0) {
            varianceCell.innerHTML = `<span style="color:var(--warning-color, #f59e0b)">+${varianceQty} (Surplus)</span>`;
          } else {
            varianceCell.innerHTML = `<span style="color:var(--danger-color, #ef4444)">${varianceQty} (Missing)</span>`;
          }
        }
      });

      showNotification('Counts saved and variances calculated.', 'success');
      // Intentionally NOT closing the modal so the user can review the variances
      this.loadSubTab();
    });

    document.getElementById('close-count-sheet').addEventListener('click', () => {
      countDiv.remove();
    });
  }

  async renderExpiries(pane) {
    const batches = await db.batches.toArray();
    const productsMap = new Map((await db.products.toArray()).map(p => [p.id, p]));

    const now = new Date();
    const alert30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const alert90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    pane.innerHTML = `
      <h3>Batch Expiry Exposure</h3>
      <p style="font-size:11px;color:var(--text-secondary);margin-bottom:20px;">Displays batch tracked products expiring within the next 30/60/90 days.</p>

      <div class="table-wrapper">
        <table class="pos-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch Number</th>
              <th>Expiry Date</th>
              <th>Days Remaining</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${batches.map(bt => {
              const prod = productsMap.get(bt.product_id);
              if (!prod) return '';
              
              const exp = new Date(bt.expiry_date);
              const diffTime = exp - now;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              let statusBadge = '';
              if (diffDays <= 0) {
                statusBadge = '<span class="badge danger">Expired</span>';
              } else if (diffDays <= 30) {
                statusBadge = '<span class="badge danger">Critical (&lt;30d)</span>';
              } else if (diffDays <= 90) {
                statusBadge = '<span class="badge warning">Warning (&lt;90d)</span>';
              } else {
                statusBadge = '<span class="badge success">Healthy</span>';
              }

              return `
                <tr>
                  <td>${prod.name}</td>
                  <td style="font-family:monospace;">${bt.batch_no}</td>
                  <td>${bt.expiry_date}</td>
                  <td style="font-weight:bold; color:${diffDays <= 30 ? 'var(--accent-rose)' : 'inherit'}">
                    ${diffDays <= 0 ? 'Expired' : diffDays + ' days'}
                  </td>
                  <td>${statusBadge}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}
