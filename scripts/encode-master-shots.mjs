#!/usr/bin/env node

import { access, mkdir, readFile, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PerspectiveCamera, Vector3 } from "three";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = resolve(repositoryRoot, "public/room/manifest.json");
const generatedTypesPath = resolve(repositoryRoot, "three/scene/plateManifest.ts");
const expectedEndpoints = [
  "opening",
  "desk",
  "films",
  "journal",
  "contact",
  "about",
];
const expectedVariants = ["wide", "portrait"];
const expectedTransitions = [
  "opening-desk",
  "desk-films",
  "desk-journal",
  "desk-contact",
  "desk-about",
];
const expectedRowHeight = 0.026;
const expectedRowPitch = 0.044;
const minimumPortraitLabelWidth = 135;

function quadPixelWidth(quad, width) {
  if (!finiteTuple(quad, 8)) return 0;
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  return (Math.max(...xs) - Math.min(...xs)) * width;
}

function quadInsideFrame(quad, inset = 0) {
  return (
    finiteTuple(quad, 8) &&
    quad.every((value) => value >= inset && value <= 1 - inset)
  );
}

function quadIntersectsFrame(quad) {
  if (!finiteTuple(quad, 8)) return false;
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  const ys = [quad[1], quad[3], quad[5], quad[7]];
  return Math.max(...xs) > 0 && Math.min(...xs) < 1 && Math.max(...ys) > 0 && Math.min(...ys) < 1;
}

function parseArgs(argv) {
  const args = {
    verify: false,
    encode: false,
    variants: new Set(),
    transitions: new Set(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--verify") args.verify = true;
    else if (value === "--encode") args.encode = true;
    else if (value === "--variant") args.variants.add(argv[++index]);
    else if (value === "--transition") args.transitions.add(argv[++index]);
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.verify && !args.encode) args.encode = true;
  return args;
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: repositoryRoot,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
    });
  });
}

function publicUrlToPath(value) {
  if (typeof value !== "string" || !value.startsWith("/room/")) {
    throw new Error(`Expected /room public URL, got ${JSON.stringify(value)}`);
  }
  return resolve(repositoryRoot, "public", value.slice(1));
}

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function exactKeys(value, expected, label, issues) {
  const actual = Object.keys(value ?? {});
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    issues.push(`${label} must be exactly ${expected.join(", ")}; got ${actual.join(", ") || "none"}`);
  }
}

