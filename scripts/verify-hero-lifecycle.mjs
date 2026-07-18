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
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

const argumentsList = process.argv.slice(2);
const url =
  argumentsList.find((argument) => !argument.startsWith("--")) ??
  "http://localhost:3000/";
const allViewports = [
  { name: "desktop", width: 1280, height: 720, profile: "wide" },
  { name: "tall desktop", width: 1316, height: 1329, profile: "wide" },
  { name: "tablet landscape", width: 1024, height: 768, profile: "wide" },
  { name: "tablet portrait", width: 768, height: 1024, profile: "wide" },
  { name: "phone", width: 375, height: 812, profile: "portrait" },
];
const viewportFilter = argumentsList
  .find((argument) => argument.startsWith("--viewport="))
  ?.split("=")[1];
const VIEWPORTS = viewportFilter
  ? allViewports.filter(
      ({ name }) => name.replaceAll(" ", "-") === viewportFilter,
    )
  : allViewports;
assert.ok(VIEWPORTS.length > 0, `unknown viewport ${viewportFilter}`);
const DESTINATIONS = ["films", "journal", "contact", "about"];
const TIME_EPSILON = 0.04;
const MAX_CORNER_ERROR_CSS_PX = 0.75;
const MIN_CAPTURED_EDGE_STRENGTH = 24;
const MIN_MATCHED_EDGE_STRENGTH = 3;
const EDGE_SEARCH_RADIUS_PX = 4;
const MAX_WEAK_EDGE_FRACTION = 0.1;
const PRESENTED_FRAME_EVENT = "lazy-a:compositor-frame-presented";
const PRESENTED_PIXEL_REFERENCES =
  "/room/hero/hero-presented-pixel-references.json";
const PRESENTED_PIXEL_AUTHORING_MANIFEST =
  "/room/hero/hero-presented-authoring-manifest.json";
const PRESENTED_PIXEL_REFERENCE_KIND = "authored-presented-pixels-v1";
const PRESENTED_PIXEL_REGION_ENCODING = "rgb-poster-foreground-treatment";
const HERO_AUTHORING_GENERATOR = "blender-background-python";
const HERO_SURFACE_OBJECT = "HeroLiveSurface";
const HERO_MASTER_BLEND = "build/wo-0117-r/master.blend";
const HERO_RENDER_SCRIPT = "scripts/render-master-shots.py";
const HERO_COMPOSITOR_GLB = "public/room/hero/hero-compositor.glb";
const HERO_REFERENCE_SCHEDULE = "build/wo-0117-r/hero-reference-schedule.json";
const HERO_REFERENCE_RASTERIZER =
  "scripts/generate-hero-presented-references.mjs";
const REFERENCE_PHASES = ["early", "mid", "late"];
const MAX_CATALOG_BYTES = 256 * 1024;
const MAX_AUTHORING_MANIFEST_BYTES = 2 * 1024 * 1024;
const MIN_TRACE_REGION_PIXELS = 16;
const MIN_TRACE_REGION_FRACTION = 0.0005;
const MIN_CROPPED_TRACE_SCALE = 0.7;
const MIN_CROPPED_BOUNDARY_FRACTION = 0.15;
const MIN_TREATMENT_REGION_PIXELS = 64;
const MIN_TREATMENT_REGION_FRACTION = 0.002;
const MAX_TRACE_OVERLAP_FRACTION = 0.05;
const MAX_ROOM_TREATMENT_LUMA_DELTA = 5;
const MAX_ROOM_TREATMENT_CHANNEL_DELTA = 9;
const selfTest = process.argv.includes("--self-test");
const runtimeOnly = argumentsList.includes("--runtime-only");
const debugCaptureDirectory = process.env.HERO_DEBUG_CAPTURE_DIR;

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

function bilinearLuma(frame, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(frame.width - 1, x0 + 1);
  const y1 = Math.min(frame.height - 1, y0 + 1);
  const xWeight = x - x0;
  const yWeight = y - y0;
  const top =
    luma(pixelAt(frame, x0, y0)) * (1 - xWeight) +
    luma(pixelAt(frame, x1, y0)) * xWeight;
  const bottom =
    luma(pixelAt(frame, x0, y1)) * (1 - xWeight) +
    luma(pixelAt(frame, x1, y1)) * xWeight;
  return top * (1 - yWeight) + bottom * yWeight;
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

function sha256Canonical(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isNormalizedPoint(point) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    point.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
  );
}

function validBoundaries(boundaries) {
  return (
    Array.isArray(boundaries) &&
    boundaries.length > 0 &&
    boundaries.every(
      (boundary) =>
        Array.isArray(boundary) &&
        boundary.length >= 2 &&
        boundary.every(isNormalizedPoint),
    )
  );
}

function presentedPixelCoverageIssues(catalog, viewportKey) {
  const frames = catalog?.viewports?.[viewportKey]?.frames;
  if (!Array.isArray(frames)) {
    return [`viewport ${viewportKey} reference frames are missing`];
  }
  const issues = [];
  const resting = frames.filter(
    ({ plateState }) => plateState === "resting:desk",
  );
  if (
    resting.length < 2 ||
    !resting.some(({ heroFramePresented }) => heroFramePresented === 1)
  ) {
    issues.push(
      `viewport ${viewportKey} needs frame 1 and a representative resting frame`,
    );
  }
  for (const destination of DESTINATIONS) {
    for (const direction of ["forward", "reverse"]) {
      const plateState =
        direction === "forward"
          ? `transitioning:desk-to-${destination}`
          : `transitioning:${destination}-to-desk`;
      const moving = frames.filter((frame) => frame.plateState === plateState);
      if (moving.length === 0) {
        issues.push(
          `destination ${destination} is missing ${direction} direction references`,
        );
        continue;
      }
      const phaseFrames = Object.fromEntries(
        REFERENCE_PHASES.map((phase) => [
          phase,
          moving.filter((frame) => frame.phase === phase),
        ]),
      );
      for (const phase of REFERENCE_PHASES) {
        if (phaseFrames[phase].length === 0) {
          issues.push(
            `destination ${destination} ${direction} direction is missing ${phase} phase`,
          );
        }
      }
      if (
        REFERENCE_PHASES.every((phase) => phaseFrames[phase].length > 0) &&
        !(
          Math.max(
            ...phaseFrames.early.map(({ projectionFrame }) => projectionFrame),
          ) <
            Math.min(
              ...phaseFrames.mid.map(({ projectionFrame }) => projectionFrame),
            ) &&
          Math.max(
            ...phaseFrames.mid.map(({ projectionFrame }) => projectionFrame),
          ) <
            Math.min(
              ...phaseFrames.late.map(({ projectionFrame }) => projectionFrame),
            )
        )
      ) {
        issues.push(
          `destination ${destination} ${direction} phases must progress early < mid < late`,
        );
      }
    }
  }
  return issues;
}

function traceEvidenceIssues(evidence, viewportKey) {
  const [width, height] = viewportKey.split("x").map(Number);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return [`invalid trace-evidence viewport ${viewportKey}`];
  }
  const area = width * height;
  const viewportMinimum = Math.max(
    MIN_TRACE_REGION_PIXELS,
    Math.ceil(area * MIN_TRACE_REGION_FRACTION),
  );
  if (
    evidence?.version !== 1 ||
    !Number.isInteger(evidence?.visibleHeroPixels) ||
    evidence.visibleHeroPixels <= 0 ||
    evidence.visibleHeroPixels > area ||
    !Number.isInteger(evidence?.minimumPixels) ||
    evidence.minimumPixels < MIN_TRACE_REGION_PIXELS ||
    (evidence?.basis === "cropped-visible-boundary-v2" &&
      (!Number.isInteger(evidence?.availableProjectedBoundary) ||
        evidence.availableProjectedBoundary <= 0))
  ) {
    return ["trace-evidence measurements are invalid"];
  }
  const expectedMinimum =
    evidence.basis === "viewport-area-v1"
      ? viewportMinimum
      : evidence.basis === "cropped-visible-boundary-v2"
        ? Math.max(
            MIN_TRACE_REGION_PIXELS,
            Math.min(
              viewportMinimum,
              Math.ceil(
                Math.sqrt(evidence.visibleHeroPixels) * MIN_CROPPED_TRACE_SCALE,
              ),
              Math.ceil(
                evidence.availableProjectedBoundary *
                  MIN_CROPPED_BOUNDARY_FRACTION,
              ),
            ),
          )
        : null;
  return expectedMinimum === evidence.minimumPixels
    ? []
    : [
        `trace-evidence minimum ${evidence.minimumPixels} does not match ${expectedMinimum}`,
      ];
}

