/**
 * Work Order 0117-R CONTACT material-reveal gate.
 *
 * The page must expose this diagnostic marker on every animation frame.
 * Missing observability is a failure:
 *
 *   window.__lazyAContactReveal = {
 *     phase: "idle" | "revealing" | "hold" | "reversing",
 *     mechanism: "raking-light",
 *     lampLevel: number,             // 0..1
 *     revealLevel: number,           // 0..1
 *     paperOpacity: number,          // fixed across every phase
 *     standalonePlaneCount: number,  // CONTACT/email planes; must be 0
 *   };
 *
 * Usage:
 *   node scripts/verify-contact-reveal.mjs [url] [--out-dir path]
 */

import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { chromium } from "playwright";

const args = process.argv.slice(2);
const baseUrl =
  args.find((argument) => !argument.startsWith("--")) ??
  "http://localhost:3000/";
const outDirIndex = args.indexOf("--out-dir");
const outDir = resolve(
  outDirIndex >= 0
    ? args[outDirIndex + 1]
    : `${tmpdir()}/lazy-a-0117-r-contact`,
);
const viewport = { width: 1280, height: 720 };
const SAMPLE_INTERVAL_MS = 100;

function withContactRequest(url) {
  const target = new URL(url);
  target.searchParams.set("talk", "contact");
  return target.href;
}

function inspectContact() {
  const marker = window.__lazyAContactReveal ?? null;
  const visible = (element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) > 0 &&
      bounds.width > 0 &&
      bounds.height > 0
    );
  };
  const standaloneDomPlanes = [
    ...document.querySelectorAll(
      '[data-contact-plane="true"], [data-email-plane="true"], [data-contact-overlay="true"]',
    ),
  ]
    .filter(visible)
    .map((element) => element.outerHTML.slice(0, 180));
  return {
    at: performance.now(),
    endpoint: window.__lazyAEndpoint ?? window.__lazyAConversation ?? null,
    marker,
    standaloneDomPlanes,
  };
}

function isFiniteLevel(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function longestTrueDuration(samples, predicate) {
  let longest = 0;
  let startedAt = null;
  for (const sample of samples) {
    if (predicate(sample)) {
      if (startedAt === null) startedAt = sample.at;
      longest = Math.max(longest, sample.at - startedAt);
    } else {
      startedAt = null;
    }
  }
  return longest;
}

async function collect(page, durationMs, onSample) {
  const samples = [];
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    const sample = await page.evaluate(inspectContact);
    samples.push(sample);
    if (onSample) await onSample(sample);
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }
  return samples;
}

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

const evidence = {
  rest: resolve(outDir, "contact-rest.png"),
  mid: resolve(outDir, "contact-reveal-mid.png"),
  hold: resolve(outDir, "contact-hold.png"),
  reversed: resolve(outDir, "contact-reversed.png"),
};

let restSample;
let riseSamples = [];
let reverseSamples = [];
try {
  const restPage = await browser.newPage({ viewport });
  await restPage.goto(baseUrl, { waitUntil: "load" });
  await restPage.waitForTimeout(4800);
  restSample = await restPage.evaluate(inspectContact);
  await restPage.screenshot({ path: evidence.rest });
  await restPage.close();

  const page = await browser.newPage({ viewport });
  await page.goto(withContactRequest(baseUrl), { waitUntil: "load" });
  let midCaptured = false;
  riseSamples = await collect(page, 7000, async (sample) => {
    const revealLevel = sample.marker?.revealLevel;
    if (
      !midCaptured &&
      isFiniteLevel(revealLevel) &&
      revealLevel >= 0.25 &&
      revealLevel <= 0.75
    ) {
      midCaptured = true;
      await page.screenshot({ path: evidence.mid });
    }
  });
  if (!midCaptured) await page.screenshot({ path: evidence.mid });
  await page.screenshot({ path: evidence.hold });

  await page.keyboard.press("Escape");
  reverseSamples = await collect(page, 1800);
  await page.screenshot({ path: evidence.reversed });
  await page.close();
} finally {
  await browser.close();
}

const allSamples = [restSample, ...riseSamples, ...reverseSamples].filter(
  Boolean,
);
const markerSamples = allSamples.filter(
  (sample) => sample.marker && typeof sample.marker === "object",
);
const failures = [];
const passes = [];

if (markerSamples.length !== allSamples.length || markerSamples.length === 0) {
  failures.push(
    `window.__lazyAContactReveal missing in ${allSamples.length - markerSamples.length}/${allSamples.length} samples`,
  );
} else {
  passes.push(
    `CONTACT diagnostics present in all ${allSamples.length} samples`,
  );
}

