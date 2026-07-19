#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { PerspectiveCamera, Quaternion, Vector2, Vector3 } from "three";

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(path.join(root, "public/room/manifest.json"), "utf8"),
);
const stageSource = readFileSync(
  path.join(root, "three/scene/Stage.tsx"),
  "utf8",
);
const compositorSource = readFileSync(
  path.join(root, "components/room/PlateCompositor.tsx"),
  "utf8",
);
const heroCompositorSource = readFileSync(
  path.join(root, "components/room/PlateHeroComposite.tsx"),
  "utf8",
);
const navigationSource = readFileSync(
  path.join(root, "components/site/AttentionNavigation.tsx"),
  "utf8",
);
const plateAssetsSource = readFileSync(
  path.join(root, "lib/plateAssets.ts"),
  "utf8",
);
const rendererSource = readFileSync(
  path.join(root, "scripts/render-master-shots.py"),
  "utf8",
);
const referenceGeneratorSource = readFileSync(
  path.join(root, "scripts/generate-hero-presented-references.mjs"),
  "utf8",
);
const lifecycleVerifierSource = readFileSync(
  path.join(root, "scripts/verify-hero-lifecycle.mjs"),
  "utf8",
);

const failures = [];

function check(name, callback) {
  try {
    const result = callback();
    if (result instanceof Promise) {
      return result
        .then((detail) =>
          console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`),
        )
        .catch((error) => {
          failures.push(`${name}: ${error.message}`);
          console.error(`FAIL ${name}: ${error.message}`);
        });
    }
    console.log(`PASS ${name}${result ? `: ${result}` : ""}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function quaternionAngle(left, right) {
  const a = new Quaternion(...left).normalize();
  const b = new Quaternion(...right).normalize();
  return 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));
}

function distance(left, right) {
  return new Vector3(...left).distanceTo(new Vector3(...right));
}

function cumulativeProgress(frames, metric) {
  const steps = frames
    .slice(1)
    .map((frame, index) => metric(frames[index].camera, frame.camera));
  const total = steps.reduce((sum, value) => sum + value, 0);
  let cumulative = 0;
  return [0, ...steps.map((value) => (cumulative += value) / total)];
}

function cameraAxisValues(frames, axis) {
  return frames.map(({ camera }) => camera.position[axis]);
}

function assertMonotonic(values, direction, label) {
  const tolerance = 1e-5;
  for (let index = 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    if (direction === "decreasing") {
      assert.ok(
        delta <= tolerance,
        `${label} reverses by ${delta.toFixed(5)} at frame ${index}`,
      );
    } else {
      assert.ok(
        delta >= -tolerance,
        `${label} reverses by ${delta.toFixed(5)} at frame ${index}`,
      );
    }
  }
}

function projectNotebook(cameraSample, worldQuad, width, height) {
  const camera = new PerspectiveCamera(
    cameraSample.fov,
    width / height,
    0.1,
    200,
  );
  camera.position.set(...cameraSample.position);
  camera.quaternion.set(...cameraSample.quaternion);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return worldQuad.map((point) => {
    const projected = new Vector3(...point).project(camera);
    return new Vector2(
      (projected.x * 0.5 + 0.5) * width,
      (-projected.y * 0.5 + 0.5) * height,
    );
  });
}

function horizontalAngleDegrees(start, end) {
  const delta = end.clone().sub(start);
  const angle = Math.abs((Math.atan2(delta.y, delta.x) * 180) / Math.PI);
  return Math.min(angle, Math.abs(180 - angle));
}

function deskPlaneGazeHit(cameraSample, deskHeight = 0.92) {
  const position = new Vector3(...cameraSample.position);
  const forward = new Vector3(0, 0, -1).applyQuaternion(
    new Quaternion(...cameraSample.quaternion),
  );
  assert.ok(forward.y < -1e-5, "JOURNAL gaze must point down at the desk");
  const distance = (deskHeight - position.y) / forward.y;
  assert.ok(distance > 0, "JOURNAL desk intersection must be in front");
  return position.addScaledVector(forward, distance);
}

check("visitor runtime retires the world-space hero surface", () => {
  assert.doesNotMatch(
    stageSource,
    /<HeroSurface|from\s+"@\/components\/room\/HeroSurface"/,
  );
  assert.doesNotMatch(
    heroCompositorSource,
    /projectionMatrix\s*\*\s*modelViewMatrix\s*\*\s*vec4\(position/,
  );
  assert.match(heroCompositorSource, /gl_Position\s*=\s*vec4\(position\.xy/);
  assert.doesNotMatch(heroCompositorSource, /\buseFrame\b/);
  return "visitor hero is a direct plate-space projection";
});

check("plate compositor owns exact room treatment and soft coverage", () => {
  assert.match(compositorSource, /PlateHeroComposite/);
  assert.match(heroCompositorSource, /heroGain/);
  assert.match(heroCompositorSource, /heroOffset/);
  assert.match(heroCompositorSource, /displayLut/);
  assert.match(heroCompositorSource, /heroCoverage/);
  assert.match(heroCompositorSource, /hero\.rgb\s*\*\s*gain\s*\+\s*offset/);
  assert.match(heroCompositorSource, /WebGLRenderTarget/);
  assert.match(heroCompositorSource, /samples\s*=\s*4/);
  assert.equal(
    manifest.hero.liveProjection,
    "plate-space-reciprocal-depth-projective",
  );
  assert.equal(manifest.hero.compositor, "plate-space-affine-soft-coverage");
  assert.equal(manifest.hero.occlusion, "authored-msaa-coverage");
  assert.equal(
    manifest.hero.treatment.kind,
    "scene-linear-blender-agx-lut-room-response",
  );
  assert.equal(manifest.hero.geometry.runtimeRole, "offscreen-coverage-only");
  assert.match(rendererSource, /hero-room-gain\.png/);
  assert.match(rendererSource, /hero-room-offset\.png/);
  assert.match(rendererSource, /hero-blender-agx-lut\.png/);
  assert.doesNotMatch(lifecycleVerifierSource, /calibrated-room-transfer/);
  assert.doesNotMatch(lifecycleVerifierSource, /authored-depth-geometry/);
  assert.match(
    lifecycleVerifierSource,
    /scene-linear-blender-agx-lut-room-response/,
  );
  assert.match(lifecycleVerifierSource, /authored-msaa-coverage/);
  return "scene-linear response + Blender display LUT + authored soft coverage";
});

check(
  "mid-video route references use the R5 shader-equivalent treatment",
  () => {
    assert.doesNotMatch(
      referenceGeneratorSource,
      /hero-room-treatment\.png/,
      "reference author cannot use the retired additive treatment",
    );
    assert.match(referenceGeneratorSource, /hero-room-gain\.png/);
    assert.match(referenceGeneratorSource, /hero-room-offset\.png/);
    assert.match(referenceGeneratorSource, /hero-blender-agx-lut\.png/);
    assert.match(referenceGeneratorSource, /sampleDisplayLut/);
    assert.match(referenceGeneratorSource, /objectPosition/);
    return "gain + offset + Blender LUT + profile crop";
  },
);

for (const [profile, variant] of Object.entries(manifest.variants)) {
  check(
    `${profile} uses one generated plate crop across runtime layers`,
    () => {
      const expected = profile === "portrait" ? "52% 50%" : "50% 50%";
      assert.equal(variant.objectPosition, expected);
      assert.match(plateAssetsSource, /profile\.objectPosition/);
      assert.match(
        navigationSource,
        /mapPlateQuad\([\s\S]*parsePlateObjectPosition\(profile\.objectPosition\)/,
      );
      assert.match(heroCompositorSource, /mapPlateQuad\([\s\S]*objectPosition/);
      return expected;
    },
  );

  check(`${profile} JOURNAL uses one coupled body curve`, () => {
    const frames = variant.transitions["desk-journal"].frames;
    const translation = cumulativeProgress(frames, (left, right) =>
      distance(left.position, right.position),
    );
    const rotation = cumulativeProgress(frames, (left, right) =>
      quaternionAngle(left.quaternion, right.quaternion),
    );
    const maximumPhaseError = Math.max(
      ...translation.map((value, index) => Math.abs(value - rotation[index])),
    );
    assert.ok(
      maximumPhaseError <= 0.12,
      `translation/rotation phase error ${maximumPhaseError.toFixed(4)} exceeds 0.12`,
    );
    assertMonotonic(
      cameraAxisValues(frames, 1),
      "decreasing",
      `${profile} JOURNAL eye height`,
    );
    assertMonotonic(
      cameraAxisValues(frames, 2),
      "decreasing",
      `${profile} JOURNAL forward travel`,
    );
    const gazeHits = frames.map(({ camera }) => deskPlaneGazeHit(camera));
    const maximumGazeZ = Math.max(...gazeHits.map(({ z }) => z));
    assert.ok(
      maximumGazeZ <= 0.25,
      `${profile} JOURNAL gaze reaches ${maximumGazeZ.toFixed(3)}m past the readable work area`,
    );
    assert.doesNotMatch(
      rendererSource,
      /JOURNAL_TARGET_LEAD_POWERS|target_raw_t|gaze_progress|body_progress\s*\*\s*2/,
      "JOURNAL gaze cannot finish before the shared body progress",
    );
    return `maximum phase error ${maximumPhaseError.toFixed(4)}; gaze z<=${maximumGazeZ.toFixed(3)}m`;
  });

  check(`${profile} JOURNAL settles into a front-readable downward POV`, () => {
    const camera = variant.endpoints.journal.projection.camera;
    const notebook = variant.journal.notebookWorldQuad;
    const projected = projectNotebook(
      camera,
      notebook,
      variant.width,
      variant.height,
    );
    const baselineAngle = horizontalAngleDegrees(projected[0], projected[1]);
    const minimumEyeHeight = profile === "wide" ? 1.24 : 1.28;
    assert.ok(
      camera.position[1] >= minimumEyeHeight,
      `eye height ${camera.position[1].toFixed(3)}m is below ${minimumEyeHeight}m`,
    );
    assert.ok(
      baselineAngle <= 8,
      `notebook baseline ${baselineAngle.toFixed(2)} degrees exceeds 8 degrees`,
    );
    return `${camera.position[1].toFixed(3)}m eye; ${baselineAngle.toFixed(2)}deg baseline`;
  });
}

async function rgb(pathname, region = null, edge = false) {
  let image = sharp(pathname).removeAlpha().toColourspace("srgb");
  if (region) image = image.extract(region);
  if (edge) {
    image = image.greyscale().convolve({
      width: 3,
      height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
    });
  }
  const { data, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function meanAbsoluteError(left, right) {
  assert.equal(left.width, right.width, "pixel widths differ");
  assert.equal(left.height, right.height, "pixel heights differ");
  assert.equal(left.data.length, right.data.length, "pixel lengths differ");
  let total = 0;
  for (let index = 0; index < left.data.length; index += 1) {
    total += Math.abs(left.data[index] - right.data[index]);
  }
  return total / left.data.length;
}

function shiftedHorizontal(image, pixels) {
  const channels = image.data.length / (image.width * image.height);
  const shifted = Buffer.alloc(image.data.length);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sourceX = Math.max(0, Math.min(image.width - 1, x - pixels));
      const sourceOffset = (y * image.width + sourceX) * channels;
      const targetOffset = (y * image.width + x) * channels;
      image.data.copy(
        shifted,
        targetOffset,
        sourceOffset,
        sourceOffset + channels,
      );
    }
  }
  return { ...image, data: shifted };
}

async function decodeFrame(source, output, last = false) {
  const args = ["-hide_banner", "-loglevel", "error"];
  if (last) args.push("-sseof", "-0.04");
  args.push("-i", source, "-frames:v", "1", "-update", "1", output, "-y");
  execFileSync("ffmpeg", args);
}

await check(
  "delivered lamp pose is continuous across every desk handoff",
  async () => {
    const temporary = await mkdtemp(path.join(tmpdir(), "lazy-a-r5-"));
    try {
      const errors = [];
      for (const profile of ["wide", "portrait"]) {
        const deskPath = path.join(
          root,
          `public/room/${profile}/stills/desk.jpg`,
        );
        const metadata = await sharp(deskPath).metadata();
        const lampRegion = {
          left: Math.round(metadata.width * 0.04),
          top: Math.round(metadata.height * 0.16),
          width: Math.round(metadata.width * 0.24),
          height: Math.round(metadata.height * 0.5),
        };
        const desk = await rgb(deskPath, lampRegion, true);
        const negativeControl = meanAbsoluteError(
          desk,
          shiftedHorizontal(desk, Math.max(8, Math.round(desk.width * 0.04))),
        );
        assert.ok(
          negativeControl > 3.5,
          `${profile} shifted-lamp negative control did not exceed the continuity threshold`,
        );
        for (const destination of ["films", "journal", "contact", "about"]) {
          const outbound = path.join(
            root,
            `public/room/${profile}/transitions/desk-${destination}.mp4`,
          );
          const inbound = path.join(
            root,
            `public/room/${profile}/transitions/${destination}-desk.mp4`,
          );
          const first = path.join(
            temporary,
            `${profile}-${destination}-first.png`,
          );
          const last = path.join(
            temporary,
            `${profile}-${destination}-last.png`,
          );
          await decodeFrame(outbound, first);
          await decodeFrame(inbound, last, true);
          const firstEdges = await rgb(first, lampRegion, true);
          const lastEdges = await rgb(last, lampRegion, true);
          errors.push({
            id: `${profile}/desk-${destination}:0`,
            error: meanAbsoluteError(desk, firstEdges),
          });
          errors.push({
            id: `${profile}/${destination}-desk:last`,
            error: meanAbsoluteError(desk, lastEdges),
          });
          errors.push({
            id: `${profile}/${destination}:forward-reverse`,
            error: meanAbsoluteError(
              await rgb(first, lampRegion),
              await rgb(last, lampRegion),
            ),
            threshold: 1.5,
          });
        }
      }
      const worst = errors
        .map((entry) => ({
          ...entry,
          threshold: entry.threshold ?? 3.5,
          ratio: entry.error / (entry.threshold ?? 3.5),
        }))
        .sort((left, right) => right.ratio - left.ratio)[0];
      assert.ok(
        worst.error <= worst.threshold,
        `${worst.id} delivered-pixel MAE ${worst.error.toFixed(3)} exceeds ${worst.threshold}`,
      );
      return `worst normalized error ${worst.ratio.toFixed(3)} at ${worst.id}`;
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  },
);

if (failures.length) {
  console.error(`\n${failures.length} R5 continuity check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nR5 delivered-pixel continuity checks passed.");
}
