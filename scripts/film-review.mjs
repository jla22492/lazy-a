/**
 * Record the complete responsive review journey in a real Chrome browser.
 *
 *   node scripts/film-review.mjs [url] [out.webm] [--size 1280x720]
 *   node scripts/film-review.mjs --url <url> --output <out.webm> --size 375x812
 */

import { chromium } from "playwright";

const DESTINATIONS = ["films", "journal", "contact", "about"];
const ARRIVAL_TIMEOUT_MS = 12_000;
const TRANSITION_TIMEOUT_MS = 8_000;
const HERO_TIMEOUT_MS = 15_000;
const FINAL_HOLD_MS = 1_200;

function usage(message, exitCode = 1) {
  if (message) console.error(message);
  console.error(
    "usage: film-review.mjs [url] [outfile] [--url URL] [--output FILE] [--size WIDTHxHEIGHT]",
  );
  process.exit(exitCode);
}

function parseArgs(args) {
  const options = {};
  const positional = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") usage(undefined, 0);
    if (argument.startsWith("--")) {
      const name = argument.slice(2);
      if (!["url", "out", "output", "size"].includes(name)) {
        usage(`unknown option: ${argument}`);
      }
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        usage(`missing value for ${argument}`);
      }
      options[name] = value;
      index += 1;
    } else {
      positional.push(argument);
    }
  }

  if (positional.length > 2) usage("too many positional arguments");
  const size = options.size ?? "1280x720";
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) usage(`invalid size: ${size}`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width <= 0 || height <= 0) usage(`invalid size: ${size}`);

  return {
    url: options.url ?? positional[0] ?? "http://localhost:3000/",
    out: options.output ?? options.out ?? positional[1] ?? "review.webm",
    width,
    height,
  };
}

const { url, out, width, height } = parseArgs(process.argv.slice(2));
const startedAt = Date.now();

function beat(name, detail = "") {
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log(`beat ${elapsed}s ${name}${detail ? `: ${detail}` : ""}`);
}

async function waitForRestingEndpoint(page, endpoint) {
  await page.waitForFunction(
    (id) => {
      const camera = window.__lazyACameraDebug?.snapshot?.();
      return (
        window.__lazyAPlateState?.state === `resting:${id}` &&
        camera?.phase === "resting" &&
        camera?.endpoint === id
      );
    },
    endpoint,
    { timeout: TRANSITION_TIMEOUT_MS },
  );
}

async function heroState(page) {
  return page.evaluate(() => {
    const video = window.__lazyAReviewVideos?.find(
      (candidate) => candidate.dataset.lazyAHero === "true",
    );
    return video instanceof HTMLVideoElement
      ? {
          currentTime: video.currentTime,
          duration: video.duration,
          ended: video.ended,
          paused: video.paused,
        }
      : null;
  });
}

async function requireHeroPlaying(page, beatName) {
  const state = await heroState(page);
  if (!state || state.paused || state.ended || state.currentTime <= 0) {
    throw new Error(
      `${beatName} did not occur during hero playback: ${JSON.stringify(state)}`,
    );
  }
  return state;
}

async function navigationRowCenter(page, destination) {
  const point = await page.evaluate((id) => {
    const debug = window.__lazyANavigationDebug;
    const row = debug?.sheet.rows.find(({ id: rowId }) => rowId === id);
    if (!debug || !row) return null;
    return debug.projectSheetPoint(
      row.rect.x + row.rect.width / 2,
      row.rect.y + row.rect.height / 2,
    );
  }, destination);
  if (!point) throw new Error(`authored ${destination} row is unavailable`);
  return point;
}

async function visit(page, destination) {
  const point = await navigationRowCenter(page, destination);
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.waitForTimeout(80);
  await requireHeroPlaying(page, `${destination} hover`);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(
    (id) => window.__lazyAConversation === id,
    destination,
    { timeout: TRANSITION_TIMEOUT_MS },
  );
  await waitForRestingEndpoint(page, destination);
  const opened = await requireHeroPlaying(page, destination);
  beat(
    destination,
    `row center (${point.x.toFixed(1)}, ${point.y.toFixed(1)}), hero ${opened.currentTime.toFixed(2)}s`,
  );

  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => (window.__lazyAConversation ?? null) === null,
    null,
    { timeout: TRANSITION_TIMEOUT_MS },
  );
  await waitForRestingEndpoint(page, "desk");
  const returned = await requireHeroPlaying(page, `${destination} desk return`);
  beat("desk", `from ${destination}, hero ${returned.currentTime.toFixed(2)}s`);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

let context;
try {
  context = await browser.newContext({
    viewport: { width, height },
    recordVideo: { dir: ".", size: { width, height } },
  });
  const page = await context.newPage();
  const video = page.video();

  await page.addInitScript(() => {
    const videos = [];
    const nativeCreateElement = Document.prototype.createElement;
    Document.prototype.createElement = function createElement(
      localName,
      options,
    ) {
      const element = nativeCreateElement.call(this, localName, options);
      if (element instanceof HTMLVideoElement) videos.push(element);
      return element;
    };
    Object.defineProperty(window, "__lazyAReviewVideos", {
      configurable: false,
      value: videos,
    });
  });

  await page.goto(url, { waitUntil: "load" });
  beat("arrival", `${width}x${height}`);
  await page.waitForFunction(() => window.__arrivalDone === true, null, {
    timeout: ARRIVAL_TIMEOUT_MS,
  });
  await waitForRestingEndpoint(page, "desk");
  beat("settle", "resting:desk");

  await page.waitForFunction(
    () => {
      const hero = window.__lazyAReviewVideos?.find(
        (candidate) => candidate.dataset.lazyAHero === "true",
      );
      return (
        hero instanceof HTMLVideoElement &&
        !hero.paused &&
        !hero.ended &&
        hero.currentTime > 0
      );
    },
    null,
    { timeout: HERO_TIMEOUT_MS },
  );
  beat("hero-start");

  for (const destination of DESTINATIONS) await visit(page, destination);

  await page.waitForFunction(
    () => {
      const hero = window.__lazyAReviewVideos?.find(
        (candidate) => candidate.dataset.lazyAHero === "true",
      );
      return hero instanceof HTMLVideoElement && hero.ended;
    },
    null,
    { timeout: HERO_TIMEOUT_MS },
  );
  const ended = await heroState(page);
  beat("hero-end", `${ended.currentTime.toFixed(2)}s`);
  await page.waitForTimeout(FINAL_HOLD_MS);
  const held = await heroState(page);
  if (
    !held?.ended ||
    !held.paused ||
    !Number.isFinite(held.duration) ||
    held.duration - held.currentTime > 0.15
  ) {
    throw new Error(
      `hero did not hold its final frame: ${JSON.stringify(held)}`,
    );
  }
  beat("final-hold", `${FINAL_HOLD_MS}ms at ${held.currentTime.toFixed(2)}s`);

  await context.close();
  context = null;
  if (!video) throw new Error("Playwright did not create a review film");
  await video.saveAs(out);
  console.log(`film: ${out}`);
} finally {
  if (context) await context.close().catch(() => {});
  await browser.close();
}
