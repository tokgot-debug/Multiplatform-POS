import { expect, test, type Page } from "@playwright/test";

/**
 * Captures every POS screen and compares it to its baseline.
 *
 * Run against the current build to record baselines:
 *   npm run visual:update
 * Run after porting a screen to JSX to prove nothing moved:
 *   npm run visual
 */

// Signed in as the Owner so no module is hidden by role filtering.
const OWNER_ID = "user-owner";
const OWNER_EMAIL = "owner@vanbransa.pos";
const OWNER_UID = "uid-visual-owner";

// Seed records stamp themselves with the current time, so the clock is pinned
// to keep IndexedDB - and therefore every rendered date - identical per run.
const FIXED_TIME = new Date("2026-06-15T09:00:00.000Z");

const SCREENS = [
  "till",
  "orders",
  "shifts",
  "inventory",
  "mpesa",
  "store-stock",
  "house-stock",
  "audit-logs",
  "finance",
  "qrtools",
  "settings",
] as const;

/**
 * An ID token carrying owner claims.
 *
 * The Firebase SDK decodes this locally to read custom claims and never
 * verifies the signature in the browser, so an unsigned token is enough to
 * exercise the real sign-in path. Nothing server-side would accept it.
 */
function harnessIdToken() {
  const issued = Math.floor(FIXED_TIME.getTime() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

  return [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      iss: "https://securetoken.google.com/vanbransa-pos",
      aud: "vanbransa-pos",
      sub: OWNER_UID,
      user_id: OWNER_UID,
      email: OWNER_EMAIL,
      email_verified: true,
      auth_time: issued,
      iat: issued,
      exp: issued + 3600,
      firebase: { identities: { email: [OWNER_EMAIL] }, sign_in_provider: "password" },
      tenant_id: "vanbransa",
      staff_id: OWNER_ID,
      staff_role: "owner",
    }),
    "visual-harness",
  ].join(".");
}

/**
 * Stands in for the auth backend.
 *
 * Sign-in is a real network round trip now, so the harness mocks the provider
 * rather than the app - the component, the form and the claim handling under
 * test are all the production ones.
 */
async function stubBackend(page: Page) {
  const token = harnessIdToken();

  await page.route("**/identitytoolkit.googleapis.com/**", async (route) => {
    const url = route.request().url();
    if (url.includes("signInWithPassword")) {
      await route.fulfill({
        json: {
          kind: "identitytoolkit#VerifyPasswordResponse",
          localId: OWNER_UID,
          email: OWNER_EMAIL,
          displayName: "Vanbransa Owner",
          idToken: token,
          refreshToken: "visual-harness-refresh",
          expiresIn: "3600",
          registered: true,
        },
      });
      return;
    }
    if (url.includes("accounts:lookup")) {
      await route.fulfill({
        json: {
          users: [{
            localId: OWNER_UID,
            email: OWNER_EMAIL,
            displayName: "Vanbransa Owner",
            emailVerified: true,
            disabled: false,
            passwordUpdatedAt: FIXED_TIME.getTime(),
            validSince: String(Math.floor(FIXED_TIME.getTime() / 1000)),
            createdAt: String(FIXED_TIME.getTime()),
            lastLoginAt: String(FIXED_TIME.getTime()),
            providerUserInfo: [{ providerId: "password", federatedId: OWNER_EMAIL, email: OWNER_EMAIL }],
          }],
        },
      });
      return;
    }
    await route.fulfill({ json: {} });
  });

  await page.route("**/securetoken.googleapis.com/**", (route) =>
    route.fulfill({
      json: {
        access_token: token,
        id_token: token,
        refresh_token: "visual-harness-refresh",
        expires_in: "3600",
        token_type: "Bearer",
        user_id: OWNER_UID,
        project_id: "vanbransa-pos",
      },
    }));

  // openShift runs on sign-in; letting it fail would paint an offline toast
  // over whichever screen happened to be capturing at the time.
  await page.route("**/cloudfunctions.net/**", (route) =>
    route.fulfill({ json: { result: { shiftId: "shift-visual", reused: true } } }));

  // Screens read Dexie, never Firestore directly. Refuse the sockets so no
  // listener sits retrying in the background during a capture.
  await page.route("**/firestore.googleapis.com/**", (route) => route.abort());
}

async function unlock(page: Page) {
  await page.clock.setFixedTime(FIXED_TIME);
  await stubBackend(page);
  await page.goto("/till/");

  await expect(page.locator("#signin-email")).toBeVisible({ timeout: 30_000 });
  await page.fill("#signin-email", OWNER_EMAIL);
  await page.fill("#signin-password", "visual-harness-password");
  await page.locator("button[type=submit]").click();

  await expect(page.locator("#pos-shell")).toBeVisible({ timeout: 30_000 });
}

/** Waits for a mounted view to finish painting its content. */
async function waitForScreen(page: Page, tab: string) {
  const section = page.locator(`#view-${tab}`);
  await expect(section).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => (await section.innerHTML()).trim().length, { timeout: 30_000 })
    .toBeGreaterThan(200);
  // Dexie-backed tables populate a tick after the shell renders.
  await page.waitForTimeout(600);
  await page.evaluate(() => document.fonts.ready);
}

test("every POS screen matches its baseline", async ({ page }) => {
  await unlock(page);

  for (const tab of SCREENS) {
    // The sidebar is an accordion with one group open, so a module in another
    // group has to be revealed before it can be clicked.
    const group = page.locator(`.nav-group:has(.sidebar-nav-btn[data-tab="${tab}"])`);
    if (!(await group.getAttribute("class"))?.includes("open")) {
      await group.locator(".nav-group-toggle").click();
    }

    await page.locator(`.sidebar-nav-btn[data-tab="${tab}"]`).click();
    await waitForScreen(page, tab);

    // Soft so one drifting screen does not hide the state of the others.
    await expect.soft(page).toHaveScreenshot(`${tab}.png`, { fullPage: true });
  }
});
