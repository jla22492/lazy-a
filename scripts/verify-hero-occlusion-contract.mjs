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
const url =
  args.find((argument) => !argument.startsWith("--")) ??
  "http://localhost:3000/";

const OCCLUDER_SLOTS = [
  "ceramic_vase_02",
  "Mesh_38",
  "Mesh_39",
  "Mesh_40",
  "Mesh_41",
  "Mesh_42",
  "Mesh_43",
  "ProductionNavigationSheet",
  "Camera_01",
  "Camera_01_strap",
];
const MAX_MANIFEST_BYTES = 1_500_000;
const COORDINATE_EPSILON = 2e-5;
const ROUNDING_DIGITS = 6;
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

function pointInConvexPolygon(point, polygon, epsilon = 0) {
  let sign = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const first = polygon[index];
    const second = polygon[(index + 1) % polygon.length];
    const cross =
      (second[0] - first[0]) * (point[1] - first[1]) -
      (second[1] - first[1]) * (point[0] - first[0]);
    if (Math.abs(cross) <= epsilon) continue;
    const nextSign = Math.sign(cross);
    if (sign !== 0 && nextSign !== sign) return false;
    sign = nextSign;
  }
  return true;
}

function pairs(values) {
  const points = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push([values[index], values[index + 1]]);
  }
  return points;
}

function assertR4HeroSourceContract(hero) {
  assert.equal(hero?.compositor, "single-webgl-pass");
  assert.equal(hero?.occlusion, "authored-depth-geometry");
  assert.equal(hero?.treatment?.kind, "calibrated-room-transfer");
  assert.ok(hero?.treatment?.source.endsWith("/hero-room-treatment.png"));
  assert.ok(hero?.geometry?.source.endsWith("/hero-compositor.glb"));
  assert.ok(hero?.geometry?.occluders.includes("Mesh_31"));
  assert.equal(hero?.maskResolution, undefined);
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
  ];
  for (const stub of stubs) {
    assert.throws(() => assertR4HeroSourceContract(stub(complete)));
  }
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
  return "7 structural stubs rejected";
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

check("every projection preserves the ten named occluder slots", () => {
  for (const { id, projection } of frames) {
    assert.equal(
      projection.heroOccluders.length,
      OCCLUDER_SLOTS.length,
      `${id} slot count`,
    );
  }
  return `${frames.length} projections x ${OCCLUDER_SLOTS.length} slots`;
});

check("occluder vertices are clipped to the visible physical hero", () => {
  let vertices = 0;
  let emptySlots = 0;
  for (const { id, projection } of frames) {
    if (projection.hero === null) {
      assert.ok(
        projection.heroOccluders.every((polygon) => polygon.length === 0),
        `${id} hidden hero must not export occluders`,
      );
      emptySlots += projection.heroOccluders.length;
      continue;
    }
    assert.equal(projection.hero.length, 8, `${id} hero quad`);
    const hero = pairs(projection.hero);
    for (let slot = 0; slot < projection.heroOccluders.length; slot += 1) {
      const polygon = projection.heroOccluders[slot];
      if (polygon.length === 0) {
        emptySlots += 1;
        continue;
      }
      assert.ok(
        polygon.length >= 6 && polygon.length % 2 === 0,
        `${id} ${OCCLUDER_SLOTS[slot]} polygon shape`,
      );
      for (const point of pairs(polygon)) {
        vertices += 1;
        assert.ok(
          point.every(
            (value) =>
              Number.isFinite(value) &&
              value >= -COORDINATE_EPSILON &&
              value <= 1 + COORDINATE_EPSILON,
          ),
          `${id} ${OCCLUDER_SLOTS[slot]} has off-screen vertex ${point}`,
        );
        assert.ok(
          pointInConvexPolygon(point, hero, COORDINATE_EPSILON),
          `${id} ${OCCLUDER_SLOTS[slot]} has out-of-hero vertex ${point}`,
        );
      }
    }
  }
  return `${vertices} vertices; ${emptySlots} empty slots`;
});

check("occluder coordinates use compact rounding", () => {
  let values = 0;
  for (const { id, projection } of frames) {
    for (const polygon of projection.heroOccluders) {
      for (const value of polygon) {
        values += 1;
        assert.ok(
          Math.abs(value - Number(value.toFixed(ROUNDING_DIGITS))) <= 1e-10,
          `${id} coordinate ${value} exceeds ${ROUNDING_DIGITS} decimals`,
        );
      }
    }
  }
  return `${values} coordinates`;
});

check("R4 hero projections do not regress to low-resolution masks", () => {
  let projections = 0;
  for (const { id, projection } of frames) {
    projections += 1;
    assert.equal(
      projection.heroOcclusionMask,
      undefined,
      `${id} must use authored depth geometry instead of an RLE mask`,
    );
  }
  return `${projections} depth-geometry projections`;
});

