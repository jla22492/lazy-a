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

const TARGETS = [
  { id: "journal", screen: [840, 525] },
  { id: "contact", screen: [875, 555] },
  { id: "films", screen: [820, 490] },
  { id: "about", screen: [940, 545] },
];

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: "load" });
/* Let the arrival complete and settle. */
await page.waitForTimeout(6000);

const candidate = () => page.evaluate(() => window.__lazyANavCandidate ?? null);

let failures = 0;
for (const target of TARGETS) {
  /* Flyby first: crossing the object must never trigger. */
  await page.mouse.move(100, 600);
  await page.mouse.move(target.screen[0], target.screen[1], { steps: 3 });
  await page.mouse.move(1200, 650, { steps: 3 });
  await page.waitForTimeout(300);
  const flyby = await candidate();
  /* Rest: the physical target engages. */
  await page.mouse.move(target.screen[0], target.screen[1], { steps: 5 });
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
