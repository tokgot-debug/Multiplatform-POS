window.addEventListener('error', function(e) {
  const errDiv = document.createElement('div');
  errDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);color:#ff4444;padding:20px;z-index:999999;overflow:auto;font-family:monospace;';
  errDiv.innerHTML = '<h2>Unhandled Error!</h2><p>' + e.message + '</p><pre>' + (e.error ? e.error.stack : '') + '</pre>';
  document.body.appendChild(errDiv);
});
window.addEventListener('unhandledrejection', function(e) {
  const errDiv = document.createElement('div');
  errDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);color:#ffaa00;padding:20px;z-index:999999;overflow:auto;font-family:monospace;';
  errDiv.innerHTML = '<h2>Unhandled Promise Rejection!</h2><p>' + e.reason + '</p><pre>' + (e.reason && e.reason.stack ? e.reason.stack : '') + '</pre>';
  document.body.appendChild(errDiv);
});

import { db } from './db/schema';
import { seedDatabase, logAuditEvent } from './db/index';
import { SyncManager } from './services/sync';
import { TillView } from './ui/till';
import { InventoryView } from './ui/inventory';
import { MpesaView } from './ui/mpesa';
import { StoreStockView } from './ui/store-stock';
import { ShiftsView } from './ui/shifts';
import { OrdersView } from './ui/orders';
import { HouseStockView } from './ui/house-stock';
import { UsersView } from './ui/users';
import { SettingsView } from './ui/settings';
import { FinanceView } from './ui/finance';
import { QrToolsView } from './ui/qr_export';
import { AuditLogsView } from './ui/audit-logs';
import { SubscriptionsView } from './ui/subscriptions';
import { state, showNotification } from './context';

// Global polyfill for crypto.randomUUID in non-secure contexts (e.g. previewing over HTTP local network)
if (typeof window !== 'undefined') {
  if (!window.crypto) window.crypto = {};
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
  }
}

async function initApp() {

  console.log('Bootstrapping KPOS App...');
  
  try {
    // 1. Open and Seed Database
    await db.open();
    await seedDatabase();
  } catch (dbError) {
    console.error('Database opening failed:', dbError);
    const errorBanner = document.createElement('div');
    errorBanner.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#f43f5e;color:#fff;padding:12px;text-align:center;z-index:99999;font-size:12px;font-weight:bold;';
    errorBanner.innerText = `Database Initialization Error: ${dbError.message || dbError}. Try refreshing or clearing site data.`;
    document.body.appendChild(errorBanner);
    return;
  }

  
  // 2. Load basic config context
  const tenants = await db.tenants.toArray();
  state.currentTenant = tenants[0] || null;
  if (state.currentTenant && state.currentTenant.trading_name === 'Titanium') {
    state.currentTenant.trading_name = 'Vanbransa';
    await db.tenants.put(state.currentTenant);
  }
  const branches = await db.branches.toArray();
  state.currentBranch = branches[0] || null; // Nairobi CBD default

  // Auto-fill and migrate product images on boot
  try {
    const prods = await db.products.toArray();
    const imageMap = {
      'prod-tusker-bottle': '/ai_images/beer_glass.jpg',
      'prod-guinness': '/ai_images/stout_glass.jpg',
      'prod-whitecap': '/ai_images/beer_glass.jpg',
      'prod-savanna': '/ai_images/cider_glass.jpg',
      'prod-smirnoff-tot': '/ai_images/vodka_glass.jpg',
      'prod-jameson-tot': '/ai_images/whiskey_glass.jpg',
      'prod-konyagi': '/ai_images/gin_glass.jpg',
      'prod-wine-glass': '/ai_images/red_wine_glass.jpg',
      'prod-coca-cola': '/ai_images/coke_bottle.png',
      'prod-fanta': '/ai_images/fanta_glass.jpg',
      'prod-water': '/ai_images/mineral_water.jpg',
      'prod-juice': '/ai_images/fresh_juice.jpg',
      'prod-nyama-choma': '/ai_images/nyama_choma.jpg',
      'prod-chicken-chips': '/ai_images/grilled_chicken.jpg',
      'prod-pilau': '/ai_images/pilau_rice.jpg',
      'prod-ugali-stew': '/ai_images/ugali_nyama.jpg',
      'prod-samosa': '/ai_images/beef_samosas.jpg'
    };
    for (const p of prods) {
      if (imageMap[p.id] && p.image_data !== imageMap[p.id]) {
        p.image_data = imageMap[p.id];
        await db.products.put(p);
      }
    }
  } catch(e) {}
  
  // 3. Initialize Sync Manager
  state.syncManager = new SyncManager();
  state.syncManager.onStatusChange = handleSyncStatusUpdate;
  state.syncManager.startSyncScheduler();
  
  // 4. Initialize Sub-views
  state.views.till = new TillView(document.getElementById('view-till'));
  state.views.inventory = new InventoryView(document.getElementById('view-inventory'));
  state.views.mpesa = new MpesaView(document.getElementById('view-mpesa'));
  state.views['store-stock'] = new StoreStockView(document.getElementById('view-store-stock'));
  state.views.shifts = new ShiftsView(document.getElementById('view-shifts'));
  state.views.orders = new OrdersView(document.getElementById('view-orders'));
  state.views['house-stock'] = new HouseStockView(document.getElementById('view-house-stock'));
  state.views.users = new UsersView(document.getElementById('view-users'));
  state.views['audit-logs'] = new AuditLogsView(document.getElementById('view-view-audit-logs') || document.getElementById('view-audit-logs'));
  state.views.subscriptions = new SubscriptionsView(document.getElementById('view-subscriptions'));
  state.views.settings = new SettingsView(document.getElementById('view-settings'));
  state.views.finance = new FinanceView(document.getElementById('view-finance'));
  state.views.qrtools = new QrToolsView(document.getElementById('view-qrtools'));

  
  // Bind sidebar nav switching
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      switchTab(tab);
    });
  });
  
  // Bind online/offline simulator toggler (double click indicator to toggle for testing)
  const connIndicator = document.getElementById('connectivity-indicator');
  connIndicator.addEventListener('click', () => {
    if (state.syncManager.connectionStatus === 'ONLINE') {
      state.syncManager.setConnectionStatus('OFFLINE');
      connIndicator.classList.remove('online');
      connIndicator.classList.add('offline');
      connIndicator.querySelector('.badge-text').innerText = 'Offline';
      showNotification('Simulating Offline Mode. Outbox queue will hold transactions.', 'warning');
    } else {
      state.syncManager.setConnectionStatus('ONLINE');
      connIndicator.classList.remove('offline');
      connIndicator.classList.add('online');
      connIndicator.querySelector('.badge-text').innerText = 'Online';
      showNotification('Back online. Draining outbox queue...', 'success');
      state.syncManager.syncOutbox();
    }
  });

  // Bind PIN Lock switcher
  document.getElementById('lock-app').addEventListener('click', () => {
    lockApp();
  });

  // Load User select grid for PIN screen
  await populatePinUsers();
  
  // Start app locked (requesting PIN)
  lockApp();
}