const malformed = markerSamples.filter(
  ({ marker }) =>
    !["idle", "revealing", "hold", "reversing"].includes(marker.phase) ||
    marker.mechanism !== "raking-light" ||
    !isFiniteLevel(marker.lampLevel) ||
    !isFiniteLevel(marker.revealLevel) ||
    !isFiniteLevel(marker.paperOpacity) ||
    !Number.isInteger(marker.standalonePlaneCount),
);
if (markerSamples.length === 0 || malformed.length > 0) {
  failures.push(
    `CONTACT diagnostic shape invalid in ${malformed.length || "all"} observed sample(s)`,
  );
} else {
  passes.push(
    "CONTACT diagnostics identify raking-light levels, paper opacity, phase, and plane count",
  );
}

const standaloneDiagnostic = markerSamples.some(
  ({ marker }) => marker.standalonePlaneCount !== 0,
);
const standaloneDom = allSamples.flatMap(
  (sample) => sample.standaloneDomPlanes,
);
if (
  markerSamples.length === 0 ||
  standaloneDiagnostic ||
  standaloneDom.length > 0
) {
  failures.push(
    `standalone CONTACT/email plane check failed (diagnostic=${standaloneDiagnostic}, DOM=${standaloneDom.length})`,
  );
} else {
  passes.push(
    "no standalone CONTACT/email plane reported or visible in the DOM",
  );
}

const opacities = markerSamples
  .map(({ marker }) => marker.paperOpacity)
  .filter(isFiniteLevel);
const opacitySpread =
  opacities.length > 0
    ? Math.max(...opacities) - Math.min(...opacities)
    : Infinity;
if (opacitySpread > 0.001) {
  failures.push(
    `paper opacity changed across reveal phases (spread=${opacitySpread.toFixed(4)})`,
  );
} else {
  passes.push(
    `paper opacity stayed fixed (spread=${opacitySpread.toFixed(4)})`,
  );
}

const validRise = riseSamples.filter(
  ({ marker }) =>
    marker &&
    isFiniteLevel(marker.lampLevel) &&
    isFiniteLevel(marker.revealLevel),
);
const riseLamp = validRise.map(({ marker }) => marker.lampLevel);
const riseReveal = validRise.map(({ marker }) => marker.revealLevel);
const hasIntermediate = validRise.some(
  ({ marker }) =>
    marker.lampLevel > 0.05 &&
    marker.lampLevel < 0.95 &&
    marker.revealLevel > 0.05 &&
    marker.revealLevel < 0.95,
);
const rose =
  riseLamp.length > 1 &&
  Math.max(...riseLamp) - Math.min(...riseLamp) >= 0.75 &&
  Math.max(...riseReveal) - Math.min(...riseReveal) >= 0.75 &&
  hasIntermediate;
if (!rose) {
  failures.push(
    "lamp/reveal progression did not observably rise through an intermediate state",
  );
} else {
  passes.push(
    "lamp and indentation reveal rose through observable intermediate states",
  );
}

const holdDuration = longestTrueDuration(
  riseSamples,
  ({ endpoint, marker }) =>
    endpoint === "contact" &&
    marker?.phase === "hold" &&
    marker.lampLevel >= 0.9 &&
    marker.revealLevel >= 0.9,
);
if (holdDuration < 500) {
  failures.push(
    `CONTACT hold was not observable for 500ms (observed ${Math.round(holdDuration)}ms)`,
  );
} else {
  passes.push(`CONTACT held lamp and reveal for ${Math.round(holdDuration)}ms`);
}

const validReverse = reverseSamples.filter(
  ({ marker }) =>
    marker &&
    isFiniteLevel(marker.lampLevel) &&
    isFiniteLevel(marker.revealLevel),
);
const firstReverse = validReverse.at(0)?.marker;
const lastReverse = validReverse.at(-1)?.marker;
const reversed =
  validReverse.some(({ marker }) => marker.phase === "reversing") &&
  firstReverse &&
  lastReverse &&
  firstReverse.lampLevel - lastReverse.lampLevel >= 0.75 &&
  firstReverse.revealLevel - lastReverse.revealLevel >= 0.75 &&
  lastReverse.lampLevel <= 0.1 &&
  lastReverse.revealLevel <= 0.1;
if (!reversed) {
  failures.push(
    "closing CONTACT did not observably reverse lamp and reveal to idle",
  );
} else {
  passes.push("Escape reversed lamp and reveal to idle");
}

for (const pass of passes) console.log(`PASS ${pass}`);
for (const failure of failures) console.log(`FAIL ${failure}`);
console.log(`INFO pixel evidence: ${evidence.rest}`);
console.log(`INFO pixel evidence: ${evidence.mid}`);
console.log(`INFO pixel evidence: ${evidence.hold}`);
console.log(`INFO pixel evidence: ${evidence.reversed}`);

process.exit(failures.length === 0 ? 0 : 1);
