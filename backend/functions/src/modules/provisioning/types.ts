/** Raw shapes as the till's IndexedDB seed stores them (snake_case, KES floats). */
export type SeedPayload = {
  TENANT_ID?: string;
  tenant?: Record<string, unknown>;
  branches?: Record<string, unknown>[];
  device?: Record<string, unknown>;
  devices?: Record<string, unknown>[];
  users?: Record<string, unknown>[];
  categories?: Record<string, unknown>[];
  products?: Record<string, unknown>[];
  barcodes?: Record<string, unknown>[];
  stockMovements?: Record<string, unknown>[];
  suppliers?: Record<string, unknown>[];
  customers?: Record<string, unknown>[];
};

export type MappedStaff = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  pin: string;
};

export type MappedSeed = {
  tenantId: string;
  tenant: Record<string, unknown>;
  settings: Record<string, unknown>;
  branches: { id: string; [key: string]: unknown }[];
  devices: { id: string; [key: string]: unknown }[];
  categories: { id: string; [key: string]: unknown }[];
  products: { id: string; [key: string]: unknown }[];
  barcodes: { id: string; [key: string]: unknown }[];
  customers: { id: string; [key: string]: unknown }[];
  suppliers: { id: string; [key: string]: unknown }[];
  staff: MappedStaff[];
  stockBalances: { id: string; [key: string]: unknown }[];
};