function handleSyncStatusUpdate(status, queueCount) {
  const queueIndicator = document.getElementById('fiscal-queue-indicator');
  const queueText = document.getElementById('fiscal-queue-count');
  
  if (queueCount > 0) {
    queueIndicator.classList.remove('hidden');
    queueText.innerText = `${queueCount} Queued`;
  } else {
    queueIndicator.classList.add('hidden');
  }
}

async function populatePinUsers() {
  const users = await db.users.where('status').equals('ACTIVE').toArray();
  const select = document.getElementById('pin-user-select');
  
  if (users.length === 0) {
    select.innerHTML = '<option value="" disabled selected>No active users found. Click Hard Reset.</option>';
    const modalContent = document.querySelector('.pin-switcher-content');
    if (!document.getElementById('hard-reset-btn')) {
      const btn = document.createElement('button');
      btn.id = 'hard-reset-btn';
      btn.style = 'margin-top:16px; padding:10px; background:#f43f5e; color:white; border:none; border-radius:5px; cursor:pointer; width:100%;';
      btn.innerText = 'Hard Reset Database';
      btn.onclick = async () => {
        await db.delete();
        window.location.reload();
      };
      modalContent.appendChild(btn);
    }
    return;
  }
  
  select.innerHTML = '<option value="" disabled selected>Select your user account...</option>';
  
  users.forEach((usr) => {
    const option = document.createElement('option');
    option.value = usr.id;
    option.textContent = `${usr.name} (${usr.role})`;
    select.appendChild(option);
  });
  
  select.addEventListener('change', () => {
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-error').innerText = '';
  });
}

function lockApp() {
  state.currentUser = null;
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-error').innerText = '';
  document.getElementById('pin-modal').classList.add('active');
  document.getElementById('pos-shell').classList.add('hidden');
}

// Process PIN Numpad entries
let selectedUserPinVal = '';
document.querySelectorAll('.numpad-btn[data-val]').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById('pin-input');
    if (input.value.length < 4) {
      input.value += btn.getAttribute('data-val');
    }
  });
});

document.getElementById('numpad-clear').addEventListener('click', () => {
  document.getElementById('pin-input').value = '';
  document.getElementById('pin-error').innerText = '';
});

