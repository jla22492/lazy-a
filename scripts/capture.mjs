/**
 * The screen-capture pipeline (WORK ORDER 0091, built during 0090's
 * verification) — review media that shows what visitors see.
 *
 * The room's own ?record pipeline films the CANVAS: it cannot see the
 * HTML interface layer (wordmark, labels, captions), which is exactly
 * the layer Sprint 04/05 built. This script drives a real browser
 * (Playwright over the installed Google Chrome, so h264 video textures
 * decode) and captures the COMPOSITED page — canvas and HTML together.
 *
 *   node scripts/capture.mjs still <url> <out.png> [--wait 6] [--size 1280x720]
 *   node scripts/capture.mjs film  <url> <out.webm> [--seconds 8] [--wait 0] [--size 1280x720]
 *
 * Films record via Playwright's built-in page video (webm); convert to
 * mp4 with ffmpeg where a review surface needs it. The page is given
 * real wall-clock time — the room clock, the arrival, and the video
 * textures all run exactly as they do for a visitor.
 */

import { chromium } from "playwright";

const [, , mode, url, out, ...rest] = process.argv;

function flag(name, fallback) {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 ? rest[index + 1] : fallback;
}

const waitSeconds = Number(flag("wait", mode === "still" ? 6 : 0));
const filmSeconds = Number(flag("seconds", 8));
const [width, height] = flag("size", "1280x720").split("x").map(Number);

if (!mode || !url || !out) {
  console.error("usage: capture.mjs still|film <url> <outfile> [flags]");
  process.exit(1);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

const context = await browser.newContext({
  viewport: { width, height },
  ...(mode === "film"
    ? { recordVideo: { dir: ".", size: { width, height } } }
    : {}),
});

const page = await context.newPage();
await page.goto(url, { waitUntil: "load" });
/* The room needs real time: the arrival, the leans, the film prints. */
await page.waitForTimeout(waitSeconds * 1000);

if (mode === "still") {
  await page.screenshot({ path: out });
  await browser.close();
  console.log(`still: ${out}`);
} else {
  await page.waitForTimeout(filmSeconds * 1000);
  await context.close();
  const video = page.video();
  if (video) await video.saveAs(out);
  await browser.close();
  console.log(`film: ${out}`);
}
