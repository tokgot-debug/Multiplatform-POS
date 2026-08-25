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
const OWNER_PIN = "0000";

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
  "users",
  "audit-logs",
  "finance",
  "qrtools",
  "settings",
] as const;

async function unlock(page: Page) {
  await page.clock.setFixedTime(FIXED_TIME);
  await page.goto("/till/");

  const select = page.locator("#pin-user-select");
  await expect(select).toBeVisible({ timeout: 30_000 });
  // The dropdown is populated from IndexedDB after seeding completes.
  await expect(select.locator(`option[value="${OWNER_ID}"]`)).toHaveCount(1, { timeout: 30_000 });
  await select.selectOption(OWNER_ID);

  for (const digit of OWNER_PIN) {
    await page.locator(".numpad-btn", { hasText: new RegExp(`^${digit}$`) }).first().click();
  }
  await page.locator("#numpad-ok").click();

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
    await page.locator(`.sidebar-nav-btn[data-tab="${tab}"]`).click();
    await waitForScreen(page, tab);

    // Soft so one drifting screen does not hide the state of the others.
    await expect.soft(page).toHaveScreenshot(`${tab}.png`, { fullPage: true });
  }
});
