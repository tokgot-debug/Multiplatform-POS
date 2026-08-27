import { db } from '../db/schema';
import { logAuditEvent, getHouseStock } from '../db/index';
import { state, showNotification } from '../context';
import { MpesaService } from '../services/mpesa';

export class TillView {
  constructor(container) {
    this.container = container;
    this.cart = []; // Current cart items { product, qty, discount_amount, discount_percent, batch }
    this.parkedCarts = []; // Suspended carts
    this.selectedCustomer = null;
    this.mpesa = new MpesaService();
    this.selectedPaymentMethod = 'CASH'; // CASH, MPESA, CREDIT, SPLIT, CARD_PAYSTACK, AIRTEL_PAYSTACK, BANK_PAYSTACK
    this.splitDetails = { cash: 0, mpesa: 0 };
    this.paystackRef = null;
    this.loadPaystackScript();
  }

  loadPaystackScript() {
    if (window.PaystackPop) return;
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.head.appendChild(script);
  }

  async load() {
    if (state.currentUser?.role === 'Supervisor') {
      this.container.innerHTML = `
        <div style="padding: 48px; text-align: center; color: var(--text-primary); max-width: 500px; margin: 100px auto; background: #140e08; border: 1px solid var(--border-color); border-radius: 16px; box-shadow: var(--glass-shadow); font-family: var(--font-main);">
          <span style="font-size: 60px;">🚫</span>
          <h2 style="margin: 24px 0 12px 0; font-weight: 800; color: #fff; font-size: 22px;">Sales Terminal Restricted</h2>
          <p style="color: var(--text-secondary); line-height: 1.6; font-size: 14px; margin-bottom: 24px;">Supervisors are restricted from performing till sales. Please log in with a Waiter/Waitress, Bar Staff, Manager, or Owner account to register sales.</p>
        </div>
      `;
      return;
    }
    
    this.selectedCustomer = await db.customers.where('id').equals('cust-walkin').first();
    if (!this.selectedCustomer) {
      // Safety fallback to prevent app crashing if DB record is missing
      this.selectedCustomer = { id: 'cust-walkin', name: 'Walk-In Customer', price_tier: 'RETAIL' };
    }
    this.render();
    await this.loadProducts();
    await this.loadCustomerDropdown();
    this.updateCartUI();
  }

