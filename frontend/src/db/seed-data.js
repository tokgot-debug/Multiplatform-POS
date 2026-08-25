/**
 * Opening data for a fresh Vanbransa install.
 *
 * Pure data only: no Dexie, no browser globals. seedDatabase() writes it into
 * IndexedDB and the Firestore provisioner sends the same objects upstream, so
 * the till and the server can never disagree about the opening catalogue.
 */

export const TENANT_ID = 'tenant-01';
export const DEFAULT_BRANCH_ID = 'branch-nai-01';
export const DEFAULT_DEVICE_ID = 'device-till-01';

export const tenant = {
    id: TENANT_ID,
    legal_name: 'Kenya Retail Group Ltd',
    trading_name: 'Vanbransa',
    kra_pin: 'P051234567A',
    etims_mode: 'OSCU',
    status: 'ACTIVE'
  };

export const branches = [
    { id: 'branch-nai-01', tenant_id: TENANT_ID, name: 'Nairobi CBD Branch', code: 'BH001', etims_bhf_id: '00', is_active: 1 },
    { id: 'branch-nai-02', tenant_id: TENANT_ID, name: 'Westlands Branch', code: 'BH002', etims_bhf_id: '01', is_active: 1 }
  ];

export const device = {
    id: 'device-till-01',
    tenant_id: TENANT_ID,
    branch_id: 'branch-nai-01',
    label: 'Main Till 01'
  };

export const users = [
    { id: 'user-cashier-1', tenant_id: TENANT_ID, name: 'Wanjiku Kamau', phone: '0712345678', email: 'wanjiku@kpos.co.ke', pin: '1111', status: 'ACTIVE', role: 'Cashier' },
    { id: 'user-cashier-2', tenant_id: TENANT_ID, name: 'Mwangi Njoroge', phone: '0722345678', email: 'mwangi@kpos.co.ke', pin: '2222', status: 'ACTIVE', role: 'Cashier' },
    { id: 'user-bar-staff', tenant_id: TENANT_ID, name: 'Mercy Wanjala', phone: '0725345678', email: 'mercy@kpos.co.ke', pin: '4444', status: 'ACTIVE', role: 'Bar Staff' },
    { id: 'user-store-keeper', tenant_id: TENANT_ID, name: 'John Mutua', phone: '0728345678', email: 'john@kpos.co.ke', pin: '3333', status: 'ACTIVE', role: 'Store Keeper' },
    { id: 'user-supervisor', tenant_id: TENANT_ID, name: 'Jane Mwende', phone: '0733345678', email: 'mwende@kpos.co.ke', pin: '9999', status: 'ACTIVE', role: 'Supervisor' },
    { id: 'user-manager', tenant_id: TENANT_ID, name: 'Omondi Juma', phone: '0744345678', email: 'omondi@kpos.co.ke', pin: '8888', status: 'ACTIVE', role: 'Store Manager' },
    { id: 'user-owner', tenant_id: TENANT_ID, name: 'Vanbransa Owner', phone: '0755345678', email: 'owner@kpos.co.ke', pin: '0000', status: 'ACTIVE', role: 'Owner' }
  ];

export const categories = [
    { id: 'cat-beers', name: 'Beers & Ciders' },
    { id: 'cat-spirits', name: 'Spirits & Wines' },
    { id: 'cat-softdrinks', name: 'Soft Drinks & Water' },
    { id: 'cat-food', name: 'Food & Meals' },
    { id: 'cat-services', name: 'Services & Charges' }
  ];

