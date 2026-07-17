/**
 * Work Order 0117-R behavioral gate: the hero film plays exactly once per
 * page visit, independently of destination navigation, and stays registered
 * to the authored print throughout every photographic camera state.
 *
 * Usage:
 *   node scripts/verify-hero-lifecycle.mjs [url]
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { chromium } from "playwright";
import sharp from "sharp";

const url = process.argv[2] ?? "http://localhost:3000/";
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720, profile: "wide" },
  { name: "tall desktop", width: 1316, height: 1329, profile: "wide" },
  { name: "tablet landscape", width: 1024, height: 768, profile: "wide" },
  { name: "tablet portrait", width: 768, height: 1024, profile: "wide" },
  { name: "phone", width: 375, height: 812, profile: "portrait" },
];
const DESTINATIONS = ["films", "journal", "contact", "about"];
const TIME_EPSILON = 0.04;
const MAX_CORNER_ERROR_CSS_PX = 0.75;
const MIN_CAPTURED_EDGE_STRENGTH = 24;
const EDGE_SEARCH_RADIUS_PX = 4;
const PRESENTED_FRAME_EVENT = "lazy-a:compositor-frame-presented";
const PRESENTED_PIXEL_REFERENCES =
  "/room/hero/hero-presented-pixel-references.json";
const PRESENTED_PIXEL_REFERENCE_KIND = "authored-presented-pixels-v1";
const PRESENTED_PIXEL_REGION_ENCODING = "rgb-poster-foreground-treatment";
const PRESENTED_PIXEL_AUTHORSHIP = "independent-authored-render-v1";
const MIN_TRACE_REGION_PIXELS = 16;
const MIN_TRACE_REGION_FRACTION = 0.0005;
const MIN_TREATMENT_REGION_PIXELS = 64;
const MIN_TREATMENT_REGION_FRACTION = 0.002;
const MAX_TRACE_OVERLAP_FRACTION = 0.05;
const selfTest = process.argv.includes("--self-test");

let failures = 0;
let checks = 0;
let page;
const decodedReferenceCache = new Map();

function check(ok, name, detail) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

function fixed(value) {
  return Number.isFinite(value) ? `${value.toFixed(3)}s` : "unavailable";
}

function viewportLabel(viewport) {
  return `${viewport.name} ${viewport.width}x${viewport.height}`;
}

function pixelAt(frame, x, y) {
  const offset = (y * frame.width + x) * 4;
  return [frame.data[offset], frame.data[offset + 1], frame.data[offset + 2]];
}

function luma([red, green, blue]) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function referenceRegionMapIssues(regions) {
  if (
    !Buffer.isBuffer(regions?.data) ||
    !Number.isInteger(regions?.width) ||
    !Number.isInteger(regions?.height) ||
    regions.width <= 0 ||
    regions.height <= 0 ||
    regions.data.length !== regions.width * regions.height * 4
  ) {
    return ["reference region map is malformed"];
  }
  const counts = [0, 0, 0];
  let redGreenOverlap = 0;
  for (let offset = 0; offset < regions.data.length; offset += 4) {
    const marked = [0, 1, 2].map(
      (channel) => regions.data[offset + channel] >= 128,
    );
    marked.forEach((value, channel) => {
      if (value) counts[channel] += 1;
    });
    if (marked[0] && marked[1]) redGreenOverlap += 1;
  }
  const area = regions.width * regions.height;
  const minimums = [
    Math.max(
      MIN_TRACE_REGION_PIXELS,
      Math.ceil(area * MIN_TRACE_REGION_FRACTION),
    ),
    Math.max(
      MIN_TRACE_REGION_PIXELS,
      Math.ceil(area * MIN_TRACE_REGION_FRACTION),
    ),
    Math.max(
      MIN_TREATMENT_REGION_PIXELS,
      Math.ceil(area * MIN_TREATMENT_REGION_FRACTION),
    ),
  ];
  const issues = [];
  const names = ["red poster-axis", "green foreground-edge", "blue treatment"];
  for (let channel = 0; channel < names.length; channel += 1) {
    if (counts[channel] < minimums[channel]) {
      issues.push(
        `${names[channel]} region needs substantial coverage; got ${counts[channel]} pixels, minimum ${minimums[channel]}`,
      );
    }
  }
  const smallerTrace = Math.min(counts[0], counts[1]);
  if (
    smallerTrace > 0 &&
    redGreenOverlap / smallerTrace > MAX_TRACE_OVERLAP_FRACTION
  ) {
    issues.push(
      `red poster-axis and green foreground traces must be independent; ${redGreenOverlap}/${smallerTrace} trace pixels overlap`,
    );
  }
  return issues;
}

function presentationSequenceIssues(frameNumbers) {
  if (!Array.isArray(frameNumbers) || frameNumbers.length === 0) {
    return ["no live compositor frame was presented after playback release"];
  }
  const issues = [];
  if (frameNumbers[0] !== 1) {
    issues.push(
      `frame 1 must be the first live compositor presentation after release; got ${frameNumbers[0]}`,
    );
  }
  for (let index = 0; index < frameNumbers.length; index += 1) {
    if (!Number.isInteger(frameNumbers[index]) || frameNumbers[index] < 1) {
      issues.push(`invalid presented frame ${String(frameNumbers[index])}`);
      continue;
    }
    if (index > 0 && frameNumbers[index] < frameNumbers[index - 1]) {
      issues.push(
        `compositor frames arrived out of order at ${frameNumbers[index - 1]} -> ${frameNumbers[index]}`,
      );
    }
  }
  return issues;
}

function normalizePresentedPixelCatalog(catalog, viewportKey, catalogUrl) {
  if (
    catalog?.version !== 1 ||
    catalog?.presentationEvent !== PRESENTED_FRAME_EVENT ||
    catalog?.kind !== PRESENTED_PIXEL_REFERENCE_KIND ||
    catalog?.regionEncoding !== PRESENTED_PIXEL_REGION_ENCODING
  ) {
    throw new Error(
      `${viewportKey} catalog must use the version-1 presented-pixel contract`,
    );
  }
  if (catalog.authorship !== PRESENTED_PIXEL_AUTHORSHIP) {
    throw new Error(
      `${viewportKey} catalog authorship must be ${PRESENTED_PIXEL_AUTHORSHIP}`,
    );
  }
  const frames = catalog.viewports?.[viewportKey]?.frames;
  if (!Array.isArray(frames) || frames.length < 4) {
    throw new Error(
      `${viewportKey} must provide resting plus forward/reverse moving authored references`,
    );
  }
  const normalized = frames
    .map((frame) => {
      const composite =
        typeof frame?.composite === "string"
          ? new URL(frame.composite, catalogUrl).href
          : null;
      const regions =
        typeof frame?.regions === "string"
          ? new URL(frame.regions, catalogUrl).href
          : null;
      const authoredSource =
        typeof frame?.authoredSource === "string"
          ? new URL(frame.authoredSource, catalogUrl).href
          : null;
      return {
        heroFramePresented: frame?.heroFramePresented,
        plateState: frame?.plateState,
        projectionFrame: frame?.projectionFrame,
        composite,
        regions,
        authoredSource,
        authoredSourceSha256: frame?.authoredSourceSha256,
      };
    })
    .sort((left, right) => left.heroFramePresented - right.heroFramePresented);
  if (
    normalized[0]?.heroFramePresented !== 1 ||
    normalized.some(
      (frame, index) =>
        !Number.isInteger(frame.heroFramePresented) ||
        frame.heroFramePresented < 1 ||
        !Number.isInteger(frame.projectionFrame) ||
        frame.projectionFrame < 0 ||
        typeof frame.plateState !== "string" ||
        !frame.composite ||
        !frame.regions ||
        !frame.authoredSource ||
        frame.authoredSource === frame.composite ||
        frame.authoredSource === frame.regions ||
        frame.regions === frame.composite ||
        !/^[a-f0-9]{64}$/.test(frame.authoredSourceSha256 ?? "") ||
        (index > 0 &&
          frame.heroFramePresented ===
            normalized[index - 1].heroFramePresented),
    )
  ) {
    throw new Error(
      `${viewportKey} references need unique positive frame ids, exact plate/projection state, distinct authored sources/region maps, and SHA-256 provenance`,
    );
  }
  const resting = normalized.filter(
    ({ plateState }) => plateState === "resting:desk",
  );
  const forward = normalized.filter(({ plateState }) =>
    /^transitioning:desk-to-(films|journal|contact|about)$/.test(plateState),
  );
  const reverse = normalized.filter(({ plateState }) =>
    /^transitioning:(films|journal|contact|about)-to-desk$/.test(plateState),
  );
  const pairedTransition = forward.some(({ plateState }) => {
    const destination = plateState.slice("transitioning:desk-to-".length);
    return reverse.some(
      (candidate) =>
        candidate.plateState === `transitioning:${destination}-to-desk`,
    );
  });
  if (
    resting.length < 2 ||
    resting[0]?.heroFramePresented !== 1 ||
    forward.length === 0 ||
    reverse.length === 0 ||
    !pairedTransition
  ) {
    throw new Error(
      `${viewportKey} references must include frame 1 plus representative resting, paired forward, and paired reverse navigation captures`,
    );
  }
  return normalized;
}

function maskedPixelDelta(actual, reference, regions, maskChannel) {
  if (
    actual.width !== reference.width ||
    actual.height !== reference.height ||
    actual.width !== regions.width ||
    actual.height !== regions.height
  ) {
    return {
      meanLumaDelta: Number.POSITIVE_INFINITY,
      meanChannelDelta: Number.POSITIVE_INFINITY,
      samples: 0,
    };
  }
  let lumaDelta = 0;
  let channelDelta = 0;
  let samples = 0;
  for (let y = 1; y < actual.height - 1; y += 1) {
    for (let x = 1; x < actual.width - 1; x += 1) {
      const offset = (y * actual.width + x) * 4;
      if (regions.data[offset + maskChannel] < 128) continue;
      const actualPixel = pixelAt(actual, x, y);
      const referencePixel = pixelAt(reference, x, y);
      lumaDelta += Math.abs(luma(actualPixel) - luma(referencePixel));
      channelDelta += Math.max(
        ...actualPixel.map((value, index) =>
          Math.abs(value - referencePixel[index]),
        ),
      );
      samples += 1;
    }
  }
  return {
    meanLumaDelta: samples ? lumaDelta / samples : Number.POSITIVE_INFINITY,
    meanChannelDelta: samples
      ? channelDelta / samples
      : Number.POSITIVE_INFINITY,
    samples,
  };
}

function maskValue(regions, x, y, maskChannel) {
  return regions.data[(y * regions.width + x) * 4 + maskChannel];
}

function referenceEdgeNormal(regions, x, y, maskChannel) {
  let xx = 0;
  let xy = 0;
  let yy = 0;
  let neighbors = 0;
  for (let offsetY = -3; offsetY <= 3; offsetY += 1) {
    for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
      if (
        (offsetX === 0 && offsetY === 0) ||
        Math.hypot(offsetX, offsetY) > 3 ||
        maskValue(regions, x + offsetX, y + offsetY, maskChannel) < 128
      ) {
        continue;
      }
      xx += offsetX * offsetX;
      xy += offsetX * offsetY;
      yy += offsetY * offsetY;
      neighbors += 1;
    }
  }
  if (neighbors === 0) return null;
  const tangentAngle = Math.atan2(2 * xy, xx - yy) / 2;
  return [-Math.sin(tangentAngle), Math.cos(tangentAngle)];
}

function referenceEdgePoints(regions, maskChannel) {
  const points = [];
  for (let y = 4; y < regions.height - 4; y += 1) {
    for (let x = 4; x < regions.width - 4; x += 1) {
      if (maskValue(regions, x, y, maskChannel) < 128) continue;
      const normal = referenceEdgeNormal(regions, x, y, maskChannel);
      if (normal) points.push({ x, y, normal });
    }
  }
  return points;
}

function directionalGradient(frame, x, y, normal) {
  const firstX = Math.round(x - normal[0]);
  const firstY = Math.round(y - normal[1]);
  const secondX = Math.round(x + normal[0]);
  const secondY = Math.round(y + normal[1]);
  return Math.abs(
    luma(pixelAt(frame, secondX, secondY)) -
      luma(pixelAt(frame, firstX, firstY)),
  );
}

function measureEdgeAlignment(frame, regions, maskChannel) {
  if (frame.width !== regions.width || frame.height !== regions.height) {
    return {
      maxErrorPx: Number.POSITIVE_INFINITY,
      minStrength: 0,
      samples: 0,
      weakSamples: 0,
    };
  }
  const points = referenceEdgePoints(regions, maskChannel);
  let maxErrorPx = 0;
  let minStrength = Number.POSITIVE_INFINITY;
  let weakSamples = 0;
  for (const { x: expectedX, y: expectedY, normal } of points) {
    let bestStrength = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (
      let offset = -EDGE_SEARCH_RADIUS_PX;
      offset <= EDGE_SEARCH_RADIUS_PX;
      offset += 0.25
    ) {
      const x = Math.round(expectedX + normal[0] * offset);
      const y = Math.round(expectedY + normal[1] * offset);
      if (x < 1 || y < 1 || x >= frame.width - 1 || y >= frame.height - 1)
        continue;
      const distance = Math.abs(offset);
      const strength = directionalGradient(frame, x, y, normal);
      if (
        strength > bestStrength ||
        (strength === bestStrength && distance < bestDistance)
      ) {
        bestStrength = strength;
        bestDistance = distance;
      }
    }
    minStrength = Math.min(minStrength, bestStrength);
    if (bestStrength < MIN_CAPTURED_EDGE_STRENGTH) {
      weakSamples += 1;
    } else {
      maxErrorPx = Math.max(maxErrorPx, bestDistance);
    }
  }
  if (points.length === 0 || weakSamples > 0) {
    maxErrorPx = Number.POSITIVE_INFINITY;
  }
  return {
    maxErrorPx,
    minStrength: points.length ? minStrength : 0,
    samples: points.length,
    weakSamples,
  };
}

function measuredPresentedPixelMetrics(resting, firstPainted, playingFrames) {
  const presentedFrames = [firstPainted, ...playingFrames];
  const treatment = presentedFrames.map((frame) =>
    maskedPixelDelta(
      frame,
      frame.reference?.composite ?? {},
      frame.reference?.regions ?? {},
      2,
    ),
  );
  const posterAxis = presentedFrames.map((frame) =>
    measureEdgeAlignment(frame, frame.reference?.regions ?? {}, 0),
  );
  const foreground = presentedFrames.map((frame) =>
    measureEdgeAlignment(frame, frame.reference?.regions ?? {}, 1),
  );
  return {
    firstFrame: maskedPixelDelta(
      firstPainted,
      resting,
      firstPainted.reference?.regions ?? {},
      2,
    ),
    playingFrames: {
      maxRoomTreatmentDelta: Math.max(
        ...treatment.map(({ meanChannelDelta }) => meanChannelDelta),
      ),
      minimumTreatmentSamples: Math.min(
        ...treatment.map(({ samples }) => samples),
      ),
    },
    motionSamples: {
      maxPosterAxisErrorPx: Math.max(
        ...posterAxis.map(({ maxErrorPx }) => maxErrorPx),
      ),
      minPosterAxisEdgeStrength: Math.min(
        ...posterAxis.map(({ minStrength }) => minStrength),
      ),
      posterAxisSamples: Math.min(...posterAxis.map(({ samples }) => samples)),
      posterAxisWeakSamples: Math.max(
        ...posterAxis.map(({ weakSamples }) => weakSamples),
      ),
      maxForegroundEdgeErrorPx: Math.max(
        ...foreground.map(({ maxErrorPx }) => maxErrorPx),
      ),
      minForegroundEdgeStrength: Math.min(
        ...foreground.map(({ minStrength }) => minStrength),
      ),
      foregroundSamples: Math.min(...foreground.map(({ samples }) => samples)),
      foregroundWeakSamples: Math.max(
        ...foreground.map(({ weakSamples }) => weakSamples),
      ),
    },
  };
}

function fixtureFrame({
  background = 20,
  paper = 220,
  foreground = 40,
  foregroundX = 16,
  drawForeground = true,
} = {}) {
  const width = 32;
  const height = 32;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = x >= 6 && x <= 25 && y >= 6 && y <= 25 ? paper : background;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  if (drawForeground) {
    for (let y = 10; y <= 21; y += 1) {
      const offset = (y * width + foregroundX) * 4;
      data[offset] = foreground;
      data[offset + 1] = foreground;
      data[offset + 2] = foreground;
    }
  }
  return {
    data,
    width,
    height,
  };
}

function fixtureRegions() {
  const width = 32;
  const height = 32;
  const data = Buffer.alloc(width * height * 4);
  const mark = (x, y, channel) => {
    data[(y * width + x) * 4 + channel] = 255;
    data[(y * width + x) * 4 + 3] = 255;
  };
  for (let value = 7; value <= 24; value += 1) {
    mark(value, 6, 0);
    mark(value, 25, 0);
    mark(6, value, 0);
    mark(25, value, 0);
  }
  for (let y = 10; y <= 21; y += 1) {
    mark(15, y, 1);
    mark(17, y, 1);
  }
  for (let y = 8; y <= 23; y += 1) {
    for (let x = 8; x <= 23; x += 1) {
      if (x < 14 || x > 18) mark(x, y, 2);
    }
  }
  return { data, width, height };
}

function withFixtureReference(frame, composite = frame) {
  return {
    ...frame,
    reference: {
      composite,
      regions: fixtureRegions(),
    },
  };
}

function runSelfTests() {
  const resting = fixtureFrame();
  const firstPainted = withFixtureReference(fixtureFrame());
  const changedContent = fixtureFrame({ paper: 110 });
  assert.deepEqual(
    referenceRegionMapIssues(fixtureRegions()),
    [],
    "independent substantial RGB reference regions should pass",
  );

  const trivialRegions = fixtureRegions();
  trivialRegions.data.fill(0);
  for (let channel = 0; channel < 3; channel += 1) {
    trivialRegions.data[channel] = 255;
  }
  assert.match(
    referenceRegionMapIssues(trivialRegions).join("\n"),
    /substantial/,
    "single-pixel RGB maps must not establish authored coverage",
  );

  const overlappingRegions = fixtureRegions();
  for (let offset = 0; offset < overlappingRegions.data.length; offset += 4) {
    overlappingRegions.data[offset + 1] = overlappingRegions.data[offset];
  }
  assert.match(
    referenceRegionMapIssues(overlappingRegions).join("\n"),
    /independent/,
    "overlapping poster and foreground traces must not pass as independent maps",
  );

  const authoredHash = "a".repeat(64);
  const catalog = {
    version: 1,
    presentationEvent: PRESENTED_FRAME_EVENT,
    kind: PRESENTED_PIXEL_REFERENCE_KIND,
    regionEncoding: PRESENTED_PIXEL_REGION_ENCODING,
    authorship: "independent-authored-render-v1",
    viewports: {
      "32x32": {
        frames: [
          {
            heroFramePresented: 1,
            plateState: "resting:desk",
            projectionFrame: 0,
            composite: "frame-0001.png",
            regions: "frame-0001-regions.png",
            authoredSource: "authored/frame-0001.png",
            authoredSourceSha256: authoredHash,
          },
          {
            heroFramePresented: 2,
            plateState: "resting:desk",
            projectionFrame: 0,
            composite: "frame-0002.png",
            regions: "frame-0002-regions.png",
            authoredSource: "authored/frame-0002.png",
            authoredSourceSha256: authoredHash,
          },
          {
            heroFramePresented: 12,
            plateState: "transitioning:desk-to-films",
            projectionFrame: 10,
            composite: "frame-0012.png",
            regions: "frame-0012-regions.png",
            authoredSource: "authored/frame-0012.png",
            authoredSourceSha256: authoredHash,
          },
          {
            heroFramePresented: 45,
            plateState: "transitioning:films-to-desk",
            projectionFrame: 10,
            composite: "frame-0045.png",
            regions: "frame-0045-regions.png",
            authoredSource: "authored/frame-0045.png",
            authoredSourceSha256: authoredHash,
          },
        ],
      },
    },
  };
  assert.equal(
    normalizePresentedPixelCatalog(
      catalog,
      "32x32",
      "https://example.test/room/hero/catalog.json",
    ).length,
    4,
    "catalog must carry resting plus moving forward/reverse authored references",
  );
  assert.throws(
    () =>
      normalizePresentedPixelCatalog(
        { ...catalog, authorship: undefined },
        "32x32",
        "https://example.test/room/hero/catalog.json",
      ),
    /authorship/,
    "catalogs without authored-source provenance must fail",
  );
  const selfReferentialCatalog = structuredClone(catalog);
  selfReferentialCatalog.viewports["32x32"].frames[0].authoredSource =
    "frame-0001.png";
  assert.throws(
    () =>
      normalizePresentedPixelCatalog(
        selfReferentialCatalog,
        "32x32",
        "https://example.test/room/hero/catalog.json",
      ),
    /distinct authored sources/,
    "a delivered composite cannot cite itself as independent authored provenance",
  );

  assert.deepEqual(presentationSequenceIssues([1, 2, 3]), []);
  assert.match(
    presentationSequenceIssues([2, 1]).join("\n"),
    /first|out of order/,
    "a later frame presented before frame 1 must fail",
  );
  assert.match(
    presentationSequenceIssues([0, 1]).join("\n"),
    /first/,
    "a pre-frame-1 compositor presentation must fail",
  );

  const good = measuredPresentedPixelMetrics(resting, firstPainted, [
    withFixtureReference(changedContent),
  ]);
  assert.ok(good.firstFrame.meanLumaDelta <= 3);
  assert.ok(good.firstFrame.meanChannelDelta <= 4);
  assert.ok(
    good.playingFrames.maxRoomTreatmentDelta <= 6,
    "changing content must compare with its matching authored frame",
  );
  assert.ok(good.playingFrames.minimumTreatmentSamples > 0);
  assert.ok(good.motionSamples.maxPosterAxisErrorPx <= 0.75);
  assert.ok(good.motionSamples.maxForegroundEdgeErrorPx <= 1);
  assert.ok(
    good.motionSamples.minPosterAxisEdgeStrength >= MIN_CAPTURED_EDGE_STRENGTH,
  );
  assert.ok(
    good.motionSamples.minForegroundEdgeStrength >= MIN_CAPTURED_EDGE_STRENGTH,
  );

  const flat = fixtureFrame({
    background: 80,
    paper: 80,
    foreground: 80,
  });
  const flatMetrics = measuredPresentedPixelMetrics(
    flat,
    withFixtureReference(flat),
    [],
  );
  assert.equal(
    flatMetrics.motionSamples.maxPosterAxisErrorPx,
    Number.POSITIVE_INFINITY,
    "flat frames must not pass poster-axis alignment",
  );

  const missingForeground = fixtureFrame({ drawForeground: false });
  const missingMetrics = measuredPresentedPixelMetrics(
    missingForeground,
    withFixtureReference(missingForeground),
    [],
  );
  assert.ok(missingMetrics.motionSamples.maxPosterAxisErrorPx <= 0.75);
  assert.equal(
    missingMetrics.motionSamples.maxForegroundEdgeErrorPx,
    Number.POSITIVE_INFINITY,
    "missing foreground edges must fail independently of poster edges",
  );

  const shiftedForeground = fixtureFrame({ foregroundX: 19 });
  const shiftedMetrics = measuredPresentedPixelMetrics(
    shiftedForeground,
    withFixtureReference(shiftedForeground),
    [],
  );
  assert.ok(
    shiftedMetrics.motionSamples.maxForegroundEdgeErrorPx > 1,
    "shifted foreground edges must exceed the R4 alignment threshold",
  );

  const wrongTreatment = fixtureFrame({ paper: 70 });
  const wrongTreatmentMetrics = measuredPresentedPixelMetrics(
    resting,
    firstPainted,
    [withFixtureReference(wrongTreatment, changedContent)],
  );
  assert.ok(
    wrongTreatmentMetrics.playingFrames.maxRoomTreatmentDelta > 6,
    "captured pixels must reject a mismatched per-frame treatment reference",
  );

  const fabricatedDiagnostics = {
    pixels: {
      firstFrame: { meanLumaDelta: 0, meanChannelDelta: 0 },
      playingFrames: { maxRoomTreatmentDelta: 0 },
      motionSamples: { maxPosterAxisErrorPx: 0, maxForegroundEdgeErrorPx: 0 },
    },
  };
  const corrupted = withFixtureReference(
    fixtureFrame({ background: 255, paper: 0, foreground: 0 }),
  );
  const negative = measuredPresentedPixelMetrics(resting, corrupted, []);
  assert.ok(
    negative.firstFrame.meanLumaDelta > 3 ||
      negative.firstFrame.meanChannelDelta > 4,
    "fabricated compositor diagnostics cannot change captured pixel metrics",
  );
  assert.equal(fabricatedDiagnostics.pixels.firstFrame.meanLumaDelta, 0);
  console.log(
    "hero lifecycle self-tests passed (trivial/overlapping maps, out-of-order presentation, and final-pixel edge/treatment negatives).",
  );
}

if (selfTest) {
  runSelfTests();
  process.exit(0);
}

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

async function installPageProbes(expectedProfile) {
  await page.addInitScript(
    ({ profile, presentedFrameEvent }) => {
      const records = [];
      const tracked = new WeakMap();
      const events = [];
      const pendingHeroPlays = [];
      let heroPlaybackReleased = false;

      const eventSnapshot = (type, video) => ({
        type,
        at: performance.now(),
        arrivalDone: window.__arrivalDone === true,
        conversation: window.__lazyAConversation ?? null,
        currentTime: video.currentTime,
        duration: video.duration,
      });

      const track = (element) => {
        if (!(element instanceof HTMLVideoElement)) return null;
        const existing = tracked.get(element);
        if (existing) return existing;

        const record = {
          element,
          createdAt: performance.now(),
          createdBeforeSettle: window.__arrivalDone !== true,
          initialTime: element.currentTime,
          preSettleObserved: false,
          preSettleMaxTime: 0,
          playCalls: 0,
          playStarts: 0,
          endedEvents: 0,
        };
        tracked.set(element, record);
        records.push(record);

        element.addEventListener("play", () => {
          record.playStarts += 1;
          events.push(eventSnapshot("play", element));
        });
        element.addEventListener("ended", () => {
          record.endedEvents += 1;
          events.push(eventSnapshot("ended", element));
        });
        return record;
      };

      const nativeCreateElement = Document.prototype.createElement;
      Document.prototype.createElement = function createElement(
        localName,
        options,
      ) {
        const element = nativeCreateElement.call(this, localName, options);
        track(element);
        return element;
      };

      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function play() {
        const record = track(this);
        if (record) {
          record.playCalls += 1;
          events.push(eventSnapshot("play-call", this));
        }
        if (
          this instanceof HTMLVideoElement &&
          this.dataset.lazyAHero === "true" &&
          !heroPlaybackReleased
        ) {
          return new Promise((resolve, reject) => {
            pendingHeroPlays.push({ element: this, resolve, reject });
          });
        }
        return nativePlay.call(this);
      };

      const sampleBeforeSettle = () => {
        if (window.__arrivalDone !== true) {
          for (const record of records) {
            record.preSettleObserved = true;
            record.preSettleMaxTime = Math.max(
              record.preSettleMaxTime,
              record.element.currentTime,
            );
          }
        }
        requestAnimationFrame(sampleBeforeSettle);
      };
      requestAnimationFrame(sampleBeforeSettle);

      Object.defineProperty(window, "__heroLifecycleProbe", {
        configurable: false,
        value: {
          records,
          events,
          releasePlayback() {
            presented.presentedFramesAfterRelease.length = 0;
            presented.videoFrames.clear();
            presented.compositorFrames.clear();
            presented.latestFrame = 0;
            presented.playbackReleasedAt = performance.now();
            heroPlaybackReleased = true;
            for (const { element, resolve, reject } of pendingHeroPlays.splice(
              0,
            )) {
              nativePlay.call(element).then(resolve, reject);
            }
          },
        },
      });

      const values = {
        authored: null,
        live: null,
      };
      const samples = [];
      let activeSegment = "arrival opening -> desk";
      let sampleId = 0;
      const lastSampledProjection = new Map();
      const lastWaitingProjection = new Map();

      const expectedCorners = (authored) => {
        if (!Array.isArray(authored) || authored.length !== 8) return null;
        const source =
          profile === "portrait"
            ? { width: 375, height: 812 }
            : { width: 1280, height: 720 };
        const scale = Math.max(
          innerWidth / source.width,
          innerHeight / source.height,
        );
        const offsetX = (innerWidth - source.width * scale) / 2;
        const offsetY = (innerHeight - source.height * scale) / 2;
        return authored.map((value, index) => {
          const horizontal = index % 2 === 0;
          const pixels = horizontal
            ? offsetX + value * source.width * scale
            : offsetY + value * source.height * scale;
          return pixels / (horizontal ? innerWidth : innerHeight);
        });
      };

      const cornerErrors = (live, authored) => {
        const expected = expectedCorners(authored);
        if (!Array.isArray(live) || live.length !== 8 || !expected) return null;
        return [0, 1, 2, 3].map((index) =>
          Math.hypot(
            (live[index * 2] - expected[index * 2]) * innerWidth,
            (live[index * 2 + 1] - expected[index * 2 + 1]) * innerHeight,
          ),
        );
      };

      const createRegistrationSample = (kind, label) => {
        if (!activeSegment) return;
        const authored = values.authored?.hero;
        const live = values.live;
        const compositor = window.__lazyACompositor ?? null;
        samples.push({
          id: ++sampleId,
          segment: activeSegment,
          kind,
          label,
          authored: Array.isArray(authored) ? [...authored] : null,
          authoredProjectable: Array.isArray(authored) && authored.length === 8,
          profile: window.__lazyAPlateState?.profile ?? null,
          liveObserved: Array.isArray(live),
          occlusionObserved:
            compositor?.occlusion === "authored-depth-geometry",
          legacyOcclusionMarkerPresent: "__lazyAHeroOcclusion" in window,
          cornerErrors: cornerErrors(live, authored),
        });
      };

      const recordDecodedFrame = (metadata) => {
        if (!activeSegment) return;
        samples.push({
          id: ++sampleId,
          segment: activeSegment,
          kind: "decoded",
          label: `decoded frame ${metadata.presentedFrames}`,
          decodedFrame: metadata.presentedFrames,
          profile: window.__lazyAPlateState?.profile ?? null,
        });
      };

      const recordWaitingProjection = (projection) => {
        if (!activeSegment) return;
        samples.push({
          id: ++sampleId,
          segment: activeSegment,
          kind: "waiting",
          label: "hero texture not ready",
          profile: window.__lazyAPlateState?.profile ?? null,
        });
        lastWaitingProjection.set(activeSegment, projection);
      };

      const sampleRenderedState = () => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const projection = values.authored;
            if (!activeSegment || !projection) return;
            const authoredProjectable =
              Array.isArray(projection.hero) && projection.hero.length === 8;
            const compositorReady =
              window.__lazyACompositor?.atomic === true &&
              window.__lazyACompositor?.occlusion === "authored-depth-geometry";
            if (
              !compositorReady ||
              (authoredProjectable && !Array.isArray(values.live))
            ) {
              if (lastWaitingProjection.get(activeSegment) !== projection) {
                recordWaitingProjection(projection);
              }
            } else if (
              lastSampledProjection.get(activeSegment) !== projection
            ) {
              lastSampledProjection.set(activeSegment, projection);
              createRegistrationSample("rendered", "post-render state");
            }
          }, 0);
          sampleRenderedState();
        });
      };
      sampleRenderedState();

      const publishProperty = (name, key) => {
        Object.defineProperty(window, name, {
          configurable: true,
          get: () => values[key],
          set: (value) => {
            values[key] = value;
          },
        });
      };
      publishProperty("__lazyAPlateProjection", "authored");
      publishProperty("__lazyAHeroProjection", "live");

      const presented = {
        target: null,
        capture: null,
        latestFrame: 0,
        overlay: null,
        slowedVideo: null,
        armedAt: 0,
        playbackReleasedAt: 0,
        presentedFramesAfterRelease: [],
        videoFrames: new Map(),
        compositorFrames: new Map(),
      };
      const restorePlaybackRate = () => {
        if (!presented.slowedVideo) return;
        presented.slowedVideo.element.playbackRate =
          presented.slowedVideo.playbackRate;
        presented.slowedVideo = null;
      };
      const removeOverlay = () => {
        presented.overlay?.remove();
        presented.overlay = null;
      };
      const freezePresentedCanvas = () => {
        const source = [...document.querySelectorAll("canvas")]
          .map((canvas) => ({
            canvas,
            bounds: canvas.getBoundingClientRect(),
          }))
          .filter(({ bounds }) => bounds.width > 0 && bounds.height > 0)
          .sort(
            (left, right) =>
              right.bounds.width * right.bounds.height -
              left.bounds.width * left.bounds.height,
          )[0];
        if (!source) return null;
        removeOverlay();
        const overlay = document.createElement("canvas");
        overlay.width = innerWidth;
        overlay.height = innerHeight;
        Object.assign(overlay.style, {
          position: "fixed",
          inset: "0",
          width: `${innerWidth}px`,
          height: `${innerHeight}px`,
          pointerEvents: "none",
          zIndex: "2147483647",
        });
        const context = overlay.getContext("2d");
        context.drawImage(
          source.canvas,
          source.bounds.left,
          source.bounds.top,
          source.bounds.width,
          source.bounds.height,
        );
        document.documentElement.append(overlay);
        presented.overlay = overlay;
        const heroVideo = records.find(
          ({ element }) => element.dataset.lazyAHero === "true",
        )?.element;
        if (heroVideo && !presented.slowedVideo) {
          presented.slowedVideo = {
            element: heroVideo,
            playbackRate: heroVideo.playbackRate,
          };
          heroVideo.playbackRate = 0.0625;
        }
        return source.bounds.toJSON();
      };
      const tryCapturePresentedFrame = (frameNumber) => {
        const target = presented.target;
        const compositor = presented.compositorFrames.get(frameNumber);
        if (
          presented.capture ||
          target?.heroFramePresented !== frameNumber ||
          !presented.videoFrames.has(frameNumber) ||
          !compositor ||
          compositor.at < presented.armedAt ||
          !compositor.heroPlaying ||
          compositor.projectionFrame !== target.projectionFrame ||
          compositor.plateState !== target.plateState
        ) {
          return;
        }
        const canvasBounds = freezePresentedCanvas();
        if (!canvasBounds) return;
        presented.capture = {
          compositor,
          nativeVideoFrame: presented.videoFrames.get(frameNumber),
          canvasBounds,
          legacyOcclusionMarkerPresent: "__lazyAHeroOcclusion" in window,
        };
      };
      window.addEventListener(presentedFrameEvent, (event) => {
        const detail = event.detail;
        if (!Number.isInteger(detail?.heroFramePresented)) return;
        const heroRecord = records.find(
          ({ element }) => element.dataset.lazyAHero === "true",
        );
        const snapshot = {
          at: performance.now(),
          atomic: detail.atomic,
          plateMediaTime: detail.plateMediaTime,
          projectionFrame: detail.projectionFrame,
          heroFramePresented: detail.heroFramePresented,
          treatment: detail.treatment,
          occlusion: detail.occlusion,
          plateState: window.__lazyAPlateState?.state ?? null,
          heroPlaying:
            Boolean(heroRecord) &&
            heroRecord.playStarts > 0 &&
            !heroRecord.element.paused,
        };
        if (
          heroPlaybackReleased &&
          snapshot.at >= presented.playbackReleasedAt
        ) {
          presented.presentedFramesAfterRelease.push(detail.heroFramePresented);
        }
        presented.latestFrame = Math.max(
          presented.latestFrame,
          detail.heroFramePresented,
        );
        presented.compositorFrames.set(detail.heroFramePresented, snapshot);
        tryCapturePresentedFrame(detail.heroFramePresented);
      });

      const nativeVideoFrameCallback =
        HTMLVideoElement.prototype.requestVideoFrameCallback;
      if (typeof nativeVideoFrameCallback === "function") {
        HTMLVideoElement.prototype.requestVideoFrameCallback = function (
          callback,
        ) {
          return nativeVideoFrameCallback.call(this, (now, metadata) => {
            if (this.dataset.lazyAHero === "true") {
              presented.latestFrame = Math.max(
                presented.latestFrame,
                metadata.presentedFrames,
              );
              presented.videoFrames.set(metadata.presentedFrames, {
                mediaTime: metadata.mediaTime,
                presentedFrames: metadata.presentedFrames,
                expectedDisplayTime: metadata.expectedDisplayTime,
              });
              tryCapturePresentedFrame(metadata.presentedFrames);
            }
            callback(now, metadata);
            if (this.closest('[data-room-renderer="plate"]')) {
              recordDecodedFrame(metadata);
            }
          });
        };
      }

      const summarize = (segment) => {
        const selected = samples.filter((sample) => sample.segment === segment);
        const rendered = selected.filter(
          (sample) => sample.kind !== "decoded" && sample.kind !== "waiting",
        );
        const errors = rendered.flatMap((sample) => sample.cornerErrors ?? []);
        return {
          segment,
          total: rendered.length,
          rawTotal: selected.length,
          decoded: selected.filter((sample) => sample.kind === "decoded")
            .length,
          waiting: selected.filter((sample) => sample.kind === "waiting")
            .length,
          points: rendered.filter((sample) => sample.kind === "point").length,
          unresolved: rendered.filter(
            (sample) =>
              !sample.occlusionObserved ||
              (sample.authoredProjectable && !sample.liveObserved),
          ).length,
          invalidCorners: rendered.filter((sample) => {
            if (!sample.authoredProjectable) return sample.liveObserved;
            return (
              !Array.isArray(sample.cornerErrors) ||
              sample.cornerErrors.length !== 4
            );
          }).length,
          hiddenOffscreen: rendered.filter(
            (sample) => !sample.authoredProjectable && !sample.liveObserved,
          ).length,
          profileMismatches: selected.filter(
            (sample) => sample.profile !== profile,
          ).length,
          maxCornerError: errors.length ? Math.max(...errors) : null,
          occlusionFailures: rendered.filter(
            (sample) =>
              !sample.occlusionObserved || sample.legacyOcclusionMarkerPresent,
          ).length,
        };
      };

      Object.defineProperty(window, "__heroRegistrationProbe", {
        configurable: false,
        value: {
          beginSegment(segment) {
            activeSegment = segment;
          },
          capture(label) {
            createRegistrationSample("point", label);
          },
          summarize,
        },
      });

      Object.defineProperty(window, "__heroPresentedFrameProbe", {
        configurable: false,
        value: {
          arm(target) {
            removeOverlay();
            presented.capture = null;
            presented.target = target;
            presented.armedAt = performance.now();
            tryCapturePresentedFrame(target.heroFramePresented);
          },
          snapshot() {
            return {
              capture: presented.capture,
              latestFrame: presented.latestFrame,
              target: presented.target,
              presentedFramesAfterRelease: [
                ...presented.presentedFramesAfterRelease,
              ],
            };
          },
          release() {
            removeOverlay();
            restorePlaybackRate();
            presented.capture = null;
            presented.target = null;
          },
        },
      });
    },
    {
      profile: expectedProfile,
      presentedFrameEvent: PRESENTED_FRAME_EVENT,
    },
  );
}

function heroSnapshot() {
  return page.evaluate(() => {
    const probe = window.__heroLifecycleProbe;
    if (!probe) return { supported: false, reason: "media probe missing" };

    const records = probe.records.filter((record) => {
      const source = record.element.currentSrc || record.element.src || "";
      return source.length > 0;
    });
    const heroRecords = records.filter(
      (record) => record.element.dataset.lazyAHero === "true",
    );
    const record = heroRecords.length === 1 ? heroRecords[0] : null;
    if (!record) {
      return {
        supported: false,
        reason: `expected one data-lazy-a-hero video; found ${records.length} videos (${heroRecords.length} marked hero)`,
      };
    }

    const video = record.element;
    return {
      supported: true,
      source: video.currentSrc || video.src,
      createdBeforeSettle: record.createdBeforeSettle,
      initialTime: record.initialTime,
      preSettleObserved: record.preSettleObserved,
      preSettleMaxTime: record.preSettleMaxTime,
      playCalls: record.playCalls,
      playStarts: record.playStarts,
      endedEvents: record.endedEvents,
      playEvents: probe.events.filter(
        (event) => event.type === "play" && event.duration === video.duration,
      ),
      currentTime: video.currentTime,
      duration: video.duration,
      loop: video.loop,
      paused: video.paused,
      ended: video.ended,
      readyState: video.readyState,
    };
  });
}

async function waitForHero(predicate, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  let snapshot = await heroSnapshot();
  while (Date.now() < deadline) {
    if (snapshot.supported && predicate(snapshot)) return snapshot;
    await page.waitForTimeout(50);
    snapshot = await heroSnapshot();
  }
  return snapshot;
}

async function conversationState() {
  return page.evaluate(() => ({
    observable: Boolean(window.__lazyANavigationDebug),
    value: window.__lazyAConversation ?? null,
    candidate: window.__lazyANavCandidate ?? null,
  }));
}

async function decodePng(png) {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function captureCurrentFrame() {
  const [png, compositor] = await Promise.all([
    page.screenshot(),
    page.evaluate(() => window.__lazyACompositor ?? null),
  ]);
  const frame = await decodePng(png);
  return {
    ...frame,
    compositor,
  };
}

async function loadPresentedPixelReferenceCatalog(viewport) {
  const { catalog, catalogUrl } = await page.evaluate(
    async ({ eventName, referenceSuffix, referenceKind, regionEncoding }) => {
      const manifestUrl = new URL("room/manifest.json", document.baseURI);
      const manifestResponse = await fetch(manifestUrl);
      if (!manifestResponse.ok) {
        throw new Error(
          `could not load hero manifest (${manifestResponse.status})`,
        );
      }
      const manifest = await manifestResponse.json();
      const verification = manifest.hero?.verification;
      if (
        verification?.presentationEvent !== eventName ||
        !verification?.presentedPixelReferences?.endsWith(referenceSuffix) ||
        verification?.referenceKind !== referenceKind ||
        verification?.regionEncoding !== regionEncoding
      ) {
        throw new Error(
          "R4 hero verification must declare the compositor presentation event and authored pixel-reference catalog",
        );
      }
      const catalogUrl = new URL(
        verification.presentedPixelReferences,
        document.baseURI,
      );
      const catalogResponse = await fetch(catalogUrl);
      if (!catalogResponse.ok) {
        throw new Error(
          `could not load ${catalogUrl.pathname} (${catalogResponse.status})`,
        );
      }
      return {
        catalog: await catalogResponse.json(),
        catalogUrl: catalogUrl.href,
      };
    },
    {
      eventName: PRESENTED_FRAME_EVENT,
      referenceSuffix: PRESENTED_PIXEL_REFERENCES,
      referenceKind: PRESENTED_PIXEL_REFERENCE_KIND,
      regionEncoding: PRESENTED_PIXEL_REGION_ENCODING,
    },
  );
  return normalizePresentedPixelCatalog(
    catalog,
    `${viewport.width}x${viewport.height}`,
    catalogUrl,
  );
}

async function loadReferenceAsset(source) {
  if (!decodedReferenceCache.has(source)) {
    decodedReferenceCache.set(
      source,
      (async () => {
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(
            `could not load presented-pixel reference ${source} (${response.status})`,
          );
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        return {
          frame: await decodePng(buffer),
          sha256: createHash("sha256").update(buffer).digest("hex"),
        };
      })(),
    );
  }
  return decodedReferenceCache.get(source);
}

async function loadPresentedPixelReference(reference, viewport) {
  const [compositeAsset, regionsAsset, authoredSourceAsset] = await Promise.all(
    [
      loadReferenceAsset(reference.composite),
      loadReferenceAsset(reference.regions),
      loadReferenceAsset(reference.authoredSource),
    ],
  );
  const composite = compositeAsset.frame;
  const regions = regionsAsset.frame;
  for (const [kind, frame] of [
    ["composite", composite],
    ["regions", regions],
  ]) {
    if (frame.width !== viewport.width || frame.height !== viewport.height) {
      throw new Error(
        `${kind} reference for frame ${reference.heroFramePresented} is ${frame.width}x${frame.height}; expected ${viewport.width}x${viewport.height}`,
      );
    }
  }
  if (
    authoredSourceAsset.sha256 !== reference.authoredSourceSha256 ||
    compositeAsset.sha256 !== authoredSourceAsset.sha256
  ) {
    throw new Error(
      `authored source provenance for frame ${reference.heroFramePresented} does not match its delivered composite (${authoredSourceAsset.sha256}/${compositeAsset.sha256}; expected ${reference.authoredSourceSha256})`,
    );
  }
  const regionIssues = referenceRegionMapIssues(regions);
  if (regionIssues.length > 0) {
    throw new Error(
      `region reference for frame ${reference.heroFramePresented} is invalid: ${regionIssues.join("; ")}`,
    );
  }
  return { composite, regions };
}

async function armPresentedFrameCapture(reference) {
  await page.evaluate(
    (target) => window.__heroPresentedFrameProbe.arm(target),
    {
      heroFramePresented: reference.heroFramePresented,
      plateState: reference.plateState,
      projectionFrame: reference.projectionFrame,
    },
  );
}

async function releaseHeroPlayback() {
  await page.evaluate(() => window.__heroLifecycleProbe.releasePlayback());
}

async function captureArmedPresentedFrame(
  reference,
  decodedReference,
  nextReference = null,
) {
  await page.waitForFunction(
    (target) => {
      const snapshot = window.__heroPresentedFrameProbe.snapshot();
      const sequence = snapshot.presentedFramesAfterRelease;
      const invalidSequence =
        sequence.length > 0 &&
        (sequence[0] !== 1 ||
          sequence.some(
            (frame, index) => index > 0 && frame < sequence[index - 1],
          ));
      return (
        invalidSequence ||
        (snapshot.capture?.compositor?.heroFramePresented ===
          target.heroFramePresented &&
          snapshot.capture?.compositor?.plateState === target.plateState &&
          snapshot.capture?.compositor?.projectionFrame ===
            target.projectionFrame)
      );
    },
    {
      heroFramePresented: reference.heroFramePresented,
      plateState: reference.plateState,
      projectionFrame: reference.projectionFrame,
    },
    { timeout: 8_000 },
  );
  const probeBeforeCapture = await page.evaluate(() =>
    window.__heroPresentedFrameProbe.snapshot(),
  );
  const sequenceIssues = presentationSequenceIssues(
    probeBeforeCapture.presentedFramesAfterRelease,
  );
  if (sequenceIssues.length > 0) {
    throw new Error(sequenceIssues.join("; "));
  }
  const [png, probe] = await Promise.all([
    page.screenshot(),
    page.evaluate(() => window.__heroPresentedFrameProbe.snapshot()),
  ]);
  await page.evaluate(
    (nextTarget) => {
      window.__heroPresentedFrameProbe.release();
      if (nextTarget) {
        window.__heroPresentedFrameProbe.arm(nextTarget);
      }
    },
    nextReference
      ? {
          heroFramePresented: nextReference.heroFramePresented,
          plateState: nextReference.plateState,
          projectionFrame: nextReference.projectionFrame,
        }
      : null,
  );
  const frame = await decodePng(png);
  const capture = probe.capture;
  if (
    capture?.nativeVideoFrame?.presentedFrames !==
      reference.heroFramePresented ||
    capture?.compositor?.heroFramePresented !== reference.heroFramePresented ||
    capture?.compositor?.plateState !== reference.plateState ||
    capture?.compositor?.projectionFrame !== reference.projectionFrame
  ) {
    throw new Error(
      `frame callback/compositor state mismatch for reference ${reference.heroFramePresented}: ${JSON.stringify(capture)}`,
    );
  }
  return {
    ...frame,
    compositor: capture.compositor,
    nativeVideoFrame: capture.nativeVideoFrame,
    legacyOcclusionMarkerPresent: capture.legacyOcclusionMarkerPresent,
    reference: decodedReference,
  };
}

function assertAtomicCompositor(viewport, capturedFrame) {
  const label = viewportLabel(viewport);
  const { compositor } = capturedFrame;
  check(
    compositor?.atomic === true &&
      Number.isFinite(compositor?.plateMediaTime) &&
      Number.isInteger(compositor?.projectionFrame) &&
      Number.isInteger(compositor?.heroFramePresented) &&
      compositor?.treatment === "calibrated-room-transfer" &&
      compositor?.occlusion === "authored-depth-geometry" &&
      capturedFrame.nativeVideoFrame?.presentedFrames ===
        compositor.heroFramePresented &&
      capturedFrame.legacyOcclusionMarkerPresent === false,
    `${label} atomic compositor observability`,
    JSON.stringify({
      compositor,
      nativeVideoFrame: capturedFrame.nativeVideoFrame,
      legacyOcclusionMarkerPresent: capturedFrame.legacyOcclusionMarkerPresent,
    }),
  );
}

function assertPresentedPixelContract(
  viewport,
  resting,
  firstPainted,
  playingFrames,
) {
  const label = viewportLabel(viewport);
  const {
    firstFrame,
    playingFrames: treatment,
    motionSamples,
  } = measuredPresentedPixelMetrics(resting, firstPainted, playingFrames);
  check(
    firstFrame?.meanLumaDelta <= 3 && firstFrame?.meanChannelDelta <= 4,
    `${label} resting poster matches the first painted live frame`,
    JSON.stringify(firstFrame),
  );
  check(
    treatment?.minimumTreatmentSamples > 0 &&
      treatment?.maxRoomTreatmentDelta <= 6,
    `${label} representative playing frames match authored per-frame room treatment`,
    JSON.stringify(treatment),
  );
  check(
    motionSamples?.posterAxisSamples > 0 &&
      motionSamples?.posterAxisWeakSamples === 0 &&
      motionSamples?.minPosterAxisEdgeStrength >= MIN_CAPTURED_EDGE_STRENGTH &&
      motionSamples?.maxPosterAxisErrorPx <= 0.75,
    `${label} captured poster-axis edges stay registered`,
    JSON.stringify(motionSamples),
  );
  check(
    motionSamples?.foregroundSamples > 0 &&
      motionSamples?.foregroundWeakSamples === 0 &&
      motionSamples?.minForegroundEdgeStrength >= MIN_CAPTURED_EDGE_STRENGTH &&
      motionSamples?.maxForegroundEdgeErrorPx <= 1,
    `${label} captured foreground occlusion edges stay registered`,
    JSON.stringify(motionSamples),
  );
}

async function waitForRestingEndpoint(id) {
  await page.waitForFunction(
    (endpoint) => {
      const camera = window.__lazyACameraDebug?.snapshot?.();
      return (
        window.__lazyAPlateState?.state === `resting:${endpoint}` &&
        camera?.phase === "resting" &&
        camera?.endpoint === endpoint
      );
    },
    id,
    { timeout: 8_000 },
  );
}

async function beginRegistrationSegment(segment) {
  await page.evaluate(
    (name) => window.__heroRegistrationProbe.beginSegment(name),
    segment,
  );
}

async function captureRegistrationPoint(label) {
  await page.evaluate(
    (name) => window.__heroRegistrationProbe.capture(name),
    label,
  );
}

async function registrationSummary(segment) {
  return page.evaluate(
    (name) => window.__heroRegistrationProbe.summarize(name),
    segment,
  );
}

async function waitForRegistrationSummary(segment, requireDecoded) {
  const deadline = Date.now() + 2_000;
  let summary = await registrationSummary(segment);
  while (Date.now() < deadline) {
    if (
      summary.total > 0 &&
      summary.unresolved === 0 &&
      (!requireDecoded || summary.decoded > 0)
    ) {
      return summary;
    }
    await page.waitForTimeout(25);
    summary = await registrationSummary(segment);
  }
  return summary;
}

async function assertRegistrationSegment(viewport, segment, requireDecoded) {
  const label = viewportLabel(viewport);
  const summary = await waitForRegistrationSummary(segment, requireDecoded);
  const coverageDetail =
    `rendered=${summary.total} records=${summary.rawTotal} ` +
    `decoded=${summary.decoded} waiting=${summary.waiting} ` +
    `points=${summary.points} ` +
    `unresolved=${summary.unresolved} ` +
    `hiddenOffscreen=${summary.hiddenOffscreen}`;
  check(
    summary.total > 0 &&
      summary.points > 0 &&
      (!requireDecoded || summary.decoded > 0) &&
      summary.unresolved === 0,
    `${label} ${segment} frame coverage`,
    coverageDetail,
  );
  check(
    summary.profileMismatches === 0,
    `${label} ${segment} profile selection`,
    `expected=${viewport.profile} mismatches=${summary.profileMismatches}/${summary.rawTotal}`,
  );
  check(
    summary.invalidCorners === 0 &&
      Number.isFinite(summary.maxCornerError) &&
      summary.maxCornerError <= MAX_CORNER_ERROR_CSS_PX,
    `${label} ${segment} four-corner registration`,
    Number.isFinite(summary.maxCornerError)
      ? `max=${summary.maxCornerError.toFixed(3)}px limit=${MAX_CORNER_ERROR_CSS_PX}px invalid=${summary.invalidCorners}`
      : `corner samples unavailable; invalid=${summary.invalidCorners}`,
  );
  check(
    summary.occlusionFailures === 0,
    `${label} ${segment} foreground occlusion`,
    `authored-depth failures=${summary.occlusionFailures}`,
  );
}

async function openDestination(id) {
  const point = await page.evaluate((destination) => {
    const debug = window.__lazyANavigationDebug;
    const row = debug?.sheet.rows.find(
      ({ id: rowId }) => rowId === destination,
    );
    if (!debug || !row) return null;
    return debug.projectSheetPoint(
      row.rect.x + row.rect.width / 2,
      row.rect.y + row.rect.height / 2,
    );
  }, id);
  if (!point) {
    return { ok: false, detail: `authored ${id} row is unavailable` };
  }
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.waitForTimeout(300);
  const beforeClick = await conversationState();
  await page.mouse.click(point.x, point.y);
  try {
    await page.waitForFunction(
      (expected) => window.__lazyAConversation === expected,
      id,
      { timeout: 2_000 },
    );
  } catch {
    const state = await conversationState();
    return {
      ok: false,
      detail: `candidate=${beforeClick.candidate ?? "null"}; expected ${id}, got ${state.value ?? "null"}`,
    };
  }
  try {
    await waitForRestingEndpoint(id);
  } catch {
    const state = await page.evaluate(() => ({
      plate: window.__lazyAPlateState?.state ?? null,
      camera: window.__lazyACameraDebug?.snapshot?.() ?? null,
    }));
    return {
      ok: false,
      detail: `${id} did not settle: ${JSON.stringify(state)}`,
    };
  }
  return {
    ok: true,
    detail: `${id} opened at (${point.x.toFixed(1)}, ${point.y.toFixed(1)}); candidate=${beforeClick.candidate ?? "null"}`,
  };
}

async function closeDestination(id) {
  await page.keyboard.press("Escape");
  try {
    await waitForRestingEndpoint("desk");
    await page.waitForFunction(
      () => window.__lazyAConversation === null,
      null,
      { timeout: 2_000 },
    );
    return { ok: true, detail: `${id} returned to desk` };
  } catch {
    const state = await page.evaluate(() => ({
      conversation: window.__lazyAConversation ?? null,
      plate: window.__lazyAPlateState?.state ?? null,
      camera: window.__lazyACameraDebug?.snapshot?.() ?? null,
    }));
    return { ok: false, detail: JSON.stringify(state) };
  }
}

async function runViewport(viewport) {
  const label = viewportLabel(viewport);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  page = await context.newPage();
  await installPageProbes(viewport.profile);

  try {
    await page.goto(url, { waitUntil: "load" });

    const observed = await waitForHero(() => true);
    check(
      observed.supported,
      `${label} hero video observability`,
      observed.supported ? observed.source : observed.reason,
    );
    if (!observed.supported) return;

    await page.waitForFunction(() => window.__arrivalDone === true, null, {
      timeout: 12_000,
    });
    await waitForRestingEndpoint("desk");
    const settled = await heroSnapshot();
    check(
      settled.createdBeforeSettle && settled.preSettleObserved,
      `${label} pre-settle video observation`,
      `createdBeforeSettle=${settled.createdBeforeSettle} sampled=${settled.preSettleObserved}`,
    );
    check(
      Math.abs(settled.initialTime) <= TIME_EPSILON &&
        settled.preSettleMaxTime <= TIME_EPSILON,
      `${label} pre-settle currentTime is zero`,
      `initial=${fixed(settled.initialTime)} max=${fixed(settled.preSettleMaxTime)}`,
    );
    await captureRegistrationPoint("desk endpoint after arrival");
    await assertRegistrationSegment(viewport, "arrival opening -> desk", true);
    check(
      settled.loop === false,
      `${label} looping is disabled`,
      `loop=${settled.loop}`,
    );
    const references = await loadPresentedPixelReferenceCatalog(viewport);
    const restingReferences = references.filter(
      ({ plateState }) => plateState === "resting:desk",
    );
    const firstReference = restingReferences.find(
      ({ heroFramePresented }) => heroFramePresented === 1,
    );
    const representativeReference = restingReferences.find(
      ({ heroFramePresented }) => heroFramePresented !== 1,
    );
    const forwardReference = references.find(({ plateState }) => {
      if (
        !/^transitioning:desk-to-(films|journal|contact|about)$/.test(
          plateState,
        )
      ) {
        return false;
      }
      const destination = plateState.slice("transitioning:desk-to-".length);
      return references.some(
        (candidate) =>
          candidate.plateState === `transitioning:${destination}-to-desk`,
      );
    });
    const movingDestination = forwardReference.plateState.slice(
      "transitioning:desk-to-".length,
    );
    const reverseReference = references.find(
      ({ plateState }) =>
        plateState === `transitioning:${movingDestination}-to-desk`,
    );
    const decodedReferences = new Map(
      await Promise.all(
        references.map(async (reference) => [
          reference.heroFramePresented,
          await loadPresentedPixelReference(reference, viewport),
        ]),
      ),
    );
    await armPresentedFrameCapture(firstReference);
    const restingPoster = await captureCurrentFrame();
    await releaseHeroPlayback();

    const started = await waitForHero(
      (snapshot) => snapshot.playStarts >= 1,
      8_000,
    );
    const afterStart = await heroSnapshot();
    const firstPlay = afterStart.playEvents[0];
    check(
      afterStart.playCalls === 1 && afterStart.playStarts === 1,
      `${label} one play start after settle`,
      `calls=${afterStart.playCalls} starts=${afterStart.playStarts}`,
    );
    check(
      Boolean(firstPlay?.arrivalDone) &&
        firstPlay.currentTime <= TIME_EPSILON * 2,
      `${label} play starts from zero after settle`,
      firstPlay
        ? `arrivalDone=${firstPlay.arrivalDone} currentTime=${fixed(firstPlay.currentTime)}`
        : `no play event; currentTime=${fixed(started.currentTime)}`,
    );
    const firstPaintedLiveFrame = await captureArmedPresentedFrame(
      firstReference,
      decodedReferences.get(firstReference.heroFramePresented),
      representativeReference,
    );
    const representativePlayingFrame = await captureArmedPresentedFrame(
      representativeReference,
      decodedReferences.get(representativeReference.heroFramePresented),
    );
    assertAtomicCompositor(viewport, firstPaintedLiveFrame);

    const debug = await conversationState();
    check(
      debug.observable,
      `${label} destination state observability`,
      debug.observable
        ? `conversation=${debug.value ?? "null"}`
        : "window.__lazyAConversation is unavailable",
    );

    const playbackSnapshots = [];
    const movingFrames = [];
    let allDestinationsOpened = true;
    let allDeskReturns = true;
    const orderedDestinations = [
      movingDestination,
      ...DESTINATIONS.filter(
        (destination) => destination !== movingDestination,
      ),
    ];
    for (const destination of orderedDestinations) {
      const forward = `desk -> ${destination}`;
      await beginRegistrationSegment(forward);
      const beforeOpen = await heroSnapshot();
      let forwardCapture = null;
      if (destination === movingDestination) {
        await armPresentedFrameCapture(forwardReference);
        forwardCapture = captureArmedPresentedFrame(
          forwardReference,
          decodedReferences.get(forwardReference.heroFramePresented),
        );
      }
      const opened = await openDestination(destination);
      if (forwardCapture) {
        const captured = await forwardCapture;
        movingFrames.push(captured);
        assertAtomicCompositor(viewport, captured);
      }
      allDestinationsOpened &&= opened.ok;
      if (opened.ok) {
        await captureRegistrationPoint(`${destination} endpoint`);
      }
      await assertRegistrationSegment(viewport, forward, true);
      const afterOpen = await heroSnapshot();
      playbackSnapshots.push(afterOpen);
      check(
        opened.ok,
        `${label} open ${destination} destination`,
        opened.detail,
      );

      if (destination === "films") {
        check(
          opened.ok &&
            afterOpen.currentTime > beforeOpen.currentTime + 0.2 &&
            !afterOpen.paused,
          `${label} currentTime advances while destination opens`,
          `${fixed(beforeOpen.currentTime)} -> ${fixed(afterOpen.currentTime)} paused=${afterOpen.paused}`,
        );
      }

      const reverse = `${destination} -> desk`;
      await beginRegistrationSegment(reverse);
      let reverseCapture = null;
      if (destination === movingDestination) {
        await armPresentedFrameCapture(reverseReference);
        reverseCapture = captureArmedPresentedFrame(
          reverseReference,
          decodedReferences.get(reverseReference.heroFramePresented),
        );
      }
      const closed = await closeDestination(destination);
      if (reverseCapture) {
        const captured = await reverseCapture;
        movingFrames.push(captured);
        assertAtomicCompositor(viewport, captured);
      }
      allDeskReturns &&= closed.ok;
      if (closed.ok) {
        await captureRegistrationPoint(`desk endpoint after ${destination}`);
      }
      await assertRegistrationSegment(viewport, reverse, true);
      const afterClose = await heroSnapshot();
      playbackSnapshots.push(afterClose);
      check(closed.ok, `${label} ${destination} desk return`, closed.detail);

      if (destination === "journal") {
        check(
          opened.ok,
          `${label} switch destination during playback`,
          opened.detail,
        );
        check(
          closed.ok,
          `${label} close destination during playback`,
          `conversation=${(await conversationState()).value ?? "null"}`,
        );
      }
    }

    check(
      movingFrames.length === 2 &&
        movingFrames[0]?.compositor?.plateState ===
          forwardReference.plateState &&
        movingFrames[1]?.compositor?.plateState === reverseReference.plateState,
      `${label} forward and reverse moving references were presented`,
      movingFrames
        .map(
          ({ compositor }) =>
            `${compositor.plateState}@hero=${compositor.heroFramePresented}/projection=${compositor.projectionFrame}`,
        )
        .join(", "),
    );
    assertPresentedPixelContract(
      viewport,
      restingPoster,
      firstPaintedLiveFrame,
      [representativePlayingFrame, ...movingFrames],
    );

    const monotonicPlayback = playbackSnapshots.every(
      (snapshot, index) =>
        index === 0 ||
        snapshot.currentTime + TIME_EPSILON >=
          playbackSnapshots[index - 1].currentTime,
    );
    const oneShotPlayback = playbackSnapshots.every(
      (snapshot) => snapshot.playCalls === 1 && snapshot.playStarts === 1,
    );
    check(
      allDestinationsOpened &&
        allDeskReturns &&
        monotonicPlayback &&
        oneShotPlayback,
      `${label} destination close/switch preserves playback`,
      `samples=${playbackSnapshots.map((snapshot) => fixed(snapshot.currentTime)).join(" -> ")} calls=${playbackSnapshots.at(-1)?.playCalls} starts=${playbackSnapshots.at(-1)?.playStarts}`,
    );

    const beforeEnd = await heroSnapshot();
    const endedSnapshot = await waitForHero(
      (snapshot) => snapshot.endedEvents >= 1 || snapshot.ended,
      Math.min(
        Math.max(
          (beforeEnd.duration - beforeEnd.currentTime + 2) * 1_000,
          4_000,
        ),
        16_000,
      ),
    );
    check(
      endedSnapshot.endedEvents === 1 && endedSnapshot.ended,
      `${label} hero reaches ended once`,
      `endedEvents=${endedSnapshot.endedEvents} ended=${endedSnapshot.ended} currentTime=${fixed(endedSnapshot.currentTime)}`,
    );
    const presentedSequence = await page.evaluate(
      () =>
        window.__heroPresentedFrameProbe.snapshot().presentedFramesAfterRelease,
    );
    const sequenceIssues = presentationSequenceIssues(presentedSequence);
    check(
      sequenceIssues.length === 0,
      `${label} compositor presentation begins at frame 1 and stays ordered`,
      sequenceIssues.length > 0
        ? sequenceIssues.join("; ")
        : `${presentedSequence.length} live presentations, first=${presentedSequence[0]}`,
    );

    const finalFrameTime = endedSnapshot.currentTime;
    await page.waitForTimeout(600);
    const held = await heroSnapshot();
    const atFinalFrame =
      Number.isFinite(held.duration) &&
      held.duration > 0 &&
      held.duration - held.currentTime <= 0.15;
    await beginRegistrationSegment("final hold");
    await captureRegistrationPoint("held hero final frame");
    await assertRegistrationSegment(viewport, "final hold", false);
    check(
      endedSnapshot.ended &&
        held.ended &&
        held.paused &&
        atFinalFrame &&
        Math.abs(held.currentTime - finalFrameTime) <= TIME_EPSILON,
      `${label} ended hero holds final frame`,
      `paused=${held.paused} ended=${held.ended} currentTime=${fixed(held.currentTime)} duration=${fixed(held.duration)}`,
    );
    check(
      held.playCalls === 1 && held.playStarts === 1,
      `${label} final hold does not restart playback`,
      `calls=${held.playCalls} starts=${held.playStarts}`,
    );
  } catch (error) {
    check(
      false,
      `${label} gate execution`,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await context.close();
  }
}

try {
  for (const viewport of VIEWPORTS) {
    await runViewport(viewport);
  }
} finally {
  await closeBrowser();
}

console.log(
  `${failures === 0 ? "PASS" : "FAIL"} hero lifecycle: ${checks - failures}/${checks} checks passed`,
);
process.exit(failures === 0 ? 0 : 1);