  render() {
    this.container.innerHTML = `
      <div class="till-grid">
        <!-- Products Column -->
        <div class="till-catalogue-col">
          <div class="till-search-bar">
            <div class="search-input-wrapper">
              <input type="text" id="till-search" placeholder="Search by name, SKU or barcode...">
            </div>
            <button class="barcode-scanner-btn" id="till-scan-sim">
              <span>📷</span> Simulate Barcode
            </button>
            <button class="sec-btn" id="till-park-btn">Park Cart</button>
            <button class="sec-btn" id="till-resume-btn">Resume Carts (<span id="parked-count">0</span>)</button>
          </div>
          
          <div class="cat-filters" id="cat-filters">
            <div class="filter-chip active" data-cat="all">All Items</div>
            <div class="filter-chip" data-cat="cat-beers">🍺 Beers & Ciders</div>
            <div class="filter-chip" data-cat="cat-spirits">🥃 Spirits & Wines</div>
            <div class="filter-chip" data-cat="cat-softdrinks">🥤 Soft Drinks</div>
            <div class="filter-chip" data-cat="cat-food">🍽️ Food & Meals</div>
            <div class="filter-chip" data-cat="cat-services">🧾 Services</div>
          </div>

          <div class="product-grid" id="till-prod-grid">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Cart Column -->
        <div class="till-cart-col">
          <div class="cart-header">
            <h3>Current Sale</h3>
            <span class="cart-count" id="cart-item-count">0 Items</span>
          </div>

          <div class="cart-list" id="cart-list">
            <div class="cart-empty">
              <span class="cart-empty-icon">🛒</span>
              <span>Cart is empty</span>
            </div>
          </div>

          <!-- Customer & Buyer PIN -->
          <div class="cart-customer-section">
            <div class="customer-attach-header">
              <span>Attach Customer</span>
              <span id="price-tier-indicator" style="color:var(--accent-cyan)">Retail Pricing</span>
            </div>
            <div class="customer-selector">
              <select id="cart-customer-select">
                <!-- Loaded dynamically -->
              </select>
            </div>
            <div class="buyer-pin-row">
              <input type="text" id="cart-buyer-pin" placeholder="Buyer KRA PIN (Optional)">
            </div>
          </div>

          <!-- Cart Totals & Checkout -->
          <div class="cart-summary">
            <div class="summary-row">
              <span>Subtotal</span>
              <span id="summary-subtotal">KES 0.00</span>
            </div>
            <div class="summary-row">
              <span>Discount</span>
              <span id="summary-discount">KES 0.00</span>
            </div>
            <div class="summary-row">
              <span>VAT Tax</span>
              <span id="summary-tax">KES 0.00</span>
            </div>
            <div class="summary-row total">
              <span>Total</span>
              <span id="summary-total">KES 0.00</span>
            </div>
            <button class="checkout-btn" id="till-pay-now-btn" disabled>Pay Now</button>
          </div>
        </div>
      </div>

      <!-- Payment & Checkout Modal Overlay -->
      <div id="payment-modal" class="modal">
        <div class="modal-content" style="max-width: 700px;">
          <h2>Process Checkout</h2>
          <p>Choose settlement method and finalize invoice</p>

          <div class="checkout-modal-grid">
            <!-- Methods Column -->
            <div class="checkout-payment-methods">
              <div class="payment-method-card selected" data-method="CASH">
                <span style="font-size:20px;">💵</span>
                <div>
                  <h4>Cash Payment</h4>
                  <p>Accept physical currency and compute change</p>
                </div>
              </div>
              <div class="payment-method-card" data-method="MPESA">
                <span style="font-size:20px;">📱</span>
                <div>
                  <h4>M-Pesa STK Push</h4>
                  <p>Send prompt directly to customer phone</p>
                </div>
              </div>
              <div class="payment-method-card" data-method="CREDIT">
                <span style="font-size:20px;">💳</span>
                <div>
                  <h4>On Account (Credit)</h4>
                  <p>Charge against debtor limits</p>
                </div>
              </div>
              <div class="payment-method-card" data-method="SPLIT">
                <span style="font-size:20px;">⚖️</span>
                <div>
                  <h4>Split Payment</h4>
                  <p>Combine Cash and M-Pesa</p>
                </div>
              </div>
              <div class="payment-method-card" data-method="CARD_PAYSTACK">
                <span style="font-size:20px;">💳</span>
                <div>
                  <h4>Visa / Mastercard</h4>
                  <p>Paystack card checkout</p>
                </div>
              </div>
              <div class="payment-method-card" data-method="AIRTEL_PAYSTACK">
                <span style="font-size:20px;">🔴</span>
                <div>
                  <h4>Airtel Money</h4>
                  <p>Airtel mobile money via Paystack</p>
                </div>
              </div>
              <div class="payment-method-card" data-method="BANK_PAYSTACK">
                <span style="font-size:20px;">🏛️</span>
                <div>
                  <h4>Bank Transfer</h4>
                  <p>Bank transfer via Paystack</p>
                </div>
              </div>
            </div>

            <!-- Input Column -->
            <div class="payment-inputs-col">
              <div class="payment-detail-box">
                <h3>Grand Total Due</h3>
                <p id="checkout-due-amount">KES 0.00</p>
              </div>

              <!-- Table Number -->
              <div class="checkout-inputs" style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; display: block !important;">
                <label style="font-size:11px;color:var(--text-secondary)">Table Number (Optional)</label>
                <input type="text" id="checkout-table-number" placeholder="e.g. 12 or Patio 3" style="width: 100%;">
              </div>

              <!-- Loyalty Points & Rewards -->
              <div class="checkout-inputs" id="loyalty-redeem-section" style="margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; display: block !important;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <label style="font-size:11px;color:var(--text-secondary);display:block;">Available Loyalty Points</label>
                    <span id="checkout-loyalty-pts" style="font-size:13px;font-weight:700;color:var(--accent-amber);">0 pts</span>
                  </div>
                  <button type="button" id="btn-redeem-loyalty" class="sec-btn" style="padding: 4px 8px; font-size: 11px;">Redeem Points</button>
                </div>
                <div id="loyalty-redeem-status" style="font-size:11px;color:var(--accent-green);margin-top:4px;display:none;"></div>
              </div>

              <!-- Cash Input fields -->
              <div class="checkout-inputs" id="payment-inputs-cash">
                <label style="font-size:11px;color:var(--text-secondary)">Tendered Cash Amount</label>
                <input type="number" id="pay-cash-tendered" placeholder="Enter amount received...">
                <div class="summary-row" style="margin-top:8px;">
                  <span>Change Due:</span>
                  <span id="pay-cash-change" style="font-weight:700;color:var(--accent-green)">KES 0.00</span>
                </div>
              </div>

              <!-- M-Pesa Input fields -->
              <div class="checkout-inputs hidden" id="payment-inputs-mpesa">
                <label style="font-size:11px;color:var(--text-secondary)">M-Pesa Mobile Number</label>
                <input type="text" id="pay-mpesa-phone" placeholder="e.g. 0712345678">
                <button class="primary-btn" id="pay-trigger-stk" style="margin-top:4px;">Initiate STK Push</button>
                <div id="stk-status-area" class="hidden" style="margin-top:8px;text-align:center;font-size:12px;">
                  <span class="badge warning" id="stk-status-badge">Awaiting User PIN...</span>
                </div>
              </div>

              <!-- Credit Limit check fields -->
              <div class="checkout-inputs hidden" id="payment-inputs-credit">
                <div class="summary-row">
                  <span>Customer Debt Limit:</span>
                  <span id="pay-credit-limit">KES 0.00</span>
                </div>
                <div class="summary-row" style="margin-top:4px;">
                  <span>Current Outstanding Balance:</span>
                  <span id="pay-credit-balance">KES 0.00</span>
                </div>
                <p id="credit-warn-text" class="error-msg"></p>
              </div>

              <!-- Split payment inputs -->
              <div class="checkout-inputs hidden" id="payment-inputs-split">
                <label style="font-size:11px;color:var(--text-secondary)">Amount Cash</label>
                <input type="number" id="pay-split-cash" placeholder="Cash portion...">
                <label style="font-size:11px;color:var(--text-secondary)">Amount M-Pesa (Send STK)</label>
                <input type="number" id="pay-split-mpesa" placeholder="M-Pesa portion...">
                <input type="text" id="pay-split-phone" placeholder="M-Pesa Phone Number" style="margin-top:4px;">
                <button class="primary-btn" id="pay-split-trigger-stk">Trigger M-Pesa STK</button>
              </div>

              <!-- Paystack Card inputs -->
              <div class="checkout-inputs hidden" id="payment-inputs-card">
                <label style="font-size:11px;color:var(--text-secondary)">Customer Email Address (Required)</label>
                <input type="email" id="pay-card-email" placeholder="customer@example.com" value="customer@titanium.com">
                <button class="primary-btn" id="pay-trigger-card-paystack" style="margin-top:8px;background:#c8832a;color:#fff;border:none;">Launch Card Payment 💳</button>
                <div id="card-paystack-status" class="hidden" style="margin-top:8px;text-align:center;font-size:12px;">
                  <span class="badge warning" id="card-paystack-badge">Waiting for Paystack...</span>
                </div>
              </div>

              <!-- Paystack Airtel inputs -->
              <div class="checkout-inputs hidden" id="payment-inputs-airtel">
                <label style="font-size:11px;color:var(--text-secondary)">Customer Email Address (Required)</label>
                <input type="email" id="pay-airtel-email" placeholder="customer@example.com" value="customer@titanium.com">
                <button class="primary-btn" id="pay-trigger-airtel-paystack" style="margin-top:8px;background:#c8832a;color:#fff;border:none;">Launch Airtel Money 🔴</button>
                <div id="airtel-paystack-status" class="hidden" style="margin-top:8px;text-align:center;font-size:12px;">
                  <span class="badge warning" id="airtel-paystack-badge">Waiting for Paystack...</span>
                </div>
              </div>

              <!-- Paystack Bank Transfer inputs -->
              <div class="checkout-inputs hidden" id="payment-inputs-bank">
                <label style="font-size:11px;color:var(--text-secondary)">Customer Email Address (Required)</label>
                <input type="email" id="pay-bank-email" placeholder="customer@example.com" value="customer@titanium.com">
                <button class="primary-btn" id="pay-trigger-bank-paystack" style="margin-top:8px;background:#c8832a;color:#fff;border:none;">Launch Bank Transfer 🏛️</button>
                <div id="bank-paystack-status" class="hidden" style="margin-top:8px;text-align:center;font-size:12px;">
                  <span class="badge warning" id="bank-paystack-badge">Waiting for Paystack...</span>
                </div>
              </div>

              <div style="display:flex;gap:10px;margin-top:auto;">
                <button class="cancel-pay-btn" style="flex:1;" id="pay-cancel-btn">Back to Cart</button>
                <button class="confirm-pay-btn" style="flex:1.5;" id="pay-confirm-btn">Confirm & Print</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ESC/POS Thermal Receipt Paper Simulation Modal -->
      <div id="receipt-modal" class="modal">
        <div class="modal-content" style="max-width: 420px; background: #222; padding: 20px;">
          <h2 style="font-size:16px; margin-bottom: 12px; color: #fff;">Simulated Printed Receipt</h2>
          
          <div style="display:flex; gap: 8px; margin-bottom: 12px; width:100%;">
            <button class="primary-btn active" id="receipt-format-58" style="flex:1;">58mm Roll</button>
            <button class="sec-btn" id="receipt-format-80" style="flex:1;">80mm Roll</button>
          </div>

          <div id="receipt-paper-view" class="receipt-paper-58">
            <!-- Simulated thermal receipt content -->
          </div>

          <div style="display:flex; gap: 10px; width: 100%; margin-top: 16px;">
            <button class="primary-btn" style="flex:1;" id="receipt-close-btn">Done (New Sale)</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // Search filter typing
    const searchInput = document.getElementById('till-search');
    searchInput.addEventListener('input', () => {
      this.filterCatalogue();
    });

    // Category filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        this.filterCatalogue();
      });
    });

    // Simulate Barcode Scanner action
    document.getElementById('till-scan-sim').addEventListener('click', () => {
      this.simulateBarcodeScan();
    });

    // Customer attach dropdown selection
    const custSelect = document.getElementById('cart-customer-select');
    custSelect.addEventListener('change', async (e) => {
      const custId = e.target.value;
      this.selectedCustomer = await db.customers.get(custId);
      
      // Update UI prices based on customer price tier
      document.getElementById('price-tier-indicator').innerText = 
        this.selectedCustomer.price_tier === 'WHOLESALE' ? 'Wholesale Pricing' : 'Retail Pricing';
      
      document.getElementById('cart-buyer-pin').value = this.selectedCustomer.kra_pin || '';
      
      this.recomputeTotals();
    });

    // Pay now triggers checkout modal
    document.getElementById('till-pay-now-btn').addEventListener('click', () => {
      this.openCheckoutModal();
    });

    // Payment method switcher
    document.querySelectorAll('.payment-method-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const methodCard = e.target.closest('.payment-method-card');
        document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
        methodCard.classList.add('selected');
        
        const method = methodCard.getAttribute('data-method');
        this.selectPaymentMethod(method);
      });
    });

    // Cash tendered math
    document.getElementById('pay-cash-tendered').addEventListener('input', (e) => {
      this.updateCashChange(parseFloat(e.target.value) || 0);
    });

    // STK Push Trigger
    document.getElementById('pay-trigger-stk').addEventListener('click', () => {
      this.triggerMpesaStk();
    });

    // Split STK Trigger
    document.getElementById('pay-split-trigger-stk').addEventListener('click', () => {
      this.triggerSplitMpesaStk();
    });

    // Paystack triggers
    document.getElementById('pay-trigger-card-paystack').addEventListener('click', () => {
      this.triggerPaystack('card');
    });
    document.getElementById('pay-trigger-airtel-paystack').addEventListener('click', () => {
      this.triggerPaystack('mobile_money');
    });
    document.getElementById('pay-trigger-bank-paystack').addEventListener('click', () => {
      this.triggerPaystack('bank');
    });

    // Cancel / Close buttons
    document.getElementById('pay-cancel-btn').addEventListener('click', () => {
      document.getElementById('payment-modal').classList.remove('active');
    });

    document.getElementById('pay-confirm-btn').addEventListener('click', () => {
      this.finalizeInvoice();
    });

    document.getElementById('receipt-close-btn').addEventListener('click', () => {
      document.getElementById('receipt-modal').classList.remove('active');
      this.clearCart();
    });

    // Format switches
    document.getElementById('receipt-format-58').addEventListener('click', (e) => {
      document.getElementById('receipt-format-80').classList.remove('active');
      e.target.classList.add('active');
      document.getElementById('receipt-paper-view').className = 'receipt-paper-58';
    });
    
    document.getElementById('receipt-format-80').addEventListener('click', (e) => {
      document.getElementById('receipt-format-58').classList.remove('active');
      e.target.classList.add('active');
      document.getElementById('receipt-paper-view').className = 'receipt-paper-80';
    });

    // Park Cart & Resume Carts
    document.getElementById('till-park-btn').addEventListener('click', () => {
      this.parkCurrentCart();
    });

    document.getElementById('till-resume-btn').addEventListener('click', () => {
      this.resumeParkedCart();
    });
  }

  async loadProducts() {
    const products = await db.products.where('is_active').equals(1).toArray();
    const grid = document.getElementById('till-prod-grid');
    grid.innerHTML = '';
    
    for (const prod of products) {
      const stock = await getHouseStock(prod.id, state.currentBranch.id);
      
      const card = document.createElement('div');
      card.className = `product-card ${prod.is_batch_tracked ? 'batch-tracked' : ''}`;
      card.setAttribute('data-id', prod.id);
      card.setAttribute('data-cat', prod.category_id);
      card.setAttribute('data-name', prod.name.toLowerCase());
      card.setAttribute('data-sku', prod.sku.toLowerCase());

      // Fetch barcode
      const barRec = await db.barcodes.where('product_id').equals(prod.id).first();
      const barcodeVal = barRec ? barRec.barcode : '';
      card.setAttribute('data-barcode', barcodeVal);

      card.innerHTML = `
        <div style="height: 120px; flex-shrink: 0; border-radius: 8px; margin-bottom: 8px; background: url('${prod.image_data ? (prod.image_data.includes('?') ? prod.image_data : prod.image_data + '?v=2') : '/ai_images/juice_glass.jpg'}') center/cover no-repeat; border: 1px solid rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: center;">
          ${!prod.image_data ? '<span style="font-size:24px; opacity:0.3;">📷</span>' : ''}
        </div>
        <div>
          <h4>${prod.name}</h4>
          <p class="sku">${prod.sku}</p>
        </div>
        
        <div class="card-summary-tabs">
          <div class="c-tab active">Info</div>
          <div class="c-tab">Stock</div>
          <div class="c-tab">Stats</div>
        </div>
        <div class="card-tab-content">
          <div><strong style="color:#fff">Tax:</strong> ${prod.tax_code} | <strong style="color:#fff">UOM:</strong> ${prod.uom}</div>
          <div style="margin-top:4px"><strong style="color:#fff">Origin:</strong> ${prod.origin_country || 'N/A'}</div>
        </div>

        <div class="card-footer">
          <span class="price">KES ${prod.sell_price.toFixed(2)}</span>
          <span class="stock ${stock <= 10 && !prod.is_service ? 'low' : ''}">
            ${prod.is_service ? 'Service' : stock + ' left'}
          </span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.addToCart(prod);
      });
      grid.appendChild(card);
    }
  }

  async loadCustomerDropdown() {
    const list = await db.customers.toArray();
    const select = document.getElementById('cart-customer-select');
    select.innerHTML = '';
    
    list.forEach(cust => {
      const opt = document.createElement('option');
      opt.value = cust.id;
      opt.innerText = cust.name + (cust.phone ? ` (${cust.phone})` : '');
      if (cust.id === 'cust-walkin') opt.selected = true;
      select.appendChild(opt);
    });
  }

  filterCatalogue() {
    const query = document.getElementById('till-search').value.toLowerCase();
    const activeCat = document.querySelector('.filter-chip.active').getAttribute('data-cat');
    const cards = document.querySelectorAll('.product-card');

    cards.forEach(card => {
      const name = card.getAttribute('data-name');
      const sku = card.getAttribute('data-sku');
      const bar = card.getAttribute('data-barcode');
      const cat = card.getAttribute('data-cat');

      const matchesQuery = !query || name.includes(query) || sku.includes(query) || bar.includes(query);
      const matchesCat = activeCat === 'all' || cat === activeCat;

      if (matchesQuery && matchesCat) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  }

  async simulateBarcodeScan() {
    // Mock simple scanner inputting a barcode
    const barcodes = ['6161234567890', '6161234567891', '6161234567892', '6161234567893'];
    const randomBarcode = barcodes[Math.floor(Math.random() * barcodes.length)];
    
    showNotification(`Scanned Barcode: ${randomBarcode}`, 'success');

    const barcodeRecord = await db.barcodes.where('barcode').equals(randomBarcode).first();
    if (barcodeRecord) {
      const prod = await db.products.get(barcodeRecord.product_id);
      if (prod) {
        this.addToCart(prod);
      }
    } else {
      showNotification('Barcode not found in catalogue.', 'error');
    }
  }

  async addToCart(product) {
    // If batch tracked, resolve first expiry batch (FEFO Suggestion)
    let selectedBatch = null;
    if (product.is_batch_tracked) {
      // Find batches for product ordered by expiry date (First Expiry First Out)
      const batches = await db.batches
        .where('product_id')
        .equals(product.id)
        .toArray();
      
      // Sort FEFO
      batches.sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date));
      selectedBatch = batches.find(b => new Date(b.expiry_date) > new Date()); // Non expired
      
      if (!selectedBatch) {
        showNotification('Product is expired or no active batch in stock.', 'error');
        return;
      }
    }

    const existingIndex = this.cart.findIndex(item => 
      item.product.id === product.id && 
      (!selectedBatch || item.batch?.id === selectedBatch.id)
    );

    if (existingIndex > -1) {
      this.cart[existingIndex].qty += 1;
    } else {
      this.cart.push({
        product,
        qty: 1,
        discount_amount: 0,
        discount_percent: 0,
        batch: selectedBatch
      });
    }

    showNotification(`${product.name} added to cart`, 'success');
    this.updateCartUI();
  }

  updateCartUI() {
    const list = document.getElementById('cart-list');
    const payBtn = document.getElementById('till-pay-now-btn');
    
    if (this.cart.length === 0) {
      list.innerHTML = `
        <div class="cart-empty">
          <span class="cart-empty-icon">🛒</span>
          <span>Cart is empty</span>
        </div>
      `;
      payBtn.disabled = true;
      this.recomputeTotals();
      return;
    }

    list.innerHTML = '';
    payBtn.disabled = false;

    this.cart.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      
      const rate = this.selectedCustomer.price_tier === 'WHOLESALE' ? item.product.cost_price * 1.15 : item.product.sell_price;
      const total = rate * item.qty;

      div.innerHTML = `
        <div class="cart-item-header" style="display: flex; align-items: center; gap: 8px;">
          ${item.product.image_data ? `<img src="${item.product.image_data}" style="width: 24px; height: 24px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(200, 130, 42, 0.2);">` : `<div style="width: 24px; height: 24px; border-radius: 4px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 11px; color: var(--text-muted);">📷</div>`}
          <span class="cart-item-title" style="flex: 1;">${item.product.name}</span>
          <button class="cart-item-remove" data-idx="${index}">✕</button>
        </div>
        ${item.batch ? `
          <div class="cart-item-batch-info">
            <span>Batch: ${item.batch.batch_no}</span>
            <span>Exp: ${item.batch.expiry_date}</span>
          </div>
        ` : ''}
        <div class="cart-item-details">
          <div class="cart-item-qty-control">
            <button class="qty-btn dec" data-idx="${index}">-</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn inc" data-idx="${index}">+</button>
          </div>
          <span class="cart-item-price">KES ${total.toFixed(2)}</span>
        </div>
      `;

      // Remove item listener
      div.querySelector('.cart-item-remove').addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        this.cart.splice(idx, 1);
        this.updateCartUI();
      });

      // Quantity increment/decrement listener
      div.querySelector('.qty-btn.dec').addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        if (this.cart[idx].qty > 1) {
          this.cart[idx].qty--;
        } else {
          this.cart.splice(idx, 1);
        }
        this.updateCartUI();
      });

      div.querySelector('.qty-btn.inc').addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        this.cart[idx].qty++;
        this.updateCartUI();
      });

      list.appendChild(div);
    });

    this.recomputeTotals();
  }

  recomputeTotals() {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;

    this.cart.forEach(item => {
      const price = this.selectedCustomer.price_tier === 'WHOLESALE' ? item.product.cost_price * 1.15 : item.product.sell_price;
      const itemSub = price * item.qty;
      subtotal += itemSub;
      
      // Calculate tax components based on tax band settings
      let rate = 0.16; // Standard Standard (A)
      if (item.product.tax_code === 'B') rate = 0.08;
      else if (item.product.tax_code === 'C' || item.product.tax_code === 'E') rate = 0.00;

      const itemTax = (itemSub - (itemSub / (1 + rate)));
      tax += itemTax;
    });

    const total = subtotal - discount;

    document.getElementById('summary-subtotal').innerText = `KES ${subtotal.toFixed(2)}`;
    document.getElementById('summary-discount').innerText = `KES ${discount.toFixed(2)}`;
    document.getElementById('summary-tax').innerText = `KES ${tax.toFixed(2)}`;
    document.getElementById('summary-total').innerText = `KES ${total.toFixed(2)}`;

    // Store calculations on class reference
    this.totals = { subtotal, discount, tax, total };
  }

  openCheckoutModal() {
    const cashEnabled = localStorage.getItem('pos_cash_enabled') !== 'false';
    this.originalDue = this.totals.total;
    this.redeemedPoints = 0;

    document.getElementById('checkout-due-amount').innerText = `KES ${this.totals.total.toFixed(2)}`;
    document.getElementById('payment-modal').classList.add('active');

    // Populate Loyalty details
    const ptsSpan = document.getElementById('checkout-loyalty-pts');
    const redeemBtn = document.getElementById('btn-redeem-loyalty');
    const redeemStatus = document.getElementById('loyalty-redeem-status');
    redeemStatus.style.display = 'none';

    if (this.selectedCustomer && this.selectedCustomer.id !== 'cust-walkin') {
      const pts = this.selectedCustomer.loyalty_points || 0;
      ptsSpan.textContent = `${pts} pts`;
      redeemBtn.disabled = pts <= 0;
    } else {
      ptsSpan.textContent = '0 pts';
      redeemBtn.disabled = true;
    }

    // Set redeem handler once
    if (!this.loyaltyBound) {
      redeemBtn.addEventListener('click', () => {
        const pts = this.selectedCustomer.loyalty_points || 0;
        if (pts <= 0) return;
        
        // Max points to redeem is limited by due amount
        const redeemAmt = Math.min(pts, Math.floor(this.originalDue));
        this.redeemedPoints = redeemAmt;
        this.totals.total = this.originalDue - redeemAmt;

        document.getElementById('checkout-due-amount').innerText = `KES ${this.totals.total.toFixed(2)}`;
        redeemStatus.textContent = `★ Redeemed ${redeemAmt} points for KES ${redeemAmt}.00 discount!`;
        redeemStatus.style.display = 'block';
        redeemBtn.disabled = true;

        // Re-update select payment method input fields
        this.selectPaymentMethod(this.selectedPaymentMethod);
      });
      this.loyaltyBound = true;
    }

    // Hide/show cash payment option based on owner setting
    const cashCard = document.querySelector('[data-method="CASH"]');
    if (cashCard) cashCard.style.display = cashEnabled ? '' : 'none';

    // Default to cash if enabled, otherwise M-Pesa
    this.selectPaymentMethod(cashEnabled ? 'CASH' : 'MPESA');
  }

  selectPaymentMethod(method) {
    this.selectedPaymentMethod = method;
    
    // Hide all input areas
    document.getElementById('payment-inputs-cash').classList.add('hidden');
    document.getElementById('payment-inputs-mpesa').classList.add('hidden');
    document.getElementById('payment-inputs-credit').classList.add('hidden');
    document.getElementById('payment-inputs-split').classList.add('hidden');
    document.getElementById('payment-inputs-card').classList.add('hidden');
    document.getElementById('payment-inputs-airtel').classList.add('hidden');
    document.getElementById('payment-inputs-bank').classList.add('hidden');

    // Show selected
    if (method === 'CASH') {
      document.getElementById('payment-inputs-cash').classList.remove('hidden');
      document.getElementById('pay-cash-tendered').value = Math.ceil(this.totals.total);
      this.updateCashChange(Math.ceil(this.totals.total));
    } else if (method === 'MPESA') {
      document.getElementById('payment-inputs-mpesa').classList.remove('hidden');
      document.getElementById('pay-mpesa-phone').value = this.selectedCustomer.phone || '';
      document.getElementById('stk-status-area').classList.add('hidden');
    } else if (method === 'CREDIT') {
      document.getElementById('payment-inputs-credit').classList.remove('hidden');
      
      if (!this.selectedCustomer || this.selectedCustomer.id === 'cust-walkin') {
        document.getElementById('pay-credit-limit').innerText = 'N/A';
        document.getElementById('pay-credit-balance').innerText = 'N/A';
        const warn = document.getElementById('credit-warn-text');
        warn.innerText = 'Walk-In Customer cannot checkout on credit. Please select a registered profile.';
        document.getElementById('pay-confirm-btn').disabled = true;
      } else {
        const limit = this.selectedCustomer.credit_limit || 0;
        const outstanding = this.selectedCustomer.credit_balance || 0;

        document.getElementById('pay-credit-limit').innerText = `KES ${limit.toFixed(2)}`;
        document.getElementById('pay-credit-balance').innerText = `KES ${outstanding.toFixed(2)}`;
        
        const warn = document.getElementById('credit-warn-text');
        if (this.totals.total > (limit - outstanding)) {
          warn.innerText = 'CREDIT LIMIT BREACHED. Cannot complete sale on credit.';
          document.getElementById('pay-confirm-btn').disabled = true;
        } else {
          warn.innerText = '';
          document.getElementById('pay-confirm-btn').disabled = false;
        }
      }
    } else if (method === 'SPLIT') {
      document.getElementById('payment-inputs-split').classList.remove('hidden');
      document.getElementById('pay-split-cash').value = (this.totals.total / 2).toFixed(2);
      document.getElementById('pay-split-mpesa').value = (this.totals.total / 2).toFixed(2);
      document.getElementById('pay-split-phone').value = this.selectedCustomer.phone || '';
    } else if (method === 'CARD_PAYSTACK') {
      document.getElementById('payment-inputs-card').classList.remove('hidden');
      document.getElementById('pay-card-email').value = this.selectedCustomer.email || 'customer@titanium.com';
    } else if (method === 'AIRTEL_PAYSTACK') {
      document.getElementById('payment-inputs-airtel').classList.remove('hidden');
      document.getElementById('pay-airtel-email').value = this.selectedCustomer.email || 'customer@titanium.com';
    } else if (method === 'BANK_PAYSTACK') {
      document.getElementById('payment-inputs-bank').classList.remove('hidden');
      document.getElementById('pay-bank-email').value = this.selectedCustomer.email || 'customer@titanium.com';
    }
  }

  updateCashChange(tendered) {
    const change = Math.max(0, tendered - this.totals.total);
    document.getElementById('pay-cash-change').innerText = `KES ${change.toFixed(2)}`;
  }

  async triggerMpesaStk() {
    const phone = document.getElementById('pay-mpesa-phone').value;
    const stkStatus = document.getElementById('stk-status-area');
    const stkBadge = document.getElementById('stk-status-badge');

    stkStatus.classList.remove('hidden');
    stkBadge.className = 'badge warning';

    if (state.syncManager.connectionStatus === 'OFFLINE') {
      stkBadge.innerText = 'Offline: Payment Queued';
      this.mpesaRef = 'OFF-MP-' + crypto.randomUUID().slice(0, 6).toUpperCase();
      showNotification('Offline Mode: M-Pesa assumed successful and queued for sync.', 'warning');
      return;
    }

    stkBadge.innerText = 'Initiating STK Push...';

    const res = await this.mpesa.initiateStkPush(phone, this.totals.total, 'KPOS_SALE');
    if (res.success) {
      stkBadge.innerText = 'Awaiting User PIN on Phone...';
      
      // Simulate Safaricom response callback processing
      const callbackRes = await this.mpesa.simulateCallback(res.CheckoutRequestID, true);
      
      if (callbackRes.success) {
        stkBadge.className = 'badge success';
        stkBadge.innerText = `Confirmed. Code: ${callbackRes.mpesaReceipt}`;
        this.mpesaRef = callbackRes.mpesaReceipt;
        showNotification(`M-Pesa payment received. Receipt Ref: ${callbackRes.mpesaReceipt}`, 'success');
      } else {
        stkBadge.className = 'badge danger';
        stkBadge.innerText = 'Callback Cancelled.';
        showNotification('M-Pesa STK Push rejected or expired.', 'error');
      }
    } else {
      stkStatus.classList.add('hidden');
      showNotification(res.message, 'error');
    }
  }

  async triggerSplitMpesaStk() {
    const phone = document.getElementById('pay-split-phone').value;
    const mpesaPortion = parseFloat(document.getElementById('pay-split-mpesa').value) || 0;
    
    if (state.syncManager.connectionStatus === 'OFFLINE') {
      this.mpesaRef = 'OFF-MP-' + crypto.randomUUID().slice(0, 6).toUpperCase();
      showNotification('Offline Mode: Split M-Pesa portion queued for sync.', 'warning');
      return;
    }

    showNotification('Initiating split M-Pesa STK push...', 'warning');
    const res = await this.mpesa.initiateStkPush(phone, mpesaPortion, 'KPOS_SPLIT_SALE');
    if (res.success) {
      const callback = await this.mpesa.simulateCallback(res.CheckoutRequestID, true);
      if (callback.success) {
        this.mpesaRef = callback.mpesaReceipt;
        showNotification(`Split portion of KES ${mpesaPortion} paid. Ref: ${callback.mpesaReceipt}`, 'success');
      }
    }
  }

  async triggerPaystack(channel) {
    const emailInputId = channel === 'card' ? 'pay-card-email' : channel === 'mobile_money' ? 'pay-airtel-email' : 'pay-bank-email';
    const statusWrapId = channel === 'card' ? 'card-paystack-status' : channel === 'mobile_money' ? 'airtel-paystack-status' : 'bank-paystack-status';
    const badgeId = channel === 'card' ? 'card-paystack-badge' : channel === 'mobile_money' ? 'airtel-paystack-badge' : 'bank-paystack-badge';

    const email = document.getElementById(emailInputId).value || 'customer@titanium.com';
    const statusWrap = document.getElementById(statusWrapId);
    const badge = document.getElementById(badgeId);

    statusWrap.classList.remove('hidden');
    badge.className = 'badge warning';
    badge.innerText = 'Initializing...';

    if (!window.PaystackPop) {
      showNotification('Paystack script is still loading. Please try again.', 'error');
      badge.innerText = 'Script not ready';
      return;
    }

    const paystackKey = localStorage.getItem('paystack_public_key') || 'pk_test_a42095cc1a55f9a7444b02000000000000000000';
    const ref = 'PST-' + crypto.randomUUID().slice(0, 8).toUpperCase();
    const amount = Math.round(this.totals.total * 100);

    try {
      const handler = PaystackPop.setup({
        key: paystackKey,
        email: email,
        amount: amount,
        currency: 'KES',
        ref: ref,
        channels: channel === 'card' ? ['card'] : channel === 'mobile_money' ? ['mobile_money'] : ['bank_transfer'],
        callback: (response) => {
          badge.className = 'badge success';
          badge.innerText = 'Paid. Ref: ' + response.reference;
          this.paystackRef = response.reference;
          showNotification('Paystack payment success: ' + response.reference, 'success');
          
          setTimeout(() => {
            this.finalizeInvoice();
          }, 1500);
        },
        onClose: () => {
          badge.className = 'badge danger';
          badge.innerText = 'Payment Cancelled';
          showNotification('Paystack checkout closed.', 'warning');
        }
      });
      handler.openIframe();
    } catch (e) {
      badge.className = 'badge danger';
      badge.innerText = 'Failed: ' + e.message;
      showNotification('Paystack setup failed: ' + e.message, 'error');
    }
  }

  async finalizeInvoice() {
    const saleId = crypto.randomUUID();
    const invoiceNo = `INV-BH001-${new Date().getTime().toString().slice(-6)}`;
    const saleUuid = crypto.randomUUID();
    const buyerPin = document.getElementById('cart-buyer-pin').value || '';
    const tableNo = document.getElementById('checkout-table-number').value || '';

    // Verify waiter/waitress shift is open
    const openShift = await db.shifts.where('status').equals('OPEN').first();
    if (!openShift) {
      showNotification('No open waiter/waitress shift found. Open shift before completing sales.', 'error');
      return;
    }

    const hasKdsItems = this.cart.some(item => !item.product.is_service);
    const saleRecord = {
      id: saleId,
      tenant_id: state.currentTenant.id,
      branch_id: state.currentBranch.id,
      device_id: 'device-till-01',
      shift_id: openShift.id,
      invoice_no: invoiceNo,
      sale_uuid: saleUuid,
      customer_id: this.selectedCustomer.id || null,
      table_no: tableNo,
      buyer_pin: buyerPin,
      subtotal: this.totals.subtotal,
      discount: this.totals.discount,
      tax_total: this.totals.tax,
      grand_total: this.totals.total,
      status: 'COMPLETED',
      kds_status: hasKdsItems ? 'PENDING' : 'SERVED',
      sold_at: new Date().toISOString(),
      synced_at: null,
      fiscal_status: 'QUEUED',
      etims_solution: 'OSCU'
    };

    const paymentRecord = {
      id: crypto.randomUUID(),
      sale_id: saleId,
      method: this.selectedPaymentMethod,
      amount: this.totals.total,
      reference: this.selectedPaymentMethod.includes('PAYSTACK') ? (this.paystackRef || '') : (this.mpesaRef || ''),
      provider_txn_id: this.selectedPaymentMethod.includes('PAYSTACK') ? (this.paystackRef || '') : (this.mpesaRef || ''),
      verified: this.selectedPaymentMethod.includes('PAYSTACK') ? 1 : (['MPESA', 'CREDIT'].includes(this.selectedPaymentMethod) ? 1 : 0),
      received_at: new Date().toISOString()
    };

    // Perform database operations within atomic transactions
    await db.transaction('rw', [db.sales, db.sale_lines, db.payments, db.stock_movements, db.audit_log, db.customers], async () => {
      // 1. Write Sale
      await db.sales.add(saleRecord);

      // 2. Write Sale Lines & Stock Movements
      for (const item of this.cart) {
        const rate = this.selectedCustomer.price_tier === 'WHOLESALE' ? item.product.cost_price * 1.15 : item.product.sell_price;
        const total = rate * item.qty;

        let taxRate = 0.16;
        if (item.product.tax_code === 'B') taxRate = 0.08;
        else if (item.product.tax_code === 'C' || item.product.tax_code === 'E') taxRate = 0.00;

        await db.sale_lines.add({
          id: crypto.randomUUID(),
          sale_id: saleId,
          product_id: item.product.id,
          qty: item.qty,
          unit_price: rate,
          discount: 0,
          tax_code: item.product.tax_code,
          tax_rate: taxRate,
          tax_amount: (total - (total / (1 + taxRate))),
          line_total: total,
          unit_cost_at_sale: item.product.cost_price
        });

        // Write Stock movement depletion record (Negative stock blocked checks enforced if needed)
        await db.stock_movements.add({
          id: crypto.randomUUID(),
          tenant_id: state.currentTenant.id,
          branch_id: state.currentBranch.id,
          product_id: item.product.id,
          batch_id: item.batch ? item.batch.id : null,
          type: 'SALE',
          location: 'HOUSE',
          qty: -item.qty,
          unit_cost: item.product.cost_price,
          ref_type: 'SALE',
          ref_id: saleId,
          reason: 'Customer Checkout POS',
          created_by: state.currentUser.id,
          created_at: new Date().toISOString()
        });
      }

      // 3. Write payment records
      await db.payments.add(paymentRecord);

      // 4. Update Customer Loyalty & Credit Balance
      if (this.selectedCustomer && this.selectedCustomer.id !== 'cust-walkin') {
        const customer = await db.customers.get(this.selectedCustomer.id);
        if (customer) {
          const updates = {};
          
          if (this.selectedPaymentMethod === 'CREDIT') {
            updates.credit_balance = (customer.credit_balance || 0) + this.totals.total;
          }

          const pointsEarned = Math.floor(this.totals.total / 100);
          updates.loyalty_points = Math.max(0, (customer.loyalty_points || 0) + pointsEarned - (this.redeemedPoints || 0));

          await db.customers.update(customer.id, updates);

          // Sync local customer reference
          this.selectedCustomer.credit_balance = updates.credit_balance !== undefined ? updates.credit_balance : customer.credit_balance;
          this.selectedCustomer.loyalty_points = updates.loyalty_points;
        }
      }

      // 5. Log audit session
      await logAuditEvent(state.currentTenant.id, state.currentUser.id, 'SALE_CHECKOUT', 'SALE', saleId);
    });

    // Check low stock
    for (const item of this.cart) {
      if (!item.product.is_service) {
        const remainingStock = await getHouseStock(item.product.id, state.currentBranch.id);
        if (remainingStock <= 20) {
          showNotification(`Low Stock Alert: ${item.product.name} is down to ${remainingStock} in House! Please request more.`, 'warning');
        }
      }
    }

    // Triggers background sync outbox process immediately if online
    state.syncManager.syncOutbox();

    document.getElementById('payment-modal').classList.remove('active');
    this.openPrintedReceipt(saleRecord, paymentRecord);
  }

  async openPrintedReceipt(sale, payment) {
    const selectCustomerName = this.selectedCustomer.name;
    const lines = await db.sale_lines.where('sale_id').equals(sale.id).toArray();
    
    // Load products names mapping
    const productsList = await db.products.toArray();
    const prodMap = new Map(productsList.map(p => [p.id, p]));

    // Construct receipt mock view
    const paperView = document.getElementById('receipt-paper-view');
    
    // Simulate eTIMS records return, if background sync processed quickly.
    const fiscal = await db.fiscal_records.where('sale_id').equals(sale.id).first();
    const hasFiscal = !!fiscal;

    paperView.innerHTML = `
      <div class="receipt-header">
        <h2>${state.currentTenant.trading_name}</h2>
        <p>${state.currentBranch.name}</p>
        <p>PIN: ${state.currentTenant.kra_pin}</p>
        <p>Branch ID: ${state.currentBranch.etims_bhf_id}</p>
        <p>Tel: +254 712 345678</p>
      </div>
      <div class="receipt-divider"></div>
      <div style="font-size:10px; margin-bottom: 8px;">
        <div><b>Invoice:</b> ${sale.invoice_no}</div>
        <div><b>Date:</b> ${new Date(sale.sold_at).toLocaleString()}</div>
        <div><b>Waiter/Waitress:</b> ${state.currentUser.name}</div>
        <div><b>Customer:</b> ${selectCustomerName}</div>
        ${sale.buyer_pin ? `<div><b>Buyer PIN:</b> ${sale.buyer_pin}</div>` : ''}
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-items">
        ${lines.map(line => {
          const prod = prodMap.get(line.product_id);
          return `
            <div class="receipt-item-details">
              <div class="receipt-item-row">
                <span>${prod ? prod.name : 'Unknown Item'}</span>
                <span>${line.line_total.toFixed(2)}</span>
              </div>
              <div style="font-size:9px; color:#555;">
                ${line.qty} x ${line.unit_price.toFixed(2)} (Tax: ${line.tax_code})
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-totals-row">
        <span>Subtotal</span>
        <span>${sale.subtotal.toFixed(2)}</span>
      </div>
      <div class="receipt-totals-row">
        <span>VAT Tax</span>
        <span>${sale.tax_total.toFixed(2)}</span>
      </div>
      <div class="receipt-totals-row" style="font-size:13px;">
        <span>TOTAL DUE</span>
        <span>KES ${sale.grand_total.toFixed(2)}</span>
      </div>
      <div class="receipt-divider"></div>
      <div style="font-size:10px; margin-bottom: 8px;">
        <div><b>Settlement:</b> ${payment.method === 'CARD_PAYSTACK' ? 'Visa/Mastercard (Paystack)' : payment.method === 'AIRTEL_PAYSTACK' ? 'Airtel Money (Paystack)' : payment.method === 'BANK_PAYSTACK' ? 'Bank Transfer (Paystack)' : payment.method}</div>
        ${payment.reference ? `<div><b>Ref:</b> ${payment.reference}</div>` : ''}
      </div>
      <div class="receipt-divider"></div>
      
      <!-- eTIMS block -->
      <div class="receipt-header" style="font-size:9px; text-align: center;">
        <p style="font-weight: bold; margin-bottom: 4px;">*** KRA eTIMS FISCAL RECORD ***</p>
        <p>CU Serial: KPOS-OSCU-998822</p>
        <p style="word-break: break-all; margin: 2px 0;">Signature: ${sale.id.slice(0, 8).toUpperCase()}KRA8899FF77EE66</p>
        <p>CU Invoice No: KRA-OSCU-${sale.id.slice(0, 8).toUpperCase()}</p>
        <div style="margin: 10px auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('https://itax.kra.go.ke/KRAFY2026/verify?invoice=KRA-OSCU-' + sale.id.slice(0, 8).toUpperCase())}" alt="KRA Verification QR Code" style="width: 80px; height: 80px; border: 1px solid #ccc; padding: 2px; background: #fff;" />
          <span style="font-size: 8px; color: #71717a;">Scan to verify at KRA Portal</span>
        </div>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-header" style="font-size:9px; margin-top:8px;">
        <p>Thank you for shopping with us!</p>
        <p>Powered by KPOS Pro Systems</p>
      </div>
    `;

    document.getElementById('receipt-modal').classList.add('active');
  }

  clearCart() {
    this.cart = [];
    this.selectedPaymentMethod = 'CASH';
    this.mpesaRef = null;
    this.updateCartUI();
  }

  parkCurrentCart() {
    if (this.cart.length === 0) {
      showNotification('Cart is empty. Cannot park.', 'error');
      return;
    }
    
    this.parkedCarts.push({
      id: crypto.randomUUID(),
      cart: [...this.cart],
      customer: this.selectedCustomer,
      timestamp: new Date().getTime()
    });

    this.cart = [];
    showNotification('Current cart suspended/parked successfully.', 'success');
    
    document.getElementById('parked-count').innerText = this.parkedCarts.length;
    this.updateCartUI();
  }

  resumeParkedCart() {
    if (this.parkedCarts.length === 0) {
      showNotification('No parked carts found.', 'error');
      return;
    }

    const resumed = this.parkedCarts.pop();
    this.cart = resumed.cart;
    this.selectedCustomer = resumed.customer;

    showNotification('Restored parked cart.', 'success');
    document.getElementById('parked-count').innerText = this.parkedCarts.length;
    this.updateCartUI();
  }
}