function heroAuthoringContractIssues(authoring, catalog) {
  const issues = [];
  if (
    authoring?.version !== 1 ||
    authoring?.immutable !== true ||
    authoring?.generator?.identity !== HERO_AUTHORING_GENERATOR ||
    authoring?.generator?.browserRuntime !== false
  ) {
    issues.push(
      "hero authoring manifest must be immutable and generated by non-browser Blender background Python",
    );
  }
  for (const [key, expectedPath] of [
    ["masterBlend", HERO_MASTER_BLEND],
    ["renderScript", HERO_RENDER_SCRIPT],
    ["compositorGlb", HERO_COMPOSITOR_GLB],
  ]) {
    const source = authoring?.sources?.[key];
    if (source?.path !== expectedPath || !isSha256(source?.sha256)) {
      issues.push(`${key} path and SHA-256 source relationship is invalid`);
    }
  }
  const heroGeometry = authoring?.geometry?.heroLiveSurface;
  const occluders = authoring?.geometry?.heroOccluders;
  if (
    heroGeometry?.object !== HERO_SURFACE_OBJECT ||
    !isSha256(heroGeometry?.geometrySha256)
  ) {
    issues.push("HeroLiveSurface source geometry hash is missing");
  }
  if (
    !Array.isArray(occluders) ||
    occluders.length === 0 ||
    occluders.some(
      (occluder) =>
        !/^HeroOccluder[A-Za-z0-9_]*$/.test(occluder?.object ?? "") ||
        !isSha256(occluder?.geometrySha256),
    ) ||
    new Set(occluders?.map(({ object }) => object)).size !== occluders?.length
  ) {
    issues.push("named HeroOccluder source geometry hashes are invalid");
  }
  const navigationOccluders = (occluders ?? []).filter(
    ({ sourceObject }) => sourceObject === "ProductionNavigationSheet",
  );
  if (
    navigationOccluders.length !== 2 ||
    !["wide", "portrait"].every((profile) =>
      navigationOccluders.some(
        (occluder) =>
          occluder.profile === profile &&
          occluder.object ===
            `HeroOccluder_ProductionNavigationSheet_${profile}` &&
          occluder.navigationPlane?.width === 0.3 &&
          occluder.navigationPlane?.height === 0.2 &&
          ["origin", "uAxis", "vAxis", "normal"].every(
            (key) =>
              Array.isArray(occluder.navigationPlane?.[key]) &&
              occluder.navigationPlane[key].length === 3 &&
              occluder.navigationPlane[key].every(Number.isFinite),
          ),
      ),
    )
  ) {
    issues.push(
      "wide and portrait navigation depth proxies must bind their canonical physical planes",
    );
  }
  if (
    authoring?.regionSemantics?.red !== "projected-HeroLiveSurface-boundary" ||
    authoring?.regionSemantics?.green !==
      "projected-named-HeroOccluder-boundaries" ||
    authoring?.regionSemantics?.blue !== "HeroLiveSurface-treatment-interior"
  ) {
    issues.push("geometry-derived RGB region semantics are invalid");
  }
  if (
    authoring?.referenceGeneration?.capturePlaybackRates?.hero !== 0.4 ||
    authoring?.referenceGeneration?.capturePlaybackRates?.plate !== 0.5
  ) {
    issues.push("reference capture playback rates are invalid");
  }
  if (
    catalog?.authoringManifest !==
      PRESENTED_PIXEL_AUTHORING_MANIFEST.split("/").at(-1) ||
    !isSha256(catalog?.authoringManifestSha256)
  ) {
    issues.push("catalog is not pinned to an immutable authoring manifest");
  }
  const expectedOccluders = new Map(
    (occluders ?? []).map(({ object, geometrySha256 }) => [
      object,
      geometrySha256,
    ]),
  );
  const catalogFrames = Object.entries(catalog?.viewports ?? {}).flatMap(
    ([viewport, value]) =>
      (value?.frames ?? []).map((frame) => ({ ...frame, viewport })),
  );
  const edgeQualityReferences = new Map();
  for (const frame of catalogFrames) {
    const label = `${frame.viewport}/${frame.authoringReferenceId ?? "missing-reference"}`;
    const reference = authoring?.references?.[frame.authoringReferenceId ?? ""];
    if (!reference) {
      issues.push(`${label} has no authoring reference`);
      continue;
    }
    if (
      reference.viewport !== frame.viewport ||
      reference.heroFramePresented !== frame.heroFramePresented ||
      reference.heroMediaTime !== frame.heroMediaTime
    ) {
      issues.push(`${label} authoring frame binding is invalid`);
    }
    const assets = [
      ["source", frame.authoredSource],
      ["composite", frame.composite],
      ["regions", frame.regions],
    ].map(([key, catalogPath]) => ({
      key,
      catalogPath,
      path: reference[key]?.path,
      sha256: reference[key]?.sha256,
    }));
    if (
      assets.some(
        ({ catalogPath, path, sha256 }) =>
          path !== catalogPath || !isSha256(sha256),
      ) ||
      new Set(assets.map(({ path }) => path)).size !== assets.length ||
      new Set(assets.map(({ sha256 }) => sha256)).size !== assets.length
    ) {
      issues.push(
        `${label} source, composite, and region paths/hashes must be distinct and pinned`,
      );
    }
    const projection = reference.projection;
    const traceIssues = traceEvidenceIssues(
      projection?.traceEvidence,
      frame.viewport,
    );
    if (traceIssues.length > 0) {
      issues.push(`${label} ${traceIssues.join("; ")}`);
    }
    if (
      reference.projectionSha256 !== sha256Canonical(projection) ||
      projection?.red?.object !== HERO_SURFACE_OBJECT ||
      projection?.red?.geometrySha256 !== heroGeometry?.geometrySha256 ||
      !validBoundaries(projection?.red?.boundaries) ||
      projection?.blue?.object !== HERO_SURFACE_OBJECT ||
      projection?.blue?.geometrySha256 !== heroGeometry?.geometrySha256 ||
      !Array.isArray(projection?.blue?.polygon) ||
      projection.blue.polygon.length < 3 ||
      !projection.blue.polygon.every(isNormalizedPoint)
    ) {
      issues.push(`${label} HeroLiveSurface projected geometry is invalid`);
    }
    const projectedOccluders = projection?.green?.objects;
    const greenApplicable = projection?.green?.applicable;
    if (
      !Array.isArray(projectedOccluders) ||
      typeof greenApplicable !== "boolean" ||
      greenApplicable !== projectedOccluders.length > 0 ||
      projectedOccluders.some(
        (entry) =>
          !expectedOccluders.has(entry.object) ||
          entry.geometrySha256 !== expectedOccluders.get(entry.object) ||
          !validBoundaries(entry.boundaries),
      ) ||
      new Set(projectedOccluders.map(({ object }) => object)).size !==
        projectedOccluders.length
    ) {
      issues.push(`${label} HeroOccluder projected geometry is invalid`);
    }
    if (greenApplicable) {
      edgeQualityReferences.set(
        frame.viewport,
        (edgeQualityReferences.get(frame.viewport) ?? 0) + 1,
      );
    }
  }
  for (const viewport of Object.keys(catalog?.viewports ?? {})) {
    if ((edgeQualityReferences.get(viewport) ?? 0) < 3) {
      issues.push(
        `${viewport} needs at least three authored foreground edge-quality references`,
      );
    }
  }
  return issues;
}

