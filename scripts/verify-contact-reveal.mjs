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

import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

const args = process.argv.slice(2);
const manifestOnly = args.includes("--manifest-only");
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
const MID_REVEAL_MIN = 0.68;
const MID_REVEAL_MAX = 0.82;
const EXPECTED_CONTACT_COPY = [
  "Jonathan Adelson",
  "JonathanAdelson1@gmail.com",
  "1-310-709-9283",
].join("\n");
const EXPECTED_INDENT_DEPTH = 0.0003;
const MAX_GRAZING_ANGLE_DEGREES = 35;
const MID_LAMP_POOL_REGION = {
  x: 0.28,
  y: 0.22,
  width: 0.05,
  height: 0.08,
};
const MID_UNLIT_TABLE_REGION = {
  x: 0.72,
  y: 0.22,
  width: 0.05,
  height: 0.08,
};

function contactManifestFailures(manifest) {
  const failures = [];
  for (const [profile, variant] of Object.entries(manifest.variants ?? {})) {
    const contact = variant.contact;
    if (!contact) {
      failures.push(`${profile}: CONTACT manifest data missing`);
      continue;
    }
    if (
      contact.materialMechanism !== "lamp-reactive-compressed-fiber-groove" ||
      contact.coloredRevealMixCount !== 1 ||
      contact.fiberResponseAnimated !== true ||
      contact.fiberResponseNormalWeighted !== true ||
      contact.normalResponseAnimated !== true ||
      contact.physicalOcclusionResponse !== true ||
      !(contact.fiberResponseFloorPeak < contact.fiberResponseWallPeak) ||
      contact.idleFillStrength !== 0.15 ||
      contact.geometryAnimated !== false
      || contact.indentDepth !== EXPECTED_INDENT_DEPTH ||
      !Number.isFinite(contact.grazingAngleDegrees) ||
      contact.grazingAngleDegrees > MAX_GRAZING_ANGLE_DEGREES
    ) {
      failures.push(
        `${profile}: CONTACT must use fixed geometry and a lamp-reactive compressed-fiber groove`,
      );
    }
    if (
      !Array.isArray(contact.lightOrigin) ||
      contact.lightOrigin.length !== 3 ||
      !Array.isArray(contact.lightTarget) ||
      contact.lightTarget.length !== 3 ||
      contact.lightInsideShade !== true ||
      contact.lightIntersectsPaper !== true
    ) {
      failures.push(
        `${profile}: CONTACT light must originate inside the visible lamp shade and intersect the contact paper`,
      );
    }
    const frames = variant.transitions?.["desk-contact"]?.frames ?? [];
    if (
      frames.length === 0 ||
      frames.some((frame) => frame.contactIndentDepth !== contact.indentDepth)
    ) {
      failures.push(
        `${profile}: CONTACT indentation depth must remain physically fixed through the light reveal`,
      );
    }
  }
  return failures;
}

if (manifestOnly) {
  const manifest = JSON.parse(
    await readFile(resolve("public/room/manifest.json"), "utf8"),
  );
  const failures = contactManifestFailures(manifest);
  failures.forEach((failure) => console.log(`FAIL ${failure}`));
  if (failures.length === 0) {
    console.log(
      "PASS CONTACT manifest uses fixed physical indentation and lamp-origin fiber response",
    );
  }
  process.exit(failures.length === 0 ? 0 : 1);
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

async function activatePhysicalContact(page) {
  await page.waitForFunction(() => window.__arrivalDone === true, null, {
    timeout: 15_000,
  });
  const screen = await page.evaluate(() => {
    const debug = window.__lazyANavigationDebug;
    const row = debug?.sheet?.rows?.find(({ id }) => id === "contact");
    if (!row || typeof debug?.projectSheetPoint !== "function") return null;
    return debug.projectSheetPoint(
      row.rect.x + row.rect.width / 2,
      row.rect.y + row.rect.height / 2,
    );
  });
  if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
    throw new Error("CONTACT physical row center is unavailable");
  }
  await page.mouse.move(screen.x, screen.y, { steps: 4 });
  await page.waitForTimeout(120);
  const candidate = await page.evaluate(
    () => window.__lazyANavCandidate ?? null,
  );
  if (candidate !== "contact") {
    throw new Error(`CONTACT physical row resolved to ${String(candidate)}`);
  }
  await page.mouse.click(screen.x, screen.y);
}