function finiteTuple(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function validateProjection(frame, label, issues) {
  if (!frame || typeof frame !== "object") {
    issues.push(`${label} projection frame is missing`);
    return;
  }
  if (
    !finiteTuple(frame.camera?.position, 3) ||
    !finiteTuple(frame.camera?.quaternion, 4) ||
    !Number.isFinite(frame.camera?.fov)
  ) {
    issues.push(`${label} camera sample is malformed`);
  }
  if (frame.hero !== null && !finiteTuple(frame.hero, 8)) {
    issues.push(`${label} hero projection must be an 8-number quad or null`);
  }
  if (
    !Number.isFinite(frame.lampLevel) ||
    !Number.isFinite(frame.revealLevel) ||
    frame.lampLevel < 0 ||
    frame.lampLevel > 1 ||
    frame.revealLevel < 0 ||
    frame.revealLevel > 1
  ) {
    issues.push(`${label} lamp/reveal levels must be within 0..1`);
  }
}

function exportedNavigationProjection(variant, endpointId) {
  const plane = variant.navigation.plane;
  const origin = new Vector3(...plane.origin);
  const uAxis = new Vector3(...plane.uAxis);
  const vAxis = new Vector3(...plane.vAxis);
  const points = [
    origin.clone(),
    origin.clone().addScaledVector(uAxis, plane.width),
    origin
      .clone()
      .addScaledVector(uAxis, plane.width)
      .addScaledVector(vAxis, plane.height),
    origin.clone().addScaledVector(vAxis, plane.height),
  ];
  const sample = variant.endpoints[endpointId].projection.camera;
  const camera = new PerspectiveCamera(
    sample.fov,
    variant.width / variant.height,
    0.1,
    200,
  );
  camera.position.set(...sample.position);
  camera.quaternion.set(...sample.quaternion);
  camera.updateMatrixWorld(true);
  return points.flatMap((point) => {
    const projected = point.project(camera);
    return [projected.x * 0.5 + 0.5, 0.5 - projected.y * 0.5];
  });
}

function validateManifest(manifest) {
  const issues = [];
  if (manifest.version !== 1) issues.push("manifest version must be 1");
  if (manifest.generatedBy !== "scripts/render-master-shots.py") {
    issues.push("manifest must be generated by scripts/render-master-shots.py");
  }
  if (manifest.coordinateSystem !== "three-y-up") {
    issues.push("manifest coordinateSystem must be three-y-up");
  }
  if (
    manifest.cameraRotationConversion !==
    "basis-similarity-with-camera-local-basis"
  ) {
    issues.push("camera rotation export must declare the verified basis-similarity conversion");
  }
  if (manifest.fps !== 30) issues.push("manifest fps must be 30");
  if (JSON.stringify(manifest.endpointIds) !== JSON.stringify(expectedEndpoints)) {
    issues.push("manifest endpointIds are incomplete or out of order");
  }
  exactKeys(manifest.variants, expectedVariants, "variants", issues);

  for (const variantId of expectedVariants) {
    const variant = manifest.variants?.[variantId];
    if (!variant) continue;
    if (!Number.isFinite(variant.fov)) issues.push(`${variantId} fov is missing`);
    exactKeys(variant.endpoints, expectedEndpoints, `${variantId} endpoints`, issues);
    exactKeys(variant.transitions, expectedTransitions, `${variantId} transitions`, issues);

    const endpointFovs = new Set();
    for (const endpointId of expectedEndpoints) {
      const endpoint = variant.endpoints?.[endpointId];
      if (!endpoint) continue;
      validateProjection(endpoint.projection, `${variantId}/${endpointId}`, issues);
      endpointFovs.add(endpoint.projection?.camera?.fov);
      if (endpoint.id !== endpointId) issues.push(`${variantId}/${endpointId} id mismatch`);
    }
    if (endpointFovs.size !== 1 || !endpointFovs.has(variant.fov)) {
      issues.push(`${variantId} must keep one constant ${variant.fov}-degree lens`);
    }

    for (const transitionId of expectedTransitions) {
      const transition = variant.transitions?.[transitionId];
      if (!transition) continue;
      const expectedDuration = transitionId === "opening-desk" ? 2.6 : 0.9;
      if (transition.duration !== expectedDuration) {
        issues.push(`${variantId}/${transitionId} duration must be ${expectedDuration}s`);
      }
      if (transition.fps !== 30) issues.push(`${variantId}/${transitionId} fps must be 30`);
      if (transition.frameCount !== Math.round(expectedDuration * 30) + 1) {
        issues.push(`${variantId}/${transitionId} frameCount does not span its exact duration`);
      }
      if (!Array.isArray(transition.frames) || transition.frames.length !== transition.frameCount) {
        issues.push(`${variantId}/${transitionId} per-frame projection samples are incomplete`);
      } else {
        transition.frames.forEach((frame, index) =>
          validateProjection(frame, `${variantId}/${transitionId} frame ${index}`, issues),
        );
      }
      if (
        transition.reverse?.source === transition.forward ||
        transition.reverse?.playbackRate !== 1 ||
        transition.reverse?.from !== transition.to ||
        transition.reverse?.to !== transition.from
      ) {
        issues.push(`${variantId}/${transitionId} reverse metadata must name a packaged destination-to-source clip`);
      }
    }

    const journal = variant.transitions?.["desk-journal"];
    if (
      journal?.journalHeadLeadSeconds !== 0.3 ||
      journal?.translationStartsAtSeconds !== 0.3
    ) {
      issues.push(`${variantId}/desk-journal must lead with the head for 0.3s`);
    }
    const contact = variant.transitions?.["desk-contact"];
    const deskCamera = variant.endpoints?.desk?.projection?.camera;
    const contactCamera = variant.endpoints?.contact?.projection?.camera;
    if (
      JSON.stringify(contactCamera) === JSON.stringify(deskCamera) ||
      contact?.frames?.every(
        (frame) => JSON.stringify(frame.camera) === JSON.stringify(deskCamera),
      )
    ) {
      issues.push(`${variantId}/desk-contact must use an authored lean/pan away from desk`);
    }
    if (
      variant.navigation?.rows?.length !== 4 ||
      !variant.navigation?.plane ||
      variant.navigation?.containment !== "half-open" ||
      variant.contact?.mechanism !== "geometry-nodes-indentation" ||
      variant.contact?.standalonePlaneCount !== 0 ||
      variant.contact?.paperOpacity !== 1
    ) {
      issues.push(`${variantId} physical navigation or CONTACT projection contract is incomplete`);
    }
    if (
      variant.contact?.geometryStats?.evaluatedVertices <= variant.contact?.geometryStats?.baseVertices ||
      variant.contact?.geometryStats?.evaluatedPolygons <= variant.contact?.geometryStats?.basePolygons
    ) {
      issues.push(`${variantId} Mesh_56 evaluated geometry does not prove a boolean-cut indentation`);
    }
    if (
      variant.navigation?.fontFamily !== "Noteworthy" ||
      variant.navigation?.marking !== "thin-graphite" ||
      variant.navigation?.alignment !== "left" ||
      variant.navigation?.rowHeight !== expectedRowHeight ||
      variant.navigation?.rowPitch !== expectedRowPitch ||
      variant.navigation?.rows?.some(
        (row, index, rows) =>
          Math.abs(row.rect.height - expectedRowHeight) > 1e-9 ||
          (index > 0 &&
            Math.abs(row.rect.y - rows[index - 1].rect.y - expectedRowPitch) > 1e-9),
      )
    ) {
      issues.push(`${variantId} navigation must use exact 0.026 rows on a 0.044 pitch in left-aligned Noteworthy graphite`);
    }
    const boundary = 0.09;
    if (
      variant.navigation?.rows?.some(
        ({ rect }) =>
          boundary >= rect.y && boundary < rect.y + rect.height,
      )
    ) {
      issues.push(`${variantId} row containment includes the y=0.09 gap boundary`);
    }
    for (const endpointId of expectedEndpoints) {
      const expected = variant.navigation?.screenQuads?.[endpointId];
      if (!finiteTuple(expected, 8)) {
        issues.push(`${variantId}/${endpointId} navigation screen quad is missing`);
        continue;
      }
      const projected = exportedNavigationProjection(variant, endpointId);
      const quarterPixel = 0.25 / Math.min(variant.width, variant.height);
      const error = Math.max(
        ...projected.map(
          (value, index) =>
            Math.abs(value - expected[index]) /
            Math.max(quarterPixel, Math.abs(expected[index]) * 0.00004),
        ),
      );
      if (error > 1) {
        issues.push(
          `${variantId}/${endpointId} exported camera/nav projection differs from Blender by ${error} tolerance units`,
        );
      }
    }
    if (
      variant.logo?.object !== "Mesh_33" ||
      variant.logo?.geometryCreated !== false ||
      variant.logo?.uvBinding !== "explicit-uv-map"
    ) {
      issues.push(`${variantId} logo must bind the upright UV map on existing Mesh_33`);
    }
    for (const endpointId of ["desk"]) {
      const logoQuad = variant.logo?.screenQuads?.[endpointId];
      if (variantId === "portrait" && !quadInsideFrame(logoQuad, 0.02)) {
        issues.push(`portrait/${endpointId} must include the full existing Mesh_33 logo card`);
      }
      for (const row of variant.navigation?.rows ?? []) {
        const labelQuad = variant.navigation?.labelScreenQuads?.[endpointId]?.[row.id];
        if (
          variantId === "portrait" &&
          quadPixelWidth(labelQuad, variant.width) < minimumPortraitLabelWidth
        ) {
          issues.push(`portrait/${endpointId} ${row.label} must project at least ${minimumPortraitLabelWidth}px wide`);
        }
      }
    }
    if (variantId === "portrait") {
      if (
        !quadIntersectsFrame(variant.contact?.lampScreenQuads?.contact) ||
        !quadInsideFrame(variant.contact?.paperScreenQuads?.contact, 0.01)
      ) {
        issues.push("portrait/contact must frame the current lamp and full contact paper together");
      }
    }
    if (
      variant.journal?.mechanism !== "physical-text-geometry" ||
      variant.journal?.surfaceObject !== "Mesh_185" ||
      variant.journal?.copy?.length !== 5 ||
      variant.journal?.lineObjects?.length !== 5 ||
      variant.journal?.fontFamily !== "Noteworthy" ||
      variant.journal?.alignment !== "left" ||
      variant.journal?.marking !== "thin-graphite" ||
      variant.journal?.pencilClearance !== "clear" ||
      variant.journal?.pencilObject !== "Mesh_53" ||
      variant.journal?.pencilMovedOnce !== true
    ) {
      issues.push(`${variantId} physical JOURNAL copy metadata is incomplete`);
    }
    if (
      variant.contact?.paperMovedOnce !== true ||
      variant.contact?.addressCopy !== "CONTACT@LAZYAPRODUCTIONS.COM" ||
      !quadInsideFrame(variant.contact?.addressScreenQuads?.contact, 0.02) ||
      quadPixelWidth(variant.contact?.addressScreenQuads?.contact, variant.width) < 140
    ) {
      issues.push(`${variantId} CONTACT must expose the one-time-positioned physical indentation in frame`);
    }
    if (
      variantId === "portrait" &&
      variant.endpoints?.contact?.framing?.coverage?.contactPaper <=
        variant.endpoints?.contact?.framing?.coverage?.charger
    ) {
      issues.push("portrait CONTACT does not favor contactPaper over charger");
    }
  }
  return issues;
}

async function loadManifest() {
  const source = await readFile(manifestPath, "utf8");
  return JSON.parse(source);
}

function selected(args, variantId, transitionId) {
  return (
    (args.variants.size === 0 || args.variants.has(variantId)) &&
    (args.transitions.size === 0 || args.transitions.has(transitionId))
  );
}

async function encode(manifest, args) {
  let encoded = 0;
  let pending = 0;
  for (const [variantId, variant] of Object.entries(manifest.variants)) {
    for (const [transitionId, transition] of Object.entries(variant.transitions)) {
      if (!selected(args, variantId, transitionId)) continue;
      const frameDirectory = publicUrlToPath(transition.framesDirectory);
      const firstFrame = resolve(frameDirectory, "0000.png");
      if (!(await exists(firstFrame))) {
        console.log(`PENDING ${variantId}/${transitionId}: no rendered frame sequence`);
        pending += 1;
        continue;
      }
      const output = publicUrlToPath(transition.forward);
      await mkdir(dirname(output), { recursive: true });
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-framerate",
        String(transition.fps),
        "-start_number",
        "0",
        "-i",
        resolve(frameDirectory, "%04d.png"),
        "-vf",
        "pad=ceil(iw/2)*2:ceil(ih/2)*2",
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        output,
      ]);
      const reverseOutput = publicUrlToPath(transition.reverse.source);
      await mkdir(dirname(reverseOutput), { recursive: true });
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-framerate",
        String(transition.fps),
        "-start_number",
        "0",
        "-i",
        resolve(frameDirectory, "%04d.png"),
        "-vf",
        "reverse,pad=ceil(iw/2)*2:ceil(ih/2)*2",
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        reverseOutput,
      ]);
      console.log(`ENCODED ${variantId}/${transitionId}: ${output} + ${reverseOutput}`);
      encoded += 2;
    }
  }
  console.log(`Encode summary: ${encoded} encoded, ${pending} pending frame sequences.`);
}

