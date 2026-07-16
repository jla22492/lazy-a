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
const MAX_MASK_UPLOAD_BYTES = 1_500_000;
const AUTHORED_MASK_SIZE = 512;
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

function decodeSilhouetteMask(mask, id) {
  assert.equal(mask?.size, AUTHORED_MASK_SIZE, `${id} mask size`);
  assert.equal(mask?.encoding, "rle-varint-v1", `${id} mask encoding`);
  assert.equal(typeof mask?.rle, "string", `${id} mask payload`);
  const bytes = Buffer.from(mask.rle, "base64");
  let offset = 0;
  const readVarint = () => {
    let value = 0;
    let shift = 0;
    while (offset < bytes.length && shift <= 28) {
      const byte = bytes[offset++];
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return value;
      shift += 7;
    }
    assert.fail(`${id} mask contains a truncated varint`);
  };
  let filledPixels = 0;
  let rowsWithMultipleRuns = 0;
  for (let y = 0; y < AUTHORED_MASK_SIZE; y += 1) {
    const runCount = readVarint();
    if (runCount > 1) rowsWithMultipleRuns += 1;
    let previousEnd = -1;
    for (let run = 0; run < runCount; run += 1) {
      const gap = readVarint();
      const length = readVarint();
      const start = previousEnd + 1 + gap;
      const end = start + length - 1;
      assert.ok(start <= end, `${id} row ${y} run ${run} is reversed`);
      assert.ok(start > previousEnd, `${id} row ${y} runs overlap`);
      assert.ok(end < AUTHORED_MASK_SIZE, `${id} row ${y} exceeds mask bounds`);
      filledPixels += end - start + 1;
      previousEnd = end;
    }
  }
  assert.equal(offset, bytes.length, `${id} mask has trailing bytes`);
  return { filledPixels, rowsWithMultipleRuns };
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

check("every projection carries a decoded evaluated-mesh silhouette", () => {
  let filledMasks = 0;
  let concaveMasks = 0;
  for (const { id, projection } of frames) {
    const decoded = decodeSilhouetteMask(projection.heroOcclusionMask, id);
    if (decoded.filledPixels > 0) filledMasks += 1;
    if (decoded.rowsWithMultipleRuns > 0) concaveMasks += 1;
  }
  assert.ok(filledMasks >= 100, `${filledMasks} non-empty masks`);
  assert.ok(concaveMasks >= 20, `${concaveMasks} masks preserve concave gaps`);
  return `${filledMasks} non-empty; ${concaveMasks} preserve concave gaps`;
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
        window.__lazyAHeroOcclusion?.masked === true,
      null,
      { timeout: 15_000 },
    );
    await page.waitForTimeout(2_100);
    const first = await page.screenshot();
    await page.waitForTimeout(700);
    const second = await page.screenshot();
    const analysis = await analyzeScreenshots(page, first, second);

    check("browser mask upload is hero-local and bounded", () => {
      assert.ok(analysis.marker, "window.__lazyAHeroOcclusion is missing");
      assert.equal(
        analysis.marker.heroLocal,
        true,
        JSON.stringify(analysis.marker),
      );
      assert.ok(
        analysis.marker.uploadBytes <= MAX_MASK_UPLOAD_BYTES,
        `${analysis.marker.uploadBytes} bytes exceeds ${MAX_MASK_UPLOAD_BYTES}`,
      );
      return `${analysis.marker.textureWidth}x${analysis.marker.textureHeight}, ${analysis.marker.uploadBytes} bytes`;
    });
    check(
      "masked hero pixels remain photographic while unmasked pixels change",
      () => {
        assert.ok(
          analysis.maskedSamples >= 20,
          `${analysis.maskedSamples} masked samples`,
        );
        assert.ok(
          analysis.unmaskedSamples >= 100,
          `${analysis.unmaskedSamples} unmasked samples`,
        );
        assert.ok(
          analysis.stableMasked / analysis.maskedSamples >= 0.8,
          `stable masked ratio ${analysis.stableMasked}/${analysis.maskedSamples}; p90=${analysis.maskedP90}`,
        );
        assert.ok(
          analysis.changingUnmasked >= 20 && analysis.unmaskedP90 >= 12,
          `changing unmasked=${analysis.changingUnmasked}; p90=${analysis.unmaskedP90}`,
        );
        return `masked p90=${analysis.maskedP90}; unmasked p90=${analysis.unmaskedP90}`;
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
