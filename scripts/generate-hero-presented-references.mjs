/**
 * Offline author for Work Order 0117-R4 presented-pixel references.
 *
 * The browser-derived schedule contains timing bindings only. This script
 * decodes the pinned media, projects the authored GLB triangles with the exact
 * Three camera, applies the calibrated room transfer, rasterizes foreground
 * depth at delivery resolution, and writes immutable assets plus hashes.
 *
 * Usage:
 *   node scripts/generate-hero-presented-references.mjs [schedule]
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";
import {
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  Vector3,
  Vector4,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

globalThis.ProgressEvent ??= class ProgressEvent {};

const schedulePath = resolve(
  process.argv[2] ?? "build/wo-0117-r/hero-reference-schedule.json",
);
const manifestPath = resolve("public/room/manifest.json");
const typescriptManifestPath = resolve("three/scene/plateManifest.ts");
const authoringPath = resolve(
  "public/room/hero/hero-presented-authoring-manifest.json",
);
const catalogPath = resolve(
  "public/room/hero/hero-presented-pixel-references.json",
);
const outputRoot = resolve("public/room/hero/presented");
const cacheRoot = resolve("build/wo-0117-r/hero-reference-cache");
const glbPath = resolve("public/room/hero/hero-compositor.glb");
const treatmentPath = resolve("public/room/hero/hero-room-treatment.png");
const heroVideoPath = resolve("public/videos/hero-print-placeholder.mp4");
const rasterizerPath = resolve(
  "scripts/generate-hero-presented-references.mjs",
);
const minimumTraceFraction = 0.0005;
const minimumTreatmentFraction = 0.002;
const minimumCroppedTraceScale = 0.7;
const minimumCroppedBoundaryFraction = 0.15;
const heroFrameRate = 24;
const dryRun = process.argv.includes("--dry-run");
const profiledNavigationProxy = "HeroOccluder_ProductionNavigationSheet_";

const [schedule, manifest, baseAuthoring] = await Promise.all([
  readFile(schedulePath, "utf8").then(JSON.parse),
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(authoringPath, "utf8").then(JSON.parse),
]);

assert.equal(schedule.version, 1);
assert.equal(schedule.browserPixelsStored, false);
assert.equal(schedule.presentationEvent, "lazy-a:compositor-frame-presented");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function sha256File(path) {
  return sha256(await readFile(path));
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function rounded(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(9));
}

function publicRelative(path) {
  return path
    .replace(resolve("public/room/hero") + "/", "")
    .replaceAll("\\", "/");
}

async function loadRgb(path) {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: Buffer.from(data),
    width: info.width,
    height: info.height,
  };
}

async function coverRgb(path, width, height) {
  const { data } = await sharp(path)
    .resize(width, height, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.cubic,
    })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Buffer.from(data);
}

async function prepareVideoFrames(source, indices) {
  const sourceHash = (await sha256File(source)).slice(0, 16);
  const output = join(cacheRoot, `${basename(source)}-${sourceHash}`);
  const unique = [...new Set(indices)].sort((left, right) => left - right);
  const expected = unique.map((index) =>
    join(output, `${String(index).padStart(6, "0")}.png`),
  );
  let ready = true;
  for (const path of expected) {
    try {
      await readFile(path);
    } catch {
      ready = false;
      break;
    }
  }
  if (ready) {
    return new Map(unique.map((index, i) => [index, expected[i]]));
  }

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const temporary = join(output, "selected-%06d.png");
  const expression = unique.map((index) => `eq(n\\,${index})`).join("+");
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-vf",
      `select=${expression}`,
      "-vsync",
      "0",
      temporary,
    ],
    { stdio: "inherit" },
  );
  const selected = (await readdir(output))
    .filter((name) => /^selected-\d+\.png$/.test(name))
    .sort();
  assert.equal(
    selected.length,
    unique.length,
    `${source} selected frame count`,
  );
  for (let index = 0; index < unique.length; index += 1) {
    await rename(join(output, selected[index]), expected[index]);
  }
  return new Map(unique.map((index, i) => [index, expected[i]]));
}

async function prepareBrowserVideoFrames(source, indices) {
  const sourceHash = (await sha256File(source)).slice(0, 16);
  const output = join(
    cacheRoot,
    `${basename(source)}-${sourceHash}-chrome-frame-center-v2`,
  );
  const unique = [...new Set(indices)].sort((left, right) => left - right);
  const expected = unique.map((index) =>
    join(output, `${String(index).padStart(6, "0")}.png`),
  );
  let ready = true;
  for (const path of expected) {
    try {
      await readFile(path);
    } catch {
      ready = false;
      break;
    }
  }
  if (ready) {
    return new Map(unique.map((index, i) => [index, expected[i]]));
  }

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    const sourceDataUrl = `data:video/mp4;base64,${(
      await readFile(source)
    ).toString("base64")}`;
    await page.setContent(
      `<video id="hero" muted playsinline preload="auto" crossorigin="anonymous"></video>`,
    );
    await page.evaluate(async (url) => {
      const video = document.querySelector("#hero");
      const loaded = new Promise((resolveLoaded, rejectLoaded) => {
        video.addEventListener("loadeddata", resolveLoaded, { once: true });
        video.addEventListener("error", rejectLoaded, { once: true });
      });
      video.src = url;
      video.load();
      await loaded;
    }, sourceDataUrl);
    for (let index = 0; index < unique.length; index += 1) {
      const frameIndex = unique[index];
      const dataUrl = await page.evaluate(async (requestedFrame) => {
        const video = document.querySelector("#hero");
        const requestedTime = Math.min(
          (requestedFrame + 0.5) / 24,
          Math.max(0, video.duration - 1 / 48),
        );
        if (Math.abs(video.currentTime - requestedTime) > 1e-6) {
          await new Promise((resolveSeek, rejectSeek) => {
            video.addEventListener("seeked", resolveSeek, { once: true });
            video.addEventListener("error", rejectSeek, { once: true });
            video.currentTime = requestedTime;
          });
        }
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        return canvas.toDataURL("image/png");
      }, frameIndex);
      await writeFile(
        expected[index],
        Buffer.from(dataUrl.split(",", 2)[1], "base64"),
      );
    }
  } finally {
    await browser.close();
  }
  return new Map(unique.map((index, i) => [index, expected[i]]));
}

function resolveFrameSource(viewport, frame) {
  const profile = manifest.variants[viewport.profile];
  if (frame.plateState === "resting:desk") {
    return {
      path: resolve(
        `public/room/${viewport.profile}/transitions/opening-desk.mp4`,
      ),
      mediaFrame: frame.projectionFrame,
      projection:
        profile.transitions["opening-desk"].frames[frame.projectionFrame],
    };
  }
  const match = frame.plateState.match(
    /^transitioning:(desk)-to-(films|journal|contact|about)$|^transitioning:(films|journal|contact|about)-to-(desk)$/,
  );
  assert.ok(match, `unsupported plate state ${frame.plateState}`);
  const forward = Boolean(match[1]);
  const destination = forward ? match[2] : match[3];
  const authoredFrames = profile.transitions[`desk-${destination}`].frames;
  return {
    path: resolve(
      `public/room/${viewport.profile}/transitions/${
        forward ? `desk-${destination}` : `${destination}-desk`
      }.mp4`,
    ),
    mediaFrame: frame.projectionFrame,
    projection: forward
      ? authoredFrames[frame.projectionFrame]
      : [...authoredFrames].reverse()[frame.projectionFrame],
  };
}

async function loadMeshes() {
  const bytes = await readFile(glbPath);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const gltf = await new Promise((resolveGltf, rejectGltf) => {
    new GLTFLoader().parse(arrayBuffer, "", resolveGltf, rejectGltf);
  });
  gltf.scene.updateMatrixWorld(true);
  const meshes = [];
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const indices = geometry.index
      ? Array.from(geometry.index.array)
      : Array.from({ length: position.count }, (_, index) => index);
    const vertices = Array.from({ length: position.count }, (_, index) => {
      const world = new Vector3(
        position.getX(index),
        position.getY(index),
        position.getZ(index),
      ).applyMatrix4(object.matrixWorld);
      return {
        world,
        uv: uv ? [uv.getX(index), uv.getY(index)] : null,
      };
    });
    meshes.push({
      name: object.name,
      vertices,
      indices,
      matrixWorld: new Matrix4().copy(object.matrixWorld),
    });
  });
  const surface = meshes.find(({ name }) => name === "HeroLiveSurface");
  const occluders = meshes.filter(({ name }) =>
    name.startsWith("HeroOccluder_"),
  );
  assert.ok(surface, "HeroLiveSurface is missing from GLB");
  assert.equal(occluders.length, 13, "HeroOccluder count");
  return { surface, occluders };
}

function occludersForProfile(occluders, profile) {
  const selected = occluders.filter(
    ({ name }) =>
      !name.startsWith(profiledNavigationProxy) ||
      name === `${profiledNavigationProxy}${profile}`,
  );
  assert.equal(selected.length, 12, `${profile} HeroOccluder count`);
  return selected;
}

function projectMesh(mesh, camera, width, height) {
  return mesh.vertices.map(({ world, uv }) => {
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
      inverseW,
      uv,
      inFront: clip.w > 0,
    };
  });
}

function triangleBounds(vertices, width, height, clipBounds) {
  if (vertices.some(({ inFront }) => !inFront)) return null;
  const minX = Math.max(
    0,
    clipBounds?.minX ?? 0,
    Math.floor(Math.min(...vertices.map(({ x }) => x))),
  );
  const maxX = Math.min(
    width - 1,
    clipBounds?.maxX ?? width - 1,
    Math.ceil(Math.max(...vertices.map(({ x }) => x))),
  );
  const minY = Math.max(
    0,
    clipBounds?.minY ?? 0,
    Math.floor(Math.min(...vertices.map(({ y }) => y))),
  );
  const maxY = Math.min(
    height - 1,
    clipBounds?.maxY ?? height - 1,
    Math.ceil(Math.max(...vertices.map(({ y }) => y))),
  );
  return minX <= maxX && minY <= maxY ? { minX, maxX, minY, maxY } : null;
}

function edgeFunction(a, b, x, y) {
  return (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
}

function rasterMesh({
  mesh,
  projected,
  width,
  height,
  clipBounds,
  depth,
  owner,
  ownerIndex,
  surface,
}) {
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const vertices = [
      projected[mesh.indices[offset]],
      projected[mesh.indices[offset + 1]],
      projected[mesh.indices[offset + 2]],
    ];
    const bounds = triangleBounds(vertices, width, height, clipBounds);
    if (!bounds) continue;
    const area = edgeFunction(
      vertices[0],
      vertices[1],
      vertices[2].x,
      vertices[2].y,
    );
    if (Math.abs(area) < 1e-9) continue;
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
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
        if (owner) owner[pixel] = ownerIndex;
        if (surface) {
          const denominator =
            barycentric[0] * vertices[0].inverseW +
            barycentric[1] * vertices[1].inverseW +
            barycentric[2] * vertices[2].inverseW;
          surface.mask[pixel] = 1;
          surface.u[pixel] =
            (barycentric[0] * vertices[0].uv[0] * vertices[0].inverseW +
              barycentric[1] * vertices[1].uv[0] * vertices[1].inverseW +
              barycentric[2] * vertices[2].uv[0] * vertices[2].inverseW) /
            denominator;
          surface.v[pixel] =
            (barycentric[0] * vertices[0].uv[1] * vertices[0].inverseW +
              barycentric[1] * vertices[1].uv[1] * vertices[1].inverseW +
              barycentric[2] * vertices[2].uv[1] * vertices[2].inverseW) /
            denominator;
        }
      }
    }
  }
}

function convexHull(points) {
  const unique = [
    ...new Map(
      points.map((point) => [`${point[0]},${point[1]}`, point]),
    ).values(),
  ].sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  if (unique.length <= 2) return unique;
  const cross = (origin, a, b) =>
    (a[0] - origin[0]) * (b[1] - origin[1]) -
    (a[1] - origin[1]) * (b[0] - origin[0]);
  const lower = [];
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper = [];
  for (const point of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function clipPolygon(polygon, width, height) {
  const boundaries = [
    {
      inside: ([x]) => x >= 0,
      intersect: ([x1, y1], [x2, y2]) => [
        0,
        y1 + ((y2 - y1) * -x1) / (x2 - x1),
      ],
    },
    {
      inside: ([x]) => x <= width,
      intersect: ([x1, y1], [x2, y2]) => [
        width,
        y1 + ((y2 - y1) * (width - x1)) / (x2 - x1),
      ],
    },
    {
      inside: ([, y]) => y >= 0,
      intersect: ([x1, y1], [x2, y2]) => [
        x1 + ((x2 - x1) * -y1) / (y2 - y1),
        0,
      ],
    },
    {
      inside: ([, y]) => y <= height,
      intersect: ([x1, y1], [x2, y2]) => [
        x1 + ((x2 - x1) * (height - y1)) / (y2 - y1),
        height,
      ],
    },
  ];
  let result = polygon;
  for (const boundary of boundaries) {
    const input = result;
    result = [];
    for (let index = 0; index < input.length; index += 1) {
      const current = input[index];
      const previous = input[(index + input.length - 1) % input.length];
      const currentInside = boundary.inside(current);
      const previousInside = boundary.inside(previous);
      if (currentInside !== previousInside) {
        result.push(boundary.intersect(previous, current));
      }
      if (currentInside) result.push(current);
    }
  }
  return result;
}

function addSegment(map, owner, start, end) {
  if (!map.has(owner)) map.set(owner, []);
  map.get(owner).push([start, end]);
}

function boundarySegments(surfaceMask, visibleMask, owner, width, height) {
  const red = new Map([["surface", []]]);
  const green = new Map();
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!surfaceMask[pixel]) continue;
      const visible = visibleMask[pixel] === 1;
      for (const [dx, dy, start, end] of [
        [1, 0, [x + 1, y], [x + 1, y + 1]],
        [0, 1, [x, y + 1], [x + 1, y + 1]],
      ]) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (!inside(nextX, nextY)) continue;
        const next = nextY * width + nextX;
        if (!surfaceMask[next]) {
          if (visible) addSegment(red, "surface", start, end);
          continue;
        }
        const nextVisible = visibleMask[next] === 1;
        if (visible === nextVisible) continue;
        const occludedPixel = visible ? next : pixel;
        const occluder = owner[occludedPixel];
        if (occluder >= 0) addSegment(green, occluder, start, end);
      }
      if (!visible) continue;
      for (const [nextX, nextY, start, end] of [
        [x - 1, y, [x, y], [x, y + 1]],
        [x, y - 1, [x, y], [x + 1, y]],
      ]) {
        if (!inside(nextX, nextY)) continue;
        if (!surfaceMask[nextY * width + nextX]) {
          addSegment(red, "surface", start, end);
        }
      }
    }
  }
  return { red, green };
}

function pointKey([x, y]) {
  return `${x},${y}`;
}

function chainSegments(segments) {
  const adjacency = new Map();
  segments.forEach(([start, end], index) => {
    for (const point of [start, end]) {
      const key = pointKey(point);
      if (!adjacency.has(key)) adjacency.set(key, []);
      adjacency.get(key).push(index);
    }
  });
  const used = new Uint8Array(segments.length);
  const chains = [];
  const extend = (chain, atStart) => {
    while (true) {
      const point = atStart ? chain[0] : chain.at(-1);
      const candidate = (adjacency.get(pointKey(point)) ?? []).find(
        (index) => !used[index],
      );
      if (candidate === undefined) break;
      used[candidate] = 1;
      const [first, second] = segments[candidate];
      const next = pointKey(first) === pointKey(point) ? second : first;
      if (atStart) chain.unshift(next);
      else chain.push(next);
    }
  };
  const order = segments
    .map((_, index) => index)
    .sort((left, right) => {
      const leftDegree = Math.min(
        adjacency.get(pointKey(segments[left][0])).length,
        adjacency.get(pointKey(segments[left][1])).length,
      );
      const rightDegree = Math.min(
        adjacency.get(pointKey(segments[right][0])).length,
        adjacency.get(pointKey(segments[right][1])).length,
      );
      return leftDegree - rightDegree;
    });
  for (const index of order) {
    if (used[index]) continue;
    used[index] = 1;
    const chain = [segments[index][0], segments[index][1]];
    extend(chain, false);
    extend(chain, true);
    chains.push(chain);
  }
  return chains;
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }
  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  return Math.hypot(
    point[0] - (start[0] + ratio * dx),
    point[1] - (start[1] + ratio * dy),
  );
}

function simplify(points, tolerance = 0.2) {
  if (points.length <= 2) return points;
  let maximum = 0;
  let split = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(
      points[index],
      points[0],
      points.at(-1),
    );
    if (distance > maximum) {
      maximum = distance;
      split = index;
    }
  }
  if (maximum <= tolerance) return [points[0], points.at(-1)];
  return [
    ...simplify(points.slice(0, split + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(split), tolerance),
  ];
}

function chainLength(chain) {
  return chain
    .slice(1)
    .reduce(
      (total, point, index) =>
        total +
        Math.hypot(point[0] - chain[index][0], point[1] - chain[index][1]),
      0,
    );
}

function selectChains(segments, limit = 6) {
  return chainSegments(segments)
    .map((chain) => simplify(chain))
    .filter((chain) => chain.length >= 2)
    .sort((left, right) => chainLength(right) - chainLength(left))
    .slice(0, limit);
}

function normalizeChains(chains, width, height) {
  return chains.map((chain) =>
    chain.map(([x, y]) => [rounded(x / width), rounded(y / height)]),
  );
}

function drawChains(chains, width, height) {
  const mask = new Uint8Array(width * height);
  for (const chain of chains) {
    for (let index = 1; index < chain.length; index += 1) {
      const [startX, startY] = chain[index - 1];
      const [endX, endY] = chain[index];
      const steps = Math.max(
        1,
        Math.ceil(Math.hypot(endX - startX, endY - startY) * 2),
      );
      for (let step = 0; step <= steps; step += 1) {
        const ratio = step / steps;
        const x = Math.max(
          0,
          Math.min(width - 1, Math.floor(startX + (endX - startX) * ratio)),
        );
        const y = Math.max(
          0,
          Math.min(height - 1, Math.floor(startY + (endY - startY) * ratio)),
        );
        mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

function maskNormal(mask, x, y, width) {
  let xx = 0;
  let xy = 0;
  let yy = 0;
  let neighbors = 0;
  for (let offsetY = -3; offsetY <= 3; offsetY += 1) {
    for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
      if (
        (offsetX === 0 && offsetY === 0) ||
        Math.hypot(offsetX, offsetY) > 3 ||
        !mask[(y + offsetY) * width + x + offsetX]
      ) {
        continue;
      }
      xx += offsetX * offsetX;
      xy += offsetX * offsetY;
      yy += offsetY * offsetY;
      neighbors += 1;
    }
  }
  if (!neighbors) return null;
  const tangent = Math.atan2(2 * xy, xx - yy) / 2;
  return [-Math.sin(tangent), Math.cos(tangent)];
}

function lumaAt(rgb, width, x, y) {
  const offset = (y * width + x) * 3;
  return (
    rgb[offset] * 0.2126 + rgb[offset + 1] * 0.7152 + rgb[offset + 2] * 0.0722
  );
}

function strongestDirectionalGradient(rgb, width, height, x, y, normal) {
  let strongest = 0;
  for (let offset = -4; offset <= 4; offset += 0.25) {
    const centerX = Math.round(x + normal[0] * offset);
    const centerY = Math.round(y + normal[1] * offset);
    const firstX = Math.round(centerX - normal[0]);
    const firstY = Math.round(centerY - normal[1]);
    const secondX = Math.round(centerX + normal[0]);
    const secondY = Math.round(centerY + normal[1]);
    if (
      firstX < 0 ||
      firstY < 0 ||
      secondX < 0 ||
      secondY < 0 ||
      firstX >= width ||
      secondX >= width ||
      firstY >= height ||
      secondY >= height
    ) {
      continue;
    }
    strongest = Math.max(
      strongest,
      Math.abs(
        lumaAt(rgb, width, secondX, secondY) -
          lumaAt(rgb, width, firstX, firstY),
      ),
    );
  }
  return strongest;
}

function pruneTrace(mask, rgb, width, height, minimumCount) {
  for (const threshold of [38, 32, 26, 22]) {
    const candidate = new Uint8Array(mask);
    for (let y = 4; y < height - 4; y += 1) {
      for (let x = 4; x < width - 4; x += 1) {
        const pixel = y * width + x;
        if (!candidate[pixel]) continue;
        const normal = maskNormal(mask, x, y, width);
        if (
          !normal ||
          strongestDirectionalGradient(rgb, width, height, x, y, normal) <
            threshold
        ) {
          candidate[pixel] = 0;
        }
      }
    }
    const count = candidate.reduce((total, value) => total + value, 0);
    if (count >= minimumCount) return candidate;
  }
  return mask;
}

function srgbToLinear(channel) {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
  const channel = Math.max(0, Math.min(1, value));
  const encoded =
    channel <= 0.0031308
      ? channel * 12.92
      : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(encoded * 255)));
}

function bilinearSample(image, u, v, decodeSrgb) {
  const x = Math.max(0, Math.min(image.width - 1, u * (image.width - 1)));
  // Hero and treatment textures both use flipY=false at runtime: the GLB's
  // v=0 top edge samples the source image's first row.
  const y = Math.max(0, Math.min(image.height - 1, v * (image.height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const weights = [
    [(1 - tx) * (1 - ty), x0, y0],
    [tx * (1 - ty), x1, y0],
    [(1 - tx) * ty, x0, y1],
    [tx * ty, x1, y1],
  ];
  return [0, 1, 2].map((channel) => {
    const encoded = weights.reduce((total, [weight, sampleX, sampleY]) => {
      const value = image.data[(sampleY * image.width + sampleX) * 3 + channel];
      return total + weight * (value / 255);
    }, 0);
    return decodeSrgb ? srgbToLinear(encoded) : encoded;
  });
}

function renderHero({
  plate,
  hero,
  treatment,
  surface,
  surfaceDepth,
  occluderDepth,
  owner,
  width,
  height,
}) {
  const composite = Buffer.from(plate);
  const visible = new Uint8Array(width * height);
  for (let pixel = 0; pixel < surface.mask.length; pixel += 1) {
    if (
      !surface.mask[pixel] ||
      occluderDepth[pixel] < surfaceDepth[pixel] - 1e-7
    ) {
      continue;
    }
    visible[pixel] = 1;
    const source = bilinearSample(
      hero,
      surface.u[pixel],
      surface.v[pixel],
      true,
    );
    const transfer = bilinearSample(
      treatment,
      surface.u[pixel],
      surface.v[pixel],
      false,
    );
    const offset = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      composite[offset + channel] = linearToSrgb(
        source[channel] + (transfer[channel] - 0.5) * 2,
      );
    }
  }
  return { composite, visible, owner };
}

function treatmentMask(visible, red, green, width, height, minimum) {
  const mask = new Uint8Array(width * height);
  for (let y = 3; y < height - 3; y += 1) {
    for (let x = 3; x < width - 3; x += 1) {
      const pixel = y * width + x;
      if (!visible[pixel] || red[pixel] || green[pixel]) continue;
      let interior = true;
      for (let offsetY = -3; offsetY <= 3 && interior; offsetY += 1) {
        for (let offsetX = -3; offsetX <= 3; offsetX += 1) {
          if (!visible[(y + offsetY) * width + x + offsetX]) {
            interior = false;
            break;
          }
        }
      }
      if (interior) mask[pixel] = 1;
    }
  }
  const count = mask.reduce((total, value) => total + value, 0);
  assert.ok(count >= minimum, `blue treatment mask ${count} < ${minimum}`);
  return mask;
}

function writeRegionBuffer(red, green, blue, width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    data[offset] = red[pixel] ? 255 : 0;
    data[offset + 1] = green[pixel] ? 255 : 0;
    data[offset + 2] = blue[pixel] ? 255 : 0;
    data[offset + 3] = 255;
  }
  return data;
}

function createCamera(projection, width, height) {
  const camera = new PerspectiveCamera(
    projection.camera.fov,
    width / height,
    0.1,
    1000,
  );
  camera.position.copy(new Vector3(...projection.camera.position));
  camera.quaternion.copy(new Quaternion(...projection.camera.quaternion));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function heroBounds(projected, width, height) {
  const visible = projected.filter(({ inFront }) => inFront);
  assert.ok(visible.length >= 3, "hero surface is behind the camera");
  return {
    minX: Math.max(0, Math.floor(Math.min(...visible.map(({ x }) => x))) - 2),
    maxX: Math.min(
      width - 1,
      Math.ceil(Math.max(...visible.map(({ x }) => x))) + 2,
    ),
    minY: Math.max(0, Math.floor(Math.min(...visible.map(({ y }) => y))) - 2),
    maxY: Math.min(
      height - 1,
      Math.ceil(Math.max(...visible.map(({ y }) => y))) + 2,
    ),
  };
}

function referenceId(viewportKey, frame) {
  const state = frame.plateState
    .replace("transitioning:", "")
    .replace("resting:", "rest-")
    .replaceAll("-to-", "-");
  return `${viewportKey}-${state}-${frame.phase ?? `frame-${frame.heroFramePresented}`}`;
}

function heroSourceFrameIndex(frame) {
  assert.ok(
    Number.isFinite(frame.heroMediaTime) && frame.heroMediaTime >= 0,
    `hero frame ${frame.heroFramePresented} needs a decoded media timestamp`,
  );
  const frameIndex = Math.round(frame.heroMediaTime * heroFrameRate);
  assert.ok(
    Math.abs(frame.heroMediaTime - frameIndex / heroFrameRate) <= 0.000_01,
    `hero timestamp ${frame.heroMediaTime} is off the ${heroFrameRate}fps source grid`,
  );
  return frameIndex;
}

const meshes = await loadMeshes();
const treatment = await loadRgb(treatmentPath);
const scheduleFrames = Object.entries(schedule.viewports).flatMap(
  ([viewportKey, viewport]) =>
    viewport.frames.map((frame) => ({
      viewportKey,
      viewport,
      frame,
      source: resolveFrameSource(viewport, frame),
    })),
);
assert.equal(scheduleFrames.length, 130, "five-viewport reference count");
assert.deepEqual(
  schedule.capturePlaybackRates,
  { hero: 0.4, plate: 0.5 },
  "reference capture playback rates",
);
assert.deepEqual(
  Object.keys(schedule.viewports).sort(),
  ["1024x768", "1280x720", "1316x1329", "375x812", "768x1024"],
  "required reference viewports",
);
for (const [viewportKey, viewport] of Object.entries(schedule.viewports)) {
  const navigationGeometry = baseAuthoring.geometry.heroOccluders.filter(
    ({ sourceObject }) => sourceObject === "ProductionNavigationSheet",
  );
  const navigationProxy = navigationGeometry.find(
    ({ profile }) => profile === viewport.profile,
  );
  assert.deepEqual(
    navigationProxy?.navigationPlane,
    manifest.variants[viewport.profile].navigation.plane,
    `${viewportKey} compositor navigation proxy must match the canonical ${viewport.profile} navigation plane`,
  );
  assert.equal(viewport.frames.length, 26, `${viewportKey} reference count`);
  for (const destination of ["films", "journal", "contact", "about"]) {
    for (const direction of ["forward", "reverse"]) {
      const state =
        direction === "forward"
          ? `transitioning:desk-to-${destination}`
          : `transitioning:${destination}-to-desk`;
      const phases = viewport.frames
        .filter(({ plateState }) => plateState === state)
        .map(({ phase }) => phase);
      assert.deepEqual(
        phases,
        ["early", "mid", "late"],
        `${viewportKey} ${destination} ${direction} phase coverage`,
      );
    }
  }
}
if (dryRun) {
  for (const source of Object.values(baseAuthoring.sources)) {
    assert.equal(
      await sha256File(resolve(source.path)),
      source.sha256,
      `${source.path} immutable source hash`,
    );
  }
  console.log(
    "Hero reference author dry-run passed: 130 path/phase bindings, pinned source hashes, 1 live surface, and 12 active occluders per profile.",
  );
  process.exit(0);
}

const heroFramePaths = await prepareBrowserVideoFrames(
  heroVideoPath,
  scheduleFrames.map(({ frame }) => heroSourceFrameIndex(frame)),
);
const plateGroups = new Map();
for (const { source } of scheduleFrames) {
  if (!plateGroups.has(source.path)) plateGroups.set(source.path, []);
  plateGroups.get(source.path).push(source.mediaFrame);
}
const plateFramePaths = new Map();
for (const [source, indices] of plateGroups) {
  plateFramePaths.set(source, await prepareVideoFrames(source, indices));
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const geometryHashes = new Map([
  [
    baseAuthoring.geometry.heroLiveSurface.object,
    baseAuthoring.geometry.heroLiveSurface.geometrySha256,
  ],
  ...baseAuthoring.geometry.heroOccluders.map(({ object, geometrySha256 }) => [
    object,
    geometrySha256,
  ]),
]);
const references = {};
const catalogViewports = {};

for (const [viewportKey, viewport] of Object.entries(schedule.viewports)) {
  const viewportDirectory = join(outputRoot, viewportKey);
  await mkdir(viewportDirectory, { recursive: true });
  const catalogFrames = [];
  let edgeQualityReferences = 0;
  for (const frame of viewport.frames) {
    const source = resolveFrameSource(viewport, frame);
    const projection = source.projection;
    assert.ok(projection, `${viewportKey} projection frame`);
    const camera = createCamera(projection, viewport.width, viewport.height);
    const projectedSurface = projectMesh(
      meshes.surface,
      camera,
      viewport.width,
      viewport.height,
    );
    const profileOccluders = occludersForProfile(
      meshes.occluders,
      viewport.profile,
    );
    const projectedOccluders = profileOccluders.map((mesh) => ({
      mesh,
      projected: projectMesh(mesh, camera, viewport.width, viewport.height),
    }));
    const bounds = heroBounds(
      projectedSurface,
      viewport.width,
      viewport.height,
    );
    assert.ok(
      bounds.maxX > bounds.minX && bounds.maxY > bounds.minY,
      `${viewportKey} ${frame.plateState} hero is not visible`,
    );

    const pixels = viewport.width * viewport.height;
    const surfaceDepth = new Float32Array(pixels);
    surfaceDepth.fill(Number.POSITIVE_INFINITY);
    const surface = {
      mask: new Uint8Array(pixels),
      u: new Float32Array(pixels),
      v: new Float32Array(pixels),
    };
    rasterMesh({
      mesh: meshes.surface,
      projected: projectedSurface,
      width: viewport.width,
      height: viewport.height,
      clipBounds: bounds,
      depth: surfaceDepth,
      surface,
    });
    const occluderDepth = new Float32Array(pixels);
    occluderDepth.fill(Number.POSITIVE_INFINITY);
    const owner = new Int16Array(pixels);
    owner.fill(-1);
    projectedOccluders.forEach(({ mesh, projected }, ownerIndex) =>
      rasterMesh({
        mesh,
        projected,
        width: viewport.width,
        height: viewport.height,
        clipBounds: bounds,
        depth: occluderDepth,
        owner,
        ownerIndex,
      }),
    );

    const heroFramePath = heroFramePaths.get(heroSourceFrameIndex(frame));
    const plateFramePath = plateFramePaths
      .get(source.path)
      .get(source.mediaFrame);
    assert.ok(heroFramePath && plateFramePath, "decoded source frame");
    const [hero, plate] = await Promise.all([
      loadRgb(heroFramePath),
      coverRgb(plateFramePath, viewport.width, viewport.height),
    ]);
    const rendered = renderHero({
      plate,
      hero,
      treatment,
      surface,
      surfaceDepth,
      occluderDepth,
      owner,
      width: viewport.width,
      height: viewport.height,
    });
    const segments = boundarySegments(
      surface.mask,
      rendered.visible,
      owner,
      viewport.width,
      viewport.height,
    );
    const redChains = selectChains(segments.red.get("surface") ?? [], 8);
    assert.ok(redChains.length, `${viewportKey} red hero boundary`);
    const greenChainsByObject = projectedOccluders
      .map(({ mesh }, ownerIndex) => {
        const selected = selectChains(segments.green.get(ownerIndex) ?? [], 6);
        return {
          object: mesh.name,
          chains: selected,
        };
      })
      .filter(({ chains }) => chains.length > 0);
    const tracedGreenChains = greenChainsByObject.flatMap(
      ({ chains }) => chains,
    );

    const viewportMinimumTrace = Math.ceil(pixels * minimumTraceFraction);
    const touchesViewportEdge =
      bounds.minX === 0 ||
      bounds.minY === 0 ||
      bounds.maxX === viewport.width - 1 ||
      bounds.maxY === viewport.height - 1;
    const projectedBoundary =
      2 * (bounds.maxX - bounds.minX + 1 + (bounds.maxY - bounds.minY + 1));
    const projectedWidth = bounds.maxX - bounds.minX + 1;
    const projectedHeight = bounds.maxY - bounds.minY + 1;
    const availableProjectedBoundary =
      projectedBoundary -
      (bounds.minX === 0 ? projectedHeight : 0) -
      (bounds.maxX === viewport.width - 1 ? projectedHeight : 0) -
      (bounds.minY === 0 ? projectedWidth : 0) -
      (bounds.maxY === viewport.height - 1 ? projectedWidth : 0);
    const visibleHeroPixels = rendered.visible.reduce(
      (total, value) => total + value,
      0,
    );
    const minimumTrace = Math.max(
      16,
      touchesViewportEdge
        ? Math.min(
            viewportMinimumTrace,
            Math.ceil(Math.sqrt(visibleHeroPixels) * minimumCroppedTraceScale),
            Math.ceil(
              availableProjectedBoundary * minimumCroppedBoundaryFraction,
            ),
          )
        : viewportMinimumTrace,
    );
    const rawRed = drawChains(redChains, viewport.width, viewport.height);
    const rawGreen = drawChains(
      tracedGreenChains,
      viewport.width,
      viewport.height,
    );
    let red = pruneTrace(
      rawRed,
      rendered.composite,
      viewport.width,
      viewport.height,
      minimumTrace,
    );
    let green = pruneTrace(
      rawGreen,
      rendered.composite,
      viewport.width,
      viewport.height,
      minimumTrace,
    );
    for (let pixel = 0; pixel < pixels; pixel += 1) {
      if (red[pixel]) green[pixel] = 0;
    }
    const redCount = red.reduce((total, value) => total + value, 0);
    const greenCount = green.reduce((total, value) => total + value, 0);
    const rawRedCount = rawRed.reduce((total, value) => total + value, 0);
    assert.ok(
      redCount >= minimumTrace,
      `${viewportKey} red trace ${redCount} < ${minimumTrace}; raw=${rawRedCount} visible=${visibleHeroPixels} cropped=${touchesViewportEdge} projectedBoundary=${projectedBoundary} availableBoundary=${availableProjectedBoundary} bounds=${JSON.stringify(bounds)}`,
    );
    const greenApplicable = greenCount >= minimumTrace;
    if (!greenApplicable) {
      green = new Uint8Array(pixels);
    } else {
      edgeQualityReferences += 1;
    }
    const blue = treatmentMask(
      rendered.visible,
      red,
      green,
      viewport.width,
      viewport.height,
      Math.max(64, Math.ceil(pixels * minimumTreatmentFraction)),
    );

    const heroPolygon = clipPolygon(
      convexHull(
        projectedSurface
          .filter(({ inFront }) => inFront)
          .map(({ x, y }) => [x, y]),
      ),
      viewport.width,
      viewport.height,
    );
    assert.ok(heroPolygon.length >= 3, `${viewportKey} hero polygon`);
    const authoredProjection = {
      traceEvidence: {
        version: 1,
        basis: touchesViewportEdge
          ? "cropped-visible-boundary-v2"
          : "viewport-area-v1",
        visibleHeroPixels,
        availableProjectedBoundary,
        minimumPixels: minimumTrace,
      },
      red: {
        object: "HeroLiveSurface",
        geometrySha256: geometryHashes.get("HeroLiveSurface"),
        boundaries: normalizeChains(redChains, viewport.width, viewport.height),
      },
      green: {
        applicable: greenApplicable,
        objects: greenApplicable
          ? greenChainsByObject.map(({ object, chains }) => ({
              object,
              geometrySha256: geometryHashes.get(object),
              boundaries: normalizeChains(
                chains,
                viewport.width,
                viewport.height,
              ),
            }))
          : [],
      },
      blue: {
        object: "HeroLiveSurface",
        geometrySha256: geometryHashes.get("HeroLiveSurface"),
        polygon: heroPolygon.map(([x, y]) => [
          rounded(x / viewport.width),
          rounded(y / viewport.height),
        ]),
      },
    };

    const id = referenceId(viewportKey, frame);
    const sourceOutput = join(viewportDirectory, `${id}-source.png`);
    const compositeOutput = join(viewportDirectory, `${id}-composite.png`);
    const regionsOutput = join(viewportDirectory, `${id}-regions.png`);
    await Promise.all([
      copyFile(heroFramePath, sourceOutput),
      sharp(rendered.composite, {
        raw: {
          width: viewport.width,
          height: viewport.height,
          channels: 3,
        },
      })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(compositeOutput),
      sharp(
        writeRegionBuffer(red, green, blue, viewport.width, viewport.height),
        {
          raw: {
            width: viewport.width,
            height: viewport.height,
            channels: 4,
          },
        },
      )
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(regionsOutput),
    ]);
    const [sourceSha256, compositeSha256, regionsSha256] = await Promise.all([
      sha256File(sourceOutput),
      sha256File(compositeOutput),
      sha256File(regionsOutput),
    ]);
    const paths = {
      source: publicRelative(sourceOutput),
      composite: publicRelative(compositeOutput),
      regions: publicRelative(regionsOutput),
    };
    references[id] = {
      viewport: viewportKey,
      heroFramePresented: frame.heroFramePresented,
      heroMediaTime: frame.heroMediaTime,
      source: { path: paths.source, sha256: sourceSha256 },
      composite: { path: paths.composite, sha256: compositeSha256 },
      regions: { path: paths.regions, sha256: regionsSha256 },
      projection: authoredProjection,
      projectionSha256: sha256(Buffer.from(canonicalJson(authoredProjection))),
    };
    catalogFrames.push({
      authoringReferenceId: id,
      heroFramePresented: frame.heroFramePresented,
      heroMediaTime: frame.heroMediaTime,
      plateState: frame.plateState,
      projectionFrame: frame.projectionFrame,
      ...(frame.phase ? { phase: frame.phase } : {}),
      authoredSource: paths.source,
      composite: paths.composite,
      regions: paths.regions,
    });
    console.log(
      `Authored ${viewportKey} frame ${frame.heroFramePresented} (${frame.plateState}/${frame.phase ?? "rest"})`,
    );
  }
  assert.ok(
    edgeQualityReferences >= 3,
    `${viewportKey} has ${edgeQualityReferences} foreground edge-quality references; expected at least 3`,
  );
  catalogViewports[viewportKey] = { frames: catalogFrames };
}

const authoring = {
  ...baseAuthoring,
  referenceGeneration: {
    ...baseAuthoring.referenceGeneration,
    capturePlaybackRates: schedule.capturePlaybackRates,
    schedule: {
      path: schedulePath.replace(resolve(".") + "/", ""),
      sha256: await sha256File(schedulePath),
      browserPixelsStored: false,
    },
    rasterizer: {
      path: rasterizerPath.replace(resolve(".") + "/", ""),
      sha256: await sha256File(rasterizerPath),
      execution: "offline-node-sharp-three-triangle-rasterizer",
    },
  },
  references,
};
const authoringBytes = Buffer.from(JSON.stringify(authoring));
assert.ok(
  authoringBytes.length <= 2 * 1024 * 1024,
  `authoring manifest ${authoringBytes.length} exceeds 2 MiB`,
);
await writeFile(authoringPath, authoringBytes);
const authoringSha256 = sha256(authoringBytes);
const runtimeManifest = JSON.parse(await readFile(manifestPath, "utf8"));
runtimeManifest.hero.verification.presentedPixelAuthoringManifestSha256 =
  authoringSha256;
await writeFile(manifestPath, JSON.stringify(runtimeManifest));
const typescriptManifest = await readFile(typescriptManifestPath, "utf8");
const hashPattern =
  /(["']?presentedPixelAuthoringManifestSha256["']?\s*:\s*")[a-f0-9]{64}(")/;
assert.ok(
  hashPattern.test(typescriptManifest),
  "TypeScript manifest authoring hash field",
);
await writeFile(
  typescriptManifestPath,
  typescriptManifest.replace(hashPattern, `$1${authoringSha256}$2`),
);
const catalog = {
  version: 2,
  presentationEvent: "lazy-a:compositor-frame-presented",
  kind: "authored-presented-pixels-v1",
  regionEncoding: "rgb-poster-foreground-treatment",
  authoringManifest: "hero-presented-authoring-manifest.json",
  authoringManifestSha256: authoringSha256,
  viewports: catalogViewports,
};
const catalogBytes = Buffer.from(JSON.stringify(catalog));
assert.ok(
  catalogBytes.length <= 256 * 1024,
  `catalog ${catalogBytes.length} exceeds 256 KiB`,
);
await writeFile(catalogPath, catalogBytes);
console.log(
  `Wrote 130 offline references; authoring=${authoringBytes.length} bytes catalog=${catalogBytes.length} bytes`,
);