function pointToSegmentDistance(point, start, end) {
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

function pointInsidePolygon(point, polygon) {
  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const [currentX, currentY] = polygon[current];
    const [previousX, previousY] = polygon[previous];
    if (
      currentY > point[1] !== previousY > point[1] &&
      point[0] <
        ((previousX - currentX) * (point[1] - currentY)) /
          (previousY - currentY) +
          currentX
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function referenceRegionProjectionIssues(regions, projection) {
  const greenApplicable = projection?.green?.applicable === true;
  const issues = referenceRegionMapIssues(regions, {
    greenApplicable,
    traceMinimumPixels: projection?.traceEvidence?.minimumPixels,
  });
  if (issues.length > 0) return issues;
  const boundarySets = [
    projection?.red?.boundaries,
    greenApplicable
      ? projection?.green?.objects?.flatMap(({ boundaries }) => boundaries)
      : null,
  ];
  for (let channel = 0; channel < boundarySets.length; channel += 1) {
    if (channel === 1 && !greenApplicable) continue;
    const segments = (boundarySets[channel] ?? []).flatMap((boundary) =>
      boundary.slice(1).map((end, index) => [boundary[index], end]),
    );
    if (segments.length === 0) {
      issues.push(`channel ${channel} has no projected geometry boundaries`);
      continue;
    }
    let marked = 0;
    let outside = 0;
    for (let y = 0; y < regions.height; y += 1) {
      for (let x = 0; x < regions.width; x += 1) {
        if (regions.data[(y * regions.width + x) * 4 + channel] < 128) {
          continue;
        }
        marked += 1;
        const point = [(x + 0.5) / regions.width, (y + 0.5) / regions.height];
        const distance = Math.min(
          ...segments.map(([start, end]) =>
            pointToSegmentDistance(point, start, end),
          ),
        );
        if (distance * Math.max(regions.width, regions.height) > 1.5) {
          outside += 1;
        }
      }
    }
    if (marked === 0 || outside / marked > 0.05) {
      issues.push(
        `${channel === 0 ? "red" : "green"} trace does not match projected geometry boundaries`,
      );
    }
  }
  const treatmentPolygon = projection?.blue?.polygon;
  let blueMarked = 0;
  let blueOutside = 0;
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (regions.data[(y * regions.width + x) * 4 + 2] < 128) continue;
      blueMarked += 1;
      if (
        !Array.isArray(treatmentPolygon) ||
        !pointInsidePolygon(
          [(x + 0.5) / regions.width, (y + 0.5) / regions.height],
          treatmentPolygon,
        )
      ) {
        blueOutside += 1;
      }
    }
  }
  if (blueMarked === 0 || blueOutside > 0) {
    issues.push(
      "blue treatment region is not inside projected HeroLiveSurface geometry",
    );
  }
  return issues;
}

function referenceRegionMapIssues(
  regions,
  { greenApplicable = true, traceMinimumPixels = null } = {},
) {
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
    traceMinimumPixels ??
      Math.max(
        MIN_TRACE_REGION_PIXELS,
        Math.ceil(area * MIN_TRACE_REGION_FRACTION),
      ),
    traceMinimumPixels ??
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
    if (channel === 1 && !greenApplicable) {
      if (counts[channel] !== 0) {
        issues.push(
          `green foreground-edge region must be empty without an authored crossing; got ${counts[channel]} pixels`,
        );
      }
      continue;
    }
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

function normalizePresentedPixelCatalog(
  catalog,
  viewportKey,
  catalogUrl,
  authoring,
  authoringUrl,
) {
  if (
    catalog?.version !== 2 ||
    catalog?.presentationEvent !== PRESENTED_FRAME_EVENT ||
    catalog?.kind !== PRESENTED_PIXEL_REFERENCE_KIND ||
    catalog?.regionEncoding !== PRESENTED_PIXEL_REGION_ENCODING
  ) {
    throw new Error(
      `${viewportKey} catalog must use the version-2 presented-pixel contract`,
    );
  }
  const authoringIssues = heroAuthoringContractIssues(authoring, catalog);
  if (authoringIssues.length > 0) {
    throw new Error(
      `${viewportKey} authoring contract is invalid: ${authoringIssues.join("; ")}`,
    );
  }
  const frames = catalog.viewports?.[viewportKey]?.frames;
  const coverageIssues = presentedPixelCoverageIssues(catalog, viewportKey);
  if (!Array.isArray(frames) || coverageIssues.length > 0) {
    throw new Error(
      `${viewportKey} reference coverage is invalid: ${coverageIssues.join("; ")}`,
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
      const authoringReference =
        authoring.references?.[frame?.authoringReferenceId];
      return {
        authoringReferenceId: frame?.authoringReferenceId,
        heroFramePresented: frame?.heroFramePresented,
        heroMediaTime: frame?.heroMediaTime,
        authoringHeroMediaTime: authoringReference?.heroMediaTime,
        plateState: frame?.plateState,
        projectionFrame: frame?.projectionFrame,
        phase: frame?.phase ?? null,
        composite,
        regions,
        authoredSource,
        sourceSha256: authoringReference?.source?.sha256,
        compositeSha256: authoringReference?.composite?.sha256,
        regionsSha256: authoringReference?.regions?.sha256,
        authoringProjection: authoringReference?.projection,
        capturePlaybackRates:
          authoring.referenceGeneration?.capturePlaybackRates,
        authoredSourceContractUrl:
          typeof authoringReference?.source?.path === "string"
            ? new URL(authoringReference.source.path, authoringUrl).href
            : null,
        compositeContractUrl:
          typeof authoringReference?.composite?.path === "string"
            ? new URL(authoringReference.composite.path, authoringUrl).href
            : null,
        regionsContractUrl:
          typeof authoringReference?.regions?.path === "string"
            ? new URL(authoringReference.regions.path, authoringUrl).href
            : null,
      };
    })
    .sort((left, right) => left.heroFramePresented - right.heroFramePresented);
  if (
    normalized[0]?.heroFramePresented !== 1 ||
    normalized.some(
      (frame, index) =>
        !Number.isInteger(frame.heroFramePresented) ||
        frame.heroFramePresented < 1 ||
        !Number.isFinite(frame.heroMediaTime) ||
        frame.heroMediaTime < 0 ||
        frame.heroMediaTime !== frame.authoringHeroMediaTime ||
        !Number.isInteger(frame.projectionFrame) ||
        frame.projectionFrame < 0 ||
        typeof frame.plateState !== "string" ||
        typeof frame.authoringReferenceId !== "string" ||
        !frame.composite ||
        !frame.regions ||
        !frame.authoredSource ||
        new Set([frame.authoredSource, frame.composite, frame.regions]).size !==
          3 ||
        frame.authoredSource !== frame.authoredSourceContractUrl ||
        frame.composite !== frame.compositeContractUrl ||
        frame.regions !== frame.regionsContractUrl ||
        !isSha256(frame.sourceSha256) ||
        !isSha256(frame.compositeSha256) ||
        !isSha256(frame.regionsSha256) ||
        (index > 0 &&
          frame.heroFramePresented ===
            normalized[index - 1].heroFramePresented),
    )
  ) {
    throw new Error(
      `${viewportKey} references need unique positive frame ids, exact plate/projection state, and authoring-pinned asset URLs/hashes`,
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

function measureTreatmentRegistration(actual, reference, regions) {
  if (
    actual.width !== reference.width ||
    actual.height !== reference.height ||
    actual.width !== regions.width ||
    actual.height !== regions.height
  ) {
    return { errorPx: Number.POSITIVE_INFINITY, samples: 0 };
  }
  const candidates = [];
  for (let offsetY = -4; offsetY <= 4; offsetY += 1) {
    for (let offsetX = -4; offsetX <= 4; offsetX += 1) {
      let delta = 0;
      let samples = 0;
      for (let y = 5; y < actual.height - 5; y += 3) {
        for (let x = 5; x < actual.width - 5; x += 3) {
          if (maskValue(regions, x, y, 2) < 128) continue;
          const shiftedX = x + offsetX;
          const shiftedY = y + offsetY;
          if (
            shiftedX < 0 ||
            shiftedY < 0 ||
            shiftedX >= actual.width ||
            shiftedY >= actual.height
          ) {
            continue;
          }
          const actualPixel = pixelAt(actual, shiftedX, shiftedY);
          const referencePixel = pixelAt(reference, x, y);
          delta += Math.max(
            ...actualPixel.map((value, index) =>
              Math.abs(value - referencePixel[index]),
            ),
          );
          samples += 1;
        }
      }
      candidates.push({
        offsetX,
        offsetY,
        errorPx: Math.hypot(offsetX, offsetY),
        meanDelta: samples ? delta / samples : Number.POSITIVE_INFINITY,
        samples,
      });
    }
  }
  candidates.sort(
    (left, right) =>
      left.meanDelta - right.meanDelta || left.errorPx - right.errorPx,
  );
  const best = candidates[0];
  const zero = candidates.find(
    ({ offsetX, offsetY }) => offsetX === 0 && offsetY === 0,
  );
  const worst = candidates.at(-1);
  const meaningfulTranslatedImprovement =
    best.errorPx >= 1 && zero.meanDelta - best.meanDelta > 0.25;
  const resolved = meaningfulTranslatedImprovement ? best : zero;
  return {
    ...resolved,
    discriminative:
      worst !== undefined && worst.meanDelta - best.meanDelta > 0.25,
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

function geometryEdgePoints(boundaries, width, height) {
  if (!Array.isArray(boundaries)) return [];
  const points = [];
  for (const boundary of boundaries) {
    if (!Array.isArray(boundary) || boundary.length < 2) continue;
    for (let index = 1; index < boundary.length; index += 1) {
      const start = [
        boundary[index - 1][0] * width - 0.5,
        boundary[index - 1][1] * height - 0.5,
      ];
      const end = [
        boundary[index][0] * width - 0.5,
        boundary[index][1] * height - 0.5,
      ];
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) continue;
      const normal = [-dy / length, dx / length];
      const steps = Math.max(1, Math.ceil(length));
      for (let step = 0; step < steps; step += 1) {
        const ratio = (step + 0.5) / steps;
        const x = start[0] + dx * ratio;
        const y = start[1] + dy * ratio;
        if (x >= 4 && y >= 4 && x < width - 4 && y < height - 4) {
          points.push({ x, y, normal });
        }
      }
    }
  }
  return points;
}

function directionalGradient(frame, x, y, normal) {
  return (
    bilinearLuma(frame, x + normal[0], y + normal[1]) -
    bilinearLuma(frame, x - normal[0], y - normal[1])
  );
}

function matchAuthoredEdge(
  frame,
  authoredReference,
  expectedX,
  expectedY,
  normal,
) {
  const authoredGradient = directionalGradient(
    authoredReference,
    expectedX,
    expectedY,
    normal,
  );
  const authoredStrength = Math.abs(authoredGradient);
  if (authoredStrength < MIN_CAPTURED_EDGE_STRENGTH) {
    return {
      authoredEdge: false,
      offset: null,
      strongest: 0,
    };
  }

  let bestOffset = null;
  let strongest = 0;
  for (let distance = 0; distance <= EDGE_SEARCH_RADIUS_PX; distance += 0.25) {
    const offsets = distance === 0 ? [0] : [-distance, distance];
    let strongestAtDistance = Number.NEGATIVE_INFINITY;
    let strongestOffset = null;
    for (const offset of offsets) {
      const x = expectedX + normal[0] * offset;
      const y = expectedY + normal[1] * offset;
      if (x < 1 || y < 1 || x >= frame.width - 1 || y >= frame.height - 1) {
        continue;
      }
      const gradient = directionalGradient(frame, x, y, normal);
      const strength = Math.abs(gradient);
      strongest = Math.max(strongest, strength);
      if (
        Math.sign(gradient) !== Math.sign(authoredGradient) ||
        strength < MIN_MATCHED_EDGE_STRENGTH
      ) {
        continue;
      }
      if (strength > strongestAtDistance) {
        strongestAtDistance = strength;
        strongestOffset = offset;
      }
    }
    if (strongestAtDistance >= MIN_MATCHED_EDGE_STRENGTH) {
      bestOffset = strongestOffset;
      break;
    }
  }
  if (bestOffset === null) {
    return {
      authoredEdge: true,
      offset: null,
      strongest,
    };
  }
  return {
    authoredEdge: true,
    offset: bestOffset,
    strongest,
  };
}

function measureEdgeAlignment(
  frame,
  regions,
  maskChannel,
  authoredReference = null,
  geometryBoundaries = null,
) {
  if (frame.width !== regions.width || frame.height !== regions.height) {
    return {
      maxErrorPx: Number.POSITIVE_INFINITY,
      p95ErrorPx: Number.POSITIVE_INFINITY,
      minStrength: 0,
      samples: 0,
      weakSamples: 0,
    };
  }
  const points = geometryBoundaries
    ? geometryEdgePoints(geometryBoundaries, regions.width, regions.height)
    : referenceEdgePoints(regions, maskChannel);
  let maxErrorPx = 0;
  let minStrength = Number.POSITIVE_INFINITY;
  let weakSamples = 0;
  let samples = 0;
  const errors = [];
  for (const { x: expectedX, y: expectedY, normal } of points) {
    if (!authoredReference) continue;
    const match = matchAuthoredEdge(
      frame,
      authoredReference,
      expectedX,
      expectedY,
      normal,
    );
    if (!match.authoredEdge) continue;
    samples += 1;
    minStrength = Math.min(minStrength, match.strongest);
    if (match.offset === null) {
      weakSamples += 1;
    } else {
      const error = Math.abs(match.offset);
      errors.push(error);
      maxErrorPx = Math.max(maxErrorPx, error);
    }
  }
  errors.sort((left, right) => left - right);
  const p95ErrorPx =
    errors.length > 0
      ? errors[Math.min(errors.length - 1, Math.ceil(errors.length * 0.95) - 1)]
      : Number.POSITIVE_INFINITY;
  if (samples === 0) {
    maxErrorPx = Number.POSITIVE_INFINITY;
  }
  return {
    maxErrorPx,
    p95ErrorPx,
    minStrength: samples ? minStrength : 0,
    samples,
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
  const posterRegistration = presentedFrames.map((frame) =>
    measureTreatmentRegistration(
      frame,
      frame.reference?.composite ?? {},
      frame.reference?.regions ?? {},
    ),
  );
  const posterAxis = presentedFrames.map((frame) =>
    measureEdgeAlignment(
      frame,
      frame.reference?.regions ?? {},
      0,
      frame.reference?.composite,
      frame.reference?.authoringProjection?.red?.boundaries,
    ),
  );
  const foreground = presentedFrames
    .filter(
      (frame) =>
        frame.reference?.authoringProjection?.green?.applicable === true,
    )
    .map((frame) =>
      measureEdgeAlignment(
        frame,
        frame.reference?.regions ?? {},
        1,
        frame.reference?.composite,
        frame.reference?.authoringProjection?.green?.objects?.flatMap(
          ({ boundaries }) => boundaries,
        ),
      ),
    );
  const weakFraction = ({ samples, weakSamples }) =>
    samples > 0 ? weakSamples / samples : Number.POSITIVE_INFINITY;
  const acceptedError = (measurement) =>
    weakFraction(measurement) <= MAX_WEAK_EDGE_FRACTION
      ? measurement.p95ErrorPx
      : Number.POSITIVE_INFINITY;
  return {
    firstFrame: maskedPixelDelta(
      firstPainted,
      resting,
      firstPainted.reference?.regions ?? {},
      2,
    ),
    playingFrames: {
      maxRoomTreatmentLumaDelta: Math.max(
        ...treatment.map(({ meanLumaDelta }) => meanLumaDelta),
      ),
      maxRoomTreatmentDelta: Math.max(
        ...treatment.map(({ meanChannelDelta }) => meanChannelDelta),
      ),
      minimumTreatmentSamples: Math.min(
        ...treatment.map(({ samples }) => samples),
      ),
    },
    motionSamples: {
      maxPosterAxisErrorPx: Math.max(
        ...posterRegistration.map((registration, index) =>
          registration.discriminative
            ? registration.errorPx
            : acceptedError(posterAxis[index]),
        ),
      ),
      posterRegistrationSamples: Math.min(
        ...posterRegistration.map(({ samples }) => samples),
      ),
      minPosterAxisEdgeStrength: Math.min(
        ...posterAxis.map(({ minStrength }) => minStrength),
      ),
      posterAxisSamples: Math.min(...posterAxis.map(({ samples }) => samples)),
      posterAxisWeakSamples: Math.max(
        ...posterAxis.map(({ weakSamples }) => weakSamples),
      ),
      maxPosterAxisWeakFraction: Math.max(...posterAxis.map(weakFraction)),
      maxForegroundEdgeErrorPx: Math.max(...foreground.map(acceptedError)),
      minForegroundEdgeStrength: Math.min(
        ...foreground.map(({ minStrength }) => minStrength),
      ),
      foregroundSamples: Math.min(...foreground.map(({ samples }) => samples)),
      foregroundWeakSamples: Math.max(
        ...foreground.map(({ weakSamples }) => weakSamples),
      ),
      maxForegroundWeakFraction: Math.max(...foreground.map(weakFraction)),
    },
  };
}

function fixtureFrame({
  background = 20,
  paper = 220,
  paperOffsetX = 0,
  paperPattern = false,
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
      const onPaper =
        x >= 6 + paperOffsetX && x <= 25 + paperOffsetX && y >= 6 && y <= 25;
      const value = onPaper
        ? paper + (paperPattern ? ((x - paperOffsetX + y) % 5) * 5 : 0)
        : background;
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

function fixtureRegions({ greenApplicable = true } = {}) {
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
  if (greenApplicable) {
    for (let y = 10; y <= 21; y += 1) {
      mark(15, y, 1);
      mark(17, y, 1);
    }
  }
  for (let y = 8; y <= 23; y += 1) {
    for (let x = 8; x <= 23; x += 1) {
      if (x < 14 || x > 18) mark(x, y, 2);
    }
  }
  return { data, width, height };
}

function withFixtureReference(
  frame,
  composite = frame,
  { greenApplicable = true } = {},
) {
  return {
    ...frame,
    reference: {
      composite,
      regions: fixtureRegions({ greenApplicable }),
      authoringProjection: {
        green: { applicable: greenApplicable },
      },
    },
  };
}

async function runSelfTests() {
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

  const fixtureHash = (label) =>
    createHash("sha256").update(label).digest("hex");
  const canonicalFixture = (value) => {
    if (Array.isArray(value)) {
      return `[${value.map(canonicalFixture).join(",")}]`;
    }
    if (value && typeof value === "object") {
      return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalFixture(value[key])}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  };
  const fixtureProjection = {
    traceEvidence: {
      version: 1,
      basis: "viewport-area-v1",
      visibleHeroPixels: 400,
      minimumPixels: 16,
    },
    red: {
      object: "HeroLiveSurface",
      geometrySha256: fixtureHash("hero-geometry"),
      boundaries: [
        [
          [6.5 / 32, 6.5 / 32],
          [25.5 / 32, 6.5 / 32],
          [25.5 / 32, 25.5 / 32],
          [6.5 / 32, 25.5 / 32],
          [6.5 / 32, 6.5 / 32],
        ],
      ],
    },
    green: {
      applicable: true,
      objects: [
        {
          object: "HeroOccluderDeskCard",
          geometrySha256: fixtureHash("occluder-geometry"),
          boundaries: [
            [
              [15.5 / 32, 10.5 / 32],
              [15.5 / 32, 21.5 / 32],
            ],
            [
              [17.5 / 32, 10.5 / 32],
              [17.5 / 32, 21.5 / 32],
            ],
          ],
        },
      ],
    },
    blue: {
      object: "HeroLiveSurface",
      geometrySha256: fixtureHash("hero-geometry"),
      polygon: [
        [6.5 / 32, 6.5 / 32],
        [25.5 / 32, 6.5 / 32],
        [25.5 / 32, 25.5 / 32],
        [6.5 / 32, 25.5 / 32],
      ],
    },
  };
  const coverageFrames = [
    {
      authoringReferenceId: "rest-1",
      heroFramePresented: 1,
      heroMediaTime: 0,
      plateState: "resting:desk",
      projectionFrame: 0,
      composite: "rest-1-composite.png",
      regions: "rest-1-regions.png",
      authoredSource: "rest-1-source.exr",
    },
    {
      authoringReferenceId: "rest-2",
      heroFramePresented: 2,
      heroMediaTime: 2 / 24,
      plateState: "resting:desk",
      projectionFrame: 0,
      composite: "rest-2-composite.png",
      regions: "rest-2-regions.png",
      authoredSource: "rest-2-source.exr",
    },
  ];
  let fixtureFrameNumber = 3;
  for (const destination of DESTINATIONS) {
    for (const direction of ["forward", "reverse"]) {
      for (const [phase, projectionFrame] of [
        ["early", 1],
        ["mid", 15],
        ["late", 29],
      ]) {
        const id = `${destination}-${direction}-${phase}`;
        coverageFrames.push({
          authoringReferenceId: id,
          heroFramePresented: fixtureFrameNumber,
          heroMediaTime: fixtureFrameNumber / 24,
          plateState:
            direction === "forward"
              ? `transitioning:desk-to-${destination}`
              : `transitioning:${destination}-to-desk`,
          projectionFrame,
          phase,
          composite: `${id}-composite.png`,
          regions: `${id}-regions.png`,
          authoredSource: `${id}-source.exr`,
        });
        fixtureFrameNumber += 1;
      }
    }
  }
  const coverageCatalog = {
    version: 2,
    presentationEvent: PRESENTED_FRAME_EVENT,
    kind: PRESENTED_PIXEL_REFERENCE_KIND,
    regionEncoding: PRESENTED_PIXEL_REGION_ENCODING,
    authoringManifest: "hero-presented-authoring-manifest.json",
    authoringManifestSha256: fixtureHash("hero-authoring-manifest"),
    viewports: { "32x32": { frames: coverageFrames } },
  };
  assert.deepEqual(
    presentedPixelCoverageIssues(coverageCatalog, "32x32"),
    [],
    "every destination/direction needs early, mid, and late references",
  );
  for (const [label, predicate] of [
    ["destination", (frame) => !frame.plateState.includes("about")],
    [
      "direction",
      (frame) => frame.plateState !== "transitioning:films-to-desk",
    ],
    [
      "phase",
      (frame) =>
        !(
          frame.plateState === "transitioning:desk-to-journal" &&
          frame.phase === "mid"
        ),
    ],
  ]) {
    const incomplete = structuredClone(coverageCatalog);
    incomplete.viewports["32x32"].frames =
      incomplete.viewports["32x32"].frames.filter(predicate);
    assert.match(
      presentedPixelCoverageIssues(incomplete, "32x32").join("\n"),
      new RegExp(label),
      `missing ${label} coverage must fail`,
    );
  }

  const heroGeometry = {
    heroLiveSurface: {
      object: "HeroLiveSurface",
      geometrySha256: fixtureHash("hero-geometry"),
    },
    heroOccluders: [
      {
        object: "HeroOccluderDeskCard",
        geometrySha256: fixtureHash("occluder-geometry"),
      },
      ...["wide", "portrait"].map((profile) => ({
        object: `HeroOccluder_ProductionNavigationSheet_${profile}`,
        sourceObject: "ProductionNavigationSheet",
        geometrySha256: fixtureHash(`navigation-${profile}`),
        profile,
        navigationPlane: {
          origin: [0, 0, 0],
          uAxis: [1, 0, 0],
          vAxis: [0, 1, 0],
          normal: [0, 0, 1],
          width: 0.3,
          height: 0.2,
        },
      })),
    ],
  };
  const authoringReferences = Object.fromEntries(
    coverageFrames.map((frame) => {
      const projection = structuredClone(fixtureProjection);
      return [
        frame.authoringReferenceId,
        {
          viewport: "32x32",
          heroFramePresented: frame.heroFramePresented,
          heroMediaTime: frame.heroMediaTime,
          source: {
            path: frame.authoredSource,
            sha256: fixtureHash(`${frame.authoringReferenceId}-source`),
          },
          composite: {
            path: frame.composite,
            sha256: fixtureHash(`${frame.authoringReferenceId}-composite`),
          },
          regions: {
            path: frame.regions,
            sha256: fixtureHash(`${frame.authoringReferenceId}-regions`),
          },
          projection,
          projectionSha256: createHash("sha256")
            .update(canonicalFixture(projection))
            .digest("hex"),
        },
      ];
    }),
  );
  const authoringManifest = {
    version: 1,
    immutable: true,
    generator: {
      identity: "blender-background-python",
      browserRuntime: false,
    },
    sources: {
      masterBlend: {
        path: "build/wo-0117-r/master.blend",
        sha256: fixtureHash("master-blend"),
      },
      renderScript: {
        path: "scripts/render-master-shots.py",
        sha256: fixtureHash("render-script"),
      },
      compositorGlb: {
        path: "public/room/hero/hero-compositor.glb",
        sha256: fixtureHash("compositor-glb"),
      },
    },
    geometry: heroGeometry,
    referenceGeneration: {
      capturePlaybackRates: { hero: 0.4, plate: 0.5 },
    },
    regionSemantics: {
      red: "projected-HeroLiveSurface-boundary",
      green: "projected-named-HeroOccluder-boundaries",
      blue: "HeroLiveSurface-treatment-interior",
    },
    references: authoringReferences,
  };
  assert.deepEqual(
    heroAuthoringContractIssues(authoringManifest, coverageCatalog),
    [],
    "offline authoring manifest with geometry-derived references should pass",
  );
  const mismatchedCaptureRates = structuredClone(authoringManifest);
  mismatchedCaptureRates.referenceGeneration.capturePlaybackRates.hero = 1;
  assert.match(
    heroAuthoringContractIssues(mismatchedCaptureRates, coverageCatalog).join(
      "\n",
    ),
    /capture playback rates/,
    "reference capture rates must remain pinned to the authored schedule",
  );
  const mismatchedHeroTimestamp = structuredClone(authoringManifest);
  mismatchedHeroTimestamp.references["rest-2"].heroMediaTime = 1 / 24;
  assert.match(
    heroAuthoringContractIssues(mismatchedHeroTimestamp, coverageCatalog).join(
      "\n",
    ),
    /frame binding/,
    "catalog references must remain pinned to the decoded hero timestamp",
  );
  const mismatchedTraceEvidence = structuredClone(authoringManifest);
  mismatchedTraceEvidence.references[
    "rest-1"
  ].projection.traceEvidence.minimumPixels = 17;
  assert.match(
    heroAuthoringContractIssues(mismatchedTraceEvidence, coverageCatalog).join(
      "\n",
    ),
    /trace-evidence minimum/,
    "trace evidence must match the declared viewport basis",
  );
  const aliasAuthoring = structuredClone(authoringManifest);
  const aliasCatalog = structuredClone(coverageCatalog);
  const aliasReference = aliasAuthoring.references["rest-1"];
  const aliasFrame = aliasCatalog.viewports["32x32"].frames.find(
    ({ authoringReferenceId }) => authoringReferenceId === "rest-1",
  );
  aliasReference.source.path = "aliases/../copied-runtime.png";
  aliasReference.composite.path = "copied-runtime.png";
  aliasReference.composite.sha256 = aliasReference.source.sha256;
  aliasFrame.authoredSource = aliasReference.source.path;
  aliasFrame.composite = aliasReference.composite.path;
  assert.match(
    heroAuthoringContractIssues(aliasAuthoring, aliasCatalog).join("\n"),
    /alias|distinct/,
    "copied runtime screenshots with URL aliases and matching hashes must fail",
  );
  const mismatchedGeometry = structuredClone(authoringManifest);
  mismatchedGeometry.references["rest-1"].projection.red.geometrySha256 =
    fixtureHash("wrong-geometry");
  assert.match(
    heroAuthoringContractIssues(mismatchedGeometry, coverageCatalog).join("\n"),
    /geometry/,
    "mismatched source geometry hashes must fail",
  );
  const missingGeometry = structuredClone(authoringManifest);
  delete missingGeometry.geometry.heroLiveSurface.geometrySha256;
  assert.match(
    heroAuthoringContractIssues(missingGeometry, coverageCatalog).join("\n"),
    /geometry/,
    "missing source geometry hashes must fail",
  );
  assert.deepEqual(
    referenceRegionProjectionIssues(
      fixtureRegions(),
      authoringManifest.references["rest-1"].projection,
    ),
    [],
    "geometry-derived region traces should match their projected evidence",
  );
  const arbitraryRegions = fixtureRegions();
  for (let y = 7; y <= 24; y += 1) {
    arbitraryRegions.data[(y * 32 + 6) * 4] = 0;
    arbitraryRegions.data[(y * 32 + 3) * 4] = 255;
  }
  assert.deepEqual(
    referenceRegionMapIssues(arbitraryRegions),
    [],
    "arbitrary shifted traces remain substantial and non-overlapping",
  );
  assert.match(
    referenceRegionProjectionIssues(
      arbitraryRegions,
      authoringManifest.references["rest-1"].projection,
    ).join("\n"),
    /projected|geometry/,
    "arbitrary non-overlapping traces must fail geometry projection",
  );
  const nonOccludedProjection = structuredClone(fixtureProjection);
  nonOccludedProjection.green = { applicable: false, objects: [] };
  assert.deepEqual(
    referenceRegionProjectionIssues(
      fixtureRegions({ greenApplicable: false }),
      nonOccludedProjection,
    ),
    [],
    "non-occluded references retain axis and treatment evidence without a fabricated green trace",
  );
  assert.match(
    referenceRegionProjectionIssues(
      fixtureRegions(),
      nonOccludedProjection,
    ).join("\n"),
    /must be empty/,
    "green pixels without an authored crossing must fail",
  );

  assert.equal(
    normalizePresentedPixelCatalog(
      coverageCatalog,
      "32x32",
      "https://example.test/room/hero/catalog.json",
      authoringManifest,
      "https://example.test/room/hero/hero-presented-authoring-manifest.json",
    ).length,
    26,
    "normalized catalog must retain all resting and moving references",
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
    good.playingFrames.maxRoomTreatmentLumaDelta <=
      MAX_ROOM_TREATMENT_LUMA_DELTA &&
      good.playingFrames.maxRoomTreatmentDelta <=
        MAX_ROOM_TREATMENT_CHANNEL_DELTA,
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
    withFixtureReference(shiftedForeground, fixtureFrame()),
    [],
  );
  assert.ok(
    shiftedMetrics.motionSamples.maxForegroundEdgeErrorPx > 1,
    "shifted foreground edges must exceed the R4 alignment threshold",
  );
  const texturedReference = fixtureFrame({ paperPattern: true });
  const shiftedPosterMetrics = measuredPresentedPixelMetrics(
    texturedReference,
    texturedReference,
    [
      withFixtureReference(
        fixtureFrame({ paperOffsetX: 2, paperPattern: true }),
        texturedReference,
      ),
    ],
  );
  assert.ok(
    shiftedPosterMetrics.motionSamples.maxPosterAxisErrorPx > 0.75,
    "shifted poster content must fail whole-surface registration",
  );

  const subtleTexture = fixtureFrame({
    paper: 80,
    drawForeground: false,
  });
  for (let y = 6; y <= 25; y += 1) {
    for (let x = 6; x <= 25; x += 1) {
      const offset = (y * subtleTexture.width + x) * 4;
      const value = 80 + Math.floor((x - 6) / 4);
      subtleTexture.data[offset] = value;
      subtleTexture.data[offset + 1] = value;
      subtleTexture.data[offset + 2] = value;
    }
  }
  const subtleRegistration = measureTreatmentRegistration(
    subtleTexture,
    subtleTexture,
    fixtureRegions({ greenApplicable: false }),
  );
  assert.equal(
    subtleRegistration.discriminative,
    true,
    "subtle spatial texture must remain usable when zero is the best match",
  );
  assert.equal(
    subtleRegistration.errorPx,
    0,
    "subtle stationary texture must resolve to zero translation",
  );

  const lowerContrast = fixtureFrame({ paper: 38, foreground: 25 });
  const lowerContrastMetrics = measuredPresentedPixelMetrics(
    lowerContrast,
    withFixtureReference(lowerContrast, fixtureFrame()),
    [],
  );
  assert.ok(
    lowerContrastMetrics.motionSamples.maxPosterAxisErrorPx <= 0.75,
    `room-treatment contrast changes must not masquerade as poster motion: ${lowerContrastMetrics.motionSamples.maxPosterAxisErrorPx}`,
  );
  assert.ok(
    lowerContrastMetrics.motionSamples.maxForegroundEdgeErrorPx <= 1,
    `room-treatment contrast changes must not masquerade as foreground motion: ${lowerContrastMetrics.motionSamples.maxForegroundEdgeErrorPx}`,
  );

  const wrongTreatment = fixtureFrame({ paper: 70 });
  const wrongTreatmentMetrics = measuredPresentedPixelMetrics(
    resting,
    firstPainted,
    [withFixtureReference(wrongTreatment, changedContent)],
  );
  assert.ok(
    wrongTreatmentMetrics.playingFrames.maxRoomTreatmentDelta >
      MAX_ROOM_TREATMENT_CHANNEL_DELTA,
    "captured pixels must reject a mismatched per-frame treatment reference",
  );

  const fabricatedDiagnostics = {
    pixels: {
      firstFrame: { meanLumaDelta: 0, meanChannelDelta: 0 },
      playingFrames: {
        maxRoomTreatmentLumaDelta: 0,
        maxRoomTreatmentDelta: 0,
      },
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

  const currentAuthoring = JSON.parse(
    await readFile(
      resolve("public/room/hero/hero-presented-authoring-manifest.json"),
      "utf8",
    ),
  );
  assert.deepEqual(
    await localHeroAuthoringSourceIssues(currentAuthoring),
    [],
    "current authoring sources, schedule, and rasterizer hashes should pass",
  );
  const staleSchedule = structuredClone(currentAuthoring);
  staleSchedule.referenceGeneration.schedule.sha256 =
    fixtureHash("stale-schedule");
  assert.match(
    (await localHeroAuthoringSourceIssues(staleSchedule)).join("\n"),
    /reference schedule SHA-256/,
    "a stale reference schedule hash must fail",
  );
  const staleRasterizer = structuredClone(currentAuthoring);
  staleRasterizer.referenceGeneration.rasterizer.sha256 =
    fixtureHash("stale-rasterizer");
  assert.match(
    (await localHeroAuthoringSourceIssues(staleRasterizer)).join("\n"),
    /reference rasterizer SHA-256/,
    "a stale reference rasterizer hash must fail",
  );
  console.log(
    "hero lifecycle self-tests passed (alias/hash provenance, geometry mismatch, conditional real-crossing traces, destination/direction/phase coverage, out-of-order presentation, and final-pixel negatives).",
  );
}

if (selfTest) {
  await runSelfTests();
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
      const captureResumeEvents = new WeakSet();
      let heroPlaybackReleased = false;
      let referenceCaptureRates = null;

      const eventSnapshot = (type, video) => ({
        type,
        hero: video.dataset.lazyAHero === "true",
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
          if (captureResumeEvents.delete(element)) return;
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
          Boolean(this.dataset.lazyAPlate) &&
          referenceCaptureRates
        ) {
          this.playbackRate = referenceCaptureRates.plate;
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
            removeOverlay();
            restorePlaybackRate();
            restoreCaptureHolds();
            presented.capture = null;
            presented.presentedFramesAfterRelease.length = 0;
            presented.videoFrames.clear();
            presented.compositorFrames.clear();
            presented.latestFrame = 0;
            presented.playbackReleasedAt = performance.now();
            presented.armedAt = presented.playbackReleasedAt;
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
        slowedVideos: [],
        captureHolds: [],
        armedAt: 0,
        playbackReleasedAt: 0,
        presentedFramesAfterRelease: [],
        videoFrames: new Map(),
        compositorFrames: new Map(),
      };
      const restorePlaybackRate = () => {
        for (const { element, playbackRate } of presented.slowedVideos) {
          element.playbackRate = playbackRate;
        }
        presented.slowedVideos.length = 0;
      };
      const isCaptureHeld = (element) =>
        presented.captureHolds.includes(element);
      const holdForCapture = (element) => {
        if (!element || isCaptureHeld(element)) return;
        presented.captureHolds.push(element);
        if (!element.paused) element.pause();
      };
      const resumeForCapture = (element) => {
        const index = presented.captureHolds.indexOf(element);
        if (index === -1) return;
        presented.captureHolds.splice(index, 1);
        if (!element.ended) {
          captureResumeEvents.add(element);
          void nativePlay.call(element);
        }
      };
      const activePlateForCapture = () =>
        records
          .map(({ element }) => element)
          .find(
            (element) =>
              Boolean(element.dataset.lazyAPlate) &&
              !element.ended &&
              (!element.paused || isCaptureHeld(element)),
          );
      const restoreCaptureHolds = () => {
        for (const element of presented.captureHolds.splice(0)) {
          if (!element.ended) {
            captureResumeEvents.add(element);
            void nativePlay.call(element);
          }
        }
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
        const captureVideos = records
          .map(({ element }) => element)
          .filter(
            (element) =>
              element.dataset.lazyAHero === "true" ||
              (Boolean(element.dataset.lazyAPlate) &&
                !element.paused &&
                !element.ended),
          );
        for (const element of captureVideos) {
          if (
            presented.slowedVideos.some(
              ({ element: slowed }) => slowed === element,
            )
          ) {
            continue;
          }
          presented.slowedVideos.push({
            element,
            playbackRate: element.playbackRate,
          });
          // Preserve the authored hero-to-plate clock ratio while the frozen
          // overlay gives Playwright time to capture the exact compositor
          // frame. Chrome's supported floor is 0.0625, so 0.15625 keeps the
          // 0.4/0.5 authoring pair proportional at 0.0625/0.078125.
          element.playbackRate = element.playbackRate * 0.15625;
        }
        return source.bounds.toJSON();
      };
      const tryCapturePresentedFrame = (frameNumber) => {
        const target = presented.target;
        const compositor = presented.compositorFrames.get(frameNumber);
        const firstFrameHandshake =
          frameNumber === 1 && target?.heroMediaTime === 0;
        const heroRecord = records.find(
          ({ element }) => element.dataset.lazyAHero === "true",
        );
        const nativeVideoFrame =
          presented.videoFrames.get(frameNumber) ??
          (firstFrameHandshake &&
          heroRecord?.element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
            ? {
                mediaTime: 0,
                presentedFrames: 1,
                expectedDisplayTime: null,
                source: "loadeddata",
              }
            : null);
        if (
          presented.capture ||
          !target ||
          !nativeVideoFrame ||
          Math.abs(nativeVideoFrame.mediaTime - target.heroMediaTime) >
            0.000_01 ||
          !compositor ||
          compositor.at < presented.armedAt ||
          (!firstFrameHandshake && !compositor.heroPlaying) ||
          compositor.projectionFrame !== target.projectionFrame ||
          compositor.plateState !== target.plateState
        ) {
          return;
        }
        const canvasBounds = freezePresentedCanvas();
        if (!canvasBounds) return;
        presented.capture = {
          compositor,
          nativeVideoFrame,
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
            (!heroRecord.element.paused || isCaptureHeld(heroRecord.element)),
        };
        const target = presented.target;
        if (!presented.capture && target) {
          if (target.heroMediaTime > 0) {
            holdForCapture(heroRecord?.element);
          }
          if (
            snapshot.plateState === target.plateState &&
            snapshot.projectionFrame === target.projectionFrame &&
            snapshot.at >= presented.armedAt
          ) {
            holdForCapture(activePlateForCapture());
          } else {
            resumeForCapture(activePlateForCapture());
          }
        }
        if (
          heroPlaybackReleased &&
          snapshot.at >= presented.playbackReleasedAt &&
          detail.heroFramePresented > 0
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
            if (this.dataset.lazyAPlate) {
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
            const heroRecord = records.find(
              ({ element }) => element.dataset.lazyAHero === "true",
            );
            const hero = heroRecord?.element;
            if (
              hero &&
              Number.isFinite(target.heroMediaTime) &&
              target.heroMediaTime > 0
            ) {
              holdForCapture(hero);
              hero.currentTime = Math.min(
                Math.max(0, hero.duration - 1 / 48),
                target.heroMediaTime + 1 / 48,
              );
            }
            tryCapturePresentedFrame(presented.latestFrame);
          },
          snapshot() {
            const targetFrame = presented.target?.heroFramePresented;
            return {
              capture: presented.capture,
              latestFrame: presented.latestFrame,
              target: presented.target,
              armedAt: presented.armedAt,
              targetVideoFrame: Number.isInteger(targetFrame)
                ? (presented.videoFrames.get(targetFrame) ?? null)
                : null,
              targetCompositorFrame: Number.isInteger(targetFrame)
                ? (presented.compositorFrames.get(targetFrame) ?? null)
                : null,
              presentedFramesAfterRelease: [
                ...presented.presentedFramesAfterRelease,
              ],
            };
          },
          release() {
            removeOverlay();
            restorePlaybackRate();
            restoreCaptureHolds();
            presented.capture = null;
            presented.target = null;
          },
          setCapturePlaybackRates(rates) {
            if (rates?.hero !== 0.4 || rates?.plate !== 0.5) {
              throw new Error("invalid reference capture playback rates");
            }
            referenceCaptureRates = rates;
            for (const { element } of records) {
              if (element.dataset.lazyAHero === "true") {
                element.playbackRate = rates.hero;
              }
            }
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
        (event) => event.type === "play" && event.hero,
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

async function localHeroAuthoringSourceIssues(authoring) {
  const issues = [];
  for (const [label, source, expectedPath] of [
    ["masterBlend", authoring?.sources?.masterBlend, HERO_MASTER_BLEND],
    ["renderScript", authoring?.sources?.renderScript, HERO_RENDER_SCRIPT],
    ["compositorGlb", authoring?.sources?.compositorGlb, HERO_COMPOSITOR_GLB],
    [
      "reference schedule",
      authoring?.referenceGeneration?.schedule,
      HERO_REFERENCE_SCHEDULE,
    ],
    [
      "reference rasterizer",
      authoring?.referenceGeneration?.rasterizer,
      HERO_REFERENCE_RASTERIZER,
    ],
  ]) {
    if (source?.path !== expectedPath || !isSha256(source?.sha256)) {
      issues.push(`${label} authoring source is invalid`);
      continue;
    }
    try {
      const bytes = await readFile(resolve(source.path));
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== source.sha256) {
        issues.push(
          `${label} SHA-256 ${actual} does not match ${source.sha256}`,
        );
      }
    } catch (error) {
      issues.push(`${label} source cannot be read: ${error.message}`);
    }
  }
  return issues;
}

async function loadPresentedPixelReferenceCatalog(viewport) {
  const response = await page.evaluate(
    async ({
      eventName,
      referenceSuffix,
      authoringSuffix,
      referenceKind,
      regionEncoding,
    }) => {
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
        verification?.presentedPixelReferences !== referenceSuffix ||
        verification?.presentedPixelAuthoringManifest !== authoringSuffix ||
        !/^[a-f0-9]{64}$/.test(
          verification?.presentedPixelAuthoringManifestSha256 ?? "",
        ) ||
        verification?.referenceKind !== referenceKind ||
        verification?.regionEncoding !== regionEncoding
      ) {
        throw new Error(
          "R4 hero verification must declare the compositor event, pixel catalog, and hashed offline authoring manifest",
        );
      }
      const catalogUrl = new URL(
        verification.presentedPixelReferences.replace(/^\/+/, ""),
        document.baseURI,
      );
      const authoringUrl = new URL(
        verification.presentedPixelAuthoringManifest.replace(/^\/+/, ""),
        document.baseURI,
      );
      const [catalogResponse, authoringResponse] = await Promise.all([
        fetch(catalogUrl),
        fetch(authoringUrl),
      ]);
      if (!catalogResponse.ok || !authoringResponse.ok) {
        throw new Error(
          `could not load hero verification contracts (${catalogResponse.status}/${authoringResponse.status})`,
        );
      }
      return {
        catalogText: await catalogResponse.text(),
        catalogUrl: catalogUrl.href,
        authoringText: await authoringResponse.text(),
        authoringUrl: authoringUrl.href,
        declaredAuthoringSha256:
          verification.presentedPixelAuthoringManifestSha256,
      };
    },
    {
      eventName: PRESENTED_FRAME_EVENT,
      referenceSuffix: PRESENTED_PIXEL_REFERENCES,
      authoringSuffix: PRESENTED_PIXEL_AUTHORING_MANIFEST,
      referenceKind: PRESENTED_PIXEL_REFERENCE_KIND,
      regionEncoding: PRESENTED_PIXEL_REGION_ENCODING,
    },
  );
  if (
    Buffer.byteLength(response.catalogText) > MAX_CATALOG_BYTES ||
    Buffer.byteLength(response.authoringText) > MAX_AUTHORING_MANIFEST_BYTES
  ) {
    throw new Error("hero verification contracts exceed practical size limits");
  }
  const actualAuthoringSha256 = createHash("sha256")
    .update(response.authoringText)
    .digest("hex");
  const catalog = JSON.parse(response.catalogText);
  const authoring = JSON.parse(response.authoringText);
  if (
    actualAuthoringSha256 !== response.declaredAuthoringSha256 ||
    catalog.authoringManifestSha256 !== actualAuthoringSha256 ||
    new URL(catalog.authoringManifest, response.catalogUrl).href !==
      response.authoringUrl
  ) {
    throw new Error(
      "hero pixel catalog is not cryptographically pinned to the fetched authoring manifest",
    );
  }
  const localSourceIssues = await localHeroAuthoringSourceIssues(authoring);
  if (localSourceIssues.length > 0) {
    throw new Error(
      `hero offline authoring sources are invalid: ${localSourceIssues.join("; ")}`,
    );
  }
  return normalizePresentedPixelCatalog(
    catalog,
    `${viewport.width}x${viewport.height}`,
    response.catalogUrl,
    authoring,
    response.authoringUrl,
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
    authoredSourceAsset.sha256 !== reference.sourceSha256 ||
    compositeAsset.sha256 !== reference.compositeSha256 ||
    regionsAsset.sha256 !== reference.regionsSha256
  ) {
    throw new Error(
      `authoring asset hash mismatch for frame ${reference.heroFramePresented}`,
    );
  }
  const regionIssues = referenceRegionProjectionIssues(
    regions,
    reference.authoringProjection,
  );
  if (regionIssues.length > 0) {
    throw new Error(
      `region reference for frame ${reference.heroFramePresented} is invalid: ${regionIssues.join("; ")}`,
    );
  }
  return {
    composite,
    regions,
    authoringProjection: reference.authoringProjection,
  };
}

async function armPresentedFrameCapture(reference) {
  await page.evaluate(
    (target) => window.__heroPresentedFrameProbe.arm(target),
    {
      heroFramePresented: reference.heroFramePresented,
      heroMediaTime: reference.heroMediaTime,
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
  const target = {
    heroFramePresented: reference.heroFramePresented,
    heroMediaTime: reference.heroMediaTime,
    plateState: reference.plateState,
    projectionFrame: reference.projectionFrame,
  };
  try {
    await page.waitForFunction(
      (expected) => {
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
          (Number.isFinite(snapshot.capture?.nativeVideoFrame?.mediaTime) &&
            Math.abs(
              snapshot.capture.nativeVideoFrame.mediaTime -
                expected.heroMediaTime,
            ) <= 0.000_01 &&
            snapshot.capture?.compositor?.plateState === expected.plateState &&
            snapshot.capture?.compositor?.projectionFrame ===
              expected.projectionFrame)
        );
      },
      target,
      { timeout: 8_000 },
    );
  } catch (error) {
    const state = await page.evaluate(() => ({
      probe: window.__heroPresentedFrameProbe.snapshot(),
      compositor: window.__lazyACompositor ?? null,
      plateState: window.__lazyAPlateState?.state ?? null,
      hero: [...document.querySelectorAll("video")]
        .filter((video) => video.dataset.lazyAHero === "true")
        .map((video) => ({
          currentTime: video.currentTime,
          paused: video.paused,
          ended: video.ended,
          readyState: video.readyState,
        })),
    }));
    throw new Error(
      `presented-frame target ${JSON.stringify(target)} timed out at ${JSON.stringify(state)}`,
      { cause: error },
    );
  }
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
          heroMediaTime: nextReference.heroMediaTime,
          plateState: nextReference.plateState,
          projectionFrame: nextReference.projectionFrame,
        }
      : null,
  );
  const frame = await decodePng(png);
  if (debugCaptureDirectory) {
    await mkdir(debugCaptureDirectory, { recursive: true });
    await sharp(frame.data, {
      raw: {
        width: frame.width,
        height: frame.height,
        channels: 4,
      },
    })
      .png()
      .toFile(
        resolve(debugCaptureDirectory, `${reference.authoringReferenceId}.png`),
      );
  }
  const capture = probe.capture;
  if (
    !Number.isFinite(capture?.nativeVideoFrame?.mediaTime) ||
    Math.abs(capture?.nativeVideoFrame?.mediaTime - reference.heroMediaTime) >
      0.000_01 ||
    capture?.nativeVideoFrame?.presentedFrames !==
      capture?.compositor?.heroFramePresented ||
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
    catalogReference: reference,
  };
}

async function captureArmedPresentedSequence(
  references,
  decodedReferences,
  nextReferenceAfterSequence = null,
) {
  const captured = [];
  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index];
    captured.push(
      await captureArmedPresentedFrame(
        reference,
        decodedReferences.get(reference.heroFramePresented),
        references[index + 1] ?? nextReferenceAfterSequence,
      ),
    );
  }
  return captured;
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
  const presentedFrames = [firstPainted, ...playingFrames];
  const {
    firstFrame,
    playingFrames: treatment,
    motionSamples,
  } = measuredPresentedPixelMetrics(resting, firstPainted, playingFrames);
  const frameLabel = (frame) =>
    frame.catalogReference?.authoringReferenceId ??
    `hero-${frame.compositor?.heroFramePresented ?? "unknown"}`;
  const treatmentDiagnostics = presentedFrames
    .map((frame) => ({
      frame: frameLabel(frame),
      ...maskedPixelDelta(
        frame,
        frame.reference?.composite ?? {},
        frame.reference?.regions ?? {},
        2,
      ),
    }))
    .sort((left, right) => right.meanChannelDelta - left.meanChannelDelta);
  const edgeDiagnostics = presentedFrames
    .map((frame) => ({
      frame: frameLabel(frame),
      poster: measureEdgeAlignment(
        frame,
        frame.reference?.regions ?? {},
        0,
        frame.reference?.composite,
        frame.reference?.authoringProjection?.red?.boundaries,
      ),
      foreground:
        frame.reference?.authoringProjection?.green?.applicable === true
          ? measureEdgeAlignment(
              frame,
              frame.reference?.regions ?? {},
              1,
              frame.reference?.composite,
              frame.reference?.authoringProjection?.green?.objects?.flatMap(
                ({ boundaries }) => boundaries,
              ),
            )
          : null,
    }))
    .sort(
      (left, right) =>
        right.poster.weakSamples +
        (right.foreground?.weakSamples ?? 0) -
        left.poster.weakSamples -
        (left.foreground?.weakSamples ?? 0),
    );
  const worstEdgeFrame = [...edgeDiagnostics].sort(
    (left, right) =>
      Math.max(right.poster.p95ErrorPx, right.foreground?.p95ErrorPx ?? 0) -
      Math.max(left.poster.p95ErrorPx, left.foreground?.p95ErrorPx ?? 0),
  )[0];
  check(
    firstFrame?.meanLumaDelta <= 3 && firstFrame?.meanChannelDelta <= 4,
    `${label} resting poster matches the first painted live frame`,
    JSON.stringify(firstFrame),
  );
  check(
    treatment?.minimumTreatmentSamples > 0 &&
      treatment?.maxRoomTreatmentLumaDelta <= MAX_ROOM_TREATMENT_LUMA_DELTA &&
      treatment?.maxRoomTreatmentDelta <= MAX_ROOM_TREATMENT_CHANNEL_DELTA,
    `${label} representative playing frames match authored per-frame room treatment`,
    JSON.stringify({
      ...treatment,
      worstFrame: treatmentDiagnostics[0],
    }),
  );
  check(
    motionSamples?.posterRegistrationSamples > 0 &&
      motionSamples?.maxPosterAxisErrorPx <= 0.75,
    `${label} captured poster-axis edges stay registered`,
    JSON.stringify({
      ...motionSamples,
      weakestFrame: edgeDiagnostics[0],
      worstErrorFrame: worstEdgeFrame,
    }),
  );
  check(
    motionSamples?.foregroundSamples > 0 &&
      motionSamples?.maxForegroundWeakFraction <= MAX_WEAK_EDGE_FRACTION &&
      motionSamples?.maxForegroundEdgeErrorPx <= 1,
    `${label} captured foreground occlusion edges stay registered`,
    JSON.stringify({
      ...motionSamples,
      weakestFrame: edgeDiagnostics[0],
      worstErrorFrame: worstEdgeFrame,
    }),
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

async function verifyCatalogIndependentLifecycle(viewport, label) {
  await releaseHeroPlayback();
  const started = await waitForHero(
    (snapshot) => snapshot.playStarts >= 1,
    8_000,
  );
  const afterStart = await heroSnapshot();
  const firstPlay = afterStart.playEvents[0];
  check(
    afterStart.playCalls === 1 && afterStart.playStarts === 1,
    `${label} runtime-only one play start after settle`,
    `calls=${afterStart.playCalls} starts=${afterStart.playStarts}`,
  );
  check(
    Boolean(firstPlay?.arrivalDone) &&
      firstPlay.currentTime <= TIME_EPSILON * 2,
    `${label} runtime-only play starts from zero after settle`,
    firstPlay
      ? `arrivalDone=${firstPlay.arrivalDone} currentTime=${fixed(firstPlay.currentTime)}`
      : `no play event; currentTime=${fixed(started.currentTime)}`,
  );

  const playbackSnapshots = [];
  let allDestinationsOpened = true;
  let allDeskReturns = true;
  for (const destination of DESTINATIONS) {
    const beforeOpen = await heroSnapshot();
    const opened = await openDestination(destination);
    const afterOpen = await heroSnapshot();
    playbackSnapshots.push(afterOpen);
    allDestinationsOpened &&= opened.ok;
    if (destination === "films") {
      check(
        opened.ok &&
          afterOpen.currentTime > beforeOpen.currentTime + 0.2 &&
          !afterOpen.paused,
        `${label} runtime-only playback advances while navigation opens`,
        `${fixed(beforeOpen.currentTime)} -> ${fixed(afterOpen.currentTime)} paused=${afterOpen.paused}`,
      );
    }
    const closed = await closeDestination(destination);
    const afterClose = await heroSnapshot();
    playbackSnapshots.push(afterClose);
    allDeskReturns &&= closed.ok;
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
    `${label} runtime-only navigation preserves one-shot playback`,
    `samples=${playbackSnapshots.map((snapshot) => fixed(snapshot.currentTime)).join(" -> ")} calls=${playbackSnapshots.at(-1)?.playCalls} starts=${playbackSnapshots.at(-1)?.playStarts}`,
  );

  const beforeEnd = await heroSnapshot();
  const endedSnapshot = await waitForHero(
    (snapshot) => snapshot.endedEvents >= 1 || snapshot.ended,
    Math.min(
      Math.max((beforeEnd.duration - beforeEnd.currentTime + 2) * 1_000, 4_000),
      16_000,
    ),
  );
  check(
    endedSnapshot.endedEvents === 1 && endedSnapshot.ended,
    `${label} runtime-only hero reaches ended once`,
    `endedEvents=${endedSnapshot.endedEvents} ended=${endedSnapshot.ended} currentTime=${fixed(endedSnapshot.currentTime)}`,
  );
  const presentedSequence = await page.evaluate(
    () =>
      window.__heroPresentedFrameProbe.snapshot().presentedFramesAfterRelease,
  );
  const sequenceIssues = presentationSequenceIssues(presentedSequence);
  check(
    sequenceIssues.length === 0,
    `${label} runtime-only compositor presentation stays ordered`,
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
  check(
    endedSnapshot.ended &&
      held.ended &&
      held.paused &&
      atFinalFrame &&
      Math.abs(held.currentTime - finalFrameTime) <= TIME_EPSILON &&
      held.playCalls === 1 &&
      held.playStarts === 1,
    `${label} runtime-only final frame holds without restart`,
    `paused=${held.paused} ended=${held.ended} currentTime=${fixed(held.currentTime)} duration=${fixed(held.duration)} calls=${held.playCalls}`,
  );
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
    let references;
    try {
      references = runtimeOnly
        ? null
        : await loadPresentedPixelReferenceCatalog(viewport);
    } catch (error) {
      check(
        false,
        `${label} presented-pixel catalog`,
        error instanceof Error ? error.message : String(error),
      );
      await verifyCatalogIndependentLifecycle(viewport, label);
      return;
    }
    if (!references) {
      await verifyCatalogIndependentLifecycle(viewport, label);
      return;
    }
    const restingReferences = references.filter(
      ({ plateState }) => plateState === "resting:desk",
    );
    const firstReference = restingReferences.find(
      ({ heroFramePresented }) => heroFramePresented === 1,
    );
    const representativeReference = restingReferences.find(
      ({ heroFramePresented }) => heroFramePresented !== 1,
    );
    const movingReferences = Object.fromEntries(
      DESTINATIONS.map((destination) => [
        destination,
        {
          forward: references
            .filter(
              ({ plateState }) =>
                plateState === `transitioning:desk-to-${destination}`,
            )
            .sort(
              (left, right) => left.projectionFrame - right.projectionFrame,
            ),
          reverse: references
            .filter(
              ({ plateState }) =>
                plateState === `transitioning:${destination}-to-desk`,
            )
            .sort(
              (left, right) => left.projectionFrame - right.projectionFrame,
            ),
        },
      ]),
    );
    const orderedDestinations = [...DESTINATIONS].sort(
      (left, right) =>
        movingReferences[left].forward[0].heroFramePresented -
        movingReferences[right].forward[0].heroFramePresented,
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
    await page.evaluate((rates) => {
      window.__heroPresentedFrameProbe.setCapturePlaybackRates(rates);
    }, representativeReference.capturePlaybackRates);
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
    for (const destination of orderedDestinations) {
      const forward = `desk -> ${destination}`;
      await beginRegistrationSegment(forward);
      const beforeOpen = await heroSnapshot();
      const forwardReferences = movingReferences[destination].forward;
      const reverseReferences = movingReferences[destination].reverse;
      await armPresentedFrameCapture(forwardReferences[0]);
      const forwardCapture = captureArmedPresentedSequence(
        forwardReferences,
        decodedReferences,
        reverseReferences[0],
      );
      const opened = await openDestination(destination);
      const capturedForward = await forwardCapture;
      movingFrames.push(...capturedForward);
      for (const captured of capturedForward) {
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
          opened.ok && afterOpen.currentTime > beforeOpen.currentTime + 0.2,
          `${label} audited hero timeline advances while destination opens`,
          `${fixed(beforeOpen.currentTime)} -> ${fixed(afterOpen.currentTime)} paused=${afterOpen.paused}`,
        );
      }

      const reverse = `${destination} -> desk`;
      await beginRegistrationSegment(reverse);
      const reverseCapture = captureArmedPresentedSequence(
        reverseReferences,
        decodedReferences,
      );
      const closed = await closeDestination(destination);
      const capturedReverse = await reverseCapture;
      movingFrames.push(...capturedReverse);
      for (const captured of capturedReverse) {
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

    const capturedCoverage = new Set(
      movingFrames.map(
        ({ catalogReference }) =>
          `${catalogReference.plateState}/${catalogReference.phase}`,
      ),
    );
    const expectedCoverage = new Set(
      DESTINATIONS.flatMap((destination) =>
        ["forward", "reverse"].flatMap((direction) =>
          REFERENCE_PHASES.map(
            (phase) =>
              `${
                direction === "forward"
                  ? `transitioning:desk-to-${destination}`
                  : `transitioning:${destination}-to-desk`
              }/${phase}`,
          ),
        ),
      ),
    );
    check(
      movingFrames.length === 24 &&
        capturedCoverage.size === expectedCoverage.size &&
        [...expectedCoverage].every((entry) => capturedCoverage.has(entry)),
      `${label} every destination/direction has early, mid, and late moving pixels`,
      `${movingFrames.length} captures across ${capturedCoverage.size} path phases`,
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
