/**
 * Behavioral verification for attention navigation (0075/0090/0117): a real
 * pointer rests on each destination's physical production-note word; the
 * ray target must engage on rest and clear after release. Exercises the
 * exact code path a visitor uses — not the ?talk capture aid.
 *   node scripts/verify-dwell.mjs <url> [outPrefix]
 */

import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/";
const outPrefix = process.argv[3] ?? "";

const TARGETS = ["journal", "contact", "films", "about"];

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => window.__arrivalDone === true, null, {
  timeout: 12_000,
});

const projectedTargets = await page.evaluate((ids) => {
  const debug = window.__lazyANavigationDebug;
  if (!debug) return [];
  return ids.flatMap((id) => {
    const row = debug.sheet.rows.find(({ id: rowId }) => rowId === id);
    if (!row) return [];
    const screen = debug.projectSheetPoint(
      row.rect.x + row.rect.width / 2,
      row.rect.y + row.rect.height / 2,
    );
    return [{ id, screen }];
  });
}, TARGETS);

const candidate = () => page.evaluate(() => window.__lazyANavCandidate ?? null);

let failures = 0;
for (const target of projectedTargets) {
  /* Flyby first: crossing the object must never trigger. */
  await page.mouse.move(100, 600);
  await page.mouse.move(target.screen.x, target.screen.y, { steps: 3 });
  await page.mouse.move(1200, 650, { steps: 3 });
  await page.waitForTimeout(300);
  const flyby = await candidate();
  /* Rest: the physical target engages. */
  await page.mouse.move(target.screen.x, target.screen.y, { steps: 5 });
  await page.waitForTimeout(300);
  const rested = await candidate();
  if (outPrefix) {
    await page.screenshot({ path: `${outPrefix}dwell-${target.id}.png` });
  }
  /* Release: look away, the physical target clears. */
  await page.mouse.move(100, 650, { steps: 5 });
  await page.waitForTimeout(300);
  const released = await candidate();
  const pass = flyby === null && rested === target.id && released === null;
  if (!pass) failures += 1;
  console.log(
    `${pass ? "PASS" : "FAIL"} ${target.id}: flyby=${flyby} rested=${rested} released=${released}`,
  );
}
await browser.close();
process.exit(failures ? 1 : 0);