async function probe(path) {
  const { stdout } = await run(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name,pix_fmt,width,height:format=duration",
      "-of",
      "json",
      path,
    ],
    { capture: true },
  );
  return JSON.parse(stdout);
}

async function verifyMedia(manifest) {
  const issues = [];
  let verified = 0;
  let pending = 0;
  for (const [variantId, variant] of Object.entries(manifest.variants)) {
    for (const endpoint of Object.values(variant.endpoints)) {
      const path = publicUrlToPath(endpoint.still);
      if (!(await exists(path))) {
        console.log(`PENDING ${variantId}/${endpoint.id} still (not required yet)`);
        pending += 1;
        continue;
      }
      const details = await stat(path);
      if (details.size === 0) issues.push(`${endpoint.still} is empty`);
      else verified += 1;
    }
    for (const [transitionId, transition] of Object.entries(variant.transitions)) {
      const paths = [transition.forward, transition.reverse.source];
      if (!(await exists(publicUrlToPath(transition.forward)))) {
        console.log(`PENDING ${variantId}/${transitionId} clip (not rendered yet)`);
        pending += 1;
        continue;
      }
      for (const mediaUrl of paths) {
        const path = publicUrlToPath(mediaUrl);
        if (!(await exists(path))) {
          issues.push(`${mediaUrl} is missing`);
          continue;
        }
        const result = await probe(path);
        const stream = result.streams?.[0];
        const duration = Number(result.format?.duration);
        if (stream?.codec_name !== "h264") issues.push(`${mediaUrl} codec is not H.264`);
        if (stream?.pix_fmt !== "yuv420p") issues.push(`${mediaUrl} pixel format is not yuv420p`);
        const encodedWidth = variant.width + (variant.width % 2);
        const encodedHeight = variant.height + (variant.height % 2);
        if (stream?.width !== encodedWidth || stream?.height !== encodedHeight) {
          issues.push(`${mediaUrl} dimensions do not match codec-safe ${encodedWidth}x${encodedHeight}`);
        }
        if (!Number.isFinite(duration) || Math.abs(duration - transition.duration) > 0.08) {
          issues.push(`${mediaUrl} duration ${duration} does not match ${transition.duration}s`);
        }
        verified += 1;
      }
    }
  }
  return { issues, verified, pending };
}

async function verify(manifest) {
  const issues = validateManifest(manifest);
  const generatedTypes = await readFile(generatedTypesPath, "utf8");
  if (!generatedTypes.startsWith("/* AUTO-GENERATED by scripts/render-master-shots.py")) {
    issues.push("three/scene/plateManifest.ts is not generator-owned");
  }
  const media = await verifyMedia(manifest);
  issues.push(...media.issues);
  if (issues.length > 0) {
    console.error(`Master-shot verification failed (${issues.length} issues):`);
    issues.forEach((issue) => console.error(`  - ${issue}`));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Master-shot contract verified: 2 profiles, 12 endpoints, 10 forward/reverse paths; ${media.verified} media files checked, ${media.pending} intentionally pending.`,
  );
}

const args = parseArgs(process.argv.slice(2));
const manifest = await loadManifest();
if (args.encode) await encode(manifest, args);
if (args.verify) await verify(manifest);
