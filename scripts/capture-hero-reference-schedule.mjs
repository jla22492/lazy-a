/**
 * Record reproducible browser-presented frame bindings for the offline hero
 * reference author. Browser pixels are never written: screenshots mirror the
 * lifecycle verifier's atomic pause/capture/resume evidence path.
 *
 * Usage:
 *   node scripts/capture-hero-reference-schedule.mjs [url] [output]
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { chromium } from "playwright";
import { PerspectiveCamera, Quaternion, Vector3, Vector4 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

globalThis.ProgressEvent ??= class ProgressEvent {};

const argumentsList = process.argv.slice(2);
const positionalArguments = argumentsList.filter(
  (argument) => !argument.startsWith("--"),
);
const planOnly = argumentsList.includes("--plan-only");
const url = positionalArguments[0] ?? "http://127.0.0.1:3000/";
const output = resolve(
  positionalArguments[1] ?? "build/wo-0117-r/hero-reference-schedule.json",
);
const manifest = JSON.parse(
  await readFile("public/room/manifest.json", "utf8"),
);
const compositorBytes = await readFile("public/room/hero/hero-compositor.glb");
const compositor = await new Promise((resolveGltf, rejectGltf) => {
  new GLTFLoader().parse(
    compositorBytes.buffer.slice(
      compositorBytes.byteOffset,
      compositorBytes.byteOffset + compositorBytes.byteLength,
    ),
    "",
    resolveGltf,
    rejectGltf,
  );
});
compositor.scene.updateMatrixWorld(true);
const compositorMeshes = [];
compositor.scene.traverse((object) => {
  if (!object.isMesh) return;
  const position = object.geometry.attributes.position;
  const indices = object.geometry.index
    ? Array.from(object.geometry.index.array)
    : Array.from({ length: position.count }, (_, index) => index);
  compositorMeshes.push({
    name: object.name,
    indices,
    vertices: Array.from({ length: position.count }, (_, index) =>
      new Vector3(
        position.getX(index),
        position.getY(index),
        position.getZ(index),
      ).applyMatrix4(object.matrixWorld),
    ),
  });
});
const heroSurface = compositorMeshes.find(
  ({ name }) => name === "HeroLiveSurface",
);
const heroOccluders = compositorMeshes.filter(({ name }) =>
  name.startsWith("HeroOccluder_"),
);
assert.ok(heroSurface, "authored HeroLiveSurface");
assert.equal(heroOccluders.length, 13, "authored HeroOccluder count");
const profiledNavigationProxy = "HeroOccluder_ProductionNavigationSheet_";
function heroOccludersForProfile(profile) {
  const selected = heroOccluders.filter(
    ({ name }) =>
      !name.startsWith(profiledNavigationProxy) ||
      name === `${profiledNavigationProxy}${profile}`,
  );
  assert.equal(selected.length, 12, `${profile} active HeroOccluder count`);
  return selected;
}
const allViewports = [
  { name: "desktop", width: 1280, height: 720, profile: "wide" },
  { name: "tall-desktop", width: 1316, height: 1329, profile: "wide" },
  { name: "tablet-landscape", width: 1024, height: 768, profile: "wide" },
  { name: "tablet-portrait", width: 768, height: 1024, profile: "wide" },
  { name: "phone", width: 375, height: 812, profile: "portrait" },
];
const viewportFilter = argumentsList
  .find((argument) => argument.startsWith("--viewport="))
  ?.split("=")[1];
const viewports = viewportFilter
  ? allViewports.filter(({ name }) => name === viewportFilter)
  : allViewports;
assert.ok(viewports.length > 0, `unknown viewport ${viewportFilter}`);
const destinations = ["films", "journal", "contact", "about"];
const presentedEvent = "lazy-a:compositor-frame-presented";
const authoringHeroPlaybackRate = 0.4;
const authoringPlatePlaybackRate = 0.5;
const minimumTargetProjectionGap = 2;

function visibleHeroArea(frame, viewport) {
  if (!Array.isArray(frame?.hero) || frame.hero.length !== 8) return 0;
  const profile = manifest.variants[viewport.profile];
  const scale = Math.max(
    viewport.width / profile.width,
    viewport.height / profile.height,
  );
  const offsetX = (viewport.width - profile.width * scale) / 2;
  const offsetY = (viewport.height - profile.height * scale) / 2;
  const xs = frame.hero
    .filter((_, index) => index % 2 === 0)
    .map((value) => offsetX + value * profile.width * scale);
  const ys = frame.hero
    .filter((_, index) => index % 2 === 1)
    .map((value) => offsetY + value * profile.height * scale);
  const width = Math.max(
    0,
    Math.min(viewport.width, Math.max(...xs)) - Math.max(0, Math.min(...xs)),
  );
  const height = Math.max(
    0,
    Math.min(viewport.height, Math.max(...ys)) - Math.max(0, Math.min(...ys)),
  );
  return (width * height) / (viewport.width * viewport.height);
}

function createProjectionCamera(frame, viewport) {
  const camera = new PerspectiveCamera(
    frame.camera.fov,
    viewport.width / viewport.height,
    0.1,
    1000,
  );
  camera.position.copy(new Vector3(...frame.camera.position));
  camera.quaternion.copy(new Quaternion(...frame.camera.quaternion));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function projectMesh(mesh, camera, width, height) {
  return mesh.vertices.map((world) => {
    const cameraPoint = world.clone().applyMatrix4(camera.matrixWorldInverse);
    const clip = new Vector4(
      cameraPoint.x,
      cameraPoint.y,
      cameraPoint.z,
      1,
    ).applyMatrix4(camera.projectionMatrix);
    const inverseW = clip.w === 0 ? 0 : 1 / clip.w;
    return {
      x: (clip.x * inverseW * 0.5 + 0.5) * width,
      y: (0.5 - clip.y * inverseW * 0.5) * height,
      z: clip.z * inverseW,
      inFront: clip.w > 0,
    };
  });
}

function edgeFunction(a, b, x, y) {
  return (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
}

function rasterDepth(mesh, projected, width, height, depth, mask) {
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const vertices = [
      projected[mesh.indices[offset]],
      projected[mesh.indices[offset + 1]],
      projected[mesh.indices[offset + 2]],
    ];
    if (vertices.some(({ inFront }) => !inFront)) continue;
    const minX = Math.max(
      0,
      Math.floor(Math.min(...vertices.map(({ x }) => x))),
    );
    const maxX = Math.min(
      width - 1,
      Math.ceil(Math.max(...vertices.map(({ x }) => x))),
    );
    const minY = Math.max(
      0,
      Math.floor(Math.min(...vertices.map(({ y }) => y))),
    );
    const maxY = Math.min(
      height - 1,
      Math.ceil(Math.max(...vertices.map(({ y }) => y))),
    );
    if (minX > maxX || minY > maxY) continue;
    const area = edgeFunction(
      vertices[0],
      vertices[1],
      vertices[2].x,
      vertices[2].y,
    );
    if (Math.abs(area) < 1e-9) continue;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const sampleX = x + 0.5;
        const sampleY = y + 0.5;
        const barycentric = [
          edgeFunction(vertices[1], vertices[2], sampleX, sampleY) / area,
          edgeFunction(vertices[2], vertices[0], sampleX, sampleY) / area,
          edgeFunction(vertices[0], vertices[1], sampleX, sampleY) / area,
        ];
        if (barycentric.some((value) => value < -1e-6)) continue;
        const pixel = y * width + x;
        const z =
          barycentric[0] * vertices[0].z +
          barycentric[1] * vertices[1].z +
          barycentric[2] * vertices[2].z;
        if (z > depth[pixel]) continue;
        depth[pixel] = z;
        if (mask) mask[pixel] = 1;
      }
    }
  }
}

const occlusionScoreCache = new Map();

function occlusionEdgeScore(frame, viewport) {
  const key = `${viewport.width}x${viewport.height}:${JSON.stringify(
    frame.camera,
  )}`;
  if (occlusionScoreCache.has(key)) return occlusionScoreCache.get(key);
  const scale = Math.min(1, 256 / Math.max(viewport.width, viewport.height));
  const width = Math.max(1, Math.round(viewport.width * scale));
  const height = Math.max(1, Math.round(viewport.height * scale));
  const camera = createProjectionCamera(frame, viewport);
  const pixels = width * height;
  const surfaceDepth = new Float32Array(pixels);
  surfaceDepth.fill(Number.POSITIVE_INFINITY);
  const surfaceMask = new Uint8Array(pixels);
  rasterDepth(
    heroSurface,
    projectMesh(heroSurface, camera, width, height),
    width,
    height,
    surfaceDepth,
    surfaceMask,
  );
  const occluderDepth = new Float32Array(pixels);
  occluderDepth.fill(Number.POSITIVE_INFINITY);
  for (const occluder of heroOccludersForProfile(viewport.profile)) {
    rasterDepth(
      occluder,
      projectMesh(occluder, camera, width, height),
      width,
      height,
      occluderDepth,
    );
  }
  const occluded = new Uint8Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    occluded[pixel] =
      surfaceMask[pixel] && occluderDepth[pixel] < surfaceDepth[pixel] - 1e-7
        ? 1
        : 0;
  }
  let score = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!surfaceMask[pixel]) continue;
      if (
        x + 1 < width &&
        surfaceMask[pixel + 1] &&
        occluded[pixel] !== occluded[pixel + 1]
      ) {
        score += 1;
      }
      if (
        y + 1 < height &&
        surfaceMask[pixel + width] &&
        occluded[pixel] !== occluded[pixel + width]
      ) {
        score += 1;
      }
    }
  }
  occlusionScoreCache.set(key, score);
  return score;
}

function encodedFrameCount(profile, destination, direction) {
  const filename =
    direction === "forward"
      ? `desk-${destination}.mp4`
      : `${destination}-desk.mp4`;
  const source = resolve(`public/room/${profile}/transitions/${filename}`);
  return Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-count_frames",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=nb_read_frames",
        "-of",
        "default=nokey=1:noprint_wrappers=1",
        source,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
}

function phaseTargets(viewport, destination, direction) {
  const frames =
    manifest.variants[viewport.profile].transitions[`desk-${destination}`]
      .frames;
  const available = encodedFrameCount(viewport.profile, destination, direction);
  const runtimeFrames = (
    direction === "forward" ? frames : [...frames].reverse()
  ).slice(0, available);
  let visible = runtimeFrames
    .map((frame, projectionFrame) => ({
      projectionFrame,
      area: visibleHeroArea(frame, viewport),
    }))
    .filter(
      ({ projectionFrame, area }) =>
        projectionFrame > 0 &&
        projectionFrame < runtimeFrames.length - 1 &&
        area >= 0.004,
    );
  if (visible.length < 3) {
    visible = runtimeFrames
      .map((frame, projectionFrame) => ({
        projectionFrame,
        area: visibleHeroArea(frame, viewport),
      }))
      .filter(
        ({ projectionFrame, area }) =>
          projectionFrame > 0 &&
          projectionFrame < runtimeFrames.length - 1 &&
          area >= 0.002,
      );
  }
  assert.ok(
    visible.length >= 3,
    `${viewport.name} ${destination} ${direction} lacks three visible hero samples`,
  );
  const scored = visible.map(({ projectionFrame, area }) => ({
    projectionFrame,
    area,
    occlusionEdgeScore: occlusionEdgeScore(
      runtimeFrames[projectionFrame],
      viewport,
    ),
  }));
  const boundaries = [
    0,
    Math.ceil(scored.length / 3),
    Math.ceil((scored.length * 2) / 3),
    scored.length,
  ];
  const phaseCandidates = [0, 1, 2].map((phase) => {
    const candidates = scored.slice(boundaries[phase], boundaries[phase + 1]);
    assert.ok(candidates.length > 0, `${viewport.name} phase ${phase} samples`);
    const center = (candidates.length - 1) / 2;
    return candidates
      .map((candidate, index) => ({
        ...candidate,
        distanceFromCenter: Math.abs(index - center),
      }))
      .sort(
        (left, right) =>
          right.occlusionEdgeScore - left.occlusionEdgeScore ||
          left.distanceFromCenter - right.distanceFromCenter,
      );
  });
  const combinations = phaseCandidates[0].flatMap((early) =>
    phaseCandidates[1].flatMap((mid) =>
      phaseCandidates[2]
        .filter(
          (late) =>
            mid.projectionFrame - early.projectionFrame >=
              minimumTargetProjectionGap &&
            late.projectionFrame - mid.projectionFrame >=
              minimumTargetProjectionGap,
        )
        .map((late) => [early, mid, late]),
    ),
  );
  assert.ok(
    combinations.length > 0,
    `${viewport.name} ${destination} ${direction} lacks three phase samples with ${minimumTargetProjectionGap}-frame separation`,
  );
  return combinations.sort(
    (left, right) =>
      right.reduce((sum, target) => sum + target.occlusionEdgeScore, 0) -
        left.reduce((sum, target) => sum + target.occlusionEdgeScore, 0) ||
      left.reduce((sum, target) => sum + target.distanceFromCenter, 0) -
        right.reduce((sum, target) => sum + target.distanceFromCenter, 0),
  )[0];
}

async function installTimingProbe(page) {
  await page.addInitScript(
    ({ eventName, platePlaybackRate }) => {
      const nativePlay = HTMLMediaElement.prototype.play;
      const pendingHeroPlays = [];
      const videos = [];
      const heroVideoFrames = new WeakMap();
      let playbackReleased = false;
      let target = null;
      let capture = null;
      const heldVideos = [];
      let overlay = null;
      let activePlateSource = null;

      const nativeCreateElement = Document.prototype.createElement;
      Document.prototype.createElement = function createElement(
        localName,
        options,
      ) {
        const element = nativeCreateElement.call(this, localName, options);
        if (element instanceof HTMLVideoElement) videos.push(element);
        return element;
      };

      const nativeVideoFrameCallback =
        HTMLVideoElement.prototype.requestVideoFrameCallback;
      if (typeof nativeVideoFrameCallback === "function") {
        HTMLVideoElement.prototype.requestVideoFrameCallback = function (
          callback,
        ) {
          return nativeVideoFrameCallback.call(this, (now, metadata) => {
            if (this.dataset.lazyAHero === "true") {
              heroVideoFrames.set(this, metadata);
            }
            callback(now, metadata);
          });
        };
      }

      HTMLMediaElement.prototype.play = function play() {
        if (
          this instanceof HTMLVideoElement &&
          Boolean(this.dataset.lazyAPlate)
        ) {
          const source = this.currentSrc || this.src;
          this.playbackRate = source.includes("/opening-desk.")
            ? 1
            : platePlaybackRate;
        }
        if (
          this instanceof HTMLVideoElement &&
          this.dataset.lazyAHero === "true" &&
          !playbackReleased
        ) {
          return new Promise((resolve, reject) => {
            pendingHeroPlays.push({ element: this, resolve, reject });
          });
        }
        return nativePlay.call(this);
      };

      const arm = (nextTarget) => {
        target = nextTarget;
        capture = null;
      };
      const freezeCanvas = () => {
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
        if (!source) return;
        overlay?.remove();
        overlay = document.createElement("canvas");
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
        overlay
          .getContext("2d")
          .drawImage(
            source.canvas,
            source.bounds.left,
            source.bounds.top,
            source.bounds.width,
            source.bounds.height,
          );
        document.documentElement.append(overlay);
      };
      const restore = () => {
        for (const element of heldVideos) {
          if (!element.ended) void nativePlay.call(element);
        }
        heldVideos.length = 0;
        overlay?.remove();
        overlay = null;
      };
      const seekToTarget = (nextTarget) => {
        overlay?.remove();
        overlay = null;
        const plate = videos.find(
          (video) =>
            Boolean(video.dataset.lazyAPlate) &&
            (video.currentSrc || video.src).endsWith(activePlateSource ?? ""),
        );
        const hero = videos.find(
          (video) => video.dataset.lazyAHero === "true",
        );
        if (hero && Number.isFinite(hero.duration)) {
          hero.pause();
          hero.currentTime = Math.min(
            Math.max(0, hero.currentTime + 1 / 24),
            Math.max(0, hero.duration - 1 / 300),
          );
        }
        if (plate) {
          plate.pause();
          plate.currentTime = Math.min(
            Math.max(0, (nextTarget.projectionFrame + 0.5) / 30),
            Math.max(0, plate.duration - 1 / 300),
          );
        }
      };

      window.addEventListener(eventName, (event) => {
        const detail = event.detail;
        const plateState = window.__lazyAPlateState?.state ?? null;
        if (
          capture ||
          !target ||
          detail?.atomic !== true ||
          detail.heroFramePresented < target.minHeroFrame ||
          detail.projectionFrame !== target.projectionFrame ||
          plateState !== target.plateState
        ) {
          return;
        }
        const hero = videos.find((video) => video.dataset.lazyAHero === "true");
        const heroVideoFrame = hero ? heroVideoFrames.get(hero) : null;
        capture = {
          heroFramePresented: detail.heroFramePresented,
          heroMediaTime:
            heroVideoFrame?.presentedFrames === detail.heroFramePresented
              ? heroVideoFrame.mediaTime
              : detail.heroFramePresented === 1
                ? 0
                : null,
          plateMediaTime: detail.plateMediaTime,
          plateState,
          projectionFrame: detail.projectionFrame,
        };
        activePlateSource = detail.plateSource;
        freezeCanvas();
        for (const element of videos.filter(
          (video) =>
            video.dataset.lazyAHero === "true" ||
            (Boolean(video.dataset.lazyAPlate) &&
              !video.paused &&
              !video.ended),
        )) {
          if (!element.paused) {
            heldVideos.push(element);
            element.pause();
          }
        }
      });

      Object.defineProperty(window, "__heroReferenceTiming", {
        configurable: false,
        value: {
          arm,
          capture: () => capture,
          releasePlayback() {
            playbackReleased = true;
            for (const { element, resolve, reject } of pendingHeroPlays.splice(
              0,
            )) {
              nativePlay.call(element).then(resolve, reject);
            }
          },
          releaseAndArm(nextTarget) {
            const result = capture;
            target = null;
            capture = null;
            if (nextTarget) {
              arm(nextTarget);
              seekToTarget(nextTarget);
            } else {
              activePlateSource = null;
              restore();
            }
            return result;
          },
        },
      });
    },
    {
      eventName: presentedEvent,
      platePlaybackRate: authoringPlatePlaybackRate,
    },
  );
}

async function waitForResting(page, endpoint) {
  await page.waitForFunction(
    (id) =>
      window.__lazyAPlateState?.state === `resting:${id}` &&
      window.__lazyACameraDebug?.snapshot?.().endpoint === id,
    endpoint,
    { timeout: 30_000 },
  );
}

async function openDestination(page, destination) {
  const point = await page.evaluate((id) => {
    const debug = window.__lazyANavigationDebug;
    const row = debug?.sheet.rows.find(({ id: rowId }) => rowId === id);
    return debug && row
      ? debug.projectSheetPoint(
          row.rect.x + row.rect.width / 2,
          row.rect.y + row.rect.height / 2,
        )
      : null;
  }, destination);
  assert.ok(point, `authored ${destination} row is unavailable`);
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.waitForTimeout(300);
  await page.mouse.click(point.x, point.y);
  await waitForResting(page, destination);
}

async function closeDestination(page) {
  await page.keyboard.press("Escape");
  await waitForResting(page, "desk");
}

async function captureSequence(page, targets, label, alreadyArmed = false) {
  if (!alreadyArmed) {
    await page.evaluate(
      (target) => window.__heroReferenceTiming.arm(target),
      targets[0],
    );
  }
  const captures = [];
  for (let index = 0; index < targets.length; index += 1) {
    try {
      await page.waitForFunction(
        () => Boolean(window.__heroReferenceTiming.capture()),
        null,
        { timeout: 10_000 },
      );
    } catch (error) {
      const state = await page.evaluate(() => ({
        capture: window.__heroReferenceTiming.capture(),
        compositor: window.__lazyACompositor ?? null,
        plate: window.__lazyAPlateState?.state ?? null,
      }));
      throw new Error(
        `${label} timing target ${index + 1}/${targets.length} ${JSON.stringify(
          targets[index],
        )} timed out at ${JSON.stringify(state)}`,
        { cause: error },
      );
    }
    const captureBeforeScreenshot = await page.evaluate(() =>
      window.__heroReferenceTiming.capture(),
    );
    const screenshotStarted = Date.now();
    await page.screenshot({ type: "png" });
    const screenshotMilliseconds = Date.now() - screenshotStarted;
    const nextTarget = targets[index + 1]
      ? {
          ...targets[index + 1],
          minHeroFrame: Math.max(
            targets[index + 1].minHeroFrame,
            captureBeforeScreenshot.heroFramePresented + 1,
          ),
        }
      : null;
    const captured = await page.evaluate((target) => {
      return window.__heroReferenceTiming.releaseAndArm(target);
    }, nextTarget);
    assert.ok(captured, `timing capture ${index + 1} disappeared`);
    console.log(
      `Captured ${label} ${index + 1}/${targets.length}: hero=${captureBeforeScreenshot.heroFramePresented} projection=${captureBeforeScreenshot.projectionFrame} screenshot=${screenshotMilliseconds}ms`,
    );
    captures.push(captured);
  }
  return captures;
}

async function captureViewport(browser, viewport) {
  const targetPlan = Object.fromEntries(
    destinations.flatMap((destination) =>
      ["forward", "reverse"].map((direction) => [
        `${destination}:${direction}`,
        phaseTargets(viewport, destination, direction),
      ]),
    ),
  );
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  await installTimingProbe(page);
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => window.__arrivalDone === true, null, {
      timeout: 12_000,
    });
    await waitForResting(page, "desk");

    const restingState = "resting:desk";
    const restingProjectionFrame =
      manifest.variants[viewport.profile].transitions["opening-desk"].frames
        .length - 1;
    const restingProjection =
      manifest.variants[viewport.profile].transitions["opening-desk"].frames[
        restingProjectionFrame
      ];
    const restingOcclusionEdgeScore = occlusionEdgeScore(
      restingProjection,
      viewport,
    );
    const restingTargets = [
      {
        plateState: restingState,
        minHeroFrame: 1,
        projectionFrame: restingProjectionFrame,
      },
      {
        plateState: restingState,
        minHeroFrame: 2,
        projectionFrame: restingProjectionFrame,
      },
    ];
    await page.evaluate(
      (target) => window.__heroReferenceTiming.arm(target),
      restingTargets[0],
    );
    const firstResting = await captureSequence(
      page,
      [restingTargets[0]],
      `${viewport.name} resting first frame`,
      true,
    );
    const appliedAuthoringRate = await page.evaluate((playbackRate) => {
      const hero = document.querySelector('video[data-lazy-a-hero="true"]');
      if (!(hero instanceof HTMLVideoElement)) return null;
      hero.playbackRate = playbackRate;
      return hero.playbackRate;
    }, authoringHeroPlaybackRate);
    assert.equal(
      appliedAuthoringRate,
      authoringHeroPlaybackRate,
      `${viewport.name} authoring-only hero playback rate`,
    );
    await page.evaluate(
      (target) => window.__heroReferenceTiming.arm(target),
      restingTargets[1],
    );
    await page.evaluate(() => window.__heroReferenceTiming.releasePlayback());
    const secondResting = await captureSequence(
      page,
      [restingTargets[1]],
      `${viewport.name} resting moving frame`,
      true,
    );
    const resting = [...firstResting, ...secondResting];
    assert.equal(
      resting[0].heroFramePresented,
      1,
      `${viewport.name} first live hero frame`,
    );
    const frames = [
      {
        ...resting[0],
        phase: null,
        plannedOcclusionEdgeScore: restingOcclusionEdgeScore,
      },
      {
        ...resting[1],
        phase: null,
        plannedOcclusionEdgeScore: restingOcclusionEdgeScore,
      },
    ];
    let minimumHeroFrame = resting[1].heroFramePresented + 1;

    for (const destination of destinations) {
      for (const direction of ["forward", "reverse"]) {
        const plateState =
          direction === "forward"
            ? `transitioning:desk-to-${destination}`
            : `transitioning:${destination}-to-desk`;
        const targetFrames = targetPlan[`${destination}:${direction}`];
        const targets = targetFrames.map(({ projectionFrame }, index) => ({
          plateState,
          minHeroFrame: minimumHeroFrame + index,
          projectionFrame,
        }));
        console.log(
          `Recording ${viewport.name} ${destination} ${direction}: ${targetFrames
            .map(
              ({ projectionFrame, occlusionEdgeScore: score }) =>
                `${projectionFrame}[edge=${score}]`,
            )
            .join(",")}`,
        );
        const sequence = captureSequence(
          page,
          targets,
          `${viewport.name} ${destination} ${direction}`,
        );
        if (direction === "forward") {
          await openDestination(page, destination);
        } else {
          await closeDestination(page);
        }
        const captures = await sequence;
        for (let index = 0; index < captures.length; index += 1) {
          frames.push({
            ...captures[index],
            phase: ["early", "mid", "late"][index],
            plannedOcclusionEdgeScore: targetFrames[index].occlusionEdgeScore,
          });
        }
        minimumHeroFrame = captures.at(-1).heroFramePresented + 1;
      }
    }

    assert.equal(frames.length, 26, `${viewport.name} reference frame count`);
    return {
      name: viewport.name,
      width: viewport.width,
      height: viewport.height,
      profile: viewport.profile,
      frames,
    };
  } finally {
    await context.close();
  }
}

if (planOnly) {
  for (const viewport of viewports) {
    const targets = destinations.flatMap((destination) =>
      ["forward", "reverse"].flatMap((direction) =>
        phaseTargets(viewport, destination, direction).map((target, index) => ({
          destination,
          direction,
          phase: ["early", "mid", "late"][index],
          ...target,
        })),
      ),
    );
    assert.equal(
      targets.length,
      24,
      `${viewport.name} path/phase target count`,
    );
    const edgeQualityTargets = targets.filter(
      ({ occlusionEdgeScore: score }) => score > 0,
    );
    assert.ok(
      edgeQualityTargets.length >= 3,
      `${viewport.name} has ${edgeQualityTargets.length} planned edge-quality targets; expected at least 3`,
    );
    console.log(
      `${viewport.name}: ${targets.length} path/phase targets, ${edgeQualityTargets.length} with authored depth crossings`,
    );
  }
  process.exit(0);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  const captured = {};
  for (const viewport of viewports) {
    const schedule = await captureViewport(browser, viewport);
    captured[`${viewport.width}x${viewport.height}`] = schedule;
    await mkdir(dirname(output), { recursive: true });
    await writeFile(
      output,
      `${JSON.stringify(
        {
          version: 1,
          presentationEvent: presentedEvent,
          browserPixelsStored: false,
          capturePlaybackRates: {
            hero: authoringHeroPlaybackRate,
            plate: authoringPlatePlaybackRate,
          },
          generatedFrom: url,
          viewports: captured,
        },
        null,
        2,
      )}\n`,
    );
    console.log(
      `Captured ${schedule.frames.length} timing bindings for ${viewport.name}`,
    );
  }
  const schedule = {
    version: 1,
    presentationEvent: presentedEvent,
    browserPixelsStored: false,
    capturePlaybackRates: {
      hero: authoringHeroPlaybackRate,
      plate: authoringPlatePlaybackRate,
    },
    generatedFrom: url,
    viewports: captured,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(schedule, null, 2)}\n`);
  console.log(`Wrote ${output}`);
} finally {
  await browser.close();
}
