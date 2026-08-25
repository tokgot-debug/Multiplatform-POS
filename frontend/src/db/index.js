import { db } from './schema';
import * as SEED from './seed-data';

// Helper to compute SHA-256 hash using native Web Crypto API with custom fallback for non-secure contexts
export async function computeHash(message) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('SubtleCrypto failed, using local hash fallback:', e);
    }
  }
  
  // Local fallback: FNV-1a hash representation for non-secure HTTP/PWA contexts
  let hash = 2166136261;
  for (let i = 0; i < message.length; i++) {
    hash ^= message.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0');
  return hashHex.repeat(8).slice(0, 64); // Repeat to match SHA-256 length (64 chars)
}


// Immutable append-only audit logging helper
export async function logAuditEvent(tenantId, actorId, action, entityType, entityId, beforeJson = null, afterJson = null) {
  return await db.transaction('rw', db.audit_log, async () => {
    // 1. Get the last log entry to retrieve its hash
    const lastEntry = await db.audit_log.orderBy('created_at').last();
    const prevHash = lastEntry ? lastEntry.hash : '0000000000000000000000000000000000000000000000000000000000000000';
    
    // 2. Prepare content
    const timestamp = new Date().toISOString();
    const payload = JSON.stringify({
      tenantId,
      actorId,
      action,
      entityType,
      entityId,
      beforeJson,
      afterJson,
      timestamp,
      prevHash
    });
    
    // 3. Compute hash of the new record including prev_hash
    const hash = await computeHash(payload);
    
    const newEntry = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_json: beforeJson,
      after_json: afterJson,
      device_id: 'till-device-01',
      ip: '127.0.0.1',
      created_at: timestamp,
      prev_hash: prevHash,
      hash
    };
    
    await db.audit_log.add(newEntry);
    return newEntry;
  });
}

// Verify audit trail integrity by recalculating hash chain
export async function verifyAuditTrail() {
  const logs = await db.audit_log.orderBy('created_at').toArray();
  let expectedPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (log.prev_hash !== expectedPrevHash) {
      return { valid: false, brokenIndex: i, reason: 'Hash chain broken (prev_hash mismatch)' };
    }
    
    const payload = JSON.stringify({
      tenantId: log.tenant_id,
      actorId: log.actor_id,
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      beforeJson: log.before_json,
      afterJson: log.after_json,
      timestamp: log.created_at,
      prevHash: log.prev_hash
    });
    
    const calculatedHash = await computeHash(payload);
    if (log.hash !== calculatedHash) {
      return { valid: false, brokenIndex: i, reason: `Hash mismatch at record ${log.id}` };
    }
    
    expectedPrevHash = log.hash;
  }
  
  return { valid: true, count: logs.length };
}

// Derive current on-hand stock for a product in a branch (across all locations)
export async function getStockOnHand(productId, branchId, location = null) {
  if (!productId) return 0;
  const targetPid = String(productId);
  const targetBid = branchId ? String(branchId) : null;

  const movements = await db.stock_movements.toArray();
  const filtered = movements.filter(m => {
    let match = String(m.product_id) === targetPid;
    if (targetBid && m.branch_id) {
      match = match && (String(m.branch_id) === targetBid);
    }
    if (location) {
      match = match && m.location === location;
    }
    return match;
  });
    
  return filtered.reduce((acc, mov) => acc + (mov.qty || 0), 0);
}

export async function getStoreStock(productId, branchId) {
  return getStockOnHand(productId, branchId, 'STORE');
}

export async function getHouseStock(productId, branchId) {
  return getStockOnHand(productId, branchId, 'HOUSE');
}

// Derive current on-hand stock for a specific batch in a branch
export async function getBatchStockOnHand(productId, batchId, branchId) {
  const movements = await db.stock_movements
    .where('product_id')
    .equals(productId)
    .filter(m => m.branch_id === branchId && m.batch_id === batchId)
    .toArray();
    
  return movements.reduce((acc, mov) => acc + mov.qty, 0);
}

/**
 * Sales that have not reached the server exist nowhere else. Wiping them to
 * re-seed loses real money, so every wipe path has to ask first.
 */
async function hasUnsyncedSales() {
  return (await db.sales
    .filter(s => s.synced_at === undefined || s.synced_at === null)
    .count()) > 0;
}

async function wipeAllTables(reason) {
  if (await hasUnsyncedSales()) {
    console.error(`Refusing to wipe local data (${reason}): unsynced sales are still queued.`);
    return false;
  }
  await Promise.all(db.tables.map(table => table.clear()));
  return true;
}

// Seed the DB with mock data if empty
export async function seedDatabase() {
  const dbVer = localStorage.getItem('db_seed_ver');
  if (dbVer !== 'v4_bar_data') {
    console.warn('New DB version required. Wiping old data...');
    // Only advance the marker if the wipe actually happened, otherwise the
    // next boot would skip the migration entirely.
    if (await wipeAllTables('seed version change')) {
      localStorage.setItem('db_seed_ver', 'v4_bar_data');
    }
  }

  const tenantCount = await db.tenants.count();
  const userCount = await db.users.count();
  const prodCount = await db.products.count();
  const custCount = await db.customers.count();

  if (tenantCount > 0 && userCount > 0 && prodCount > 0 && custCount > 0) {
    console.log('Database fully seeded.');
    return;
  }

  // If partial state, clear all tables
  if (tenantCount > 0) {
    console.warn('Partial database state detected. Wiping and re-seeding...');
    if (!await wipeAllTables('partial seed state')) return;
  }

  console.log('Initializing IndexedDB for POS...');
  await Promise.all([
    db.tenants.clear(),
    db.branches.clear(),
    db.devices.clear(),
    db.users.clear(),
    db.categories.clear(),
    db.products.clear(),
    db.barcodes.clear(),
    db.batches.clear(),
    db.stock_movements.clear(),
    db.suppliers.clear(),
    db.customers.clear(),
    db.audit_log.clear()
  ]);

  
  // Seed tables from the shared opening dataset.
  const tenantId = SEED.TENANT_ID;
  await db.tenants.add(SEED.tenant);
  await db.branches.bulkAdd(SEED.branches);
  await db.devices.add(SEED.device);
  await db.users.bulkAdd(SEED.users);
  await db.categories.bulkAdd(SEED.categories);
  await db.products.bulkAdd(SEED.products);
  await db.barcodes.bulkAdd(SEED.barcodes);
  await db.stock_movements.bulkAdd(SEED.stockMovements);
  await db.suppliers.bulkAdd(SEED.suppliers);
  await db.customers.bulkAdd(SEED.customers);


  // Initial audit trail log
  await logAuditEvent(tenantId, 'user-manager', 'SEED_DB', 'SYSTEM', 'POS_DB', null, JSON.stringify({ seeded: true }));

  console.log('IndexedDB seed complete.');
}