async function readGrayImage(path) {
  const { data, info } = await sharp(path)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function boundsFromQuad(quad, image) {
  const xs = quad.filter((_, index) => index % 2 === 0);
  const ys = quad.filter((_, index) => index % 2 === 1);
  const left = Math.max(0, Math.floor(Math.min(...xs) * image.width));
  const right = Math.min(image.width, Math.ceil(Math.max(...xs) * image.width));
  const top = Math.max(0, Math.floor(Math.min(...ys) * image.height));
  const bottom = Math.min(
    image.height,
    Math.ceil(Math.max(...ys) * image.height),
  );
  return { left, top, right, bottom };
}

function boundsFromRegion(region, image) {
  return {
    left: Math.floor(region.x * image.width),
    top: Math.floor(region.y * image.height),
    right: Math.ceil((region.x + region.width) * image.width),
    bottom: Math.ceil((region.y + region.height) * image.height),
  };
}

function regionValues(image, bounds) {
  const values = [];
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      values.push(image.data[y * image.width + x]);
    }
  }
  return values;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function regionContrast(image, bounds) {
  const gradients = [];
  for (let y = bounds.top + 1; y < bounds.bottom - 1; y += 1) {
    for (let x = bounds.left + 1; x < bounds.right - 1; x += 1) {
      const index = y * image.width + x;
      gradients.push(
        Math.abs(image.data[index + 1] - image.data[index - 1]),
        Math.abs(
          image.data[index + image.width] - image.data[index - image.width],
        ),
      );
    }
  }
  return {
    meanGradient: mean(gradients),
    gradientP95: percentile(gradients, 0.95),
  };
}

