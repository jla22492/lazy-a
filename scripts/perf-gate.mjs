/**
 * The performance gate (WORK ORDER 0093) — 60fps and fast load are
 * non-negotiable (Jonathan's budget rule), so they are CHECKS, not
 * principles. Run against any URL; exits non-zero on failure.
 *
 *   node scripts/perf-gate.mjs [url] [--fps 55] [--budget-mb 8]
 *
 * FPS is measured over 10 seconds of the settled room (median frame
 * rate from requestAnimationFrame deltas — median, so the arrival's
 * work and GC blips don't fail an otherwise-solid room). Transfer is
 * everything the page fetched to first settle, compressed bytes.
 */

import { chromium } from "playwright";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--")) ?? "https://jla22492.github.io/lazy-a/";
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const FPS_FLOOR = flag("fps", 55);
/* The clock's guard: what may load BEFORE the settle (0104). */
const PRESETTLE_BUDGET_MB = flag("budget-mb", 3);
/* Informational ceiling for everything the room ever streams. */
const TOTAL_CEILING_MB = flag("total-mb", 20);

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

const startedAt = Date.now();
const transfers = [];
const pendingSizes = new Set();
page.on("response", async (response) => {
  const record = { at: Date.now() - startedAt, url: response.url(), bytes: 0 };
  const pending = response
    .request()
    .sizes()
    .then((sizes) => {
      record.bytes = sizes.responseBodySize + sizes.responseHeadersSize;
      transfers.push(record);
    })
    .catch(() => {
      /* sizes unavailable for some responses (cache, data URLs) — skip */
    });
  pendingSizes.add(pending);
  void pending.finally(() => pendingSizes.delete(pending));
});

await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => window.__arrivalDone === true, null, {
  timeout: 12_000,
});
const settleAt = Date.now() - startedAt;
await page.waitForTimeout(6000); // destination warm-up and the magic window

const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const deltas = [];
      let last = performance.now();
      const loop = (now) => {
        deltas.push(now - last);
        last = now;
        if (deltas.length >= 600) {
          deltas.sort((a, b) => a - b);
          resolve(1000 / deltas[Math.floor(deltas.length / 2)]);
          return;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }),
);

await Promise.allSettled([...pendingSizes]);
const preSettle = transfers
  .filter(({ at }) => at <= settleAt)
  .reduce((total, { bytes }) => total + bytes, 0);
const transferred = transfers.reduce((total, { bytes }) => total + bytes, 0);
const preMb = preSettle / (1024 * 1024);
const totalMb = transferred / (1024 * 1024);
// A nominal 60Hz display reports just below 60 because rAF timestamps include
// scheduling jitter. Rounding rejects a real 59.4fps regression while treating
// 59.9fps as the intended 60Hz cadence.
const fpsOk = Math.round(fps) >= FPS_FLOOR;
const preOk = preMb <= PRESETTLE_BUDGET_MB;
const totalOk = totalMb <= TOTAL_CEILING_MB;
const reverseArrivalPreloaded = transfers.some(({ url: assetUrl }) =>
  /\/room\/[^/]+\/transitions\/desk-opening\.mp4(?:[?#]|$)/.test(assetUrl),
);
console.log(`${fpsOk ? "PASS" : "FAIL"} fps: median ${fps.toFixed(1)} (floor ${FPS_FLOOR})`);
console.log(`${preOk ? "PASS" : "FAIL"} pre-settle transfer: ${preMb.toFixed(2)}MB (budget ${PRESETTLE_BUDGET_MB}MB)`);
console.log(`${totalOk ? "PASS" : "FAIL"} total streamed: ${totalMb.toFixed(2)}MB (ceiling ${TOTAL_CEILING_MB}MB)`);
console.log(
  `${reverseArrivalPreloaded ? "FAIL" : "PASS"} reverse-arrival preload: ${reverseArrivalPreloaded ? "desk-opening.mp4 was fetched" : "not fetched"}`,
);
await closeBrowser();
process.exit(fpsOk && preOk && totalOk && !reverseArrivalPreloaded ? 0 : 1);
