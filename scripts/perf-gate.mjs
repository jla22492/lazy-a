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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

let transferred = 0;
page.on("response", async (response) => {
  try {
    const sizes = await response.request().sizes();
    transferred += sizes.responseBodySize + sizes.responseHeadersSize;
  } catch {
    /* sizes unavailable for some responses (cache, data URLs) — skip */
  }
});

await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(4000); // the settle deadline
const preSettle = transferred;
await page.waitForTimeout(6000); // the magic window streams the rest

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

await browser.close();

const preMb = preSettle / (1024 * 1024);
const totalMb = transferred / (1024 * 1024);
const fpsOk = fps >= FPS_FLOOR;
const preOk = preMb <= PRESETTLE_BUDGET_MB;
const totalOk = totalMb <= TOTAL_CEILING_MB;
console.log(`${fpsOk ? "PASS" : "FAIL"} fps: median ${fps.toFixed(1)} (floor ${FPS_FLOOR})`);
console.log(`${preOk ? "PASS" : "FAIL"} pre-settle transfer: ${preMb.toFixed(2)}MB (budget ${PRESETTLE_BUDGET_MB}MB)`);
console.log(`${totalOk ? "PASS" : "FAIL"} total streamed: ${totalMb.toFixed(2)}MB (ceiling ${TOTAL_CEILING_MB}MB)`);
process.exit(fpsOk && preOk && totalOk ? 0 : 1);