function meanAbsoluteDifference(first, second, bounds) {
  const differences = [];
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const index = y * first.width + x;
      differences.push(Math.abs(first.data[index] - second.data[index]));
    }
  }
  return mean(differences);
}

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const closeBrowser = () =>
  Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 1_500)),
  ]);

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
  await page.goto(baseUrl, { waitUntil: "load" });
  await activatePhysicalContact(page);
  let midCaptured = false;
  riseSamples = await collect(page, 7000, async (sample) => {
    const revealLevel = sample.marker?.revealLevel;
    if (
      !midCaptured &&
      isFiniteLevel(revealLevel) &&
      revealLevel >= MID_REVEAL_MIN &&
      revealLevel <= MID_REVEAL_MAX
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
  await closeBrowser();
}

const allSamples = [restSample, ...riseSamples, ...reverseSamples].filter(
  Boolean,
);
const markerSamples = allSamples.filter(
  (sample) => sample.marker && typeof sample.marker === "object",
);
const interactiveSamples = [...riseSamples, ...reverseSamples];
const firstInteractiveMarkerIndex = interactiveSamples.findIndex(
  (sample) => sample.marker && typeof sample.marker === "object",
);
const missingAfterInteractiveObservability =
  firstInteractiveMarkerIndex < 0
    ? interactiveSamples.length
    : interactiveSamples
        .slice(firstInteractiveMarkerIndex)
        .filter(
          (sample) => !sample.marker || typeof sample.marker !== "object",
        ).length;
const failures = [];
const passes = [];
let wideContact;

try {
  const manifest = JSON.parse(
    await readFile(resolve("public/room/manifest.json"), "utf8"),
  );
  wideContact = manifest.variants?.wide?.contact;
  const copies = Object.values(manifest.variants ?? {}).map(
    (variant) => variant.contact?.addressCopy,
  );
  const mechanisms = Object.values(manifest.variants ?? {}).map(
    (variant) => variant.contact?.mechanism,
  );
  if (
    copies.length !== 2 ||
    copies.some((copy) => copy !== EXPECTED_CONTACT_COPY)
  ) {
    failures.push(
      `CONTACT copy mismatch: expected ${JSON.stringify(EXPECTED_CONTACT_COPY)}, got ${JSON.stringify(copies)}`,
    );
  } else {
    passes.push("CONTACT manifest contains the exact approved three-line copy");
  }
  if (
    mechanisms.length !== 2 ||
    mechanisms.some(
      (mechanism) => mechanism !== "applied-exact-pressure-indentation",
    )
  ) {
    failures.push(
      `CONTACT mechanism mismatch: expected applied-exact-pressure-indentation, got ${JSON.stringify(mechanisms)}`,
    );
  } else {
    passes.push(
      "CONTACT uses an exact pressure indentation applied to the paper",
    );
  }
} catch (error) {
  failures.push(`CONTACT manifest copy unavailable: ${error.message}`);
}

try {
  if (!wideContact) throw new Error("wide CONTACT manifest data missing");
  const [restImage, midImage, holdImage, reversedImage] = await Promise.all([
    readGrayImage(evidence.rest),
    readGrayImage(evidence.mid),
    readGrayImage(evidence.hold),
    readGrayImage(evidence.reversed),
  ]);
  const restAddress = boundsFromQuad(
    wideContact.addressScreenQuads.desk,
    restImage,
  );
  const holdAddress = boundsFromQuad(
    wideContact.addressScreenQuads.contact,
    holdImage,
  );
  const restContrast = regionContrast(restImage, restAddress);
  const holdContrast = regionContrast(holdImage, holdAddress);
  const holdValues = regionValues(holdImage, holdAddress);
  const holdRange = percentile(holdValues, 0.95) - percentile(holdValues, 0.05);
  const lampPoolMean = mean(
    regionValues(midImage, boundsFromRegion(MID_LAMP_POOL_REGION, midImage)),
  );
  const unlitTableMean = mean(
    regionValues(midImage, boundsFromRegion(MID_UNLIT_TABLE_REGION, midImage)),
  );
  const lampPoolLift = lampPoolMean - unlitTableMean;
  const reverseDifference = meanAbsoluteDifference(
    restImage,
    reversedImage,
    restAddress,
  );

  if (restContrast.gradientP95 > 6 || restContrast.meanGradient > 1.8) {
    failures.push(
      `latent CONTACT paper exposed visible typography-like edges (gradient p95=${restContrast.gradientP95.toFixed(1)}, mean=${restContrast.meanGradient.toFixed(2)})`,
    );
  } else {
    passes.push("latent CONTACT paper remained visually clean at rest");
  }
  if (lampPoolLift < 20) {
    failures.push(
      `mid CONTACT reveal lacked a localized lamp-pool change (luma lift=${lampPoolLift.toFixed(1)})`,
    );
  } else {
    passes.push(
      `mid CONTACT reveal changed through the lamp pool (luma lift=${lampPoolLift.toFixed(1)})`,
    );
  }
  if (
    holdContrast.gradientP95 < 14 ||
    holdContrast.meanGradient < 2.5 ||
    holdRange < 30 ||
    holdContrast.gradientP95 - restContrast.gradientP95 < 8 ||
    holdContrast.meanGradient - restContrast.meanGradient < 1
  ) {
    failures.push(
      `held CONTACT address lacked readable indentation contrast (gradient p95=${holdContrast.gradientP95.toFixed(1)}, mean=${holdContrast.meanGradient.toFixed(2)}, luma range=${holdRange.toFixed(1)}, rest deltas=${(holdContrast.gradientP95 - restContrast.gradientP95).toFixed(1)}/${(holdContrast.meanGradient - restContrast.meanGradient).toFixed(2)})`,
    );
  } else {
    passes.push("held CONTACT address showed readable indentation contrast");
  }
  if (reverseDifference > 2) {
    failures.push(
      `CONTACT reverse left visual residue on the paper (mean delta=${reverseDifference.toFixed(2)})`,
    );
  } else {
    passes.push("CONTACT reverse returned the paper cleanly to rest");
  }
} catch (error) {
  failures.push(`CONTACT pixel evidence unavailable: ${error.message}`);
}

if (
  !restSample?.marker ||
  markerSamples.length === 0 ||
  missingAfterInteractiveObservability > 0
) {
  failures.push(
    `window.__lazyAContactReveal missing after page-local observability began in ${missingAfterInteractiveObservability}/${interactiveSamples.length} interactive samples`,
  );
} else {
  passes.push(
    `CONTACT diagnostics remained present after hydration (${markerSamples.length}/${allSamples.length} samples)`,
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
