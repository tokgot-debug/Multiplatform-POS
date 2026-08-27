import { db } from './schema';
import restaurantCatalogue from '../data/restaurant-products.json';

const IMPORT_SOURCE = 'restaurant_export.xlsx';
const IMPORT_SITE_ID = 'a4e69a8b8344';
const IMPORT_TENANT_ID = 'tenant-01';
const IMPORT_BRANCH_ID = 'branch-nai-01';
const IMPORT_VERSION = `restaurant-catalogue-v1-${restaurantCatalogue.metadata.source_sha256.slice(0, 16)}`;
const IMPORT_MARKER_KEY = `restaurant_catalogue_import:${IMPORT_SITE_ID}`;
const BULK_CHUNK_SIZE = 400;

function normalizedCategory(value) {
  return String(value || 'Uncategorized').trim().normalize('NFKC').toLocaleLowerCase('en-US');
}

function categorySlug(value) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44);
  return slug || 'uncategorized';
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function categoryId(sourceCategory) {
  const normalized = normalizedCategory(sourceCategory);
  return `cat-restaurant-${categorySlug(normalized)}-${stableHash(normalized)}`;
}

function productId(sourceId) {
  return `restaurant-${sourceId}`;
}

function productSku(sourceId) {
  return `REST-${sourceId}`;
}

function movementId(sourceId, location) {
  return `restaurant-opening-${sourceId}-${location.toLowerCase()}`;
}

function numericValue(value, field, sourceId) {
  const result = Number(value);
  if (!Number.isFinite(result)) {
    throw new Error(`Restaurant catalogue ${field} is not numeric for source product ${sourceId}`);
  }
  return result;
}

function validateCatalogue() {
  const { metadata, products } = restaurantCatalogue;
  if (!metadata || !Array.isArray(products)) {
    throw new Error('Restaurant catalogue asset is malformed.');
  }
  if (metadata.sheet !== 'ALL_PRODUCTS' || metadata.titanium_site_id !== IMPORT_SITE_ID) {
    throw new Error('Restaurant catalogue asset does not identify the approved Titanium product subset.');
  }
  if (!metadata.excluded_sheets?.includes('ALL_USERS')) {
    throw new Error('Restaurant catalogue asset does not declare ALL_USERS as excluded.');
  }
  if (products.length !== metadata.product_count) {
    throw new Error(`Restaurant catalogue count mismatch: expected ${metadata.product_count}, found ${products.length}.`);
  }

  const sourceIds = new Set();
  const categoryKeys = new Set();
  let activeCount = 0;
  let zeroPriceCount = 0;
  let storeStockTotal = 0;
  let houseStockTotal = 0;

  for (const source of products) {
    if (!source.source_id || source.source_site_id !== IMPORT_SITE_ID) {
      throw new Error('Restaurant catalogue contains a missing id or a product from an unapproved site.');
    }
    if (sourceIds.has(source.source_id)) {
      throw new Error(`Restaurant catalogue contains duplicate source id ${source.source_id}.`);
    }
    sourceIds.add(source.source_id);
    categoryKeys.add(normalizedCategory(source.category));

    const price = numericValue(source.price, 'price', source.source_id);
    const storeStock = numericValue(source.store_stock, 'store_stock', source.source_id);
    const houseStock = numericValue(source.house_stock, 'house_stock', source.source_id);
    if (price < 0) {
      throw new Error(`Restaurant catalogue price is negative for source product ${source.source_id}.`);
    }

    activeCount += price > 0 ? 1 : 0;
    zeroPriceCount += price === 0 ? 1 : 0;
    storeStockTotal += storeStock;
    houseStockTotal += houseStock;
  }

  const checks = [
    ['active product', activeCount, metadata.active_product_count],
    ['zero-price product', zeroPriceCount, metadata.zero_price_product_count],
    ['category', categoryKeys.size, metadata.category_count],
    ['store stock', storeStockTotal, metadata.store_stock_total],
    ['house stock', houseStockTotal, metadata.house_stock_total],
  ];
  for (const [label, actual, expected] of checks) {
    if (actual !== expected) {
      throw new Error(`Restaurant catalogue ${label} validation failed: expected ${expected}, found ${actual}.`);
    }
  }
}