async function analyzeScreenshots(page, first, second) {
  return page.evaluate(
    async ({ firstPng, secondPng }) => {
      const decode = async (base64) => {
        const response = await fetch(`data:image/png;base64,${base64}`);
        return createImageBitmap(await response.blob());
      };
      const [firstImage, secondImage] = await Promise.all([
        decode(firstPng),
        decode(secondPng),
      ]);
      const canvas = document.createElement("canvas");
      canvas.width = firstImage.width;
      canvas.height = firstImage.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(firstImage, 0, 0);
      const firstPixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(secondImage, 0, 0);
      const secondPixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;

      const hero = (window.__lazyAHeroProjection ?? []).reduce(
        (points, value, index, values) => {
          if (index % 2 === 0) {
            points.push([value * innerWidth, values[index + 1] * innerHeight]);
          }
          return points;
        },
        [],
      );
      const profile = window.__lazyAPlateState?.profile ?? "wide";
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
      const slots = (window.__lazyAPlateProjection?.heroOccluders ?? []).map(
        (polygon) => {
          const points = [];
          for (let index = 0; index < polygon.length; index += 2) {
            points.push([
              offsetX + polygon[index] * source.width * scale,
              offsetY + polygon[index + 1] * source.height * scale,
            ]);
          }
          return points;
        },
      );

      const inside = (point, polygon) => {
        if (polygon.length < 3) return false;
        let sign = 0;
        for (let index = 0; index < polygon.length; index += 1) {
          const first = polygon[index];
          const second = polygon[(index + 1) % polygon.length];
          const cross =
            (second[0] - first[0]) * (point[1] - first[1]) -
            (second[1] - first[1]) * (point[0] - first[0]);
          if (Math.abs(cross) < 0.5) continue;
          const nextSign = Math.sign(cross);
          if (sign !== 0 && nextSign !== sign) return false;
          sign = nextSign;
        }
        return true;
      };
      const difference = (x, y) => {
        const index = (y * canvas.width + x) * 4;
        return Math.max(
          Math.abs(firstPixels[index] - secondPixels[index]),
          Math.abs(firstPixels[index + 1] - secondPixels[index + 1]),
          Math.abs(firstPixels[index + 2] - secondPixels[index + 2]),
        );
      };

      const masked = [];
      const unmasked = [];
      const bySlot = slots.map(() => []);
      const minX = Math.max(0, Math.floor(Math.min(...hero.map(([x]) => x))));
      const maxX = Math.min(
        canvas.width - 1,
        Math.ceil(Math.max(...hero.map(([x]) => x))),
      );
      const minY = Math.max(0, Math.floor(Math.min(...hero.map(([, y]) => y))));
      const maxY = Math.min(
        canvas.height - 1,
        Math.ceil(Math.max(...hero.map(([, y]) => y))),
      );
      for (let y = minY + 3; y <= maxY - 3; y += 3) {
        for (let x = minX + 3; x <= maxX - 3; x += 3) {
          const point = [x, y];
          if (!inside(point, hero)) continue;
          const coveringSlots = slots.flatMap((slot, index) =>
            inside(point, slot) ? [index] : [],
          );
          const sample = { x, y, difference: difference(x, y) };
          if (coveringSlots.length > 0) {
            masked.push(sample);
            for (const index of coveringSlots) bySlot[index].push(sample);
          } else {
            unmasked.push(sample);
          }
        }
      }
      const percentile = (samples, fraction) => {
        const values = samples
          .map(({ difference: value }) => value)
          .sort((a, b) => a - b);
        return (
          values[
            Math.min(values.length - 1, Math.floor(values.length * fraction))
          ] ?? null
        );
      };
      return {
        marker: window.__lazyAHeroOcclusion ?? null,
        maskedSamples: masked.length,
        unmaskedSamples: unmasked.length,
        maskedP90: percentile(masked, 0.9),
        unmaskedP90: percentile(unmasked, 0.9),
        changingUnmasked: unmasked.filter(
          ({ difference: value }) => value >= 12,
        ).length,
        stableMasked: masked.filter(({ difference: value }) => value <= 4)
          .length,
        slotSamples: bySlot.map((samples) => samples.length),
      };
    },
    {
      firstPng: first.toString("base64"),
      secondPng: second.toString("base64"),
    },
  );
}

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
        Array.isArray(window.__lazyAHeroProjection) &&
        window.__lazyACompositor?.atomic === true,
      null,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(2_100);
    const first = await page.screenshot();
    await page.waitForTimeout(700);
    const second = await page.screenshot();
    const analysis = await analyzeScreenshots(page, first, second);
    const compositor = await page.evaluate(
      () => window.__lazyACompositor ?? null,
    );

    check("browser presents hero and plate from one atomic compositor frame", () => {
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
        assert.equal(analysis.marker, null, JSON.stringify(analysis.marker));
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
