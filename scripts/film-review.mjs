/**
 * The review film (WORK ORDER 0091) — what a visitor actually sees.
 *
 * Records the composited page (canvas AND the HTML interface layer —
 * wordmark, labels, captions, the illuminated journal) while a scripted
 * pointer performs the visit: arrive, rest on the notebook, choose
 * JOURNAL, read, release; rest on the prints, choose FILMS; rest on the
 * charger, choose CONTACT. The canvas ?record pipeline cannot see any
 * of the HTML beats — this is the pipeline that can.
 *
 *   node scripts/film-review.mjs <url> <out.webm> [--size 1280x720]
 */

import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/";
const out = process.argv[3] ?? "review.webm";
const sizeFlagIndex = process.argv.indexOf("--size");
const [width, height] = (
  sizeFlagIndex >= 0 ? process.argv[sizeFlagIndex + 1] : "1280x720"
)
  .split("x")
  .map(Number);

/** Screen positions of the destinations in the settled seated frame. */
const REST = {
  journal: [1138, 528],
  films: [463, 204],
  contact: [1157, 284],
};
/** Empty desk, for ending conversations with a click away. */
const AWAY = [200, 620];

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({
  viewport: { width, height },
  recordVideo: { dir: ".", size: { width, height } },
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "load" });

/* The arrival: walk, sit, settle (~4s), plus a breath. */
await page.waitForTimeout(5200);

async function visit(name, holdMs) {
  const [x, y] = REST[name];
  await page.mouse.move(x, y, { steps: 20 });
  /* The dwell: the label appears, and is given a beat to be read. */
  await page.waitForTimeout(1400);
  await page.mouse.click(x, y);
  /* The lean, the content, the reading. */
  await page.waitForTimeout(holdMs);
  /* A click on empty space ends the conversation. */
  await page.mouse.click(AWAY[0], AWAY[1]);
  await page.waitForTimeout(1500);
}

/* JOURNAL gets the longest read: the words are the point. */
await visit("journal", 3600);
await visit("films", 2800);
await visit("contact", 2400);

/* A final beat of rest. */
await page.waitForTimeout(1200);

await context.close();
const video = page.video();
if (video) await video.saveAs(out);
await browser.close();
console.log(`film: ${out}`);
