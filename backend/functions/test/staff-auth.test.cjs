const assert = require("node:assert/strict");
const test = require("node:test");

const { parseStaffPinInput } = require("../lib/modules/staff-auth/input.js");
const {
  derivePinHash,
  PIN_KEY_LENGTH,
} = require("../lib/modules/staff-auth/pin-crypto.js");

test("staff PIN input requires an exact four-digit value", () => {
  assert.deepEqual(
    parseStaffPinInput({ tenantId: "tenant-1", staffId: "staff-1", pin: "0123" }),
    { tenantId: "tenant-1", staffId: "staff-1", pin: "0123" },
  );
  assert.throws(
    () => parseStaffPinInput({ tenantId: "tenant-1", staffId: "staff-1", pin: "12345" }),
    (error) => error.code === "invalid-argument",
  );
});

test("scrypt derives deterministic fixed-length PIN hashes", async () => {
  const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex");
  const first = await derivePinHash("0123", salt);
  const second = await derivePinHash("0123", salt);
  const different = await derivePinHash("9876", salt);

  assert.equal(first.length, PIN_KEY_LENGTH);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, different);
});
