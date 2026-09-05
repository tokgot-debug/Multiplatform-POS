/**
 * Creates the first owner account for a tenant.
 *
 * There is no signed-in administrator to authorise the very first account, so
 * this is gated on the deployment's bootstrap secret. It refuses to run once
 * the tenant has an active owner - it opens the door once, it is not a way back
 * into a business already in use.
 *
 * bootstrapOwner is not exported by default. Re-add the export in
 * backend/functions/src/index.ts, deploy, run this, then remove it and redeploy:
 *   export { bootstrapOwner } from "./modules/staff-admin";
 *
 * Usage:
 *   node scripts/bootstrap-owner.mjs --secret <bootstrap-secret> \
 *     --tenant vanbransa --email owner@savahope.pos --name "Martina"
 *
 * The password is prompted for, so it never lands in your shell history.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const REGION = process.env.FIREBASE_REGION || "europe-west1";
const PROJECT = process.env.FIREBASE_PROJECT || "vanbransa-pos";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const bootstrapSecret = arg("secret");
const tenantId = arg("tenant");
const email = arg("email");
const name = arg("name") ?? "Owner";
// Takes over the tenant's existing owner instead of refusing. Needed once, to
// recover the owner profile the retired PIN provisioning left with a random
// password nobody was ever told.
const adoptExisting = process.argv.includes("--adopt");

if (!bootstrapSecret || !tenantId || !email) {
  console.error("Usage: node scripts/bootstrap-owner.mjs --secret <s> --tenant <id> --email <address> [--name <name>]");
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const password = await rl.question("New owner password (min 8 chars): ");
rl.close();

if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const url = `https://${REGION}-${PROJECT}.cloudfunctions.net/bootstrapOwner`;
const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ data: { bootstrapSecret, tenantId, email, password, name, adoptExisting } }),
});

const text = await response.text();
if (!response.ok) {
  console.error(`${response.status} from bootstrapOwner\n${text}`);
  process.exit(1);
}

console.log(text);
console.log(`\nDone. Sign in at the till with ${email}, then create the rest of the staff from Users.`);
