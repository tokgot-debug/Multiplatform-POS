/**
 * Till bootstrap, lifted out of main.js unchanged in behaviour.
 *
 * Deliberately framework-agnostic: it opens and seeds IndexedDB, hydrates the
 * shared context and starts the sync scheduler. React owns the DOM; this owns
 * the data. Keeping it plain JS means the screens' own code paths are the same
 * ones the client signed off on.
 */

import { db } from './db/schema';
import { seedDatabase, getStockOnHand } from './db/index';
import { SyncManager } from './services/sync';
import { state, showNotification } from './context';

// Product imagery is repaired on every boot because earlier builds seeded
// records without it.
const PRODUCT_IMAGES = {
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

/** randomUUID is absent over plain HTTP on a LAN preview. */
export function ensureCryptoUuid() {
  if (typeof window === 'undefined') return;
  if (!window.crypto) window.crypto = {};
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };
  }
}

let bootPromise = null;

/** Boots once per page load, even if several components ask for it. */
export function bootPos(onSyncStatus) {
  if (!bootPromise) bootPromise = runBoot(onSyncStatus);
  return bootPromise;
}

async function runBoot(onSyncStatus) {
  ensureCryptoUuid();

  await db.open();
  await seedDatabase();

  const tenants = await db.tenants.toArray();
  state.currentTenant = tenants[0] || null;
  if (state.currentTenant && state.currentTenant.trading_name === 'Titanium') {
    state.currentTenant.trading_name = 'Vanbransa';
    await db.tenants.put(state.currentTenant);
  }

  const branches = await db.branches.toArray();
  state.currentBranch = branches[0] || null; // Nairobi CBD default

  try {
    const products = await db.products.toArray();
    for (const product of products) {
      const image = PRODUCT_IMAGES[product.id];
      if (image && product.image_data !== image) {
        product.image_data = image;
        await db.products.put(product);
      }
    }
  } catch (err) {
    console.warn('Product image migration skipped:', err);
  }

  state.syncManager = new SyncManager();
  if (onSyncStatus) state.syncManager.onStatusChange = onSyncStatus;
  state.syncManager.startSyncScheduler();

  return { tenant: state.currentTenant, branch: state.currentBranch };
}

export async function listActiveUsers() {
  return db.users.where('status').equals('ACTIVE').toArray();
}

/** Verifies the local unlock PIN. Returns the user, or null. */
export async function verifyLocalPin(userId, pin) {
  const user = await db.users.get(userId);
  return user && user.pin === pin ? user : null;
}

/**
 * Signs the till into Firebase and opens a shift so the outbox has somewhere to
 * drain. Fire-and-forget: every failure ends with the operator still selling.
 */
export async function establishCloudSession(user, pin) {
  const { firebaseConfigured, startTillSession, openShift } = await import('./services/firebase.js');
  if (!firebaseConfigured) return;

  try {
    await startTillSession(user.id, pin);
    const branchId = state.currentBranch ? state.currentBranch.id : null;
    if (branchId) await openShift(branchId);
    if (state.syncManager) state.syncManager.syncOutbox();
  } catch (err) {
    console.warn('Backend session unavailable; till stays local-only.', err);
    showNotification('Working offline: sales will queue until the backend is reachable.', 'warning');
  }
}

export async function endCloudSession() {
  try {
    const { firebaseConfigured, signOutTill } = await import('./services/firebase.js');
    if (firebaseConfigured) await signOutTill();
  } catch {
    // Signing out is best-effort; the local lock has already taken effect.
  }
}

/** Background low-stock sweep run shortly after unlock. */
export async function reportStockAlerts() {
  try {
    const threshold = parseInt(localStorage.getItem('pos_alert_threshold') || '10');
    const products = await db.products.where('is_active').equals(1).toArray();
    const branchId = state.currentBranch ? state.currentBranch.id : 1;

    let critical = 0;
    let low = 0;
    for (const product of products) {
      if (product.is_service) continue;
      const stock = await getStockOnHand(product.id, branchId);
      if (stock <= 0) critical++;
      else if (stock <= threshold) low++;
    }

    if (critical > 0) {
      showNotification(`URGENT: ${critical} item(s) OUT OF STOCK! Check QR & Tools > Stock Alerts.`, 'error');
    } else if (low > 0) {
      showNotification(`${low} items low on stock. Check QR & Tools > Stock Alerts.`, 'warning');
    }
  } catch {
    // A failed advisory sweep must never interrupt a shift.
  }
}
