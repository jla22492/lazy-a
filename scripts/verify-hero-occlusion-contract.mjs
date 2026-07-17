/**
 * Behavioral contract for the photographic hero matte.
 *
 * Usage:
 *   node scripts/verify-hero-occlusion-contract.mjs [url]
 *   node scripts/verify-hero-occlusion-contract.mjs --geometry-only
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const publicManifestPath = path.join(root, "public/room/manifest.json");
const typescriptManifestPath = path.join(root, "three/scene/plateManifest.ts");
const args = process.argv.slice(2);
const geometryOnly = args.includes("--geometry-only");
const selfTest = args.includes("--self-test");
const url =
  args.find((argument) => !argument.startsWith("--")) ??
  "http://localhost:3000/";

const MAX_MANIFEST_BYTES = 1_500_000;
const PRESENTED_FRAME_EVENT = "lazy-a:compositor-frame-presented";
const PRESENTED_PIXEL_REFERENCES =
  "/room/hero/hero-presented-pixel-references.json";
const PRESENTED_PIXEL_REFERENCE_KIND = "authored-presented-pixels-v1";
const PRESENTED_PIXEL_REGION_ENCODING =
  "rgb-poster-foreground-treatment";
const viewport = { width: 1280, height: 720 };
const failures = [];

function check(name, operation) {
  try {
    const detail = operation();
    console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

function projectionFrames(manifest) {
  return Object.values(manifest.variants).flatMap((variant) => [
    ...Object.values(variant.endpoints).map((endpoint) => ({
      id: `${variant.id}:endpoint:${endpoint.id}`,
      projection: endpoint.projection,
    })),
    ...Object.values(variant.transitions).flatMap((transition) =>
      transition.frames.map((projection, index) => ({
        id: `${variant.id}:${transition.id}:${index}`,
        projection,
      })),
    ),
  ]);
}

function assertR4HeroSourceContract(hero) {
  assert.equal(hero?.compositor, "single-webgl-pass");
  assert.equal(hero?.occlusion, "authored-depth-geometry");
  assert.equal(hero?.treatment?.kind, "calibrated-room-transfer");
  assert.ok(hero?.treatment?.source.endsWith("/hero-room-treatment.png"));
  assert.ok(hero?.geometry?.source.endsWith("/hero-compositor.glb"));
  assert.ok(hero?.geometry?.occluders.includes("Mesh_31"));
  assert.equal(hero?.maskResolution, undefined);
  assert.equal(
    hero?.verification?.presentationEvent,
    PRESENTED_FRAME_EVENT,
  );
  assert.ok(
    hero?.verification?.presentedPixelReferences.endsWith(
      PRESENTED_PIXEL_REFERENCES,
    ),
  );
  assert.equal(
    hero?.verification?.referenceKind,
    PRESENTED_PIXEL_REFERENCE_KIND,
  );
  assert.equal(
    hero?.verification?.regionEncoding,
    PRESENTED_PIXEL_REGION_ENCODING,
  );
}

function assertR4HeroSourceStubsFail() {
  const complete = {
    compositor: "single-webgl-pass",
    occlusion: "authored-depth-geometry",
    treatment: {
      kind: "calibrated-room-transfer",
      source: "/room/hero/hero-room-treatment.png",
    },
    geometry: {
      source: "/room/hero/hero-compositor.glb",
      occluders: ["Mesh_31"],
    },
    verification: {
      presentationEvent: PRESENTED_FRAME_EVENT,
      presentedPixelReferences: PRESENTED_PIXEL_REFERENCES,
      referenceKind: PRESENTED_PIXEL_REFERENCE_KIND,
      regionEncoding: PRESENTED_PIXEL_REGION_ENCODING,
    },
  };
  assert.doesNotThrow(() => assertR4HeroSourceContract(complete));

  const stubs = [
    (hero) => ({ ...hero, compositor: "separate-dom-and-webgl" }),
    (hero) => ({ ...hero, occlusion: "screen-space-mask" }),
    (hero) => ({ ...hero, treatment: { ...hero.treatment, kind: "rgb-multiplier" } }),
    (hero) => ({ ...hero, treatment: { ...hero.treatment, source: "/room/hero/treatment.png" } }),
    (hero) => ({ ...hero, geometry: { ...hero.geometry, source: "/room/hero/geometry.glb" } }),
    (hero) => ({ ...hero, geometry: { ...hero.geometry, occluders: ["Mesh_170"] } }),
    (hero) => ({ ...hero, maskResolution: 512 }),
    (hero) => ({
      ...hero,
      verification: {
        ...hero.verification,
        presentationEvent: "lazy-a:frame",
      },
    }),
    (hero) => ({
      ...hero,
      verification: {
        ...hero.verification,
        presentedPixelReferences: "/room/hero/references.json",
      },
    }),
    (hero) => ({
      ...hero,
      verification: {
        ...hero.verification,
        referenceKind: "runtime-scalars-v1",
      },
    }),
    (hero) => ({
      ...hero,
      verification: {
        ...hero.verification,
        regionEncoding: "rgb-combined-edges",
      },
    }),
  ];
  for (const stub of stubs) {
    assert.throws(() => assertR4HeroSourceContract(stub(complete)));
  }
}

if (selfTest) {
  assertR4HeroSourceStubsFail();
  console.log("hero occlusion self-tests passed (11 structural stubs).");
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(publicManifestPath, "utf8"));
const frames = projectionFrames(manifest);

check("hero remains a treated physical poster before playback", () => {
  assert.equal(manifest.hero?.object, "Mesh_170");
  assert.equal(
    manifest.hero?.firstFrameSource,
    "assets/master/hero/hero-print-first-frame.png",
  );
  assert.equal(manifest.hero?.restingMechanism, "baked-physical-poster");
  assert.equal(
    manifest.hero?.liveProjection,
    "camera-reciprocal-depth-projective",
  );
  return manifest.hero.liveProjection;
});

check("R4 hero source is one treated WebGL surface with authored depth", () => {
  assertR4HeroSourceContract(manifest.hero);
  return `${manifest.hero.compositor}; ${manifest.hero.occlusion}; ${manifest.hero.treatment?.kind}`;
});

check("R4 hero source contract rejects structural stubs", () => {
  assertR4HeroSourceStubsFail();
  return "11 structural stubs rejected";
});

check("R4 hero declares captured per-frame pixel references", () => {
  assert.equal(
    manifest.hero?.verification?.presentationEvent,
    PRESENTED_FRAME_EVENT,
  );
  assert.ok(
    manifest.hero?.verification?.presentedPixelReferences?.endsWith(
      PRESENTED_PIXEL_REFERENCES,
    ),
  );
  assert.equal(
    manifest.hero?.verification?.referenceKind,
    PRESENTED_PIXEL_REFERENCE_KIND,
  );
  assert.equal(
    manifest.hero?.verification?.regionEncoding,
    PRESENTED_PIXEL_REGION_ENCODING,
  );
  return manifest.hero.verification.presentedPixelReferences;
});

check("every hero projection carries four reciprocal-depth weights", () => {
  let visibleFrames = 0;
  for (const { id, projection } of frames) {
    if (projection.hero === null) {
      assert.equal(projection.heroReciprocalW, null, `${id} hidden weights`);
      continue;
    }
    visibleFrames += 1;
    assert.equal(projection.heroReciprocalW?.length, 4, `${id} weight count`);
    assert.ok(
      projection.heroReciprocalW.every(
        (value) => Number.isFinite(value) && value > 0,
      ),
      `${id} reciprocal-depth weights`,
    );
  }
  assert.ok(visibleFrames > 300, `${visibleFrames} visible projective frames`);
  return `${visibleFrames} visible projective frames`;
});

check("generated manifests stay materially compact", () => {
  const sizes = [publicManifestPath, typescriptManifestPath].map((file) => ({
    file: path.relative(root, file),
    bytes: fs.statSync(file).size,
  }));
  assert.ok(
    sizes.every(({ bytes }) => bytes <= MAX_MANIFEST_BYTES),
    `${sizes.map(({ file, bytes }) => `${file}=${bytes}`).join(", ")} (limit ${MAX_MANIFEST_BYTES})`,
  );
  return sizes.map(({ file, bytes }) => `${file}=${bytes}`).join(", ");
});

check("R4 hero projections contain no legacy screen-space occlusion payload", () => {
  let projections = 0;
  for (const { id, projection } of frames) {
    projections += 1;
    assert.ok(
      !Object.hasOwn(projection, "heroOcclusionMask"),
      `${id} must use authored depth geometry instead of an RLE mask`,
    );
    assert.ok(
      !Object.hasOwn(projection, "heroOccluders"),
      `${id} must use authored depth geometry instead of projected polygons`,
    );
  }
  return `${projections} depth-geometry projections`;
});

if (!geometryOnly) {
  let browser;
  try {
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--autoplay-policy=no-user-gesture-required"],
    });
    const page = await browser.newPage({ viewport });
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(
      () =>
        window.__arrivalDone === true &&
        window.__lazyACompositor?.atomic === true,
      null,
      { timeout: 15_000 },
    );
    const browserState = await page.evaluate(() => ({
      compositor: window.__lazyACompositor ?? null,
      legacyOcclusionMarkerPresent: "__lazyAHeroOcclusion" in window,
    }));

    check("browser presents hero and plate from one atomic compositor frame", () => {
      const { compositor } = browserState;
      assert.ok(compositor, "window.__lazyACompositor is missing");
      assert.equal(compositor.atomic, true);
      assert.ok(Number.isFinite(compositor.plateMediaTime));
      assert.ok(Number.isInteger(compositor.projectionFrame));
      assert.ok(Number.isInteger(compositor.heroFramePresented));
      assert.equal(compositor.treatment, "calibrated-room-transfer");
      assert.equal(compositor.occlusion, "authored-depth-geometry");
      return JSON.stringify(compositor);
    });
    check(
      "browser has retired the legacy RLE hero occlusion marker",
      () => {
        assert.equal(
          browserState.legacyOcclusionMarkerPresent,
          false,
          JSON.stringify(browserState),
        );
        return "no window.__lazyAHeroOcclusion marker";
      },
    );
  } catch (error) {
    failures.push("browser hero occlusion behavior");
    console.log(`FAIL browser hero occlusion behavior: ${error.message}`);
  } finally {
    await browser?.close();
  }
}

if (failures.length > 0) {
  console.error(`Hero occlusion contract failed (${failures.length} checks).`);
  process.exit(1);
}

console.log("Hero occlusion contract passed.");
