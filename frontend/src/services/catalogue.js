/**
 * Pulls the server catalogue into Dexie.
 *
 * The till reads products from Dexie, and until now Dexie was only ever filled
 * from the bundled seed file - nothing brought products back down from
 * Firestore. A product created anywhere else, including by a bulk import, was
 * invisible to every till.
 *
 * Sales still price from the server, so this is a read cache, not a second
 * source of truth.
 */

// Dexie and the Firebase client are both imported inside pullCatalogue: they
// need a browser, and importing them at module scope would stop the mapping
// below from being exercised in a plain node test.

/** Firestore's product document -> the row shape the till's screens read. */
export function toLocalProduct(doc) {
  return {
    id: doc.id,
    tenant_id: doc.tenantId,
    sku: doc.sku || doc.id,
    name: doc.name || doc.sku || doc.id,
    category_id: doc.categoryId || '',
    uom: doc.uom || 'EACH',
    is_batch_tracked: 0,
    is_service: doc.isService ? 1 : 0,
    tax_code: doc.taxCode || 'A',
    item_cls_cd: doc.itemClassCode || '',
    origin_country: 'KE',
    // The backend settles in integer minor units; the till's screens and its
    // cart maths are still in KES floats.
    sell_price: (Number(doc.sellPriceMinor) || 0) / 100,
    cost_price: (Number(doc.costPriceMinor) || 0) / 100,
    image_data: doc.imagePath || null,
    is_active: doc.isActive === false ? 0 : 1,
    version: 1
  };
}

/**
 * Replaces the local product cache with the tenant's server catalogue.
 * Returns the number of products written, or null when there is no backend.
 */
export async function pullCatalogue() {
  const { getFirebase, TENANT_ID } = await import('./firebase.js');
  const fb = await getFirebase();
  if (!fb) return null;
  if (!TENANT_ID) return null;

  const snapshot = await fb.firestore.getDocs(
    fb.firestore.query(
      fb.firestore.collection(fb.dbInstance, 'products'),
      fb.firestore.where('tenantId', '==', TENANT_ID)
    )
  );

  if (snapshot.empty) return 0;

  const products = snapshot.docs.map((entry) => toLocalProduct({ id: entry.id, ...entry.data() }));
  // bulkPut so a re-pull updates prices in place rather than duplicating, and
  // so locally seeded rows are overwritten by the authoritative copy.
  const { db } = await import('../db/schema');
  await db.products.bulkPut(products);

  return products.length;
}
