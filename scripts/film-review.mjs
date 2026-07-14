/**
 * The review film (WORK ORDER 0091) — what a visitor actually sees.
 *
 * Records the composited page while a scripted pointer performs the visit:
 * arrive, rest on the physical production-note words, choose JOURNAL,
 * FILMS, CONTACT, and ABOUT. The canvas ?record pipeline cannot see every
 * browser-level beat — this is the pipeline that can.
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
  films: [820, 490],
  journal: [840, 525],
  contact: [875, 555],
  about: [940, 545],
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

/* The arrival: walk, sit, settle (~4s) — then the magic window
   (WO 0092, Jonathan's ruling): the settled frame rests untouched for
   a full 15 seconds while the hero print plays, before any visiting. */
await page.waitForTimeout(4000 + 15000);

async function visit(name, holdMs) {
  const [x, y] = REST[name];
  await page.mouse.move(x, y, { steps: 20 });
  /* A short rest proves the physical ray target is live before clicking. */
  await page.waitForTimeout(450);
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
await visit("about", 2600);

/* A final beat of rest. */
await page.waitForTimeout(1200);

await context.close();
const video = page.video();
if (video) await video.saveAs(out);
await browser.close();
console.log(`film: ${out}`);
