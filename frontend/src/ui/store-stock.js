import { db } from '../db/schema';
import { state, showNotification } from '../context';
import { getStoreStock, getHouseStock, logAuditEvent } from '../db/index';
import { bindPager, pagerHtml, paginate } from '../services/paginate';

export class StoreStockView {
  constructor(container) {
    this.container = container;
    this.activeTab = 'inventory'; // 'inventory' | 'requests'
    this.page = 1;
    window.storeStockViewInstance = this;
    this.pollerInterval = null;
  }

  async load() {
    window.storeStockViewInstance = this;
    if (this.pollerInterval) {
      clearInterval(this.pollerInterval);
    }
    this.render();
    await this.populateData();
    this.startRequisitionPoller();
  }

  startRequisitionPoller() {
    const updateAlertBanner = async () => {
      try {
        const pendingCount = await db.requisitions.where('status').equals('PENDING').count();
        const banner = document.getElementById('storekeeper-req-alert');
        const text = document.getElementById('storekeeper-req-alert-text');
        
        if (pendingCount > 0) {
          if (banner) {
            banner.style.display = 'flex';
          }
          if (text) {
            text.textContent = `There are ${pendingCount} pending stock request(s) from the House counter. Awaiting Supervisor approval.`;
          }
          
          const lastLoggedCount = parseInt(localStorage.getItem('last_requisition_count') || '0');
          if (pendingCount > lastLoggedCount) {
            showNotification(`🔔 Requisition Alert: ${pendingCount} pending stock requests from the House!`, 'warning');
            
            // Audio alert synthesis
            if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
              const AudioCtx = window.AudioContext || window.webkitAudioContext;
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(587.33, ctx.currentTime);
              gain.gain.setValueAtTime(0.08, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.35);
            }
          }
          localStorage.setItem('last_requisition_count', String(pendingCount));
        } else {
          if (banner) banner.style.display = 'none';
          localStorage.setItem('last_requisition_count', '0');
        }
      } catch (err) {
        console.error('Error in requisition poller:', err);
      }
    };

