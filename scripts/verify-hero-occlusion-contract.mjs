/**
 * Behavioral contract for the photographic hero matte.
 *
 * Usage:
 *   node scripts/verify-hero-occlusion-contract.mjs [url]
 *   node scripts/verify-hero-occlusion-contract.mjs --geometry-only
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";
import { Matrix4, Quaternion, Vector3 } from "three";

const root = path.resolve(import.meta.dirname, "..");
const publicManifestPath = path.join(root, "public/room/manifest.json");
const typescriptManifestPath = path.join(root, "three/scene/plateManifest.ts");
const heroAuthoringManifestPath = path.join(
  root,
  "public/room/hero/hero-presented-authoring-manifest.json",
);
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
const PRESENTED_PIXEL_REGION_ENCODING = "rgb-poster-foreground-treatment";
const PRESENTED_PIXEL_AUTHORING_MANIFEST =
  "/room/hero/hero-presented-authoring-manifest.json";
const HERO_SURFACE_OBJECT = "HeroLiveSurface";
const EXPECTED_AUTHORING_SOURCES = {
  masterBlend: "build/wo-0117-r/master.blend",
  renderScript: "scripts/render-master-shots.py",
  treatmentAuthor: "scripts/build-hero-room-treatment.mjs",
  compositorGlb: "public/room/hero/hero-compositor.glb",
  treatedBake: "build/wo-0117-r/hero-treated-first-frame.png",
};
const ROOM_POSTER_REFERENCE = "public/room/wide/stills/desk.jpg";
const EXPECTED_GLB_AUTHORING_RELATIONSHIP_SHA256 =
  "1339de879c4e9f7149e4169660270e7e5e525d46ae0df2694f01330fcd603d30";
const MAX_TREATMENT_RECONSTRUCTION_ERROR = 2;
const MAX_ROOM_POSTER_MEAN_CHANNEL_DELTA = 48;
const MIN_PLATE_ORIENTATION_ERROR_MARGIN = 5;
const MAX_PRESENTED_PLATE_CHANNEL_MAD = 6;
const MAX_FIRST_FRAME_CHANNEL_MAD = 8;
const viewport = { width: 1280, height: 720 };
const failures = [];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function check(name, operation) {
  try {
    const detail = operation();
    console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

async function checkAsync(name, operation) {
  try {
    const detail = await operation();
    console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function roundGeometryValue(value) {
  const rounded = Math.round(value * 1e9) / 1e9;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function comparePoint(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

function compareTriangle(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = comparePoint(left[index], right[index]);
    if (difference !== 0) return difference;
  }
  return 0;
}

function parseGlb(glbBytes) {
  assert.ok(glbBytes.length >= 20, "GLB is too small");
  assert.equal(glbBytes.toString("ascii", 0, 4), "glTF", "GLB magic");
  assert.equal(glbBytes.readUInt32LE(4), 2, "GLB version");
  assert.equal(
    glbBytes.readUInt32LE(8),
    glbBytes.length,
    "GLB declared byte length",
  );

  const chunks = [];
  for (let offset = 12; offset < glbBytes.length;) {
    assert.ok(offset + 8 <= glbBytes.length, "GLB chunk header is truncated");
    const byteLength = glbBytes.readUInt32LE(offset);
    const type = glbBytes.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + byteLength;
    assert.ok(end <= glbBytes.length, `${type} GLB chunk is truncated`);
    chunks.push({ type, bytes: glbBytes.subarray(start, end) });
    offset = end;
  }
  assert.equal(chunks.length, 2, "GLB must contain JSON and BIN chunks");
  assert.equal(chunks[0].type, "JSON", "GLB first chunk");
  assert.equal(chunks[1].type, "BIN\u0000", "GLB second chunk");
  return {
    json: JSON.parse(chunks[0].bytes.toString("utf8").trimEnd()),
    binary: chunks[1].bytes,
  };
}

function nodeLocalMatrix(node) {
  if (node.matrix !== undefined) {
    assert.equal(node.matrix.length, 16, `${node.name} matrix length`);
    assert.ok(
      node.matrix.every(Number.isFinite),
      `${node.name} matrix must be finite`,
    );
    return new Matrix4().fromArray(node.matrix);
  }
  const translation = node.translation ?? [0, 0, 0];
  const rotation = node.rotation ?? [0, 0, 0, 1];
  const scale = node.scale ?? [1, 1, 1];
  assert.equal(translation.length, 3, `${node.name} translation length`);
  assert.equal(rotation.length, 4, `${node.name} rotation length`);
  assert.equal(scale.length, 3, `${node.name} scale length`);
  assert.ok(
    [...translation, ...rotation, ...scale].every(Number.isFinite),
    `${node.name} transform must be finite`,
  );
  return new Matrix4().compose(
    new Vector3(...translation),
    new Quaternion(...rotation),
    new Vector3(...scale),
  );
}

function activeSceneWorldMatrices(gltf) {
  assert.equal(gltf.scene, 0, "GLB active scene");
  assert.equal(gltf.scenes?.length, 1, "GLB scene count");
  const worldMatrices = new Map();
  const visiting = new Set();
  const visit = (nodeIndex, parentWorld) => {
    assert.ok(
      Number.isInteger(nodeIndex) &&
        nodeIndex >= 0 &&
        nodeIndex < gltf.nodes.length,
      `invalid GLB node index ${nodeIndex}`,
    );
    assert.ok(!visiting.has(nodeIndex), "GLB node hierarchy contains a cycle");
    assert.ok(
      !worldMatrices.has(nodeIndex),
      `GLB node ${nodeIndex} has multiple parents`,
    );
    visiting.add(nodeIndex);
    const local = nodeLocalMatrix(gltf.nodes[nodeIndex]);
    const world = parentWorld
      ? new Matrix4().multiplyMatrices(parentWorld, local)
      : local;
    worldMatrices.set(nodeIndex, world);
    for (const child of gltf.nodes[nodeIndex].children ?? []) {
      visit(child, world);
    }
    visiting.delete(nodeIndex);
  };
  for (const nodeIndex of gltf.scenes[0].nodes ?? []) {
    visit(nodeIndex, null);
  }
  return worldMatrices;
}

function accessorValues(gltf, binary, accessorIndex, expected) {
  const accessor = gltf.accessors?.[accessorIndex];
  assert.ok(accessor, `missing accessor ${accessorIndex}`);
  assert.equal(
    accessor.sparse,
    undefined,
    "sparse GLB accessors are forbidden",
  );
  assert.equal(accessor.type, expected.type, `accessor ${accessorIndex} type`);
  assert.ok(
    expected.componentTypes.includes(accessor.componentType),
    `accessor ${accessorIndex} component type`,
  );
  assert.ok(
    Number.isInteger(accessor.count) && accessor.count > 0,
    `accessor ${accessorIndex} count`,
  );
  const bufferView = gltf.bufferViews?.[accessor.bufferView];
  assert.ok(bufferView, `missing buffer view for accessor ${accessorIndex}`);
  assert.equal(bufferView.buffer, 0, `accessor ${accessorIndex} buffer`);
  const components = accessor.type === "VEC3" ? 3 : 1;
  const componentBytes =
    accessor.componentType === 5126 || accessor.componentType === 5125 ? 4 : 2;
  const packedStride = components * componentBytes;
  const stride = bufferView.byteStride ?? packedStride;
  assert.ok(
    stride >= packedStride && stride % componentBytes === 0,
    `accessor ${accessorIndex} byte stride`,
  );
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const lastByte =
    start + (accessor.count - 1) * stride + components * componentBytes;
  assert.ok(
    start >= 0 &&
      lastByte <= (bufferView.byteOffset ?? 0) + bufferView.byteLength &&
      lastByte <= binary.length,
    `accessor ${accessorIndex} exceeds its GLB buffer view`,
  );

  const values = [];
  for (let index = 0; index < accessor.count; index += 1) {
    const componentValues = [];
    for (let component = 0; component < components; component += 1) {
      const offset = start + index * stride + component * componentBytes;
      const value =
        accessor.componentType === 5126
          ? binary.readFloatLE(offset)
          : accessor.componentType === 5125
            ? binary.readUInt32LE(offset)
            : binary.readUInt16LE(offset);
      assert.ok(Number.isFinite(value), `accessor ${accessorIndex} value`);
      componentValues.push(value);
    }
    values.push(components === 1 ? componentValues[0] : componentValues);
  }
  return values;
}

function worldGeometryRelationship(
  gltf,
  binary,
  node,
  worldMatrix,
  authoringGeometry,
) {
  assert.ok(Number.isInteger(node.mesh), `${node.name} must reference a mesh`);
  const mesh = gltf.meshes?.[node.mesh];
  assert.ok(mesh, `${node.name} references a missing mesh`);
  assert.equal(mesh.primitives?.length, 1, `${node.name} primitive count`);
  const primitive = mesh.primitives[0];
  assert.equal(primitive.mode ?? 4, 4, `${node.name} primitive mode`);
  assert.ok(
    Number.isInteger(primitive.indices),
    `${node.name} must use indexed triangles`,
  );
  const positions = accessorValues(
    gltf,
    binary,
    primitive.attributes?.POSITION,
    {
      type: "VEC3",
      componentTypes: [5126],
    },
  );
  const indices = accessorValues(gltf, binary, primitive.indices, {
    type: "SCALAR",
    componentTypes: [5123, 5125],
  });
  assert.ok(
    indices.length >= 3 && indices.length % 3 === 0,
    `${node.name} index count`,
  );

  const triangles = [];
  for (let offset = 0; offset < indices.length; offset += 3) {
    const triangle = indices.slice(offset, offset + 3).map((index) => {
      assert.ok(
        Number.isInteger(index) && index >= 0 && index < positions.length,
        `${node.name} index ${index} is outside its position accessor`,
      );
      const world = new Vector3(...positions[index]).applyMatrix4(worldMatrix);
      return [world.x, world.y, world.z].map(roundGeometryValue);
    });
    triangle.sort(comparePoint);
    triangles.push(triangle);
  }
  triangles.sort(compareTriangle);
  return {
    object: node.name,
    sourceObject: authoringGeometry.sourceObject ?? null,
    authoringGeometrySha256: authoringGeometry.geometrySha256,
    worldTransform: worldMatrix.elements.map(roundGeometryValue),
    worldGeometrySha256: sha256(Buffer.from(JSON.stringify(triangles))),
    triangleCount: triangles.length,
  };
}

function assertHeroOccluderInventory(occluders, runtimeHero) {
  assert.ok(Array.isArray(occluders), "authoring HeroOccluders");
  const runtimeOccluders = runtimeHero.geometry.occluders;
  assert.ok(Array.isArray(runtimeOccluders), "runtime HeroOccluders");
  assert.equal(
    new Set(runtimeOccluders).size,
    runtimeOccluders.length,
    "runtime HeroOccluders must be unique",
  );

  const responsiveNavigation = occluders.filter(
    ({ sourceObject }) => sourceObject === "ProductionNavigationSheet",
  );
  assert.deepEqual(
    responsiveNavigation.map(({ profile }) => profile).sort(),
    ["portrait", "wide"],
    "responsive navigation HeroOccluder profiles",
  );
  assert.ok(
    occluders
      .filter(
        ({ sourceObject }) => sourceObject !== "ProductionNavigationSheet",
      )
      .every(({ profile }) => profile === undefined),
    "only the responsive navigation HeroOccluders may be profile-specific",
  );
  assert.equal(
    occluders.length,
    runtimeOccluders.length + 1,
    "authoring HeroOccluder count includes one alternate navigation profile",
  );
  assert.deepEqual(
    [...new Set(occluders.map(({ sourceObject }) => sourceObject))].sort(),
    [...runtimeOccluders].sort(),
    "runtime HeroOccluder source-object inventory",
  );
  assert.deepEqual(
    occluders.map(({ object }) => object),
    occluders.map(({ sourceObject, profile }) =>
      profile
        ? `HeroOccluder_${sourceObject}_${profile}`
        : `HeroOccluder_${sourceObject}`,
    ),
    "HeroOccluder export names",
  );
  for (const profile of ["wide", "portrait"]) {
    const active = occluders.filter(
      ({ profile: ownerProfile }) =>
        ownerProfile === undefined || ownerProfile === profile,
    );
    assert.equal(
      active.length,
      runtimeOccluders.length,
      `${profile} active HeroOccluder count`,
    );
    assert.deepEqual(
      active.map(({ sourceObject }) => sourceObject).sort(),
      [...runtimeOccluders].sort(),
      `${profile} active HeroOccluder inventory`,
    );
  }
}

function assertHeroGlbContract(glbBytes, authoring, runtimeHero) {
  const { json: gltf, binary } = parseGlb(glbBytes);
  assert.equal(gltf.asset?.version, "2.0", "glTF asset version");
  assert.equal(gltf.buffers?.length, 1, "GLB buffer count");
  assert.ok(
    gltf.buffers[0].byteLength <= binary.length &&
      binary.length - gltf.buffers[0].byteLength < 4,
    "GLB BIN chunk length",
  );
  assert.ok(Array.isArray(gltf.nodes), "GLB nodes are missing");
  const worldMatrices = activeSceneWorldMatrices(gltf);

  const surface = authoring.geometry?.heroLiveSurface;
  const occluders = authoring.geometry?.heroOccluders;
  assert.equal(surface?.object, HERO_SURFACE_OBJECT);
  assert.ok(isSha256(surface?.geometrySha256));
  assertHeroOccluderInventory(occluders, runtimeHero);
  assert.ok(
    occluders.every(({ geometrySha256 }) => isSha256(geometrySha256)),
    "authoring HeroOccluder geometry hashes",
  );
  const authoringGeometry = [surface, ...occluders];
  assert.equal(gltf.nodes.length, authoringGeometry.length, "GLB node count");
  assert.equal(gltf.meshes?.length, authoringGeometry.length, "GLB mesh count");
  assert.equal(
    worldMatrices.size,
    authoringGeometry.length,
    "active GLB node count",
  );
  assert.equal(
    new Set(gltf.nodes.map(({ name }) => name)).size,
    authoringGeometry.length,
    "GLB node names must be unique",
  );
  assert.equal(
    new Set(gltf.nodes.map(({ mesh }) => mesh)).size,
    authoringGeometry.length,
    "GLB meshes must have one object owner",
  );

  const nodeByName = new Map(
    gltf.nodes.map((node, index) => [node.name, { node, index }]),
  );
  assert.deepEqual(
    [...nodeByName.keys()].sort(),
    authoringGeometry.map(({ object }) => object).sort(),
    "GLB object inventory",
  );
  const relationships = authoringGeometry.map((geometry) => {
    const entry = nodeByName.get(geometry.object);
    assert.ok(entry, `GLB is missing ${geometry.object}`);
    return worldGeometryRelationship(
      gltf,
      binary,
      entry.node,
      worldMatrices.get(entry.index),
      geometry,
    );
  });
  const relationshipSha256 = sha256(Buffer.from(JSON.stringify(relationships)));
  assert.equal(
    relationshipSha256,
    EXPECTED_GLB_AUTHORING_RELATIONSHIP_SHA256,
    `GLB object/geometry/world-transform relationship ${relationshipSha256}`,
  );
  return {
    objects: relationships.length,
    triangles: relationships.reduce(
      (total, relationship) => total + relationship.triangleCount,
      0,
    ),
    relationshipSha256,
  };
}

async function rgbRaster(imageBytes, label) {
  const { data, info } = await sharp(imageBytes)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.channels, 3, `${label} RGB channels`);
  return { data, width: info.width, height: info.height };
}

function srgbToLinear(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function linearToSrgbByte(value) {
  const clamped = Math.max(0, Math.min(1, value));
  const encoded =
    clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

async function treatmentReconstructionError(fixture) {
  const [source, treated, transfer] = await Promise.all([
    rgbRaster(fixture.firstFrameBytes, "hero first frame"),
    rgbRaster(fixture.treatedFrameBytes, "hero treated bake"),
    rgbRaster(fixture.transferBytes, "hero room treatment"),
  ]);
  assert.deepEqual(
    [treated.width, treated.height],
    [source.width, source.height],
    "treated hero dimensions",
  );
  assert.deepEqual(
    [transfer.width, transfer.height],
    [source.width, source.height],
    "hero transfer dimensions",
  );
  let absoluteError = 0;
  for (let index = 0; index < source.data.length; index += 1) {
    const reconstructed = linearToSrgbByte(
      srgbToLinear(source.data[index]) + (transfer.data[index] / 255 - 0.5) * 2,
    );
    absoluteError += Math.abs(reconstructed - treated.data[index]);
  }
  return absoluteError / source.data.length;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (
    let index = 0, prior = polygon.length - 1;
    index < polygon.length;
    prior = index, index += 1
  ) {
    const [currentX, currentY] = polygon[index];
    const [priorX, priorY] = polygon[prior];
    if (
      currentY > y !== priorY > y &&
      x <
        ((priorX - currentX) * (y - currentY)) / (priorY - currentY) + currentX
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function meanChannels(raster, polygon = null) {
  const sums = [0, 0, 0];
  let samples = 0;
  const bounds = polygon
    ? {
        minX: Math.max(0, Math.floor(Math.min(...polygon.map(([x]) => x)))),
        maxX: Math.min(
          raster.width,
          Math.ceil(Math.max(...polygon.map(([x]) => x))),
        ),
        minY: Math.max(0, Math.floor(Math.min(...polygon.map(([, y]) => y)))),
        maxY: Math.min(
          raster.height,
          Math.ceil(Math.max(...polygon.map(([, y]) => y))),
        ),
      }
    : {
        minX: 0,
        maxX: raster.width,
        minY: 0,
        maxY: raster.height,
      };
  for (let y = bounds.minY; y < bounds.maxY; y += 1) {
    for (let x = bounds.minX; x < bounds.maxX; x += 1) {
      if (polygon && !pointInPolygon(x + 0.5, y + 0.5, polygon)) continue;
      const offset = (y * raster.width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        sums[channel] += raster.data[offset + channel];
      }
      samples += 1;
    }
  }
  assert.ok(samples > 0, "room-poster parity region has no pixels");
  return sums.map((sum) => sum / samples);
}

async function treatmentRoomParity(fixture) {
  const [source, treated, roomPlate] = await Promise.all([
    rgbRaster(fixture.firstFrameBytes, "hero first frame"),
    rgbRaster(fixture.treatedFrameBytes, "hero treated bake"),
    rgbRaster(fixture.roomPlateBytes, "authored desk room plate"),
  ]);
  const hero =
    fixture.manifest.variants?.wide?.endpoints?.desk?.projection?.hero;
  assert.equal(hero?.length, 8, "wide desk hero projection");
  const polygon = Array.from({ length: 4 }, (_, index) => [
    hero[index * 2] * roomPlate.width,
    hero[index * 2 + 1] * roomPlate.height,
  ]);
  const sourceMeans = meanChannels(source);
  const treatedMeans = meanChannels(treated);
  const roomMeans = meanChannels(roomPlate, polygon);
  const maxRoomDelta = Math.max(
    ...treatedMeans.map((value, index) => Math.abs(value - roomMeans[index])),
  );
  assert.ok(
    maxRoomDelta <= MAX_ROOM_POSTER_MEAN_CHANNEL_DELTA,
    `treated bake does not reproduce the authored room poster: source=${sourceMeans
      .map((value) => value.toFixed(3))
      .join("/")} treated=${treatedMeans
      .map((value) => value.toFixed(3))
      .join("/")} room=${roomMeans
      .map((value) => value.toFixed(3))
      .join("/")} maxDelta=${maxRoomDelta.toFixed(3)}`,
  );
  return { sourceMeans, treatedMeans, roomMeans, maxRoomDelta };
}

async function plateOrientationErrors(actualBytes, authoredPlateBytes) {
  const expected = await sharp(authoredPlateBytes)
    .resize(viewport.width, viewport.height, { fit: "cover" })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer();
  const reflected = await sharp(authoredPlateBytes)
    .flip()
    .resize(viewport.width, viewport.height, { fit: "cover" })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer();
  const actual = await sharp(actualBytes)
    .resize(viewport.width, viewport.height, { fit: "fill" })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer();
  assert.equal(actual.length, expected.length, "plate comparison dimensions");
  let uprightError = 0;
  let reflectedError = 0;
  for (let index = 0; index < actual.length; index += 1) {
    uprightError += Math.abs(actual[index] - expected[index]);
    reflectedError += Math.abs(actual[index] - reflected[index]);
  }
  return {
    uprightError: uprightError / actual.length,
    reflectedError: reflectedError / actual.length,
  };
}

function assertPlateUpright(errors) {
  assert.ok(
    errors.uprightError + MIN_PLATE_ORIENTATION_ERROR_MARGIN <
      errors.reflectedError,
    `Canvas plate is not upright: uprightError=${errors.uprightError.toFixed(
      3,
    )} reflectedError=${errors.reflectedError.toFixed(3)}`,
  );
}

async function rawViewportRgb(imageBytes, fit = "fill") {
  const { data, info } = await sharp(imageBytes)
    .resize(viewport.width, viewport.height, { fit })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, viewport.width);
  assert.equal(info.height, viewport.height);
  assert.equal(info.channels, 3);
  return data;
}

function normalizedQuadPolygon(quad, inset = 0) {
  assert.equal(quad?.length, 8, "presented hero projection");
  const points = Array.from({ length: 4 }, (_, index) => [
    quad[index * 2] * viewport.width,
    quad[index * 2 + 1] * viewport.height,
  ]);
  if (inset <= 0) return points;
  const center = points.reduce(
    ([x, y], point) => [x + point[0] / 4, y + point[1] / 4],
    [0, 0],
  );
  return points.map(([x, y]) => {
    const distance = Math.hypot(x - center[0], y - center[1]);
    const scale = distance > inset ? (distance - inset) / distance : 0;
    return [
      center[0] + (x - center[0]) * scale,
      center[1] + (y - center[1]) * scale,
    ];
  });
}

async function presentedPlateColorParity(
  actualBytes,
  authoredPlateBytes,
  heroQuad,
) {
  const [actual, expected] = await Promise.all([
    rawViewportRgb(actualBytes),
    rawViewportRgb(authoredPlateBytes, "cover"),
  ]);
  const hero = normalizedQuadPolygon(heroQuad);
  const actualSums = [0, 0, 0];
  const expectedSums = [0, 0, 0];
  const absoluteErrors = [0, 0, 0];
  let samples = 0;
  for (let y = 0; y < viewport.height; y += 1) {
    for (let x = 0; x < viewport.width; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, hero)) continue;
      const offset = (y * viewport.width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        const actualValue = actual[offset + channel];
        const expectedValue = expected[offset + channel];
        actualSums[channel] += actualValue;
        expectedSums[channel] += expectedValue;
        absoluteErrors[channel] += Math.abs(actualValue - expectedValue);
      }
      samples += 1;
    }
  }
  assert.ok(samples > viewport.width * viewport.height * 0.6);
  return {
    actualMeans: actualSums.map((sum) => sum / samples),
    expectedMeans: expectedSums.map((sum) => sum / samples),
    channelMad: absoluteErrors.map((sum) => sum / samples),
  };
}

async function presentedFirstFrameParity(beforeBytes, liveBytes, heroQuad) {
  const [before, live] = await Promise.all([
    rawViewportRgb(beforeBytes),
    rawViewportRgb(liveBytes),
  ]);
  const hero = normalizedQuadPolygon(heroQuad, 10);
  const absoluteErrors = [0, 0, 0];
  let samples = 0;
  for (let y = 0; y < viewport.height; y += 1) {
    for (let x = 0; x < viewport.width; x += 1) {
      if (!pointInPolygon(x + 0.5, y + 0.5, hero)) continue;
      const offset = (y * viewport.width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        absoluteErrors[channel] += Math.abs(
          before[offset + channel] - live[offset + channel],
        );
      }
      samples += 1;
    }
  }
  assert.ok(samples > 25_000, `${samples} first-frame hero pixels`);
  return {
    samples,
    channelMad: absoluteErrors.map((sum) => sum / samples),
  };
}

function assertPlateColorParity(metrics, label) {
  assert.ok(
    metrics.channelMad.every(
      (value) => value <= MAX_PRESENTED_PLATE_CHANNEL_MAD,
    ),
    `${label} plate color does not match authored sRGB pixels: actual=${metrics.actualMeans
      .map((value) => value.toFixed(3))
      .join("/")} authored=${metrics.expectedMeans
      .map((value) => value.toFixed(3))
      .join("/")} MAD=${metrics.channelMad
      .map((value) => value.toFixed(3))
      .join("/")}`,
  );
}

async function assertR4HeroArtifactContract(fixture) {
  const authoringManifestSha256 = sha256(fixture.authoringManifestBytes);
  assert.equal(
    fixture.manifest.hero?.firstFrameSource,
    "assets/master/hero/hero-print-first-frame.png",
  );
  assert.equal(
    fixture.manifest.hero?.treatment?.source,
    "/room/hero/hero-room-treatment.png",
  );
  assert.equal(
    fixture.manifest.hero?.verification?.presentedPixelAuthoringManifest,
    PRESENTED_PIXEL_AUTHORING_MANIFEST,
  );
  assert.equal(
    fixture.manifest.hero?.verification?.presentedPixelAuthoringManifestSha256,
    authoringManifestSha256,
    "runtime authoring-manifest SHA-256",
  );
  const authoring = JSON.parse(fixture.authoringManifestBytes);
  assert.equal(authoring.version, 1);
  assert.equal(authoring.immutable, true);
  assert.equal(authoring.generator?.identity, "blender-background-python");
  assert.equal(authoring.generator?.browserRuntime, false);
  assert.deepEqual(
    Object.keys(authoring.sources).sort(),
    Object.keys(EXPECTED_AUTHORING_SOURCES).sort(),
    "authoring source inventory",
  );
  for (const [key, expectedPath] of Object.entries(
    EXPECTED_AUTHORING_SOURCES,
  )) {
    const source = authoring.sources[key];
    assert.equal(source?.path, expectedPath, `${key} source path`);
    assert.ok(isSha256(source?.sha256), `${key} source SHA-256`);
    const bytes = fixture.sourceBytes.get(expectedPath);
    assert.ok(bytes, `${key} source bytes are missing`);
    assert.equal(sha256(bytes), source.sha256, `${key} source SHA-256`);
  }
  assert.equal(
    fixture.manifest.hero.geometry.source,
    `/${EXPECTED_AUTHORING_SOURCES.compositorGlb.replace(/^public\//, "")}`,
  );
  assert.equal(fixture.manifest.hero.geometry.surface, HERO_SURFACE_OBJECT);
  const glb = assertHeroGlbContract(
    fixture.sourceBytes.get(EXPECTED_AUTHORING_SOURCES.compositorGlb),
    authoring,
    fixture.manifest.hero,
  );
  const meanChannelError = await treatmentReconstructionError(fixture);
  assert.ok(
    meanChannelError <= MAX_TREATMENT_RECONSTRUCTION_ERROR,
    `room-treatment reconstruction error ${meanChannelError.toFixed(6)} exceeds ${MAX_TREATMENT_RECONSTRUCTION_ERROR}`,
  );
  const roomParity = await treatmentRoomParity(fixture);
  return `${glb.objects} objects, ${glb.triangles} triangles, relationship ${
    glb.relationshipSha256
  }, treatment error ${meanChannelError.toFixed(
    6,
  )}, room delta ${roomParity.maxRoomDelta.toFixed(3)}`;
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
  assert.equal(hero?.verification?.presentationEvent, PRESENTED_FRAME_EVENT);
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
    (hero) => ({
      ...hero,
      treatment: { ...hero.treatment, kind: "rgb-multiplier" },
    }),
    (hero) => ({
      ...hero,
      treatment: { ...hero.treatment, source: "/room/hero/treatment.png" },
    }),
    (hero) => ({
      ...hero,
      geometry: { ...hero.geometry, source: "/room/hero/geometry.glb" },
    }),
    (hero) => ({
      ...hero,
      geometry: { ...hero.geometry, occluders: ["Mesh_170"] },
    }),
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

function loadR4HeroArtifactFixture() {
  const manifest = JSON.parse(fs.readFileSync(publicManifestPath, "utf8"));
  const authoringManifestBytes = fs.readFileSync(heroAuthoringManifestPath);
  const authoring = JSON.parse(authoringManifestBytes);
  const sourceBytes = new Map(
    Object.values(authoring.sources).map(({ path: sourcePath }) => [
      sourcePath,
      fs.readFileSync(path.join(root, sourcePath)),
    ]),
  );
  return {
    manifest,
    authoringManifestBytes,
    sourceBytes,
    firstFrameBytes: fs.readFileSync(
      path.join(root, manifest.hero.firstFrameSource),
    ),
    treatedFrameBytes: sourceBytes.get(EXPECTED_AUTHORING_SOURCES.treatedBake),
    transferBytes: fs.readFileSync(
      path.join(root, "public", manifest.hero.treatment.source),
    ),
    roomPlateBytes: fs.readFileSync(path.join(root, ROOM_POSTER_REFERENCE)),
  };
}

function withRehashedGlb(fixture, glbBytes) {
  const authoring = JSON.parse(fixture.authoringManifestBytes);
  const glbPath = authoring.sources.compositorGlb.path;
  authoring.sources.compositorGlb.sha256 = sha256(glbBytes);
  const authoringManifestBytes = Buffer.from(JSON.stringify(authoring));
  return {
    ...fixture,
    manifest: {
      ...fixture.manifest,
      hero: {
        ...fixture.manifest.hero,
        verification: {
          ...fixture.manifest.hero.verification,
          presentedPixelAuthoringManifestSha256: sha256(authoringManifestBytes),
        },
      },
    },
    authoringManifestBytes,
    sourceBytes: new Map(fixture.sourceBytes).set(glbPath, glbBytes),
  };
}

function withRehashedTreatedBake(fixture, treatedFrameBytes, transferBytes) {
  const authoring = JSON.parse(fixture.authoringManifestBytes);
  const treatedPath = authoring.sources.treatedBake.path;
  authoring.sources.treatedBake.sha256 = sha256(treatedFrameBytes);
  const authoringManifestBytes = Buffer.from(JSON.stringify(authoring));
  return {
    ...fixture,
    manifest: {
      ...fixture.manifest,
      hero: {
        ...fixture.manifest.hero,
        verification: {
          ...fixture.manifest.hero.verification,
          presentedPixelAuthoringManifestSha256: sha256(authoringManifestBytes),
        },
      },
    },
    authoringManifestBytes,
    treatedFrameBytes,
    transferBytes,
    sourceBytes: new Map(fixture.sourceBytes).set(
      treatedPath,
      treatedFrameBytes,
    ),
  };
}

async function nearBlackTreatmentFixture(fixture) {
  const source = await rgbRaster(fixture.firstFrameBytes, "hero first frame");
  const treated = Buffer.alloc(source.data.length);
  const transfer = Buffer.alloc(source.data.length);
  for (let index = 0; index < source.data.length; index += 1) {
    transfer[index] = Math.max(
      0,
      Math.min(
        255,
        Math.round(127.5 - srgbToLinear(source.data[index]) * 127.5),
      ),
    );
  }
  const imageOptions = {
    raw: {
      width: source.width,
      height: source.height,
      channels: 3,
    },
  };
  const [treatedFrameBytes, transferBytes] = await Promise.all([
    sharp(treated, imageOptions).png().toBuffer(),
    sharp(transfer, imageOptions).png().toBuffer(),
  ]);
  return withRehashedTreatedBake(fixture, treatedFrameBytes, transferBytes);
}

async function assertR4HeroArtifactStubsFail() {
  const fixture = loadR4HeroArtifactFixture();
  await assert.doesNotReject(() => assertR4HeroArtifactContract(fixture));

  const authoring = JSON.parse(fixture.authoringManifestBytes);
  const missingPortraitNavigation = structuredClone(authoring);
  missingPortraitNavigation.geometry.heroOccluders =
    missingPortraitNavigation.geometry.heroOccluders.filter(
      ({ profile }) => profile !== "portrait",
    );
  const missingPortraitBytes = Buffer.from(
    JSON.stringify(missingPortraitNavigation),
  );
  await assert.rejects(
    () =>
      assertR4HeroArtifactContract({
        ...fixture,
        manifest: {
          ...fixture.manifest,
          hero: {
            ...fixture.manifest.hero,
            verification: {
              ...fixture.manifest.hero.verification,
              presentedPixelAuthoringManifestSha256:
                sha256(missingPortraitBytes),
            },
          },
        },
        authoringManifestBytes: missingPortraitBytes,
      }),
    /responsive navigation HeroOccluder profiles/,
  );

  const glbPath = authoring.sources.compositorGlb.path;
  const glbBytes = fixture.sourceBytes.get(glbPath);
  const corruptGlb = Buffer.from(glbBytes);
  const jsonChunkLength = corruptGlb.readUInt32LE(12);
  const binaryChunkStart = 12 + 8 + jsonChunkLength + 8;
  corruptGlb[binaryChunkStart] ^= 1;
  await assert.rejects(
    () => assertR4HeroArtifactContract(withRehashedGlb(fixture, corruptGlb)),
    /geometry|relationship|GLB/,
  );
  await assert.rejects(
    () =>
      assertR4HeroArtifactContract(
        withRehashedGlb(fixture, Buffer.from("stub GLB")),
      ),
    /GLB/,
  );
  await assert.rejects(
    () =>
      assertR4HeroArtifactContract({
        ...fixture,
        transferBytes: fixture.firstFrameBytes,
      }),
    /reconstruction error/,
  );
  const replacedBake = Buffer.from(fixture.treatedFrameBytes);
  replacedBake.fill(0, 0, Math.min(256, replacedBake.length));
  await assert.rejects(
    () =>
      assertR4HeroArtifactContract({
        ...fixture,
        treatedFrameBytes: replacedBake,
        sourceBytes: new Map(fixture.sourceBytes).set(
          EXPECTED_AUTHORING_SOURCES.treatedBake,
          replacedBake,
        ),
      }),
    /treatedBake source SHA-256/,
  );
  await assert.rejects(
    () => nearBlackTreatmentFixture(fixture).then(assertR4HeroArtifactContract),
    /does not reproduce the authored room poster/,
  );
  const authoredPlate = fixture.roomPlateBytes;
  const upright = await sharp(authoredPlate)
    .resize(viewport.width, viewport.height, { fit: "cover" })
    .png()
    .toBuffer();
  const reflected = await sharp(upright).flip().png().toBuffer();
  assertPlateUpright(await plateOrientationErrors(upright, authoredPlate));
  await assert.rejects(
    async () =>
      assertPlateUpright(
        await plateOrientationErrors(reflected, authoredPlate),
      ),
    /Canvas plate is not upright/,
  );
}

if (selfTest) {
  assertR4HeroSourceStubsFail();
  await assertR4HeroArtifactStubsFail();
  console.log(
    "hero occlusion self-tests passed (11 structural stubs, corrupt/stub GLBs, replaced transfer, near-black treatment, reflected plate).",
  );
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(publicManifestPath, "utf8"));
const frames = projectionFrames(manifest);

await checkAsync(
  "R4 hero authoring artifacts preserve exact geometry and room treatment",
  () => assertR4HeroArtifactContract(loadR4HeroArtifactFixture()),
);

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

check(
  "R4 hero projections contain no legacy screen-space occlusion payload",
  () => {
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
  },
);

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
    const canvasBytes = await page.locator("canvas").screenshot();
    await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const timeout = window.setTimeout(
            () => reject(new Error("hero first compositor frame timed out")),
            10_000,
          );
          const onFrame = (event) => {
            if (event.detail?.heroFramePresented !== 1) return;
            window.clearTimeout(timeout);
            window.removeEventListener(
              "lazy-a:compositor-frame-presented",
              onFrame,
            );
            document.querySelector("[data-lazy-a-hero]")?.pause();
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          };
          window.addEventListener("lazy-a:compositor-frame-presented", onFrame);
        }),
    );
    const liveCanvasBytes = await page.locator("canvas").screenshot();
    const deskProjection = manifest.variants.wide.endpoints.desk.projection;
    const orientationErrors = await plateOrientationErrors(
      canvasBytes,
      fs.readFileSync(path.join(root, ROOM_POSTER_REFERENCE)),
    );
    const [beforePlateParity, livePlateParity, firstFrameParity] =
      await Promise.all([
        presentedPlateColorParity(
          canvasBytes,
          fs.readFileSync(path.join(root, ROOM_POSTER_REFERENCE)),
          deskProjection.hero,
        ),
        presentedPlateColorParity(
          liveCanvasBytes,
          fs.readFileSync(path.join(root, ROOM_POSTER_REFERENCE)),
          deskProjection.hero,
        ),
        presentedFirstFrameParity(
          canvasBytes,
          liveCanvasBytes,
          deskProjection.hero,
        ),
      ]);

    check(
      "browser presents hero and plate from one atomic compositor frame",
      () => {
        const { compositor } = browserState;
        assert.ok(compositor, "window.__lazyACompositor is missing");
        assert.equal(compositor.atomic, true);
        assert.ok(Number.isFinite(compositor.plateMediaTime));
        assert.ok(Number.isInteger(compositor.projectionFrame));
        assert.ok(Number.isInteger(compositor.heroFramePresented));
        assert.equal(compositor.treatment, "calibrated-room-transfer");
        assert.equal(compositor.occlusion, "authored-depth-geometry");
        return JSON.stringify(compositor);
      },
    );
    check("browser has retired the legacy RLE hero occlusion marker", () => {
      assert.equal(
        browserState.legacyOcclusionMarkerPresent,
        false,
        JSON.stringify(browserState),
      );
      return "no window.__lazyAHeroOcclusion marker";
    });
    check("browser presents the authored photographic plate upright", () => {
      assertPlateUpright(orientationErrors);
      return `upright error ${orientationErrors.uprightError.toFixed(
        3,
      )}; reflected error ${orientationErrors.reflectedError.toFixed(3)}`;
    });
    check(
      "browser preserves authored plate color before and during the living print",
      () => {
        assertPlateColorParity(beforePlateParity, "before hero");
        assertPlateColorParity(livePlateParity, "live hero");
        return `before MAD ${beforePlateParity.channelMad
          .map((value) => value.toFixed(3))
          .join("/")}; live MAD ${livePlateParity.channelMad
          .map((value) => value.toFixed(3))
          .join("/")}`;
      },
    );
    check(
      "browser first live hero frame matches the corrected treated room poster",
      () => {
        assert.ok(
          firstFrameParity.channelMad.every(
            (value) => value <= MAX_FIRST_FRAME_CHANNEL_MAD,
          ),
          `first live frame diverges from treated poster: pixels=${
            firstFrameParity.samples
          } MAD=${firstFrameParity.channelMad
            .map((value) => value.toFixed(3))
            .join("/")}`,
        );
        return `${firstFrameParity.samples} pixels; MAD ${firstFrameParity.channelMad
          .map((value) => value.toFixed(3))
          .join("/")}`;
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
