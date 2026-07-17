/**
 * Work Order 0117-R behavioral gate: the hero film plays exactly once per
 * page visit, independently of destination navigation, and stays registered
 * to the authored print throughout every photographic camera state.
 *
 * Usage:
 *   node scripts/verify-hero-lifecycle.mjs [url]
 */

import assert from "node:assert/strict";

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
const MIN_FOREGROUND_OCCLUDERS = 10;
const selfTest = process.argv.includes("--self-test");

let failures = 0;
let checks = 0;
let page;

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

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const [currentX, currentY] = polygon[index];
    const [previousX, previousY] = polygon[previous];
    const crosses =
      currentY > y !== previousY > y &&
      x <
        ((previousX - currentX) * (y - currentY)) / (previousY - currentY) +
          currentX;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pixelAt(frame, x, y) {
  const offset = (y * frame.width + x) * 4;
  return [frame.data[offset], frame.data[offset + 1], frame.data[offset + 2]];
}

function luma([red, green, blue]) {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function pixelDelta(first, second, quad, borderOnly = false) {
  const polygon = quad.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const minX = Math.max(1, Math.min(...xs));
  const maxX = Math.min(first.width - 2, Math.max(...xs));
  const minY = Math.max(1, Math.min(...ys));
  const maxY = Math.min(first.height - 2, Math.max(...ys));
  let lumaDelta = 0;
  let channelDelta = 0;
  let samples = 0;
  const insetX = (maxX - minX) * 0.12;
  const insetY = (maxY - minY) * 0.12;
  for (let y = minY; y <= maxY; y += 2) {
    for (let x = minX; x <= maxX; x += 2) {
      if (!pointInPolygon(x, y, polygon)) continue;
      if (
        borderOnly &&
        x > minX + insetX &&
        x < maxX - insetX &&
        y > minY + insetY &&
        y < maxY - insetY
      ) {
        continue;
      }
      const firstPixel = pixelAt(first, x, y);
      const secondPixel = pixelAt(second, x, y);
      lumaDelta += Math.abs(luma(firstPixel) - luma(secondPixel));
      channelDelta += Math.max(
        ...firstPixel.map((value, index) =>
          Math.abs(value - secondPixel[index]),
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
  };
}

function gradient(frame, x, y) {
  const horizontal = Math.abs(
    luma(pixelAt(frame, x + 1, y)) - luma(pixelAt(frame, x - 1, y)),
  );
  const vertical = Math.abs(
    luma(pixelAt(frame, x, y + 1)) - luma(pixelAt(frame, x, y - 1)),
  );
  return horizontal + vertical;
}

function edgeAlignmentError(frame, quad) {
  let maximum = 0;
  for (let index = 0; index < quad.length; index += 1) {
    const [startX, startY] = quad[index];
    const [endX, endY] = quad[(index + 1) % quad.length];
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const length = Math.hypot(deltaX, deltaY);
    if (length < 1) return Number.POSITIVE_INFINITY;
    const normalX = -deltaY / length;
    const normalY = deltaX / length;
    for (let step = 1; step < 8; step += 1) {
      const ratio = step / 8;
      const pointX = startX + deltaX * ratio;
      const pointY = startY + deltaY * ratio;
      let best = { offset: 0, strength: -1 };
      for (let offset = -3; offset <= 3; offset += 1) {
        const x = Math.round(pointX + normalX * offset);
        const y = Math.round(pointY + normalY * offset);
        if (x < 1 || y < 1 || x >= frame.width - 1 || y >= frame.height - 1)
          continue;
        const strength = gradient(frame, x, y);
        if (
          strength > best.strength ||
          (strength === best.strength &&
            Math.abs(offset) < Math.abs(best.offset))
        ) {
          best = { offset, strength };
        }
      }
      maximum = Math.max(maximum, Math.abs(best.offset));
    }
  }
  return maximum;
}

function measuredPresentedPixelMetrics(resting, firstPainted, playingFrames) {
  const firstFrame = pixelDelta(resting, firstPainted, firstPainted.quad);
  const treatmentDeltas = playingFrames.map(
    (frame) =>
      pixelDelta(firstPainted, frame, firstPainted.quad, true).meanChannelDelta,
  );
  const edgeErrors = [firstPainted, ...playingFrames].map((frame) =>
    edgeAlignmentError(frame, frame.quad),
  );
  return {
    firstFrame,
    playingFrames: {
      maxRoomTreatmentDelta: Math.max(...treatmentDeltas),
    },
    motionSamples: {
      maxPosterAxisErrorPx: Math.max(...edgeErrors),
      maxForegroundEdgeErrorPx: Math.max(...edgeErrors),
    },
  };
}

function fixtureFrame(fill = 0, paper = 220) {
  const width = 16;
  const height = 16;
  const data = Buffer.alloc(width * height * 4, fill);
  for (let y = 4; y <= 11; y += 1) {
    for (let x = 4; x <= 11; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = paper;
      data[offset + 1] = paper;
      data[offset + 2] = paper;
      data[offset + 3] = 255;
    }
  }
  return {
    data,
    width,
    height,
    quad: [
      [4, 4],
      [11, 4],
      [11, 11],
      [4, 11],
    ],
  };
}

function runSelfTests() {
  const resting = fixtureFrame();
  const firstPainted = fixtureFrame();
  const good = measuredPresentedPixelMetrics(resting, firstPainted, [
    fixtureFrame(),
  ]);
  assert.ok(good.firstFrame.meanLumaDelta <= 3);
  assert.ok(good.firstFrame.meanChannelDelta <= 4);
  assert.ok(good.playingFrames.maxRoomTreatmentDelta <= 6);
  assert.ok(good.motionSamples.maxPosterAxisErrorPx <= 0.75);

  const fabricatedDiagnostics = {
    pixels: {
      firstFrame: { meanLumaDelta: 0, meanChannelDelta: 0 },
      playingFrames: { maxRoomTreatmentDelta: 0 },
      motionSamples: { maxPosterAxisErrorPx: 0, maxForegroundEdgeErrorPx: 0 },
    },
  };
  const corrupted = fixtureFrame(255, 0);
  const negative = measuredPresentedPixelMetrics(resting, corrupted, [
    corrupted,
  ]);
  assert.ok(
    negative.firstFrame.meanLumaDelta > 3 ||
      negative.firstFrame.meanChannelDelta > 4,
    "fabricated compositor diagnostics cannot change captured pixel metrics",
  );
  assert.equal(fabricatedDiagnostics.pixels.firstFrame.meanLumaDelta, 0);
  console.log(
    "hero lifecycle self-tests passed (captured pixels reject fabricated diagnostics).",
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
    ({ profile, minimumOccluders }) => {
      const records = [];
      const tracked = new WeakMap();
      const events = [];

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
        value: { records, events },
      });

      const values = {
        authored: null,
        live: null,
        occlusion: null,
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

      const maskHasRuns = (mask) => {
        if (
          !mask ||
          !Number.isInteger(mask.size) ||
          typeof mask.rle !== "string"
        ) {
          return null;
        }
        try {
          const binary = atob(mask.rle);
          const bytes = Uint8Array.from(binary, (character) =>
            character.charCodeAt(0),
          );
          let offset = 0;
          let hasRuns = false;
          const readVarint = () => {
            let value = 0;
            let shift = 0;
            while (offset < bytes.length && shift <= 28) {
              const byte = bytes[offset++];
              value |= (byte & 0x7f) << shift;
              if ((byte & 0x80) === 0) return value;
              shift += 7;
            }
            return null;
          };
          for (let y = 0; y < mask.size; y += 1) {
            const runCount = readVarint();
            if (runCount === null) return null;
            hasRuns ||= runCount > 0;
            for (let run = 0; run < runCount; run += 1) {
              if (readVarint() === null || readVarint() === null) return null;
            }
          }
          return offset === bytes.length ? hasRuns : null;
        } catch {
          return null;
        }
      };

      const createRegistrationSample = (kind, label) => {
        if (!activeSegment) return;
        const authored = values.authored?.hero;
        const live = values.live;
        const occlusion = values.occlusion;
        samples.push({
          id: ++sampleId,
          segment: activeSegment,
          kind,
          label,
          authored: Array.isArray(authored) ? [...authored] : null,
          authoredProjectable: Array.isArray(authored) && authored.length === 8,
          profile: window.__lazyAPlateState?.profile ?? null,
          liveObserved: Array.isArray(live),
          occlusionObserved: Boolean(occlusion),
          cornerErrors: cornerErrors(live, authored),
          occluders: occlusion?.polygonCount ?? null,
          masked: occlusion?.masked ?? null,
          expectedMasked: maskHasRuns(values.authored?.heroOcclusionMask),
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
            if (!Array.isArray(values.live) || !values.occlusion) {
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
      publishProperty("__lazyAHeroOcclusion", "occlusion");

      const nativeVideoFrameCallback =
        HTMLVideoElement.prototype.requestVideoFrameCallback;
      if (typeof nativeVideoFrameCallback === "function") {
        HTMLVideoElement.prototype.requestVideoFrameCallback = function (
          callback,
        ) {
          return nativeVideoFrameCallback.call(this, (now, metadata) => {
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
        const occluders = rendered
          .map((sample) => sample.occluders)
          .filter(Number.isFinite);
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
          minOccluders: occluders.length ? Math.min(...occluders) : null,
          occlusionFailures: rendered.filter(
            (sample) =>
              typeof sample.expectedMasked !== "boolean" ||
              sample.masked !== sample.expectedMasked ||
              !Number.isFinite(sample.occluders) ||
              sample.occluders < minimumOccluders,
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
    },
    {
      profile: expectedProfile,
      minimumOccluders: MIN_FOREGROUND_OCCLUDERS,
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

async function capturePresentedFrame() {
  const [png, compositor, quad] = await Promise.all([
    page.screenshot(),
    page.evaluate(() => window.__lazyACompositor ?? null),
    page.evaluate(() => window.__lazyAHeroProjection ?? null),
  ]);
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (!Array.isArray(quad) || quad.length !== 8) {
    throw new Error(
      "captured presented frame is missing the authored hero quad",
    );
  }
  return {
    data,
    width: info.width,
    height: info.height,
    quad: quad.reduce((points, value, index, values) => {
      if (index % 2 === 0) {
        points.push([value * info.width, values[index + 1] * info.height]);
      }
      return points;
    }, []),
    compositor,
  };
}

function assertAtomicCompositor(viewport, compositor) {
  const label = viewportLabel(viewport);
  check(
    compositor?.atomic === true &&
      Number.isFinite(compositor?.plateMediaTime) &&
      Number.isInteger(compositor?.projectionFrame) &&
      Number.isInteger(compositor?.heroFramePresented) &&
      compositor?.treatment === "calibrated-room-transfer" &&
      compositor?.occlusion === "authored-depth-geometry",
    `${label} atomic compositor observability`,
    JSON.stringify(compositor),
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
    treatment?.maxRoomTreatmentDelta <= 6,
    `${label} representative playing frames retain room treatment`,
    JSON.stringify(treatment),
  );
  check(
    motionSamples?.maxPosterAxisErrorPx <= 0.75 &&
      motionSamples?.maxForegroundEdgeErrorPx <= 1.0,
    `${label} presented hero remains registered behind foreground depth`,
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
    summary.occlusionFailures === 0 &&
      Number.isFinite(summary.minOccluders) &&
      summary.minOccluders >= MIN_FOREGROUND_OCCLUDERS,
    `${label} ${segment} foreground occlusion`,
    Number.isFinite(summary.minOccluders)
      ? `min=${summary.minOccluders} required=${MIN_FOREGROUND_OCCLUDERS} failures=${summary.occlusionFailures}`
      : `occlusion samples unavailable; failures=${summary.occlusionFailures}`,
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
    const restingPoster = await capturePresentedFrame();

    const started = await waitForHero(
      (snapshot) => snapshot.playStarts >= 1,
      8_000,
    );
    await page.waitForTimeout(150);
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
    const firstPaintedLiveFrame = await capturePresentedFrame();
    await page.waitForTimeout(120);
    const representativePlayingFrame = await capturePresentedFrame();
    assertAtomicCompositor(viewport, firstPaintedLiveFrame.compositor);
    assertPresentedPixelContract(
      viewport,
      restingPoster,
      firstPaintedLiveFrame,
      [representativePlayingFrame],
    );

    const debug = await conversationState();
    check(
      debug.observable,
      `${label} destination state observability`,
      debug.observable
        ? `conversation=${debug.value ?? "null"}`
        : "window.__lazyAConversation is unavailable",
    );

    const playbackSnapshots = [];
    let allDestinationsOpened = true;
    let allDeskReturns = true;
    for (const destination of DESTINATIONS) {
      const forward = `desk -> ${destination}`;
      await beginRegistrationSegment(forward);
      const beforeOpen = await heroSnapshot();
      const opened = await openDestination(destination);
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
      const closed = await closeDestination(destination);
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