function buildCategories() {
  const categoryCandidates = new Map();
  for (const source of restaurantCatalogue.products) {
    const key = normalizedCategory(source.category);
    if (!categoryCandidates.has(key)) categoryCandidates.set(key, new Map());
    const names = categoryCandidates.get(key);
    const displayName = String(source.category).trim() || 'Uncategorized';
    names.set(displayName, (names.get(displayName) || 0) + 1);
  }

  return Array.from(categoryCandidates.entries())
    .map(([key, candidates]) => {
      const name = Array.from(candidates.entries())
        .sort((left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))[0][0];
      return {
        id: categoryId(key),
        name,
        source_category_key: key,
        import_source: IMPORT_SOURCE,
        import_version: IMPORT_VERSION,
      };
    })
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

function buildProduct(source) {
  const price = numericValue(source.price, 'price', source.source_id);
  return {
    id: productId(source.source_id),
    tenant_id: IMPORT_TENANT_ID,
    sku: productSku(source.source_id),
    name: source.name,
    category_id: categoryId(source.category),
    uom: 'EA',
    is_batch_tracked: 0,
    is_service: 0,
    tax_code: 'A',
    item_cls_cd: null,
    item_ty_cd: '1',
    pkg_unit_cd: 'EA',
    qty_unit_cd: 'U',
    origin_country: 'KE',
    sell_price: price,
    cost_price: 0,
    image_data: source.image_png || source.image_url || null,
    description: source.description,
    is_active: price > 0 ? 1 : 0,
    version: 1,
    etims_registered_at: null,
    created_at: source.source_created_at || restaurantCatalogue.metadata.snapshot_at,
    source_id: source.source_id,
    source_site_id: source.source_site_id,
    source_created_at: source.source_created_at,
    source_category: source.category,
    source_sub_category: source.sub_category,
    source_details: source.details,
    source_image_url: source.image_url,
    source_image_png_invalid: source.invalid_image_png ? 1 : 0,
    source_float: source.float,
    source_store_stock: numericValue(source.store_stock, 'store_stock', source.source_id),
    source_house_stock: numericValue(source.house_stock, 'house_stock', source.source_id),
    import_source: IMPORT_SOURCE,
    import_version: IMPORT_VERSION,
  };
}

function buildMovement(source, location) {
  const quantityField = location === 'STORE' ? 'store_stock' : 'house_stock';
  return {
    id: movementId(source.source_id, location),
    tenant_id: IMPORT_TENANT_ID,
    branch_id: IMPORT_BRANCH_ID,
    product_id: productId(source.source_id),
    batch_id: null,
    type: 'OPENING_BALANCE',
    location,
    qty: numericValue(source[quantityField], quantityField, source.source_id),
    unit_cost: 0,
    ref_type: 'IMPORT',
    ref_id: IMPORT_VERSION,
    reason: `Opening ${location.toLowerCase()} balance from ${IMPORT_SOURCE}`,
    created_by: 'system-import',
    created_at: restaurantCatalogue.metadata.snapshot_at,
    // Legacy opening balances are already accounted for at source. Marking
    // them synced prevents the periodic eTIMS outbox from retransmitting them.
    synced_at: restaurantCatalogue.metadata.snapshot_at,
    source_id: source.source_id,
    source_site_id: source.source_site_id,
    import_source: IMPORT_SOURCE,
    import_version: IMPORT_VERSION,
  };
}

async function bulkPutInChunks(table, records) {
  for (let start = 0; start < records.length; start += BULK_CHUNK_SIZE) {
    await table.bulkPut(records.slice(start, start + BULK_CHUNK_SIZE));
  }
}

function readImportMarker() {
  try {
    const raw = globalThis.localStorage?.getItem(IMPORT_MARKER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

function writeImportMarker(result) {
  try {
    globalThis.localStorage?.setItem(IMPORT_MARKER_KEY, JSON.stringify(result));
  } catch (_error) {
    // IndexedDB state remains authoritative when localStorage is unavailable.
  }
}

async function databaseImportState() {
  const sentinelId = productId(restaurantCatalogue.products[0].source_id);
  const [sentinel, productCount, categoryCount, movementCount] = await Promise.all([
    db.products.get(sentinelId),
    db.products.filter(product => product.import_version === IMPORT_VERSION).count(),
    db.categories.filter(category => category.import_version === IMPORT_VERSION).count(),
    db.stock_movements.filter(movement => movement.import_version === IMPORT_VERSION).count(),
  ]);
  return { sentinel, productCount, categoryCount, movementCount };
}

function importIsComplete(state) {
  return state.sentinel?.import_version === IMPORT_VERSION
    && state.productCount === restaurantCatalogue.metadata.product_count
    && state.categoryCount === restaurantCatalogue.metadata.category_count
    && state.movementCount === restaurantCatalogue.metadata.product_count * 2;
}

export async function migrateRestaurantCatalogue() {
  validateCatalogue();

  const marker = readImportMarker();
  const before = await databaseImportState();
  if (importIsComplete(before)) {
    const result = {
      version: IMPORT_VERSION,
      source_sha256: restaurantCatalogue.metadata.source_sha256,
      product_count: before.productCount,
      category_count: before.categoryCount,
      movement_count: before.movementCount,
      skipped: true,
      marker_was_current: marker?.version === IMPORT_VERSION,
    };
    if (marker?.version !== IMPORT_VERSION) writeImportMarker(result);
    return result;
  }

  const categories = buildCategories();
  const products = restaurantCatalogue.products.map(buildProduct);
  const movements = restaurantCatalogue.products.flatMap(source => [
    buildMovement(source, 'STORE'),
    buildMovement(source, 'HOUSE'),
  ]);

  await db.transaction('rw', db.categories, db.products, db.stock_movements, async () => {
    await bulkPutInChunks(db.categories, categories);
    await bulkPutInChunks(db.products, products);
    await bulkPutInChunks(db.stock_movements, movements);
  });

  const after = await databaseImportState();
  if (!importIsComplete(after)) {
    throw new Error(
      `Restaurant catalogue import incomplete: ${after.productCount}/${products.length} products, `
      + `${after.categoryCount}/${categories.length} categories, `
      + `${after.movementCount}/${movements.length} stock movements.`,
    );
  }

  const result = {
    version: IMPORT_VERSION,
    source_sha256: restaurantCatalogue.metadata.source_sha256,
    product_count: after.productCount,
    active_product_count: restaurantCatalogue.metadata.active_product_count,
    category_count: after.categoryCount,
    movement_count: after.movementCount,
    store_stock_total: restaurantCatalogue.metadata.store_stock_total,
    house_stock_total: restaurantCatalogue.metadata.house_stock_total,
    branch_id: IMPORT_BRANCH_ID,
    applied_at: new Date().toISOString(),
    skipped: false,
  };
  writeImportMarker(result);
  console.log('Titanium restaurant catalogue import complete.', result);
  return result;
}

export const restaurantCatalogueImportInfo = Object.freeze({
  version: IMPORT_VERSION,
  sourceSha256: restaurantCatalogue.metadata.source_sha256,
  productCount: restaurantCatalogue.metadata.product_count,
  activeProductCount: restaurantCatalogue.metadata.active_product_count,
  categoryCount: restaurantCatalogue.metadata.category_count,
  movementCount: restaurantCatalogue.metadata.product_count * 2,
  storeStockTotal: restaurantCatalogue.metadata.store_stock_total,
  houseStockTotal: restaurantCatalogue.metadata.house_stock_total,
  siteId: IMPORT_SITE_ID,
  branchId: IMPORT_BRANCH_ID,
});
