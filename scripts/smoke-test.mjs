/**
 * End-to-end smoke test against the deployed project.
 *
 * Walks the real till path: PIN -> session -> shift -> sale, then re-sends the
 * same idempotency key to prove a retry cannot double-charge. Uses only the
 * public web API key, so it needs no admin credentials.
 *
 *   node scripts/smoke-test.mjs
 */

const API_KEY = process.env.VITE_FIREBASE_API_KEY
  ?? "AIzaSyD-5GMK_yz2uAFW6TNTSOxJziqPbTFCeaU";
const PROJECT = process.env.FIREBASE_PROJECT ?? "vanbransa-pos";
const REGION = process.env.FIREBASE_REGION ?? "europe-west1";
const BASE = `https://${REGION}-${PROJECT}.cloudfunctions.net`;

const TENANT_ID = "tenant-01";
const BRANCH_ID = "branch-nai-01";
const DEVICE_ID = "device-till-01";
const STAFF_ID = "user-cashier-1";
const PIN = "1111";
const PRODUCT_ID = "prod-tusker-bottle";
const CUSTOMER_ID = "cust-walkin";
const UNIT_PRICE_MINOR = 25000; // Tusker 500ml at KES 250.00

let failures = 0;

function check(label, condition, detail = "") {
  const mark = condition ? "PASS" : "FAIL";
  if (!condition) failures += 1;
  console.log(`  [${mark}] ${label}${detail ? ` - ${detail}` : ""}`);
}

async function callable(name, data, idToken) {
  const response = await fetch(`${BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && !body.error, status: response.status, body };
}

console.log(`\nSmoke test against ${PROJECT} (${REGION})\n`);

// 1. PIN -> custom token
console.log("1. startTillSession");
const session = await callable("startTillSession", {
  tenantId: TENANT_ID, staffId: STAFF_ID, deviceId: DEVICE_ID, pin: PIN,
});
check("PIN accepted", session.ok, session.ok ? "" : JSON.stringify(session.body.error));
if (!session.ok) process.exit(1);
const customToken = session.body.result.customToken;
check("custom token returned", typeof customToken === "string" && customToken.length > 0);

// 2. Custom token -> Firebase id token carrying claims
console.log("\n2. signInWithCustomToken");
const signIn = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  },
);
const signInBody = await signIn.json();
check("exchanged for an id token", Boolean(signInBody.idToken), signInBody.error?.message ?? "");
if (!signInBody.idToken) process.exit(1);
const idToken = signInBody.idToken;

const claims = JSON.parse(Buffer.from(idToken.split(".")[1], "base64").toString());
check("tenant_id claim present", claims.tenant_id === TENANT_ID, claims.tenant_id);
check("staff_id claim present", claims.staff_id === STAFF_ID, claims.staff_id);
check("staff_role claim present", claims.staff_role === "cashier", claims.staff_role);

// 3. Open a shift
console.log("\n3. openShift");
const shift = await callable(
  "openShift",
  { branchId: BRANCH_ID, deviceId: DEVICE_ID, openingFloatMinor: 500000 },
  idToken,
);
check("shift opened", shift.ok, shift.ok ? "" : JSON.stringify(shift.body.error));
if (!shift.ok) process.exit(1);
const shiftId = shift.body.result.shiftId;

const shiftAgain = await callable(
  "openShift",
  { branchId: BRANCH_ID, deviceId: DEVICE_ID },
  idToken,
);
check("re-opening is idempotent", shiftAgain.ok && shiftAgain.body.result.reused === true);

// 4. Sell something
console.log("\n4. createSale");
const idempotencyKey = `smoke-${Date.now()}`;
const salePayload = {
  tenantId: TENANT_ID,
  branchId: BRANCH_ID,
  deviceId: DEVICE_ID,
  shiftId,
  staffId: STAFF_ID,
  customerId: CUSTOMER_ID,
  idempotencyKey,
  lines: [{ productId: PRODUCT_ID, qty: 2 }],
  payments: [{ method: "cash", amountMinor: UNIT_PRICE_MINOR * 2 }],
};
const sale = await callable("createSale", salePayload, idToken);
check("sale committed", sale.ok, sale.ok ? "" : JSON.stringify(sale.body.error));
if (sale.ok) {
  const record = sale.body.result.sale;
  check("invoice number issued", Boolean(record.invoiceNumber), record.invoiceNumber);
  check("total is server-computed", record.totalMinor === UNIT_PRICE_MINOR * 2, String(record.totalMinor));
  check("inclusive VAT calculated", record.taxMinor > 0, `${record.taxMinor} minor units`);
}

// 5. A retry must not create a second sale
console.log("\n5. idempotent replay");
const replay = await callable("createSale", salePayload, idToken);
check("replay accepted", replay.ok, replay.ok ? "" : JSON.stringify(replay.body.error));
if (replay.ok && sale.ok) {
  check("flagged as replay", replay.body.result.replayed === true);
  check("same invoice, no double charge",
    replay.body.result.sale.invoiceNumber === sale.body.result.sale.invoiceNumber,
    replay.body.result.sale.invoiceNumber);
}

// 6. A wrong PIN must be refused
console.log("\n6. wrong PIN is rejected");
const badPin = await callable("startTillSession", {
  tenantId: TENANT_ID, staffId: STAFF_ID, deviceId: DEVICE_ID, pin: "9998",
});
check("rejected", !badPin.ok, badPin.body.error?.status ?? "");

// 7. Client-supplied prices must be ignored
console.log("\n7. client cannot dictate price");
const underpay = await callable("createSale", {
  ...salePayload,
  idempotencyKey: `smoke-underpay-${Date.now()}`,
  payments: [{ method: "cash", amountMinor: 1 }],
}, idToken);
check("underpayment refused", !underpay.ok, underpay.body.error?.message ?? "");

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
