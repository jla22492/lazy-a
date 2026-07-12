/**
 * Behavioral verification for attention navigation (0075/0090): a real
 * pointer rests on each destination's object; the label must appear
 * after the dwell and fade after release. Exercises the exact code path
 * a visitor uses — not the ?talk capture aid.
 *   node scripts/verify-dwell.mjs <url> [outPrefix]
 */

import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/";
const outPrefix = process.argv[3] ?? "";

const TARGETS = [
  { id: "journal", label: "JOURNAL", screen: [994, 638] },
  { id: "contact", label: "CONTACT", screen: [1105, 553] },
  { id: "films", label: "FILMS", screen: [609, 481] },
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

const labelOpacity = (label) =>
  page.evaluate((text) => {
    const nodes = [...document.querySelectorAll("div")].filter(
      (n) => n.textContent === text && n.children.length === 0,
    );
    if (!nodes.length) return null;
    return Number(getComputedStyle(nodes[0]).opacity);
  }, label);

let failures = 0;
for (const target of TARGETS) {
  /* Flyby first: crossing the object must never trigger. */
  await page.mouse.move(100, 600);
  await page.mouse.move(target.screen[0], target.screen[1], { steps: 3 });
  await page.mouse.move(1200, 650, { steps: 3 });
  await page.waitForTimeout(300);
  const flyby = await labelOpacity(target.label);
  /* Rest: the label appears after the dwell. */
  await page.mouse.move(target.screen[0], target.screen[1], { steps: 5 });
  await page.waitForTimeout(1100);
  const rested = await labelOpacity(target.label);
  if (outPrefix) {
    await page.screenshot({ path: `${outPrefix}dwell-${target.id}.png` });
  }
  /* Release: look away, the label fades. */
  await page.mouse.move(100, 650, { steps: 5 });
  await page.waitForTimeout(1200);
  const released = await labelOpacity(target.label);
  const pass = flyby === 0 && rested === 1 && released === 0;
  if (!pass) failures += 1;
  console.log(
    `${pass ? "PASS" : "FAIL"} ${target.id}: flyby=${flyby} rested=${rested} released=${released}`,
  );
}
await browser.close();
process.exit(failures ? 1 : 0);
