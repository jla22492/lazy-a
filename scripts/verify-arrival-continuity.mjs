/**
 * WO 0117-R2 decoded-frame arrival continuity gate.
 *
 * Usage:
 *   node scripts/verify-arrival-continuity.mjs [url]
 *   node scripts/verify-arrival-continuity.mjs --self-test
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const args = process.argv.slice(2);
const selfTestOnly = args.includes("--self-test");
const debug = args.includes("--debug");
const requestedViewport = args
  .find((argument) => argument.startsWith("--viewport="))
  ?.slice("--viewport=".length);
const url =
  args.find((argument) => !argument.startsWith("--")) ??
  "http://localhost:3000/";
const targetBasePath = new URL(url).pathname.replace(/\/+$/, "");
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(resolve(repositoryRoot, "public/room/manifest.json"), "utf8"),
);
const cameraContract = JSON.parse(
  await readFile(
    resolve(repositoryRoot, "assets/master/camera-contract.json"),
    "utf8",
  ),
);

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720, profile: "wide" },
  { name: "tall desktop", width: 1316, height: 1329, profile: "wide" },
  { name: "landscape tablet", width: 1024, height: 768, profile: "wide" },
  { name: "portrait tablet", width: 768, height: 1024, profile: "wide" },
  { name: "phone", width: 375, height: 812, profile: "portrait" },
];
const ARRIVAL_TIMEOUT_MS = 30_000;
const CAMERA_EPSILON = 1e-5;
const MEDIA_TIME_EPSILON = 0.04;
const MAX_PIXEL_DELTA = 2;
const MAX_MEAN_PIXEL_DELTA = 0.5;
const MIN_STABLE_PIXEL_SAMPLES = 32;
const PROBE_PLAYBACK_RATE = 0.125;
const MIN_DECODED_FRAME_RATIO = 0.95;
const MAX_AUTHORED_INDEX_STEP = 2;

function isFiniteTuple(value, length) {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => Number.isFinite(item))
  );
}

function cameraShape(camera) {
  return (
    camera &&
    isFiniteTuple(camera.position, 3) &&
    isFiniteTuple(camera.quaternion, 4) &&
    Number.isFinite(camera.fov)
  );
}

function cameraError(actual, expected) {
  if (!cameraShape(actual) || !cameraShape(expected)) return Infinity;
  return Math.max(
    Math.abs(actual.fov - expected.fov),
    ...actual.position.map((value, index) =>
      Math.abs(value - expected.position[index]),
    ),
    ...actual.quaternion.map((value, index) =>
      Math.abs(value - expected.quaternion[index]),
    ),
  );
}

function pixelDifference(before, after) {
  const beforePixels = new Map(
    (before?.pixels ?? []).map(({ key, rgb }) => [key, rgb]),
  );
  const deltas = [];
  for (const { key, rgb } of after?.pixels ?? []) {
    const prior = beforePixels.get(key);
    if (!isFiniteTuple(prior, 3) || !isFiniteTuple(rgb, 3)) continue;
    deltas.push(...rgb.map((value, index) => Math.abs(value - prior[index])));
  }
  return {
    samples: Math.floor(deltas.length / 3),
    max: deltas.length > 0 ? Math.max(...deltas) : Infinity,
    mean:
      deltas.length > 0
        ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length
        : Infinity,
  };
}

function evidenceIssues(viewport, expected, evidence) {
  const issues = [];
  const frames = Array.isArray(evidence?.frames) ? evidence.frames : [];
  const hold = evidence?.hold;
  const expectedFrames = expected.frames;

  if (evidence?.requestVideoFrameCallbackSupported !== true) {
    issues.push("requestVideoFrameCallback is unavailable or was not observed");
  }
  if (evidence?.plate?.profile !== viewport.profile) {
    issues.push(
      `profile=${String(evidence?.plate?.profile)}; expected=${viewport.profile}`,
    );
  }
  if (hold?.srcPath !== expected.forward) {
    issues.push(
      `held source=${String(hold?.srcPath)}; expected=${expected.forward}`,
    );
  }
  const minimumDecodedFrames = Math.ceil(
    expected.frameCount * MIN_DECODED_FRAME_RATIO,
  );
  if (frames.length < minimumDecodedFrames) {
    issues.push(
      `decoded samples=${frames.length}; expected at least ${minimumDecodedFrames}/${expected.frameCount} frames`,
    );
  }

  const presented = frames.map((frame) => frame.presentedFrames);
  if (
    presented.some((value) => !Number.isInteger(value)) ||
    presented.some(
      (value, index) =>
        index > 0 &&
        (value <= presented[index - 1] ||
          value - presented[index - 1] > MAX_AUTHORED_INDEX_STEP),
    )
  ) {
    issues.push(
      `decoded frame sequence repeated or skipped multiple frames: ${JSON.stringify(presented)}`,
    );
  }

  const mediaTimes = frames.map((frame) => frame.mediaTime);
  if (
    mediaTimes.some((value) => !Number.isFinite(value)) ||
    mediaTimes.some(
      (value, index) => index > 0 && value <= mediaTimes[index - 1],
    ) ||
    (mediaTimes.length > 0 && mediaTimes[0] > MEDIA_TIME_EPSILON) ||
    (mediaTimes.length > 0 &&
      mediaTimes.at(-1) < expected.duration - MEDIA_TIME_EPSILON)
  ) {
    issues.push(
      `media-time coverage is incomplete: first=${String(mediaTimes[0])} last=${String(mediaTimes.at(-1))} duration=${expected.duration}`,
    );
  }
  const authoredFrameIndices = mediaTimes.map((mediaTime) =>
    Math.min(
      Math.round(mediaTime * expected.fps),
      expectedFrames.length - 1,
    ),
  );
  if (
    authoredFrameIndices[0] !== 0 ||
    authoredFrameIndices.at(-1) !== expectedFrames.length - 1 ||
    authoredFrameIndices.some(
      (frameIndex, index) =>
        index > 0 &&
        (frameIndex <= authoredFrameIndices[index - 1] ||
          frameIndex - authoredFrameIndices[index - 1] >
            MAX_AUTHORED_INDEX_STEP),
    )
  ) {
    issues.push(
      `authored frame coverage has an endpoint, repeat, or multi-frame gap: ${JSON.stringify(authoredFrameIndices)}`,
    );
  }

  let worstCameraError = 0;
  let malformedCameraFrames = 0;
  let wrongProfileFrames = 0;
  for (const frame of frames) {
    const frameIndex = Math.min(
      Math.round(frame.mediaTime * expected.fps),
      expectedFrames.length - 1,
    );
    const error = cameraError(frame.camera, expectedFrames[frameIndex]?.camera);
    if (!Number.isFinite(error)) malformedCameraFrames += 1;
    else worstCameraError = Math.max(worstCameraError, error);
    if (frame.profile !== viewport.profile) wrongProfileFrames += 1;
  }
  if (malformedCameraFrames > 0 || worstCameraError > CAMERA_EPSILON) {
    issues.push(
      `decoded camera metadata mismatch: malformed=${malformedCameraFrames} worstError=${worstCameraError}`,
    );
  }
  if (wrongProfileFrames > 0) {
    issues.push(
      `${wrongProfileFrames} decoded frame(s) reported the wrong plate profile`,
    );
  }
  const distinctCameras = new Set(
    frames.map((frame) => JSON.stringify(frame.camera?.position)),
  ).size;
  if (distinctCameras < Math.min(10, expected.frameCount)) {
    issues.push(
      `camera sequence is static or stubbed: ${distinctCameras} distinct position sample(s)`,
    );
  }

  const heldCameraError = cameraError(
    hold?.camera,
    expectedFrames.at(-1)?.camera,
  );
  if (!Number.isFinite(heldCameraError) || heldCameraError > CAMERA_EPSILON) {
    issues.push(`held endpoint camera mismatch: error=${heldCameraError}`);
  }
  const heldAtEnd =
    hold?.connected === true &&
    hold?.visible === true &&
    hold?.isTopPlateMedia === true &&
    hold?.paused === true &&
    hold?.ended === true &&
    Number.isFinite(hold?.currentTime) &&
    Number.isFinite(hold?.duration) &&
    Math.abs(hold.currentTime - hold.duration) <= MEDIA_TIME_EPSILON &&
    evidence?.plate?.state === "resting:desk";
  if (!heldAtEnd) {
    issues.push(
      `final decoded frame was not retained at desk: ${JSON.stringify({
        connected: hold?.connected,
        visible: hold?.visible,
        isTopPlateMedia: hold?.isTopPlateMedia,
        paused: hold?.paused,
        ended: hold?.ended,
        currentTime: hold?.currentTime,
        duration: hold?.duration,
        plateState: evidence?.plate?.state,
      })}`,
    );
  }

  const pixelDelta = pixelDifference(
    frames.at(-1)?.fingerprint,
    hold?.fingerprint,
  );
  if (
    pixelDelta.samples < MIN_STABLE_PIXEL_SAMPLES ||
    pixelDelta.max > MAX_PIXEL_DELTA ||
    pixelDelta.mean > MAX_MEAN_PIXEL_DELTA
  ) {
    issues.push(
      `stable non-hero handoff changed: samples=${pixelDelta.samples} max=${pixelDelta.max} mean=${pixelDelta.mean}`,
    );
  }

  return {
    issues,
    summary: {
      frames: frames.length,
      distinctCameras,
      worstCameraError,
      heldCameraError,
      pixelDelta,
    },
  };
}

function expectedArrival(profile) {
  const variant = manifest.variants?.[profile];
  const transition = variant?.transitions?.["opening-desk"];
  if (
    !variant ||
    !transition ||
    !Array.isArray(transition.frames) ||
    transition.frames.length !== transition.frameCount
  ) {
    throw new Error(`${profile} opening-desk manifest metadata is incomplete`);
  }
  return transition;
}

function expectedArrivalForTarget(profile, basePath = targetBasePath) {
  const authored = expectedArrival(profile);
  return {
    ...authored,
    forward: `${basePath}${authored.forward}`,
  };
}

function runAntiStubSelfTest() {
  const viewport = VIEWPORTS[0];
  const expected = expectedArrival(viewport.profile);
  const authoredForward = expected.forward;
  const firstResolved = expectedArrivalForTarget(viewport.profile, "/lazy-a");
  const secondResolved = expectedArrivalForTarget(viewport.profile, "/lazy-a");
  if (
    expectedArrival(viewport.profile).forward !== authoredForward ||
    firstResolved.forward !== `/lazy-a${authoredForward}` ||
    secondResolved.forward !== firstResolved.forward
  ) {
    throw new Error(
      "arrival target-path resolution mutated or compounded the authored manifest",
    );
  }
  const staticFrame = {
    presentedFrames: 1,
    mediaTime: 0,
    profile: viewport.profile,
    camera: expected.frames[0].camera,
    fingerprint: { pixels: [] },
  };
  const stub = {
    requestVideoFrameCallbackSupported: true,
    plate: { profile: viewport.profile, state: "resting:desk" },
    frames: Array.from({ length: expected.frameCount }, () => staticFrame),
    hold: {
      srcPath: expected.forward,
      connected: true,
      visible: true,
      isTopPlateMedia: true,
      paused: true,
      ended: true,
      currentTime: expected.duration,
      duration: expected.duration,
      camera: expected.frames[0].camera,
      fingerprint: { pixels: [] },
    },
  };
  const result = evidenceIssues(viewport, expected, stub);
  if (result.issues.length < 5) {
    throw new Error(
      `anti-stub self-test expected at least five independent failures; got ${JSON.stringify(result.issues)}`,
    );
  }
  console.log(
    `PASS anti-stub self-test: rejected constant diagnostics with ${result.issues.length} independent acceptance failures`,
  );
  console.log(
    "PASS target-path self-test: repeated deployed resolution remained immutable",
  );
}

runAntiStubSelfTest();
if (selfTestOnly) process.exit(0);

function installArrivalProbe(expected) {
  const expectedPath = expected.forward;
  const expectedDuration = expected.duration;
  const expectedFps = expected.fps;
  const probePlaybackRate = expected.playbackRate;
  const nativePlay = HTMLMediaElement.prototype.play;
  const nativeRequestVideoFrameCallback =
    HTMLVideoElement.prototype.requestVideoFrameCallback;
  const decodedFrames = new Map();
  const firstFrameArmed = new WeakSet();
  let trackedVideo = null;

  const probe = {
    requestVideoFrameCallbackSupported:
      typeof nativeRequestVideoFrameCallback === "function",
    errors: [],
    snapshot: null,
  };

  const sourcePath = (video) => {
    const source = video.currentSrc || video.src || "";
    try {
      return new URL(source, location.href).pathname;
    } catch {
      return source;
    }
  };
  const isArrivalVideo = (video) => sourcePath(video) === expectedPath;
  const clone = (value) => {
    try {
      return value == null ? value : JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  };

  const fingerprint = (video, projection) => {
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) {
      return { error: "video has no decoded pixel data", pixels: [] };
    }
    const thumbnailScale = Math.min(160 / innerWidth, 160 / innerHeight);
    const width = Math.max(1, Math.round(innerWidth * thumbnailScale));
    const height = Math.max(1, Math.round(innerHeight * thumbnailScale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return { error: "2d canvas unavailable", pixels: [] };

    const coverScale = Math.max(
      width / video.videoWidth,
      height / video.videoHeight,
    );
    const renderedWidth = video.videoWidth * coverScale;
    const renderedHeight = video.videoHeight * coverScale;
    const offsetX = (width - renderedWidth) / 2;
    const offsetY = (height - renderedHeight) / 2;
    try {
      context.drawImage(video, offsetX, offsetY, renderedWidth, renderedHeight);
      const data = context.getImageData(0, 0, width, height).data;
      const hero = Array.isArray(projection?.hero) ? projection.hero : [];
      const heroX = hero
        .filter((_, index) => index % 2 === 0)
        .map((value) => offsetX + value * renderedWidth);
      const heroY = hero
        .filter((_, index) => index % 2 === 1)
        .map((value) => offsetY + value * renderedHeight);
      const heroBounds =
        hero.length === 8
          ? {
              left: Math.min(...heroX) - 4,
              right: Math.max(...heroX) + 4,
              top: Math.min(...heroY) - 4,
              bottom: Math.max(...heroY) + 4,
            }
          : null;
      const pixels = [];
      for (let row = 1; row <= 8; row += 1) {
        for (let column = 1; column <= 10; column += 1) {
          const normalizedX = column / 11;
          const normalizedY = row / 9;
          const x = Math.min(
            width - 1,
            Math.max(0, Math.round(normalizedX * (width - 1))),
          );
          const y = Math.min(
            height - 1,
            Math.max(0, Math.round(normalizedY * (height - 1))),
          );
          if (
            heroBounds &&
            x >= heroBounds.left &&
            x <= heroBounds.right &&
            y >= heroBounds.top &&
            y <= heroBounds.bottom
          ) {
            continue;
          }
          const offset = (y * width + x) * 4;
          pixels.push({
            key: `${column}:${row}`,
            rgb: [data[offset], data[offset + 1], data[offset + 2]],
          });
        }
      }
      return { width, height, pixels };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        pixels: [],
      };
    }
  };

  const recordDecodedFrame = (video, metadata) => {
    if (!isArrivalVideo(video) || decodedFrames.has(metadata.presentedFrames)) {
      return;
    }
    trackedVideo = video;
    const projectionForMask = clone(window.__lazyAPlateProjection ?? null);
    const needsFingerprint =
      metadata.mediaTime >= expectedDuration - 1 / expectedFps;
    const frame = {
      presentedFrames: metadata.presentedFrames,
      mediaTime: metadata.mediaTime,
      expectedDisplayTime: metadata.expectedDisplayTime,
      profile: null,
      camera: null,
      fingerprint: needsFingerprint
        ? fingerprint(video, projectionForMask)
        : null,
    };
    decodedFrames.set(metadata.presentedFrames, frame);
    setTimeout(() => {
      const projection = clone(window.__lazyAPlateProjection ?? null);
      frame.profile = window.__lazyAPlateState?.profile ?? null;
      frame.camera = projection?.camera ?? null;
    }, 0);
  };

  const armFirstFrame = (video) => {
    if (
      typeof nativeRequestVideoFrameCallback !== "function" ||
      !isArrivalVideo(video) ||
      firstFrameArmed.has(video)
    ) {
      return;
    }
    firstFrameArmed.add(video);
    const collect = (_now, metadata) => {
      recordDecodedFrame(video, metadata);
      if (!video.ended) {
        nativeRequestVideoFrameCallback.call(video, collect);
      }
    };
    nativeRequestVideoFrameCallback.call(video, collect);
  };

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    const result = nativeSetAttribute.call(this, name, value);
    if (this instanceof HTMLVideoElement && name.toLowerCase() === "src") {
      armFirstFrame(this);
    }
    return result;
  };
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.target instanceof HTMLVideoElement) {
        armFirstFrame(mutation.target);
      }
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLVideoElement) armFirstFrame(node);
        if (node instanceof Element) {
          for (const video of node.querySelectorAll("video")) {
            armFirstFrame(video);
          }
        }
      }
    }
  }).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });

  HTMLMediaElement.prototype.play = function () {
    if (this instanceof HTMLVideoElement && isArrivalVideo(this)) {
      // The gate observes every authored decoded frame. Slow playback keeps
      // tall-viewport paint load from causing Chrome to coalesce callbacks;
      // normal-speed motion quality is covered by the separate review films.
      this.playbackRate = probePlaybackRate;
      armFirstFrame(this);
    }
    return nativePlay.call(this);
  };

  probe.snapshot = () => {
    const video =
      trackedVideo ??
      [...document.querySelectorAll('[data-room-renderer="plate"] video')].find(
        isArrivalVideo,
      ) ??
      null;
    const projection = clone(window.__lazyAPlateProjection ?? null);
    const plate = clone(window.__lazyAPlateState ?? null);
    let hold = null;
    if (video) {
      const style = getComputedStyle(video);
      const bounds = video.getBoundingClientRect();
      const media = [
        ...video.parentElement.querySelectorAll("img, video"),
      ].filter((element) => {
        const mediaStyle = getComputedStyle(element);
        return (
          mediaStyle.display !== "none" &&
          mediaStyle.visibility !== "hidden" &&
          Number(mediaStyle.opacity) > 0
        );
      });
      hold = {
        srcPath: sourcePath(video),
        connected: video.isConnected,
        visible:
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0 &&
          bounds.width >= innerWidth &&
          bounds.height >= innerHeight,
        isTopPlateMedia: media.at(-1) === video,
        paused: video.paused,
        ended: video.ended,
        currentTime: video.currentTime,
        duration: video.duration,
        readyState: video.readyState,
        camera: projection?.camera ?? null,
        fingerprint: fingerprint(video, projection),
      };
    }
    return {
      requestVideoFrameCallbackSupported:
        probe.requestVideoFrameCallbackSupported,
      errors: [...probe.errors],
      frames: clone(
        [...decodedFrames.values()].sort(
          (left, right) => left.presentedFrames - right.presentedFrames,
        ),
      ),
      plate,
      hold,
    };
  };

  Object.defineProperty(window, "__lazyAArrivalContinuityProbe", {
    configurable: false,
    value: probe,
  });
}

let failures = 0;
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const closeBrowser = () =>
  Promise.race([
    browser.close(),
    new Promise((resolveClose) => setTimeout(resolveClose, 1_500)),
  ]);

try {
  for (const viewport of VIEWPORTS.filter(
    ({ name }) => !requestedViewport || name === requestedViewport,
  )) {
    const label = `${viewport.name} ${viewport.width}x${viewport.height}`;
    const expected = expectedArrivalForTarget(viewport.profile);
    const expectedProfile =
      viewport.width <= cameraContract.selection.phoneMaxWidth
        ? "portrait"
        : "wide";
    if (expectedProfile !== viewport.profile) {
      throw new Error(
        `${label} verifier profile contradicts camera contract: ${expectedProfile}`,
      );
    }

    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const pageErrors = [];
    const hydrationErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      const text = message.text();
      if (
        message.type() === "error" &&
        /hydrated but some attributes|hydration mismatch/i.test(text)
      ) {
        hydrationErrors.push(text);
      }
    });
    try {
      await page.addInitScript(installArrivalProbe, {
        forward: expected.forward,
        duration: expected.duration,
        fps: expected.fps,
        playbackRate: PROBE_PLAYBACK_RATE,
      });
      await page.goto(url, { waitUntil: "load" });
      await page.waitForFunction(() => window.__arrivalDone === true, null, {
        timeout: ARRIVAL_TIMEOUT_MS,
      });
      await page.waitForTimeout(250);
      const evidence = await page.evaluate(() =>
        window.__lazyAArrivalContinuityProbe?.snapshot?.(),
      );
      const result = evidenceIssues(viewport, expected, evidence);
      if (result.issues.length > 0) {
        failures += result.issues.length;
        console.log(`FAIL ${label}:`);
        for (const issue of result.issues) console.log(`  - ${issue}`);
        if (debug && evidence) {
          const cameraMismatches = evidence.frames.flatMap((frame) => {
            const frameIndex = Math.min(
              Math.round(frame.mediaTime * expected.fps),
              expected.frames.length - 1,
            );
            const error = cameraError(
              frame.camera,
              expected.frames[frameIndex]?.camera,
            );
            return error > CAMERA_EPSILON
              ? [
                  {
                    index: frameIndex,
                    presented: frame.presentedFrames,
                    mediaTime: frame.mediaTime,
                    error,
                    actual: frame.camera,
                    expected: expected.frames[frameIndex]?.camera,
                  },
                ]
              : [];
          });
          console.log(
            `  DEBUG frames: ${JSON.stringify({
              first: evidence.frames.at(0),
              last: evidence.frames.at(-1),
              cameraMismatches: cameraMismatches.slice(0, 5),
            })}`,
          );
        }
      } else {
        const { summary } = result;
        console.log(
          `PASS ${label}: ${summary.frames}/${expected.frameCount} decoded frames; profile=${viewport.profile}; cameras=${summary.distinctCameras}; cameraError=${summary.worstCameraError.toExponential(2)}; heldCameraError=${summary.heldCameraError.toExponential(2)}; stablePixels=${summary.pixelDelta.samples}; pixelDelta=max ${summary.pixelDelta.max}, mean ${summary.pixelDelta.mean.toFixed(3)}`,
        );
      }
      if (pageErrors.length > 0) {
        failures += pageErrors.length;
        for (const error of pageErrors) {
          console.log(`FAIL ${label} page error: ${error}`);
        }
      }
      if (hydrationErrors.length > 0) {
        failures += hydrationErrors.length;
        for (const error of hydrationErrors) {
          console.log(`FAIL ${label} hydration error: ${error}`);
        }
      }
    } catch (error) {
      failures += 1;
      console.log(
        `FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await closeBrowser();
}

process.exit(failures === 0 ? 0 : 1);
