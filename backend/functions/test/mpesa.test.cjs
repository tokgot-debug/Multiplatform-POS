const assert = require("node:assert/strict");
const test = require("node:test");

const {
  darajaTimestamp,
  normalizePhone,
  parseResultCode,
  parseStkCallback,
  stkPassword,
} = require("../lib/modules/mpesa/daraja.js");

function callback(overrides = {}) {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "29115-34620561-1",
        CheckoutRequestID: "ws_CO_191220191020363925",
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: 1500 },
            { Name: "MpesaReceiptNumber", Value: "NLJ7RT61SV" },
            { Name: "TransactionDate", Value: 20191219102115 },
            { Name: "PhoneNumber", Value: 254708374149 },
          ],
        },
        ...overrides,
      },
    },
  };
}

test("normalizePhone accepts every format a cashier types", () => {
  for (const raw of ["0712345678", "254712345678", "+254 712 345 678", "712345678"]) {
    assert.equal(normalizePhone(raw), "254712345678");
  }

  assert.equal(normalizePhone("0112345678"), "254112345678");
});

test("normalizePhone rejects anything Safaricom would not route", () => {
  for (const raw of ["", "0812345678", "07123456789", "0712345", "not a phone", 712345678]) {
    assert.throws(() => normalizePhone(raw), /07XXXXXXXX/);
  }
});

test("darajaTimestamp stamps Nairobi time in Daraja's format", () => {
  assert.equal(darajaTimestamp(new Date("2026-09-01T09:34:56.000Z")), "20260901123456");
});

test("stkPassword is base64 of shortcode + passkey + timestamp", () => {
  const password = stkPassword("174379", "bfb279f9aa9b", "20260901123456");
  assert.equal(
    Buffer.from(password, "base64").toString("utf8"),
    "174379bfb279f9aa9b20260901123456",
  );
});

test("parseStkCallback reads a paid push into minor units", () => {
  const parsed = parseStkCallback(callback());

  assert.equal(parsed.checkoutRequestId, "ws_CO_191220191020363925");
  assert.equal(parsed.resultCode, 0);
  assert.equal(parsed.receipt, "NLJ7RT61SV");
  assert.equal(parsed.amountMinor, 150_000);
  assert.equal(parsed.phone, "254708374149");
});

test("parseStkCallback survives a cancelled push carrying no metadata", () => {
  const cancelled = callback({
    ResultCode: 1032,
    ResultDesc: "Request cancelled by user",
    CallbackMetadata: undefined,
  });

  const parsed = parseStkCallback(cancelled);

  assert.equal(parsed.resultCode, 1032);
  assert.equal(parsed.receipt, null);
  assert.equal(parsed.amountMinor, null);
  assert.equal(parsed.phone, null);
});

test("parseStkCallback returns null for anything that is not a callback", () => {
  for (const body of [null, undefined, "", {}, { Body: {} }, { Body: { stkCallback: {} } }]) {
    assert.equal(parseStkCallback(body), null);
  }
});

test("parseResultCode reads both wire formats", () => {
  assert.equal(parseResultCode(0), 0);
  assert.equal(parseResultCode(1032), 1032);
  assert.equal(parseResultCode("0"), 0);
  assert.equal(parseResultCode("1032"), 1032);
});

test("parseResultCode never turns an unreadable code into a paid sale", () => {
  // Number("") and Number(null) are both 0, and 0 means paid. Anything that
  // is not an actual code must come back null so the payment stays pending.
  for (const value of ["", "   ", null, undefined, {}, [], "abc", NaN, Infinity]) {
    assert.equal(parseResultCode(value), null, `${JSON.stringify(value)} must not read as a result code`);
  }
});