    updateAlertBanner();
    this.pollerInterval = setInterval(updateAlertBanner, 4000);
  }

  render() {
    this.container.innerHTML = `
      <div style="padding: 24px; color: var(--text-primary); max-width: 1200px; margin: 0 auto;">
        
        <!-- Storekeeper Requisition Alert Banner -->
        <div id="storekeeper-req-alert" style="display: none; background: rgba(245, 158, 11, 0.15); border: 1.5px solid #F59E0B; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; align-items: center; justify-content: space-between; font-family: var(--font-main); box-shadow: var(--glass-shadow);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">🔔</span>
            <div>
              <strong style="color: #fff; font-size: 14px;">Pending Requisitions Alert</strong>
              <div id="storekeeper-req-alert-text" style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">There are pending stock requests from the House counter.</div>
            </div>
          </div>
          <button id="btn-view-alerts-tab" style="background: #F59E0B; color: #000; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;">View Requests</button>
        </div>

        <!-- Top Tabs & Search -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <div style="display: flex; background: var(--bg-element); border-radius: 8px; padding: 4px;">
            <button id="tab-inventory" style="background: ${this.activeTab === 'inventory' ? '#F59E0B' : 'transparent'}; color: ${this.activeTab === 'inventory' ? '#000' : 'var(--text-secondary)'}; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;">Store Inventory</button>
            <button id="tab-requests" style="background: ${this.activeTab === 'requests' ? '#F59E0B' : 'transparent'}; color: ${this.activeTab === 'requests' ? '#000' : 'var(--text-secondary)'}; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer;">Pending Requests</button>
          </div>
          
          <div style="position: relative;">
            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">🔍</span>
            <input type="text" id="store-search" placeholder="Search product..." style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 12px 8px 32px; color: var(--text-primary); font-family: var(--font-main); font-size: 13px; width: 300px;">
          </div>
        </div>

        <!-- Store Inventory Table -->
        <div id="view-store-inventory" style="display: ${this.activeTab === 'inventory' ? 'block' : 'none'}; background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
          <div style="overflow-x: auto;">
            <table class="pos-table" style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-color);">
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary); width: 35%;">PRODUCT</th>
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary);">CATEGORY</th>
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary);">UOM</th>
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary); text-align: right;">STORE STOCK</th>
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary); text-align: right;">HOUSE STOCK</th>
                  <th style="padding: 16px; font-size: 11px; color: var(--text-secondary); text-align: right; width: 120px;">ACTION</th>
                </tr>
              </thead>
              <tbody id="store-table-body">
                <!-- Rows injected here -->
              </tbody>
            </table>
          </div>
          <div id="store-pager"></div>
        </div>

        <!-- Pending Requests View -->
        <div id="view-store-requests" style="display: ${this.activeTab === 'requests' ? 'block' : 'none'}; background: var(--bg-element); border: 1px solid var(--border-color); border-radius: 8px; padding: 24px;">
           <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #fff;">Pending Stock Requisitions</h3>
           <div id="requests-list">
             <!-- Requests injected here -->
           </div>
        </div>
      </div>

      <!-- Store Stock Edit / Delivery Modal -->
      <div id="store-stock-modal" class="modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 9999; justify-content: center; align-items: center; padding: 20px;">
        <div style="background: #18181b; border: 1px solid var(--border-color); border-radius: 16px; width: 100%; max-width: 480px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);">
          
          <div style="padding: 18px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px;" id="modal-icon-header">🚚</span>
              <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #fff;" id="modal-title-header">Receive New Stock Delivery</h3>
            </div>
            <button id="store-modal-close" style="background: transparent; border: none; color: var(--text-secondary); font-size: 18px; cursor: pointer; padding: 4px 8px;">✕</button>
          </div>

          <form id="store-stock-edit-form" style="padding: 24px;">
            <input type="hidden" id="edit-prod-id">
            <input type="hidden" id="edit-mode-type" value="DELIVERY"> <!-- 'DELIVERY' | 'ABSOLUTE' -->
            
            <!-- Mode Tabs -->
            <div style="display: flex; gap: 6px; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 8px; margin-bottom: 16px;">
              <button type="button" id="mode-btn-delivery" style="flex: 1; background: #10b981; color: #fff; border: none; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                🚚 Receive Delivery (+)
              </button>
              <button type="button" id="mode-btn-absolute" style="flex: 1; background: transparent; color: var(--text-secondary); border: none; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                ✏️ Set Total Count
              </button>
            </div>

            <div style="margin-bottom: 16px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
              <div id="edit-prod-name" style="font-weight: 800; font-size: 15px; color: #fff;">PRODUCT NAME</div>
              <div style="display: flex; gap: 16px; margin-top: 6px; font-size: 12px; color: var(--text-secondary);">
                <span>Current Store Stock: <strong id="edit-current-store" style="color: #F59E0B; font-size: 14px;">0</strong></span>
                <span>House Stock: <strong id="edit-current-house" style="color: #a08060; font-size: 13px;">0</strong></span>
              </div>
            </div>

            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px;">Target Inventory Location</label>
              <select id="edit-stock-location" style="width: 100%; padding: 10px; border-radius: 6px; background: #2a1708; border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px;">
                <option value="STORE" selected>Store Room Stock (Main Inventory)</option>
                <option value="HOUSE">House / Bar Counter Stock</option>
              </select>
            </div>

            <!-- Delivery Input Mode -->
            <div id="field-wrap-delivery" style="margin-bottom: 16px;">
              <label style="display: block; font-size: 11px; font-weight: 800; color: #10b981; text-transform: uppercase; margin-bottom: 6px;">🚚 Delivered Quantity Brought In (+ Add to Store)</label>
              <input type="number" id="edit-delivery-qty" min="1" step="1" placeholder="e.g. 24 (1 crate)..." style="width: 100%; padding: 12px; border-radius: 6px; background: #18261e; border: 1.5px solid #10b981; color: #fff; font-family: var(--font-main); font-size: 16px; font-weight: 800;">
              
              <!-- Dynamic Calculation Preview Box -->
              <div style="margin-top: 10px; padding: 10px 14px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: 6px; font-size: 13px; color: #fff; display: flex; justify-content: space-between; align-items: center;">
                <span>New Resulting Total:</span>
                <strong id="preview-resulting-total" style="font-size: 16px; color: #10b981; font-weight: 800;">0</strong>
              </div>
            </div>

            <!-- Absolute Total Input Mode -->
            <div id="field-wrap-absolute" style="margin-bottom: 16px; display: none;">
              <label style="display: block; font-size: 11px; font-weight: 800; color: #e8a535; text-transform: uppercase; margin-bottom: 6px;">✏️ New Absolute Stock Quantity (Set Count)</label>
              <input type="number" id="edit-stock-qty" min="0" step="1" placeholder="Enter absolute quantity..." style="width: 100%; padding: 12px; border-radius: 6px; background: #2a1708; border: 1.5px solid #e8a535; color: #fff; font-family: var(--font-main); font-size: 16px; font-weight: 800;">
            </div>

            <!-- Quick Add Presets -->
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 10px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px;">Quick Delivery Case Presets</label>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="preset-btn" data-add="6" style="background: rgba(255,255,255,0.08); color: #fff; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">+6 (Half Case)</button>
                <button type="button" class="preset-btn" data-add="12" style="background: rgba(255,255,255,0.08); color: #fff; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">+12 (Dozen)</button>
                <button type="button" class="preset-btn" data-add="24" style="background: rgba(255,255,255,0.08); color: #fff; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">+24 (Full Case)</button>
                <button type="button" class="preset-btn" data-add="48" style="background: rgba(255,255,255,0.08); color: #fff; border: 1px solid var(--border-color); padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">+48 (2 Cases)</button>
              </div>
            </div>

            <div style="margin-bottom: 24px;">
              <label style="display: block; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 6px;">Adjustment / Delivery Reason</label>
              <select id="edit-stock-reason" style="width: 100%; padding: 10px; border-radius: 6px; background: #2a1708; border: 1px solid var(--border-color); color: #fff; font-family: var(--font-main); font-size: 13px;">
                <option value="Direct Supplier Delivery" selected>Direct Supplier Delivery / New Delivery Brought In</option>
                <option value="Physical Stock Count Adjustment">Physical Stock Count / Audit Adjustment</option>
                <option value="Spoilage / Breakage Writeoff">Spoilage / Breakage Write-off</option>
                <option value="Opening Stock Initialization">Opening Stock Initialization</option>
              </select>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button type="button" id="edit-cancel-btn" style="background: rgba(255,255,255,0.08); color: #fff; border: 1px solid var(--border-color); padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">Cancel</button>
              <button type="submit" id="edit-submit-btn" style="background: #10b981; color: #fff; border: none; padding: 10px 22px; border-radius: 6px; font-size: 13px; font-weight: 800; cursor: pointer;">🚚 Confirm Delivery &amp; Add Stock</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('tab-inventory').addEventListener('click', () => {
      this.activeTab = 'inventory';
      this.load();
    });
    document.getElementById('tab-requests').addEventListener('click', () => {
      this.activeTab = 'requests';
      this.load();
    });

    const alertBtn = document.getElementById('btn-view-alerts-tab');
    if (alertBtn) {
      alertBtn.addEventListener('click', () => {
        this.activeTab = 'requests';
        this.load();
      });
    }

    document.getElementById('store-search').addEventListener('input', () => {
      if (this.page !== undefined) this.page = 1;
      this.populateData();
    });

    this.bindEvents();
  }

  bindEvents() {
    const modal = document.getElementById('store-stock-modal');
    const closeBtn = document.getElementById('store-modal-close');
    const cancelBtn = document.getElementById('edit-cancel-btn');

    const closeModal = () => {
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    // Mode Switching inside modal
    const deliveryBtn = document.getElementById('mode-btn-delivery');
    const absoluteBtn = document.getElementById('mode-btn-absolute');
    const fieldDelivery = document.getElementById('field-wrap-delivery');
    const fieldAbsolute = document.getElementById('field-wrap-absolute');
    const modeTypeInput = document.getElementById('edit-mode-type');
    const submitBtn = document.getElementById('edit-submit-btn');

    const setMode = (mode) => {
      modeTypeInput.value = mode;
      if (mode === 'DELIVERY') {
        deliveryBtn.style.background = '#10b981';
        deliveryBtn.style.color = '#fff';
        absoluteBtn.style.background = 'transparent';
        absoluteBtn.style.color = 'var(--text-secondary)';
        fieldDelivery.style.display = 'block';
        fieldAbsolute.style.display = 'none';
        if (submitBtn) submitBtn.innerHTML = '🚚 Confirm Delivery &amp; Add Stock';
        document.getElementById('edit-stock-reason').value = 'Direct Supplier Delivery';
      } else {
        absoluteBtn.style.background = '#e8a535';
        absoluteBtn.style.color = '#000';
        deliveryBtn.style.background = 'transparent';
        deliveryBtn.style.color = 'var(--text-secondary)';
        fieldDelivery.style.display = 'none';
        fieldAbsolute.style.display = 'block';
        if (submitBtn) submitBtn.innerHTML = '💾 Update Stock Total';
        document.getElementById('edit-stock-reason').value = 'Physical Stock Count Adjustment';
      }
      this.updateLivePreview();
    };

    if (deliveryBtn) deliveryBtn.addEventListener('click', () => setMode('DELIVERY'));
    if (absoluteBtn) absoluteBtn.addEventListener('click', () => setMode('ABSOLUTE'));

    // Live preview calculation on typing delivery input
    const delInput = document.getElementById('edit-delivery-qty');
    if (delInput) {
      delInput.addEventListener('input', () => this.updateLivePreview());
    }

    // Preset buttons inside modal
    const form = document.getElementById('store-stock-edit-form');
    if (form) {
      form.querySelectorAll('.preset-btn').forEach(b => {
        b.addEventListener('click', (e) => {
          const addQty = parseInt(e.currentTarget.getAttribute('data-add')) || 0;
          const isDelivery = modeTypeInput.value === 'DELIVERY';
          const input = isDelivery ? document.getElementById('edit-delivery-qty') : document.getElementById('edit-stock-qty');
          const currentVal = parseInt(input.value) || 0;
          input.value = currentVal + addQty;
          this.updateLivePreview();
        });
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveStockAdjustment();
      });
    }

    // Dynamic location switch inside modal
    const locSelect = document.getElementById('edit-stock-location');
    if (locSelect) {
      locSelect.addEventListener('change', () => {
        this.updateLivePreview();
      });
    }
  }

  updateLivePreview() {
    const loc = document.getElementById('edit-stock-location')?.value || 'STORE';
    const curStore = parseInt(document.getElementById('edit-current-store')?.textContent) || 0;
    const curHouse = parseInt(document.getElementById('edit-current-house')?.textContent) || 0;
    const baseStock = loc === 'STORE' ? curStore : curHouse;

    const delQty = parseInt(document.getElementById('edit-delivery-qty')?.value) || 0;
    const previewEl = document.getElementById('preview-resulting-total');
    if (previewEl) {
      previewEl.textContent = `${baseStock} + ${delQty} = ${baseStock + delQty}`;
    }
  }

  async openEditModal(productId, initialMode = 'DELIVERY') {
    try {
      console.log('openEditModal triggered. ID:', productId, 'Mode:', initialMode);
      const role = state.currentUser?.role;
      if (role !== 'Store Keeper' && role !== 'Store Manager' && role !== 'Owner') {
        showNotification('Access Denied: Only Store Keepers, Managers, or Owners can receive or adjust stock.', 'error');
        return;
      }
      let prod = await db.products.get(productId);
      if (!prod && !isNaN(productId)) {
        prod = await db.products.get(Number(productId));
      }
      if (!prod) {
        const allProds = await db.products.toArray();
        prod = allProds.find(p => String(p.id) === String(productId));
      }

      if (!prod) {
        console.error('Product not found for ID:', productId);
        showNotification('Product details could not be loaded.', 'error');
        return;
      }

      const actualPid = prod.id;
      const storeStock = await getStoreStock(actualPid, state.currentBranch?.id);
      const houseStock = await getHouseStock(actualPid, state.currentBranch?.id);

      const editProdId = document.getElementById('edit-prod-id');
      const editProdName = document.getElementById('edit-prod-name');
      const editCurStore = document.getElementById('edit-current-store');
      const editCurHouse = document.getElementById('edit-current-house');
      const editLoc = document.getElementById('edit-stock-location');
      const editDelQty = document.getElementById('edit-delivery-qty');
      const editStockQty = document.getElementById('edit-stock-qty');

      if (!editProdId || !editProdName || !editCurStore || !editCurHouse || !editLoc || !editDelQty || !editStockQty) {
        throw new Error('Required modal input elements are missing from the DOM.');
      }

      editProdId.value = actualPid;
      editProdName.textContent = `${prod.name.toUpperCase()} (${prod.uom || 'UNIT'})`;
      editCurStore.textContent = storeStock;
      editCurHouse.textContent = houseStock;
      editLoc.value = 'STORE';
      editDelQty.value = '';
      editStockQty.value = storeStock;

      // Trigger mode setup
      const deliveryBtn = document.getElementById('mode-btn-delivery');
      const absoluteBtn = document.getElementById('mode-btn-absolute');
      const fieldDelivery = document.getElementById('field-wrap-delivery');
      const fieldAbsolute = document.getElementById('field-wrap-absolute');
      const modeTypeInput = document.getElementById('edit-mode-type');
      const submitBtn = document.getElementById('edit-submit-btn');

      if (modeTypeInput) modeTypeInput.value = initialMode;
      if (initialMode === 'DELIVERY') {
        if (deliveryBtn) {
          deliveryBtn.style.background = '#10b981';
          deliveryBtn.style.color = '#fff';
        }
        if (absoluteBtn) {
          absoluteBtn.style.background = 'transparent';
          absoluteBtn.style.color = 'var(--text-secondary)';
        }
        if (fieldDelivery) fieldDelivery.style.display = 'block';
        if (fieldAbsolute) fieldAbsolute.style.display = 'none';
        if (submitBtn) submitBtn.innerHTML = '🚚 Confirm Delivery &amp; Add Stock';
        const reasonEl = document.getElementById('edit-stock-reason');
        if (reasonEl) reasonEl.value = 'Direct Supplier Delivery';
      } else {
        if (absoluteBtn) {
          absoluteBtn.style.background = '#e8a535';
          absoluteBtn.style.color = '#000';
        }
        if (deliveryBtn) {
          deliveryBtn.style.background = 'transparent';
          deliveryBtn.style.color = 'var(--text-secondary)';
        }
        if (fieldDelivery) fieldDelivery.style.display = 'none';
        if (fieldAbsolute) fieldAbsolute.style.display = 'block';
        if (submitBtn) submitBtn.innerHTML = '💾 Update Stock Total';
        const reasonEl = document.getElementById('edit-stock-reason');
        if (reasonEl) reasonEl.value = 'Physical Stock Count Adjustment';
      }

      this.updateLivePreview();

      const modal = document.getElementById('store-stock-modal');
      if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
      } else {
        throw new Error('Modal element #store-stock-modal is missing from DOM.');
      }
    } catch (err) {
      console.error('Error in openEditModal:', err);
      showNotification('Error: ' + err.message, 'error');
    }
  }

  async saveStockAdjustment() {
    const productId = document.getElementById('edit-prod-id').value;
    const location = document.getElementById('edit-stock-location').value;
    const mode = document.getElementById('edit-mode-type').value;
    const reason = document.getElementById('edit-stock-reason').value;

    let prod = await db.products.get(productId);
    if (!prod && !isNaN(productId)) {
      prod = await db.products.get(Number(productId));
    }
    if (!prod) {
      const allProds = await db.products.toArray();
      prod = allProds.find(p => String(p.id) === String(productId));
    }

    const actualPid = prod ? prod.id : productId;

    const currentStock = location === 'STORE' ? 
      await getStoreStock(actualPid, state.currentBranch?.id) : 
      await getHouseStock(actualPid, state.currentBranch?.id);

    let delta = 0;
    let newQty = 0;

    if (mode === 'DELIVERY') {
      const deliveredQty = parseInt(document.getElementById('edit-delivery-qty').value);
      if (isNaN(deliveredQty) || deliveredQty <= 0) {
        showNotification('Please enter a valid positive delivery quantity brought in.', 'error');
        return;
      }
      delta = deliveredQty;
      newQty = currentStock + delta;
    } else {
      newQty = parseInt(document.getElementById('edit-stock-qty').value);
      if (isNaN(newQty) || newQty < 0) {
        showNotification('Please enter a valid non-negative stock quantity.', 'error');
        return;
      }
      delta = newQty - currentStock;
    }

    if (delta === 0) {
      showNotification('No stock change detected.', 'warning');
      const modal = document.getElementById('store-stock-modal');
      if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
      }
      return;
    }

    const prodName = prod ? prod.name : 'Product';

    await db.stock_movements.add({
      id: crypto.randomUUID(),
      tenant_id: state.currentTenant?.id || 't1',
      branch_id: state.currentBranch?.id || 'b1',
      product_id: productId,
      batch_id: null,
      type: mode === 'DELIVERY' ? 'DELIVERY_IN' : 'ADJUSTMENT',
      location: location,
      qty: delta,
      unit_cost: 0,
      ref_type: mode === 'DELIVERY' ? 'SUPPLIER_DELIVERY' : 'MANUAL_EDIT',
      ref_id: crypto.randomUUID(),
      reason: reason || (mode === 'DELIVERY' ? 'Direct Supplier Delivery' : 'Manual Stock Edit'),
      created_by: state.currentUser?.id || 'owner',
      created_at: new Date().toISOString()
    });

    await logAuditEvent(
      state.currentTenant?.id || 't1',
      state.currentUser?.id || 'anonymous',
      mode === 'DELIVERY' ? 'STOCK_DELIVERY' : 'STOCK_ADJUSTMENT',
      'PRODUCT',
      productId,
      JSON.stringify({ location, oldQty: currentStock }),
      JSON.stringify({ location, newQty, delta, reason: reason || (mode === 'DELIVERY' ? 'Direct Supplier Delivery' : 'Manual Stock Edit') })
    );

    if (mode === 'DELIVERY') {
      showNotification(`🚚 Received +${delta} units for ${prodName}! ${location === 'STORE' ? 'Store' : 'House'} stock updated from ${currentStock} to ${newQty}.`, 'success');
    } else {
      showNotification(`${location === 'STORE' ? 'Store' : 'House'} stock for ${prodName} updated to ${newQty}. (${delta > 0 ? '+' : ''}${delta})`, 'success');
    }

    const modal = document.getElementById('store-stock-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }

    await this.populateData();
  }

  async populateData() {
    if (this.activeTab === 'inventory') {
      await this.populateInventory();
    } else {
      await this.populateRequests();
    }
  }

  async populateInventory() {
    const tbody = document.getElementById('store-table-body');
    const searchInput = document.getElementById('store-search');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    
    const products = await db.products.where('is_service').equals(0).toArray();
    const categories = new Map((await db.categories.toArray()).map(c => [c.id, c.name]));

    const matches = search
      ? products.filter(p => p.name.toLowerCase().includes(search))
      : products;

    // Page before the stock lookups, not after: each row costs two more Dexie
    // reads, so this is 25 of them instead of one per product in the catalogue.
    const view = paginate(matches, this.page);
    this.page = view.page;

    const rowsHtml = [];

    for (const p of view.rows) {
      const storeStock = await getStoreStock(p.id, state.currentBranch?.id);
      const houseStock = await getHouseStock(p.id, state.currentBranch?.id);
      
      const categoryName = categories.get(p.category_id) || 'Uncategorized';

      rowsHtml.push(`
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
            <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.1); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 16px;">
              📦
            </div>
            <span style="font-size: 13px; font-weight: 700; color: #fff;">${p.name.toUpperCase()}</span>
          </td>
          <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: var(--text-secondary);">${categoryName.toUpperCase()}</td>
          <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: var(--text-secondary);">${p.uom || 'UNIT'}</td>
          <td style="padding: 12px 16px; font-size: 14px; font-weight: 800; color: #F59E0B; text-align: right;">${storeStock}</td>
          <td style="padding: 12px 16px; font-size: 14px; font-weight: 700; color: var(--text-muted); text-align: right;">${houseStock}</td>
          <td style="padding: 12px 16px; text-align: right; white-space: nowrap;">
            <div style="display: flex; gap: 6px; justify-content: flex-end;">
              <button class="btn-receive-delivery" onclick="window.storeStockViewInstance.openEditModal('${p.id}', 'DELIVERY')" style="background: #10b981; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                🚚 Receive
              </button>
              <button class="btn-edit-store-stock" onclick="window.storeStockViewInstance.openEditModal('${p.id}', 'ABSOLUTE')" style="background: rgba(255,255,255,0.08); color: #fff; border: 1px solid var(--border-color); padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                ✏️ Edit
              </button>
            </div>
          </td>
        </tr>
      `);
    }

    if (rowsHtml.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">No products found.</td></tr>`;
    } else {
      tbody.innerHTML = rowsHtml.join('');
    }

    const pager = document.getElementById('store-pager');
    if (pager) {
      pager.innerHTML = pagerHtml('store-pager-strip', view);
      bindPager('store-pager-strip', view, (next) => {
        this.page = next;
        this.populateInventory();
      });
    }
  }

  async populateRequests() {
    const list = document.getElementById('requests-list');
    const reqs = await db.requisitions.where('status').equals('PENDING').toArray();
    
    if (reqs.length === 0) {
      list.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px;">No pending requisitions.</div>`;
      return;
    }

    const html = [];
    for (const req of reqs) {
      const lines = await db.req_lines.where('req_id').equals(req.id).toArray();
      const productIds = lines.map(l => l.product_id);
      const products = await db.products.where('id').anyOf(productIds).toArray();
      const pMap = new Map(products.map(p => [p.id, p]));

      let linesHtml = lines.map(l => `
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0;">
          <span style="color: var(--text-secondary);">${pMap.get(l.product_id)?.name || 'Unknown'}</span>
          <span style="color: #fff; font-weight: 600;">Qty: ${l.qty}</span>
        </div>
      `).join('');

      const actionButtonHtml = `<button class="btn-approve-req" data-id="${req.id}" style="background: var(--accent-amber); color: #000; border: none; padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">✔️ Approve &amp; Transfer Stock</button>`;

      html.push(`
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: var(--glass-shadow);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 14px; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 12px; color: var(--text-muted);">Request ID: ${req.id.split('-')[0].toUpperCase()} • ${new Date(req.created_at).toLocaleString()}</div>
              <div style="font-size: 11px; margin-top: 4px; font-weight: 700; color: #e8a535; text-transform: uppercase;">STATUS: ${req.status}</div>
            </div>
            ${actionButtonHtml}
          </div>
          <div style="border-top: 1px solid var(--border-color); padding-top: 12px; display: flex; flex-direction: column; gap: 4px;">
            ${linesHtml}
          </div>
        </div>
      `);
    }

    list.innerHTML = html.join('');

    list.querySelectorAll('.btn-approve-req').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const reqId = e.currentTarget.getAttribute('data-id');
        await this.approveRequisition(reqId);
      });
    });
  }

  async approveRequisition(reqId) {
    const role = state.currentUser?.role;
    if (role !== 'Supervisor' && role !== 'Store Manager' && role !== 'Owner') {
      showNotification('Access Denied: Only Supervisors, Managers, or Owners can approve requests.', 'error');
      return;
    }

    if (!confirm('Approve this stock requisition and transfer stock to House counter?')) return;
    
    const lines = await db.req_lines.where('req_id').equals(reqId).toArray();
    
    await db.transaction('rw', db.stock_movements, db.requisitions, async () => {
      for (const line of lines) {
        // 1. Deplete Store Stock
        await db.stock_movements.add({
          id: crypto.randomUUID(),
          tenant_id: state.currentTenant?.id || 't1',
          branch_id: state.currentBranch?.id || 'b1',
          product_id: line.product_id,
          batch_id: null,
          type: 'TRANSFER_OUT',
          location: 'STORE',
          qty: -line.qty,
          unit_cost: 0,
          ref_type: 'REQUISITION',
          ref_id: reqId,
          reason: 'Requisition Issued to House',
          created_by: state.currentUser?.id || 'supervisor',
          created_at: new Date().toISOString()
        });

        // 2. Increase House Stock
        await db.stock_movements.add({
          id: crypto.randomUUID(),
          tenant_id: state.currentTenant?.id || 't1',
          branch_id: state.currentBranch?.id || 'b1',
          product_id: line.product_id,
          batch_id: null,
          type: 'TRANSFER_IN',
          location: 'HOUSE',
          qty: line.qty,
          unit_cost: 0,
          ref_type: 'REQUISITION',
          ref_id: reqId,
          reason: 'Requisition Received from Store',
          created_by: state.currentUser?.id || 'supervisor',
          created_at: new Date().toISOString()
        });
      }

      await db.requisitions.update(reqId, { 
        status: 'APPROVED', 
        approved_by: state.currentUser?.id || 'supervisor',
        issued_by: state.currentUser?.id || 'supervisor'
      });
    });

    await logAuditEvent(
      state.currentTenant?.id || 't1',
      state.currentUser?.id || 'anonymous',
      'APPROVE_REQUISITION',
      'REQUISITION',
      reqId
    );

    showNotification('Requisition approved and stock transferred to House successfully!', 'success');
    await this.load();
  }
}

// Global helper for inline onclick events
window.openStoreStockModal = async function(productId, mode) {
  try {
    console.log('window.openStoreStockModal triggered:', productId, mode);
    if (!window.storeStockViewInstance) {
      console.warn('storeStockViewInstance not set, instantiating fallback');
      const container = document.getElementById('view-store-stock');
      if (container) {
        window.storeStockViewInstance = new StoreStockView(container);
      }
    }
    if (window.storeStockViewInstance) {
      await window.storeStockViewInstance.openEditModal(productId, mode);
    } else {
      console.error('storeStockViewInstance could not be initialized.');
    }
  } catch (err) {
    console.error('Error in window.openStoreStockModal:', err);
  }
};