document.getElementById('numpad-ok').addEventListener('click', async () => {
  const pin = document.getElementById('pin-input').value;
  const userId = document.getElementById('pin-user-select').value;
  if (!userId) {
    document.getElementById('pin-error').innerText = 'Please select a user.';
    return;
  }
  const user = await db.users.get(userId);
  
  if (user && user.pin === pin) {
    // PIN correct. Unlock POS Shell
    state.currentUser = user;
    
    // Resolve tenant and branch context
    const tenant = await db.tenants.get(user.tenant_id);
    if (tenant) state.currentTenant = tenant;
    const branch = await db.branches.where('tenant_id').equals(user.tenant_id).first();
    if (branch) state.currentBranch = branch;

    document.getElementById('pin-modal').classList.remove('active');
    document.getElementById('pos-shell').classList.remove('hidden');
    
    // Update sidebar user profile
    const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const sidebarAvatar = document.getElementById('sidebar-avatar');
    const sidebarName = document.getElementById('sidebar-username');
    const sidebarRole = document.getElementById('sidebar-userrole');
    if (sidebarAvatar) sidebarAvatar.textContent = initials;
    if (sidebarName) sidebarName.textContent = user.name;
    if (sidebarRole) sidebarRole.textContent = user.role;

    // Hide/Show sidebar buttons based on role
    const role = user.role;
    const restrictedTabs = {
      'users': ['Owner', 'Store Manager'],
      'settings': ['Owner', 'Store Manager'],
      'inventory': ['Owner', 'Store Manager', 'Supervisor', 'Store Keeper'],
      'store-stock': ['Owner', 'Store Manager', 'Supervisor', 'Store Keeper'],
      'house-stock': ['Owner', 'Store Manager', 'Supervisor', 'Bar Staff'],
      'orders': ['Owner', 'Store Manager', 'Supervisor', 'Bar Staff'],
      'finance': ['Owner', 'Store Manager'],
      'qrtools': ['Owner', 'Store Manager', 'Supervisor'],
      'audit-logs': ['Owner', 'Store Manager'],
      'subscriptions': ['Owner', 'Store Manager']
    };
    
    document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      if (restrictedTabs[tab] && !restrictedTabs[tab].includes(role)) {
        btn.classList.add('hidden'); // Hide the button
      } else {
        btn.classList.remove('hidden'); // Show the button
      }
    });

    // Log user access session
    await logAuditEvent(state.currentTenant.id, user.id, 'LOGIN', 'USER', user.id);

    // Load default tab
    switchTab('till');

    // Run background stock alert check after login
    setTimeout(async () => {
      try {
        const threshold = parseInt(localStorage.getItem('pos_alert_threshold') || '10');
        const prods = await db.products.where('is_active').equals(1).toArray();
        const branchId = state.currentBranch ? state.currentBranch.id : 1;
        let critCount = 0, lowCount = 0;
        for (const p of prods) {
          if (p.is_service) continue;
          const { getStockOnHand } = await import('./db/index.js');
          const stock = await getStockOnHand(p.id, branchId);
          if (stock <= 0) critCount++;
          else if (stock <= threshold) lowCount++;
        }
        if (critCount > 0) showNotification('URGENT: ' + critCount + ' item(s) OUT OF STOCK! Check QR & Tools > Stock Alerts.', 'error');
        else if (lowCount > 0) showNotification(lowCount + ' items low on stock. Check QR & Tools > Stock Alerts.', 'warning');
      } catch(e) {}
    }, 3000);
  } else {
    document.getElementById('pin-input').value = '';
    document.getElementById('pin-error').innerText = 'Incorrect PIN. Try again.';
  }
});

async function switchTab(tabName) {
  // Check tab accessibility or user permissions if needed
  if (!state.currentUser) return;

  const role = state.currentUser.role;
  
  // Define which roles are allowed for restricted tabs
  const restrictedTabs = {
    'users': ['Owner', 'Store Manager'],
    'settings': ['Owner', 'Store Manager'],
    'inventory': ['Owner', 'Store Manager', 'Supervisor', 'Store Keeper'],
    'store-stock': ['Owner', 'Store Manager', 'Supervisor', 'Store Keeper'],
    'house-stock': ['Owner', 'Store Manager', 'Supervisor', 'Bar Staff'],
    'orders': ['Owner', 'Store Manager', 'Supervisor', 'Bar Staff'],
    'finance': ['Owner', 'Store Manager'],
    'qrtools': ['Owner', 'Store Manager', 'Supervisor'],
    'audit-logs': ['Owner', 'Store Manager'],
    'subscriptions': ['Owner', 'Store Manager']
  };
  
  // If the tab is restricted and the user's role is not in the allowed list, block access
  if (restrictedTabs[tabName] && !restrictedTabs[tabName].includes(role)) {
    showNotification('Access Denied: Your access level does not permit viewing this module.', 'error');
    return;
  }

  // Set sidebar nav active styling
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    }
  });
  // Also keep legacy tab-btn in sync (hidden but used by other code)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-tab') === tabName) btn.classList.add('active');
  });
  
  // Hide all view containers, show target
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.add('hidden');
    view.classList.remove('active');
  });
  
  const targetView = document.getElementById(`view-${tabName}`);
  targetView.classList.remove('hidden');
  targetView.classList.add('active');
  
  // Render and load the specific view
  if (state.views[tabName]) {
    await state.views[tabName].load();
  }
}

// Bootstrap on window load
window.addEventListener('DOMContentLoaded', initApp);
console.log('Force Vite reload for pin user dropdown fix');
