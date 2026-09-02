/**
 * Registers the C2B Validation and Confirmation URLs for a shortcode.
 *
 * This is for customers who pay the Paybill/Till directly from their own phone
 * instead of being sent an STK push. It is a one-shot per shortcode in
 * practice: changing a registered URL afterwards means a Safaricom support
 * ticket, so never point it at a tunnel.
 *
 * ValidationURL is only ever called if Safaricom has enabled external
 * validation on the shortcode. Registering it does nothing on its own.
 *
 * Usage (PowerShell):
 *   $env:MPESA_BASE_URL = "https://sandbox.safaricom.co.ke"
 *   $env:MPESA_CONSUMER_KEY = "..."
 *   $env:MPESA_CONSUMER_SECRET = "..."
 *   $env:MPESA_SHORTCODE = "..."
 *   $env:MPESA_CALLBACK_URL = "https://<c2b endpoint>"
 *   node scripts/register-mpesa-c2b.mjs
 */

const required = [
  "MPESA_BASE_URL",
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_SHORTCODE",
  "MPESA_CALLBACK_URL",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Set these first: ${missing.join(", ")}`);
  process.exit(1);
}

const base = process.env.MPESA_BASE_URL.replace(/\/$/, "");

async function darajaJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  if (!response.ok) {
    console.error(`${response.status} from ${url}\n${text}`);
    process.exit(1);
  }

  return JSON.parse(text);
}

const basic = Buffer.from(
  `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`,
).toString("base64");

const { access_token: token } = await darajaJson(
  `${base}/oauth/v1/generate?grant_type=client_credentials`,
  { headers: { Authorization: `Basic ${basic}` } },
);

const result = await darajaJson(`${base}/mpesa/c2b/v1/registerurl`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    ShortCode: process.env.MPESA_SHORTCODE,
    // "Completed" pays the customer even when our validation endpoint is down.
    // "Cancelled" would reject those payments instead.
    ResponseType: "Completed",
    ConfirmationURL: process.env.MPESA_CALLBACK_URL,
    ValidationURL: process.env.MPESA_CALLBACK_URL,
  }),
});

console.log(JSON.stringify(result, null, 2));
