/**
 * Work Order 0117 behavioral gate: navigation must come from the physical
 * production note, not floating website labels.
 *
 * Usage:
 *   node scripts/verify-physical-navigation.mjs [url]
 */

import { chromium } from "playwright";

const url = process.argv[2] ?? "https://jla22492.github.io/lazy-a/";

const TARGETS = [
  { id: "films", screen: [820, 490] },
  { id: "journal", screen: [840, 525] },
  { id: "contact", screen: [875, 555] },
  { id: "about", screen: [940, 545] },
];

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

const closeBrowser = () =>
  Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(4600);

const floatingLabels = await page.evaluate(() => {
  const labels = new Set(["FILMS", "JOURNAL", "CONTACT", "ABOUT"]);
  return [...document.querySelectorAll("div")]
    .filter((node) => labels.has(node.textContent?.trim() ?? ""))
    .map((node) => node.textContent?.trim());
});

let failed = 0;
if (floatingLabels.length > 0) {
  failed += 1;
  console.log(
    `FAIL floating website labels remain in DOM: ${floatingLabels.join(", ")}`,
  );
} else {
  console.log("PASS no floating website labels remain in DOM");
}

await page.close();

for (const target of TARGETS) {
  const targetPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await targetPage.goto(url, { waitUntil: "load" });
  await targetPage.waitForTimeout(4600);
  const [x, y] = target.screen;
  await targetPage.mouse.move(x, y, { steps: 8 });
  await targetPage.waitForTimeout(300);
  await targetPage.mouse.click(x, y);
  await targetPage.waitForTimeout(500);
  const conversation = await targetPage.evaluate(
    () => window.__lazyAConversation ?? null,
  );
  if (conversation !== target.id) {
    failed += 1;
    console.log(
      `FAIL ${target.id}: expected conversation ${target.id}, got ${conversation}`,
    );
  } else {
    console.log(`PASS ${target.id}: physical note click opens conversation`);
  }
  await targetPage.close();
}

await closeBrowser();
process.exit(failed ? 1 : 0);
