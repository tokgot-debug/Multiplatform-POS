/**
 * One-shot Firestore provisioning for a Vanbransa tenant.
 *
 * Sends the till's own opening dataset (frontend/src/db/seed-data.js) to the
 * provisionTenant callable, so the deployed catalogue and the offline catalogue
 * come from one source and cannot drift apart.
 *
 * Usage:
 *   node scripts/provision-tenant.mjs --secret <bootstrap-secret> [--force]
 *   node scripts/provision-tenant.mjs --secret-file <path> [--force]
 *
 * The callable is meant to be removed from the deployment once this has run.
 */

import { readFileSync } from "node:fs";

import * as SEED from "../frontend/src/db/seed-data.js";

const REGION = process.env.FIREBASE_REGION || "europe-west1";
const PROJECT = process.env.FIREBASE_PROJECT || "vanbransa-pos";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const secret = arg("secret")
  ?? (arg("secret-file") ? readFileSync(arg("secret-file"), "utf8").trim() : undefined);

if (!secret) {
  console.error("Missing --secret or --secret-file.");
  process.exit(1);
}

const payload = {
  bootstrapSecret: secret,
  force: process.argv.includes("--force"),
  TENANT_ID: SEED.TENANT_ID,
  tenant: SEED.tenant,
  branches: SEED.branches,
  device: SEED.device,
  users: SEED.users,
  categories: SEED.categories,
  products: SEED.products,
  barcodes: SEED.barcodes,
  stockMovements: SEED.stockMovements,
  suppliers: SEED.suppliers,
  customers: SEED.customers,
};

const url = `https://${REGION}-${PROJECT}.cloudfunctions.net/provisionTenant`;
console.log(`Provisioning ${SEED.TENANT_ID} via ${url}`);
console.log(
  `  ${SEED.products.length} products, ${SEED.users.length} staff, `
  + `${SEED.customers.length} customers, ${SEED.stockMovements.length} opening movements`,
);

const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ data: payload }),
});

const body = await response.json().catch(() => ({}));

if (!response.ok || body.error) {
  console.error(`\nFAILED (${response.status})`);
  console.error(JSON.stringify(body.error ?? body, null, 2));
  process.exit(1);
}

console.log("\nProvisioned:");
console.log(JSON.stringify(body.result ?? body, null, 2));
console.log(
  "\nNow remove provisionTenant from backend/functions/src/index.ts and redeploy.",
);