export const products = [
    // ── BEERS & CIDERS ──────────────────────────────────────────
    {
      id: 'prod-tusker-bottle',
      tenant_id: TENANT_ID, sku: 'BAR-BEE-01', name: 'Tusker Lager 500ml',
      category_id: 'cat-beers', uom: 'BOTTLE', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50202306', item_ty_cd: '1',
      pkg_unit_cd: 'BO', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 250.00, cost_price: 160.00,
      image_data: '/ai_images/beer_glass.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-guinness',
      tenant_id: TENANT_ID, sku: 'BAR-BEE-02', name: 'Guinness Foreign Extra 500ml',
      category_id: 'cat-beers', uom: 'BOTTLE', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50202306', item_ty_cd: '1',
      pkg_unit_cd: 'BO', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 280.00, cost_price: 180.00,
      image_data: '/ai_images/stout_glass.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-whitecap',
      tenant_id: TENANT_ID, sku: 'BAR-BEE-03', name: 'White Cap Lager 500ml',
      category_id: 'cat-beers', uom: 'BOTTLE', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50202306', item_ty_cd: '1',
      pkg_unit_cd: 'BO', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 250.00, cost_price: 155.00,
      image_data: '/ai_images/beer_glass.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-savanna',
      tenant_id: TENANT_ID, sku: 'BAR-CID-04', name: 'Savanna Dry Cider 330ml',
      category_id: 'cat-beers', uom: 'CAN', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50202306', item_ty_cd: '1',
      pkg_unit_cd: 'CA', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 300.00, cost_price: 190.00,
      image_data: '/ai_images/cider_glass.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },

    // ── SPIRITS & WINES ──────────────────────────────────────────
    {
      id: 'prod-smirnoff-tot',
      tenant_id: TENANT_ID, sku: 'BAR-SPR-01', name: 'Smirnoff Vodka (tot 30ml)',
      category_id: 'cat-spirits', uom: 'TOT', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50202301', item_ty_cd: '1',
      pkg_unit_cd: 'EA', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 150.00, cost_price: 90.00,
      image_data: '/ai_images/vodka_glass.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-jameson-tot',
      tenant_id: TENANT_ID, sku: 'BAR-SPR-02', name: 'Jameson Irish Whiskey (tot 30ml)',
      category_id: 'cat-spirits', uom: 'TOT', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50202302', item_ty_cd: '1',
      pkg_unit_cd: 'EA', qty_unit_cd: 'U', origin_country: 'IE',
      sell_price: 250.00, cost_price: 140.00,
      image_data: '/ai_images/whiskey_glass.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-konyagi',
      tenant_id: TENANT_ID, sku: 'BAR-SPR-03', name: 'Konyagi Gin 250ml',
      category_id: 'cat-spirits', uom: 'BOTTLE', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50202301', item_ty_cd: '1',
      pkg_unit_cd: 'BO', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 450.00, cost_price: 280.00,
      image_data: '/ai_images/gin_glass.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-wine-glass',
      tenant_id: TENANT_ID, sku: 'BAR-WIN-01', name: 'House Red Wine (glass)',
      category_id: 'cat-spirits', uom: 'GLASS', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50202300', item_ty_cd: '1',
      pkg_unit_cd: 'EA', qty_unit_cd: 'U', origin_country: 'ZA',
      sell_price: 500.00, cost_price: 280.00,
      image_data: '/ai_images/red_wine_glass.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },

    // ── SOFT DRINKS & WATER ──────────────────────────────────────
    {
      id: 'prod-coca-cola',
      tenant_id: TENANT_ID, sku: 'BAR-SFT-01', name: 'Coca-Cola 300ml',
      category_id: 'cat-softdrinks', uom: 'BOTTLE', is_batch_tracked: 0, is_service: 0,
      tax_code: 'B', item_cls_cd: '50202500', item_ty_cd: '1',
      pkg_unit_cd: 'BO', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 100.00, cost_price: 60.00,
      image_data: '/ai_images/coke_bottle.png',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-fanta',
      tenant_id: TENANT_ID, sku: 'BAR-SFT-02', name: 'Fanta Orange 300ml',
      category_id: 'cat-softdrinks', uom: 'BOTTLE', is_batch_tracked: 0, is_service: 0,
      tax_code: 'B', item_cls_cd: '50202500', item_ty_cd: '1',
      pkg_unit_cd: 'BO', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 100.00, cost_price: 60.00,
      image_data: '/ai_images/fanta_glass.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-water',
      tenant_id: TENANT_ID, sku: 'BAR-SFT-03', name: 'Mineral Water 500ml',
      category_id: 'cat-softdrinks', uom: 'BOTTLE', is_batch_tracked: 0, is_service: 0,
      tax_code: 'C', item_cls_cd: '50202500', item_ty_cd: '1',
      pkg_unit_cd: 'BO', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 70.00, cost_price: 35.00,
      image_data: '/ai_images/mineral_water.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-juice',
      tenant_id: TENANT_ID, sku: 'BAR-SFT-04', name: 'Fresh Juice (glass)',
      category_id: 'cat-softdrinks', uom: 'GLASS', is_batch_tracked: 0, is_service: 0,
      tax_code: 'B', item_cls_cd: '50202500', item_ty_cd: '1',
      pkg_unit_cd: 'EA', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 200.00, cost_price: 80.00,
      image_data: '/ai_images/fresh_juice.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },

    // ── FOOD & MEALS ─────────────────────────────────────────────
    {
      id: 'prod-nyama-choma',
      tenant_id: TENANT_ID, sku: 'FOD-NYM-01', name: 'Nyama Choma (per 0.5kg)',
      category_id: 'cat-food', uom: 'PORTION', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50101700', item_ty_cd: '1',
      pkg_unit_cd: 'PK', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 800.00, cost_price: 500.00,
      image_data: '/ai_images/nyama_choma.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-chicken-chips',
      tenant_id: TENANT_ID, sku: 'FOD-CKN-02', name: 'Grilled Chicken & Chips',
      category_id: 'cat-food', uom: 'PLATE', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50101700', item_ty_cd: '1',
      pkg_unit_cd: 'PK', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 650.00, cost_price: 350.00,
      image_data: '/ai_images/grilled_chicken.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-pilau',
      tenant_id: TENANT_ID, sku: 'FOD-PIL-03', name: 'Pilau Rice (full)',
      category_id: 'cat-food', uom: 'PLATE', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50101700', item_ty_cd: '1',
      pkg_unit_cd: 'PK', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 350.00, cost_price: 180.00,
      image_data: '/ai_images/pilau_rice.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-ugali-stew',
      tenant_id: TENANT_ID, sku: 'FOD-UGL-04', name: 'Ugali & Beef Stew',
      category_id: 'cat-food', uom: 'PLATE', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50101700', item_ty_cd: '1',
      pkg_unit_cd: 'PK', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 300.00, cost_price: 160.00,
      image_data: '/ai_images/ugali_nyama.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-samosa',
      tenant_id: TENANT_ID, sku: 'FOD-SAM-05', name: 'Beef Samosas (3 pcs)',
      category_id: 'cat-food', uom: 'PORTION', is_batch_tracked: 0, is_service: 0,
      tax_code: 'A', item_cls_cd: '50101700', item_ty_cd: '1',
      pkg_unit_cd: 'PK', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 120.00, cost_price: 60.00,
      image_data: '/ai_images/beef_samosas.jpg',
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },

    // ── SERVICES ─────────────────────────────────────────────────
    {
      id: 'prod-table-service',
      tenant_id: TENANT_ID, sku: 'SRV-TBL-01', name: 'Table Service Charge',
      category_id: 'cat-services', uom: 'CHARGE', is_batch_tracked: 0, is_service: 1,
      tax_code: 'E', item_cls_cd: '73151600', item_ty_cd: '2',
      pkg_unit_cd: 'EA', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 100.00, cost_price: 0.00,
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    },
    {
      id: 'prod-corkage',
      tenant_id: TENANT_ID, sku: 'SRV-CRK-02', name: 'Corkage Fee',
      category_id: 'cat-services', uom: 'CHARGE', is_batch_tracked: 0, is_service: 1,
      tax_code: 'E', item_cls_cd: '73151600', item_ty_cd: '2',
      pkg_unit_cd: 'EA', qty_unit_cd: 'U', origin_country: 'KE',
      sell_price: 500.00, cost_price: 0.00,
      etims_registered_at: new Date().toISOString(), is_active: 1, version: 1
    }
  ];

export const barcodes = [
    { barcode: '5000102340022', product_id: 'prod-tusker-bottle' },
    { barcode: '5000102340023', product_id: 'prod-guinness' },
    { barcode: '5000102340024', product_id: 'prod-whitecap' },
    { barcode: '5000102340025', product_id: 'prod-savanna' },
    { barcode: '5000102340026', product_id: 'prod-konyagi' },
    { barcode: '5000102340030', product_id: 'prod-coca-cola' },
    { barcode: '5000102340031', product_id: 'prod-fanta' },
    { barcode: '5000102340032', product_id: 'prod-water' }
  ];

export const stockMovements = [
    { id: 'sm-01', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-tusker-bottle', batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 120, unit_cost: 160.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-02', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-guinness',       batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 60,  unit_cost: 180.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-03', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-whitecap',       batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 80,  unit_cost: 155.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-04', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-savanna',        batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 48,  unit_cost: 190.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-05', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-smirnoff-tot',   batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 200, unit_cost: 90.00,  ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-06', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-jameson-tot',    batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 150, unit_cost: 140.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-07', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-konyagi',        batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 36,  unit_cost: 280.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-08', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-wine-glass',     batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 100, unit_cost: 280.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-09', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-coca-cola',      batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 144, unit_cost: 60.00,  ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-10', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-fanta',          batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 144, unit_cost: 60.00,  ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-11', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-water',          batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 200, unit_cost: 35.00,  ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-12', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-juice',          batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 80,  unit_cost: 80.00,  ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-13', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-nyama-choma',    batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 50,  unit_cost: 500.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-14', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-chicken-chips',  batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 50,  unit_cost: 350.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-15', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-pilau',          batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 50,  unit_cost: 180.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-16', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-ugali-stew',     batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 50,  unit_cost: 160.00, ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() },
    { id: 'sm-17', tenant_id: TENANT_ID, branch_id: 'branch-nai-01', product_id: 'prod-samosa',         batch_id: null, type: 'OPENING_BALANCE', location: 'STORE', qty: 100, unit_cost: 60.00,  ref_type: 'SYSTEM', ref_id: 'seed', reason: 'Stock initialization', created_by: 'user-manager', created_at: new Date().toISOString() }
  ];

export const suppliers = [
    { id: 'supp-01', tenant_id: TENANT_ID, name: 'EABL Distributors Kenya', kra_pin: 'P059876543Z', phone: '020-123456', email: 'orders@eabl.co.ke' },
    { id: 'supp-02', tenant_id: TENANT_ID, name: 'Coca-Cola Beverages Africa', kra_pin: 'P058765432Y', phone: '020-654321', email: 'sales@cokeke.co.ke' }
  ];

export const customers = [
    { id: 'cust-walkin', tenant_id: TENANT_ID, name: 'Walk-In Guest', phone: '', kra_pin: '', credit_limit: 0.00, terms: 0, price_tier: 'RETAIL' },
    { id: 'cust-corporate', tenant_id: TENANT_ID, name: 'Corporate Account (Events)', phone: '0711999888', kra_pin: 'P057776665K', credit_limit: 200000.00, terms: 30, price_tier: 'WHOLESALE' },
    { id: 'cust-hotel-abc', tenant_id: TENANT_ID, name: 'ABC Hotel Supply', phone: '0722888999', kra_pin: 'P051112223X', credit_limit: 500000.00, terms: 15, price_tier: 'WHOLESALE' }
  ];

