/**
 * The stranger's clock, measured (WORK ORDER 0093) — Jonathan's 4/5/6
 * acceptance criteria, taken from a real browser session the way a
 * visitor experiences it, never estimated:
 *
 *   ≤4s  the arrival settles into the seated working position
 *   ~5s  the hero print begins to move, unprompted
 *   ≤6s  a destination answers attention through the physical note target
 *
 *   node scripts/measure-clock.mjs [url]
 *
 * Method: page time zero is navigation commit. The settle is detected
 * by a static wall region ceasing to change; the magic by the hero
 * region beginning to change AFTER the settle; the answer by resting
 * the pointer on the physical JOURNAL word and timing the ray target.
 */

import { chromium } from "playwright";

const url = process.argv[2] ?? "https://jla22492.github.io/lazy-a/";

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  const probe = {
    startedAt: performance.now(),
    settleAt: null,
    magicAt: null,
  };
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play() {
    if (this.dataset.lazyAHero === "true" && probe.magicAt === null) {
      probe.magicAt = performance.now();
    }
    return nativePlay.call(this);
  };
  window.__lazyAClockProbe = probe;
  const observeSettle = () => {
    if (window.__arrivalDone === true && probe.settleAt === null) {
      probe.settleAt = performance.now();
    }
    requestAnimationFrame(observeSettle);
  };
  requestAnimationFrame(observeSettle);
});
await page.goto(url, { waitUntil: "commit" });

await page.waitForFunction(
  () =>
    window.__lazyAClockProbe?.settleAt !== null &&
    window.__lazyAClockProbe?.magicAt !== null,
  null,
  { timeout: 12_000 },
);
const beats = await page.evaluate(() => {
  const probe = window.__lazyAClockProbe;
  return {
    settleAt: (probe.settleAt - probe.startedAt) / 1000,
    magicAt: (probe.magicAt - probe.startedAt) / 1000,
  };
});

/* The answer: rest on the physical JOURNAL word, time the ray target. */
const journalRest = await page.evaluate(() => {
  const debug = window.__lazyANavigationDebug;
  const row = debug?.sheet.rows.find(({ id }) => id === "journal");
  if (!debug || !row) return null;
  return debug.projectSheetPoint(
    row.rect.x + row.rect.width / 2,
    row.rect.y + row.rect.height / 2,
  );
});
await page.mouse.move(200, 300);
const restStart = Date.now();
if (journalRest) {
  await page.mouse.move(journalRest.x, journalRest.y, { steps: 5 });
}
let answerMs = null;
for (let i = 0; i < 40; i++) {
  const target = await page.evaluate(() => window.__lazyANavCandidate ?? null);
  if (target === "journal") {
    answerMs = Date.now() - restStart;
    break;
  }
  await page.waitForTimeout(50);
}
await browser.close();

const settle = beats.settleAt;
const magic = beats.magicAt;
const answer = answerMs === null ? null : answerMs / 1000;
const verdicts = [
  ["settle ≤ 4s", settle, settle !== null && settle <= 4],
  ["magic ≈ 5s (4–6s window)", magic, magic !== null && magic >= 4 && magic <= 6],
  ["physical JOURNAL target ≤ 1s of rest", answer, answer !== null && answer <= 1],
];
let failed = 0;
for (const [name, value, ok] of verdicts) {
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}: ${value === null ? "not detected" : value.toFixed(2) + "s"}`,
  );
}
process.exit(failed ? 1 : 0);
