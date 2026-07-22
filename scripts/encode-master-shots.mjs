#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = resolve(repositoryRoot, "public/room/manifest.json");
const generatedTypesPath = resolve(
  repositoryRoot,
  "three/scene/plateManifest.ts",
);
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
const minimumPortraitLabelWidth = 55;
const minimumPortraitLabelHeight = 12;
const minimumPortraitSheetHeight = 70;
const expectedContactCopy = [
  "Jonathan Adelson",
  "JonathanAdelson1@gmail.com",
  "1-310-709-9283",
].join("\n");
const expectedContactIndentDepth = 0.0003;
const contactActivationSamples = 31;
const practicalAuthoringManifest =
  "/room/contact/practical-light-authoring-manifest.json";
const practicalAuthoringGenerator = "blender-background-python";
const practicalMasterBlend = "build/wo-0117-r/master.blend";
const practicalRenderScript = "scripts/render-master-shots.py";
const practicalBulbObject = "ContactPracticalBulb";
const practicalShadeObject = "ContactPracticalShadeInterior";
const practicalDeskObject = "Mesh_26";
const practicalContactPaperObject = "Mesh_56";
const widePracticalRelationship = "visible-practical-source-v1";
const portraitPracticalRelationship = "offscreen-practical-light-pool-v1";
const portraitPoolDerivation = "blender-shade-cone-receiver-render-v1";
const maximumPracticalAuthoringBytes = 256 * 1024;
const practicalViewports = {
  wide: [1280, 720],
  portrait: [375, 812],
};
const maximumJournalBaselineRotationDegrees = 12;
const minimumJournalEndpointCoverage = 0.4;
const maximumJournalEndpointCoverage = 0.6;
const maximumJournalAngularStepDegrees = 3;
const maximumOrientationOnlyPlateauSteps = 0;
const cameraPositionEpsilon = 1e-7;
const cameraAngleEpsilonDegrees = 1e-5;
const declaredMetricTolerance = 1e-6;
const presentedFrameEvent = "lazy-a:compositor-frame-presented";
const presentedPixelReferences =
  "/room/hero/hero-presented-pixel-references.json";
const presentedPixelAuthoringManifest =
  "/room/hero/hero-presented-authoring-manifest.json";
const presentedPixelReferenceKind = "authored-presented-pixels-v1";
const presentedPixelRegionEncoding = "rgb-poster-foreground-treatment";
const approvedR3ContactPathSha256 = {
  wide: "f9432c37d2e081d41d9e745ffe6dc8807f8e0255dec6f9701a130d0706aba375",
  portrait: "496a618f0a311cdf52717a7376387da075c173639899ff88af4361b3df48054c",
};
const approvedR3EndpointCameras = {
  wide: {
    opening: {
      position: [-0.600000023842, 1.600000023842, 4.900000095367],
      quaternion: [
        -0.068154491484, -0.065739862621, -0.004500729963, 0.995496332645,
      ],
      fov: 35,
    },
    desk: {
      position: [0.050000000745, 1.600000023842, 1.450000047684],
      quaternion: [
        -0.142799422145, 0.007813094184, 0.001127292984, 0.989720225334,
      ],
      fov: 35,
    },
    films: {
      position: [0.050000000745, 1.600000023842, 1.450000047684],
      quaternion: [
        -0.082423180342, -0.127863273025, -0.010663641617, 0.988303422928,
      ],
      fov: 35,
    },
    contact: {
      position: [-0.449999988079, 1.580000042915, 0.319999992847],
      quaternion: [
        -0.528137803078, 0.012861071154, 0.008000271395, 0.849023580551,
      ],
      fov: 35,
    },
  },
  portrait: {
    opening: {
      position: [-0.600000023842, 1.600000023842, 4.900000095367],
      quaternion: [
        -0.068154491484, -0.065739862621, -0.004500729963, 0.995496332645,
      ],
      fov: 35,
    },
    desk: {
      position: [0.299162566662, 1.600000023842, 2.349999904633],
      quaternion: [
        -0.098435617983, -0.020484184846, -0.002026646631, 0.994930505753,
      ],
      fov: 35,
    },
    films: {
      position: [0.299162566662, 1.600000023842, 2.349999904633],
      quaternion: [
        -0.058334533125, -0.044582102448, -0.002607719041, 0.99729770422,
      ],
      fov: 35,
    },
    contact: {
      position: [-0.40000000596, 2.25, 0.850000023842],
      quaternion: [
        -0.476842790842, 0.020944772288, 0.011366510764, 0.87866550684,
      ],
      fov: 35,
    },
  },
};
const decodedSampleSize = 64;
const maximumDecodedMeanError = 8;
const minimumDecodedMotion = 0.5;
const generatedManifestMarker = "const generatedPlateManifest = ";
const generatedManifestTerminator = " as const;";

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

function firstSemanticDifference(expected, actual, path = "$") {
  if (Object.is(expected, actual)) return null;
  if (
    typeof expected !== typeof actual ||
    expected === null ||
    actual === null
  ) {
    return path;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (
      !Array.isArray(expected) ||
      !Array.isArray(actual) ||
      expected.length !== actual.length
    ) {
      return `${path}.length`;
    }
    for (let index = 0; index < expected.length; index += 1) {
      const difference = firstSemanticDifference(
        expected[index],
        actual[index],
        `${path}[${index}]`,
      );
      if (difference) return difference;
    }
    return null;
  }
  if (typeof expected === "object") {
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();
    if (expectedKeys.length !== actualKeys.length) return `${path} keys`;
    for (let index = 0; index < expectedKeys.length; index += 1) {
      if (expectedKeys[index] !== actualKeys[index])
        return `${path}.${expectedKeys[index] ?? actualKeys[index]}`;
    }
    for (const key of expectedKeys) {
      const difference = firstSemanticDifference(
        expected[key],
        actual[key],
        `${path}.${key}`,
      );
      if (difference) return difference;
    }
    return null;
  }
  return path;
}

function generatedManifestIssues(manifest, generatedSource) {
  const issues = [];
  if (
    !generatedSource.startsWith(
      "/* AUTO-GENERATED by scripts/render-master-shots.py",
    )
  ) {
    issues.push("three/scene/plateManifest.ts is not generator-owned");
  }
  const start = generatedSource.indexOf(generatedManifestMarker);
  const end =
    start < 0
      ? -1
      : generatedSource.indexOf(
          generatedManifestTerminator,
          start + generatedManifestMarker.length,
        );
  if (start < 0 || end < 0) {
    issues.push(
      "three/scene/plateManifest.ts does not contain the generated plateManifest payload",
    );
    return issues;
  }
  let embedded;
  try {
    embedded = JSON.parse(
      generatedSource.slice(start + generatedManifestMarker.length, end),
    );
  } catch (error) {
    issues.push(
      `three/scene/plateManifest.ts payload is not valid JSON: ${error.message}`,
    );
    return issues;
  }
  const difference = firstSemanticDifference(manifest, embedded);
  if (difference) {
    issues.push(
      `three/scene/plateManifest.ts payload differs from public/room/manifest.json at ${difference}`,
    );
  }
  return issues;
}

function meanAbsoluteError(left, right) {
  if (
    !Buffer.isBuffer(left) ||
    !Buffer.isBuffer(right) ||
    left.length !== right.length ||
    left.length === 0
  ) {
    return Number.POSITIVE_INFINITY;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference += Math.abs(left[index] - right[index]);
  }
  return difference / left.length;
}

function decodedRelationshipIssues(
  label,
  sourceSamples,
  forwardSamples,
  reverseSamples,
  reverseSourceSamples = [...sourceSamples].reverse(),
) {
  const issues = [];
  const sampleNames = ["first", "middle", "last"];
  for (const [kind, samples] of [
    ["source", sourceSamples],
    ["forward", forwardSamples],
    ["reverse", reverseSamples],
    ["reverse source", reverseSourceSamples],
  ]) {
    if (!Array.isArray(samples) || samples.length !== sampleNames.length) {
      issues.push(`${label} ${kind} did not decode first/middle/last samples`);
    }
  }
  if (issues.length > 0) return issues;

  for (let index = 0; index < sampleNames.length; index += 1) {
    const forwardError = meanAbsoluteError(
      sourceSamples[index],
      forwardSamples[index],
    );
    if (forwardError > maximumDecodedMeanError) {
      issues.push(
        `${label} forward ${sampleNames[index]} differs from source (mean error ${forwardError.toFixed(2)})`,
      );
    }
    const reverseError = meanAbsoluteError(
      reverseSourceSamples[index],
      reverseSamples[index],
    );
    if (reverseError > maximumDecodedMeanError) {
      issues.push(
        `${label} reverse ${sampleNames[index]} does not map back to source (mean error ${reverseError.toFixed(2)})`,
      );
    }
  }

  if (
    meanAbsoluteError(sourceSamples[0], sourceSamples[1]) <
      minimumDecodedMotion &&
    meanAbsoluteError(sourceSamples[1], sourceSamples[2]) < minimumDecodedMotion
  ) {
    issues.push(
      `${label} source first/middle/last samples are static or duplicated`,
    );
  }
  if (
    meanAbsoluteError(forwardSamples[0], forwardSamples[1]) <
      minimumDecodedMotion &&
    meanAbsoluteError(forwardSamples[1], forwardSamples[2]) <
      minimumDecodedMotion
  ) {
    issues.push(
      `${label} forward first/middle/last samples are static or duplicated`,
    );
  }
  return issues;
}

function decodedEndpointIssues(label, endpointSample, references) {
  if (!Buffer.isBuffer(endpointSample) || references.length === 0) {
    return [`${label} has no decoded source-frame relationship`];
  }
  return references.flatMap(({ source, sample }) => {
    const error = meanAbsoluteError(sample, endpointSample);
    return error > maximumDecodedMeanError
      ? [`${label} differs from ${source} (mean error ${error.toFixed(2)})`]
      : [];
  });
}

function generatedManifestSource(payload) {
  return [
    "/* AUTO-GENERATED by scripts/render-master-shots.py. Do not hand-edit camera data. */",
    `const generatedPlateManifest = ${JSON.stringify(payload)} as const;`,
    "export const plateManifest = generatedPlateManifest;",
  ].join("\n");
}

async function runSelfTests() {
  const manifest = {
    version: 1,
    variants: { wide: { width: 1280, nested: { value: "current" } } },
  };
  assert.deepEqual(
    generatedManifestIssues(manifest, generatedManifestSource(manifest)),
    [],
    "matching embedded manifest payload should pass",
  );

  const staleManifest = structuredClone(manifest);
  staleManifest.variants.wide.nested.value = "stale";
  assert.match(
    generatedManifestIssues(
      manifest,
      generatedManifestSource(staleManifest),
    ).join("\n"),
    /variants\.wide\.nested\.value/,
    "nested semantic drift should report its path",
  );

  const sourceSamples = [
    Buffer.from([0, 4, 8, 12]),
    Buffer.from([40, 44, 48, 52]),
    Buffer.from([80, 84, 88, 92]),
  ];
  const forwardSamples = sourceSamples.map((sample) =>
    Buffer.from(sample.map((value) => value + 1)),
  );
  const reverseSamples = [...forwardSamples].reverse();
  assert.deepEqual(
    decodedRelationshipIssues(
      "fixture/transition",
      sourceSamples,
      forwardSamples,
      reverseSamples,
    ),
    [],
    "forward and reverse samples matching the source sequence should pass",
  );

  const stubSamples = sourceSamples.map(() => Buffer.from(sourceSamples[0]));
  assert.match(
    decodedRelationshipIssues(
      "fixture/transition",
      sourceSamples,
      stubSamples,
      stubSamples,
    ).join("\n"),
    /middle|last/,
    "a static stub clip should fail sampled source relationships",
  );

  const clippedJournalMetrics = projectedJournalEndpointMetrics(
    { width: 100, height: 100 },
    {
      position: [0, 0, 0],
      quaternion: [0, 0, 0, 1],
      fov: 90,
    },
    [
      [-2, 2, -1],
      [2, 2, -1],
      [2, -2, -1],
      [-2, -2, -1],
    ],
  );
  assert.ok(
    Math.abs(clippedJournalMetrics.endpointCoverage - 1) <= 1e-9,
    `projected JOURNAL coverage must clip to the viewport; got ${clippedJournalMetrics.endpointCoverage}`,
  );
  const endpointMetrics = {
    endpointBaselineRotationDegrees: 6,
    endpointCoverage: 0.5,
  };
  const declaredEndpoint = { ...endpointMetrics };
  assert.deepEqual(
    journalDeclaredEndpointIssues(declaredEndpoint, endpointMetrics),
    [],
    "sample-matched JOURNAL endpoint declarations should pass",
  );
  assert.match(
    journalDeclaredEndpointIssues({}, endpointMetrics).join("\n"),
    /endpointBaselineRotationDegrees[\s\S]*endpointCoverage/,
    "missing JOURNAL endpoint declarations must fail",
  );
  assert.match(
    journalDeclaredEndpointIssues(
      {
        endpointBaselineRotationDegrees: 5,
        endpointCoverage: 0.55,
      },
      endpointMetrics,
    ).join("\n"),
    /projected/,
    "fabricated JOURNAL endpoint declarations must fail projected parity",
  );
  assert.match(
    journalDeclaredEndpointIssues(
      {
        endpointBaselineRotationDegrees: 13,
        endpointCoverage: 0.7,
      },
      {
        endpointBaselineRotationDegrees: 13,
        endpointCoverage: 0.7,
      },
    ).join("\n"),
    /<=12[\s\S]*0\.4\.\.0\.6/,
    "out-of-range JOURNAL endpoint declarations must fail",
  );

  const yawQuaternion = (degrees) => {
    const radians = (degrees * Math.PI) / 180;
    return [0, Math.sin(radians / 2), 0, Math.cos(radians / 2)];
  };
  const physicalNotebookWorldQuad = [
    [-0.7, 0.5, 0],
    [0.7, 0.5, 0],
    [0.7, -0.5, 0],
    [-0.7, -0.5, 0],
  ];
  const readableApproachFrames = Array.from({ length: 24 }, (_, index) => {
    const progress = index / 23;
    const position = [0, 0, 2 - 1.2 * progress];
    const camera = new PerspectiveCamera(90, 1, 0.1, 200);
    camera.position.set(...position);
    camera.lookAt(1 - progress, 0, 0);
    return {
      camera: {
        position,
        quaternion: camera.quaternion.toArray(),
        fov: 90,
      },
    };
  });
  const readingHalfStart = Math.ceil((readableApproachFrames.length - 1) / 2);
  assert.equal(
    journalGazeHitsNotebook(
      readableApproachFrames[0].camera,
      physicalNotebookWorldQuad,
    ),
    false,
    "the readable JOURNAL fixture must miss during approach",
  );
  assert.deepEqual(
    journalMotionIssues(readableApproachFrames),
    [],
    "the readable JOURNAL fixture must begin coupled and stay below 3 degree steps",
  );
  const readableEndpointMetrics = projectedJournalEndpointMetrics(
    { width: 100, height: 100 },
    readableApproachFrames.at(-1).camera,
    physicalNotebookWorldQuad,
  );
  assert.deepEqual(
    journalDeclaredEndpointIssues(
      readableEndpointMetrics,
      readableEndpointMetrics,
    ),
    [],
    "the readable JOURNAL fixture endpoint must pass",
  );
  assert.deepEqual(
    journalReadingSightlineIssues(
      readableApproachFrames,
      physicalNotebookWorldQuad,
      physicalNotebookWorldQuad,
    ),
    [],
    "a coupled JOURNAL approach may miss early and must pass once every reading-half sample hits",
  );
  const lateLockFrames = structuredClone(readableApproachFrames);
  lateLockFrames[readingHalfStart].camera = readableApproachFrames[0].camera;
  assert.match(
    journalReadingSightlineIssues(
      lateLockFrames,
      physicalNotebookWorldQuad,
      physicalNotebookWorldQuad,
    ).join("\n"),
    /missed authored frame 12 \(reading half starts at 12\)/,
    "a JOURNAL path that locks after the reading half must fail",
  );
  const fabricatedNotebookWorldQuad = physicalNotebookWorldQuad.map(
    ([x, y, z]) => [x + 1, y, z],
  );
  assert.match(
    journalReadingSightlineIssues(
      readableApproachFrames,
      physicalNotebookWorldQuad,
      fabricatedNotebookWorldQuad,
    ).join("\n"),
    /declared notebookWorldQuad/,
    "a fabricated JOURNAL notebookWorldQuad must fail",
  );
  const unreadableEndpointMetrics = projectedJournalEndpointMetrics(
    { width: 100, height: 100 },
    readableApproachFrames[0].camera,
    physicalNotebookWorldQuad,
  );
  assert.match(
    journalDeclaredEndpointIssues(
      unreadableEndpointMetrics,
      unreadableEndpointMetrics,
    ).join("\n"),
    /endpointCoverage/,
    "an unreadable JOURNAL endpoint must fail",
  );
  const coupledFrames = Array.from({ length: 6 }, (_, index) => ({
    camera: {
      position: [0, -index * 0.01, -index * 0.02],
      quaternion: yawQuaternion(index),
      fov: 35,
    },
  }));
  assert.deepEqual(
    journalMotionIssues(coupledFrames),
    [],
    "continuously coupled JOURNAL samples should pass",
  );
  const coupledMetrics = journalMotionMetrics(coupledFrames);
  const declaredMotion = {
    fps: 30,
    journalHeadLeadSeconds: 0,
    translationStartsAtSeconds: coupledMetrics.firstTranslationFrame / 30,
    motionModel: "coupled-hip-pivot",
    maxAngularStepDegrees: coupledMetrics.maxAngularStepDegrees,
  };
  assert.deepEqual(
    journalDeclaredMotionIssues(declaredMotion, coupledMetrics),
    [],
    "sample-matched JOURNAL scalar declarations should pass",
  );
  assert.match(
    journalDeclaredMotionIssues(
      {
        ...declaredMotion,
        translationStartsAtSeconds: 0,
        maxAngularStepDegrees: 0.1,
      },
      coupledMetrics,
    ).join("\n"),
    /derived/,
    "fabricated JOURNAL scalar values must fail sample parity",
  );
  const discontinuityFrames = structuredClone(coupledFrames);
  discontinuityFrames[3].camera.quaternion = yawQuaternion(12);
  assert.match(
    journalMotionIssues(discontinuityFrames).join("\n"),
    /angular step/,
    "an angular discontinuity must fail from actual camera samples",
  );
  const stagedFrames = Array.from({ length: 7 }, (_, index) => ({
    camera: {
      position: index < 4 ? [0, 0, 0] : [0, 0, -(index - 3) * 0.02],
      quaternion: yawQuaternion(index),
      fov: 35,
    },
  }));
  assert.match(
    journalMotionIssues(stagedFrames).join("\n"),
    /coupled|orientation-only/,
    "staged head-then-body motion must fail from actual camera samples",
  );

  const fixtureHash = (label) =>
    createHash("sha256").update(label).digest("hex");
  const practicalSources = {
    masterBlend: {
      path: practicalMasterBlend,
      sha256: fixtureHash("master-blend"),
    },
    renderScript: {
      path: practicalRenderScript,
      sha256: fixtureHash("render-script"),
    },
  };
  const practicalGeometry = {
    bulb: {
      object: practicalBulbObject,
      geometrySha256: fixtureHash("bulb-geometry"),
    },
    shadeInterior: {
      object: practicalShadeObject,
      geometrySha256: fixtureHash("shade-geometry"),
    },
    desk: {
      object: "Mesh_26",
      geometrySha256: fixtureHash("desk-geometry"),
      worldQuad: [
        [-1, -1, 0],
        [1, -1, 0],
        [1, 1, 0],
        [-1, 1, 0],
      ],
    },
    contactPaper: {
      object: "Mesh_56",
      geometrySha256: fixtureHash("contact-paper-geometry"),
      worldQuad: [
        [-0.2, -0.2, 0.01],
        [0.2, -0.2, 0.01],
        [0.2, 0.2, 0.01],
        [-0.2, 0.2, 0.01],
      ],
    },
  };
  const lightSourcePayload = {
    relationship: "shade-origin-ray-v1",
    lampObject: "scan_lamp",
    shadeOpening: [0, 0, 1],
    shadeOpeningRadius: 0.1,
    shadeAxis: [0, 0, -1],
    origin: [0, 0, 0.98],
    direction: [0, 0, -1],
    target: [0, 0, 0.01],
    axisErrorDegrees: 0,
    spotAngleDegrees: 70,
  };
  const lightSource = {
    ...lightSourcePayload,
    relationshipSha256: sha256Canonical({
      sources: practicalSources,
      receiverGeometry: {
        desk: practicalGeometry.desk,
        contactPaper: practicalGeometry.contactPaper,
      },
      lightSource: lightSourcePayload,
    }),
  };
  const wideProjection = {
    kind: "visible-practical-source-v1",
    viewport: practicalViewports.wide,
    deskCameraSha256: sha256Canonical(approvedR3EndpointCameras.wide.desk),
    lightSourceRelationshipSha256: lightSource.relationshipSha256,
    bulb: {
      ...practicalGeometry.bulb,
      quad: [0.1, 0.1, 0.2, 0.1, 0.2, 0.2, 0.1, 0.2],
      mask: {
        path: "wide-bulb-mask.png",
        sha256: fixtureHash("wide-bulb-mask"),
      },
    },
    shadeInterior: {
      ...practicalGeometry.shadeInterior,
      quad: [0.3, 0.1, 0.5, 0.1, 0.5, 0.25, 0.3, 0.25],
      mask: {
        path: "wide-shade-interior-mask.png",
        sha256: fixtureHash("wide-shade-mask"),
      },
    },
  };
  const receiverGeometrySha256 = sha256Canonical({
    desk: practicalGeometry.desk.geometrySha256,
    contactPaper: practicalGeometry.contactPaper.geometrySha256,
  });
  const portraitProjection = {
    kind: "offscreen-practical-light-pool-v1",
    viewport: practicalViewports.portrait,
    deskCameraSha256: sha256Canonical(approvedR3EndpointCameras.portrait.desk),
    lightSourceRelationshipSha256: lightSource.relationshipSha256,
    receivers: {
      deskGeometrySha256: practicalGeometry.desk.geometrySha256,
      contactPaperGeometrySha256: practicalGeometry.contactPaper.geometrySha256,
      receiverGeometrySha256,
    },
    lightPool: {
      derivation: "blender-shade-cone-receiver-render-v1",
      runtimeAuthored: false,
      lightSourceRelationshipSha256: lightSource.relationshipSha256,
      receiverGeometrySha256,
      quad: [0.1, 0.3, 0.8, 0.3, 0.8, 0.8, 0.1, 0.8],
      mask: {
        path: "portrait-desk-paper-light-pool-mask.png",
        sha256: fixtureHash("portrait-light-pool-mask"),
      },
    },
  };
  const practicalProfiles = {
    wide: {
      ...wideProjection,
      projectionSha256: sha256Canonical(wideProjection),
    },
    portrait: {
      ...portraitProjection,
      projectionSha256: sha256Canonical(portraitProjection),
    },
  };
  const practicalAuthoring = {
    version: 2,
    immutable: true,
    generator: {
      identity: practicalAuthoringGenerator,
      browserRuntime: false,
    },
    sources: practicalSources,
    geometry: practicalGeometry,
    lightSource,
    profiles: practicalProfiles,
  };
  assert.deepEqual(practicalAuthoringContractIssues(practicalAuthoring), []);
  const mismatchedGeometry = structuredClone(practicalAuthoring);
  mismatchedGeometry.profiles.wide.bulb.geometrySha256 =
    fixtureHash("wrong-geometry");
  assert.match(
    practicalAuthoringContractIssues(mismatchedGeometry).join("\n"),
    /geometry/,
    "encoder parity must reject mismatched source geometry",
  );
  const missingPortrait = structuredClone(practicalAuthoring);
  delete missingPortrait.profiles.portrait;
  assert.match(
    practicalAuthoringContractIssues(missingPortrait).join("\n"),
    /portrait/,
    "encoder parity must reject missing portrait practical evidence",
  );
  const runtimeMask = structuredClone(practicalAuthoring);
  runtimeMask.profiles.portrait.lightPool.runtimeAuthored = true;
  assert.match(
    practicalAuthoringContractIssues(runtimeMask).join("\n"),
    /runtime-authored/,
    "encoder parity must reject a runtime-authored portrait pool mask",
  );
  const wrongSourceHash = structuredClone(practicalAuthoring);
  wrongSourceHash.sources.masterBlend.sha256 = fixtureHash("wrong-master");
  assert.match(
    practicalAuthoringContractIssues(wrongSourceHash).join("\n"),
    /source relationship/,
    "encoder parity must bind the portrait pool to exact source hashes",
  );

  console.log(
    "encode-master-shots self-tests passed (media parity, reading-half physical sightline, missing/fabricated JOURNAL endpoint declarations, derived motion scalar negatives, unreadable endpoint, and CONTACT geometry/portrait negatives).",
  );
}

function quadPixelWidth(quad, width) {
  if (!finiteTuple(quad, 8)) return 0;
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  return (Math.max(...xs) - Math.min(...xs)) * width;
}

function quadPixelHeight(quad, height) {
  if (!finiteTuple(quad, 8)) return 0;
  const ys = [quad[1], quad[3], quad[5], quad[7]];
  return (Math.max(...ys) - Math.min(...ys)) * height;
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
  return (
    Math.max(...xs) > 0 &&
    Math.min(...xs) < 1 &&
    Math.max(...ys) > 0 &&
    Math.min(...ys) < 1
  );
}

function journalGazeHitsNotebook(camera, notebookWorldQuad) {
  if (
    !finiteTuple(camera?.position, 3) ||
    !finiteTuple(camera?.quaternion, 4) ||
    !Array.isArray(notebookWorldQuad) ||
    notebookWorldQuad.length !== 4 ||
    notebookWorldQuad.some((point) => !finiteTuple(point, 3))
  ) {
    return false;
  }
  const position = new Vector3(...camera.position);
  const direction = new Vector3(0, 0, -1).applyQuaternion(
    new Quaternion(...camera.quaternion),
  );
  const [first, second, third, fourth] = notebookWorldQuad.map(
    (point) => new Vector3(...point),
  );
  const normal = second.clone().sub(first).cross(third.clone().sub(first));
  const denominator = normal.dot(direction);
  if (Math.abs(denominator) <= 1e-6) return false;
  const distance = normal.dot(first.clone().sub(position)) / denominator;
  if (distance <= 0) return false;
  const hit = position.addScaledVector(direction, distance);
  const inTriangle = (a, b, c) => {
    const ab = b.clone().sub(a);
    const ac = c.clone().sub(a);
    const ah = hit.clone().sub(a);
    const dotABAB = ab.dot(ab);
    const dotABAC = ab.dot(ac);
    const dotACAC = ac.dot(ac);
    const dotAHAB = ah.dot(ab);
    const dotAHAC = ah.dot(ac);
    const determinant = dotABAB * dotACAC - dotABAC * dotABAC;
    if (Math.abs(determinant) <= 1e-9) return false;
    const u = (dotACAC * dotAHAB - dotABAC * dotAHAC) / determinant;
    const v = (dotABAB * dotAHAC - dotABAC * dotAHAB) / determinant;
    return u >= -1e-5 && v >= -1e-5 && u + v <= 1 + 1e-5;
  };
  return inTriangle(first, second, third) || inTriangle(first, third, fourth);
}

function journalReadingSightlineIssues(
  frames,
  physicalNotebookWorldQuad,
  declaredNotebookWorldQuad,
) {
  if (
    !Array.isArray(physicalNotebookWorldQuad) ||
    physicalNotebookWorldQuad.length !== 4 ||
    physicalNotebookWorldQuad.some((point) => !finiteTuple(point, 3))
  ) {
    return ["physical notebookWorldQuad is incomplete"];
  }
  const issues = [];
  if (
    !Array.isArray(declaredNotebookWorldQuad) ||
    declaredNotebookWorldQuad.length !== physicalNotebookWorldQuad.length ||
    declaredNotebookWorldQuad.some(
      (point, index) =>
        !finiteTuple(point, 3) ||
        point.some(
          (value, valueIndex) =>
            value !== physicalNotebookWorldQuad[index][valueIndex],
        ),
    )
  ) {
    issues.push("declared notebookWorldQuad must match physical geometry");
  }
  if (
    !Array.isArray(frames) ||
    frames.length < 3 ||
    frames.some(
      (frame) =>
        !finiteTuple(frame?.camera?.position, 3) ||
        !finiteTuple(frame?.camera?.quaternion, 4),
    )
  ) {
    return [...issues, "actual camera samples are incomplete"];
  }
  const readingHalfStart = Math.ceil((frames.length - 1) / 2);
  const missedReadingFrame = frames
    .slice(readingHalfStart)
    .findIndex(
      (frame) =>
        !journalGazeHitsNotebook(frame.camera, physicalNotebookWorldQuad),
    );
  if (missedReadingFrame >= 0) {
    issues.push(
      `sightline must intersect physical notebookWorldQuad throughout the reading half; missed authored frame ${readingHalfStart + missedReadingFrame} (reading half starts at ${readingHalfStart})`,
    );
  }
  return issues;
}

function clipPolygonToViewport(points) {
  const clip = (polygon, inside, intersect) => {
    const clipped = [];
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const currentInside = inside(current);
      const previousInside = inside(previous);
      if (currentInside !== previousInside) {
        clipped.push(intersect(previous, current));
      }
      if (currentInside) clipped.push(current);
    }
    return clipped;
  };
  const interpolateAtX = (first, second, x) => {
    const ratio = (x - first[0]) / (second[0] - first[0]);
    return [x, first[1] + (second[1] - first[1]) * ratio];
  };
  const interpolateAtY = (first, second, y) => {
    const ratio = (y - first[1]) / (second[1] - first[1]);
    return [first[0] + (second[0] - first[0]) * ratio, y];
  };
  return [
    [
      (point) => point[0] >= 0,
      (first, second) => interpolateAtX(first, second, 0),
    ],
    [
      (point) => point[0] <= 1,
      (first, second) => interpolateAtX(first, second, 1),
    ],
    [
      (point) => point[1] >= 0,
      (first, second) => interpolateAtY(first, second, 0),
    ],
    [
      (point) => point[1] <= 1,
      (first, second) => interpolateAtY(first, second, 1),
    ],
  ].reduce(
    (polygon, [inside, intersect]) =>
      polygon.length === 0 ? polygon : clip(polygon, inside, intersect),
    points,
  );
}

function polygonArea(points) {
  if (points.length < 3) return 0;
  const signedArea = points.reduce((area, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return area + x * nextY - y * nextX;
  }, 0);
  return Math.abs(signedArea) / 2;
}

function projectedJournalEndpointMetrics(
  variant,
  cameraSample,
  notebookWorldQuad,
) {
  if (
    !finiteTuple(cameraSample?.position, 3) ||
    !finiteTuple(cameraSample?.quaternion, 4) ||
    !Number.isFinite(cameraSample?.fov) ||
    !Array.isArray(notebookWorldQuad) ||
    notebookWorldQuad.length !== 4 ||
    notebookWorldQuad.some((point) => !finiteTuple(point, 3))
  ) {
    return null;
  }
  const camera = new PerspectiveCamera(
    cameraSample.fov,
    variant.width / variant.height,
    0.1,
    200,
  );
  camera.position.set(...cameraSample.position);
  camera.quaternion.set(...cameraSample.quaternion);
  camera.updateMatrixWorld(true);
  const points = notebookWorldQuad.map((point) => {
    const projected = new Vector3(...point).project(camera);
    return [projected.x * 0.5 + 0.5, 0.5 - projected.y * 0.5];
  });
  const [start, end] = points;
  const baselineRotationDegrees =
    (Math.abs(Math.atan2(end[1] - start[1], end[0] - start[0])) * 180) /
    Math.PI;
  return {
    endpointCoverage: polygonArea(clipPolygonToViewport(points)),
    endpointBaselineRotationDegrees: Math.min(
      baselineRotationDegrees,
      180 - baselineRotationDegrees,
    ),
  };
}

function cameraPositionStep(left, right) {
  if (!finiteTuple(left?.position, 3) || !finiteTuple(right?.position, 3)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(
    ...left.position.map((value, index) => value - right.position[index]),
  );
}

function cameraAngularStepDegrees(left, right) {
  if (!finiteTuple(left?.quaternion, 4) || !finiteTuple(right?.quaternion, 4)) {
    return Number.POSITIVE_INFINITY;
  }
  const leftLength = Math.hypot(...left.quaternion);
  const rightLength = Math.hypot(...right.quaternion);
  if (leftLength <= 0 || rightLength <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const dot = Math.abs(
    left.quaternion.reduce(
      (sum, value, index) =>
        sum + (value / leftLength) * (right.quaternion[index] / rightLength),
      0,
    ),
  );
  return (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
}

function journalMotionMetrics(frames) {
  if (
    !Array.isArray(frames) ||
    frames.length < 3 ||
    frames.some(
      (frame) =>
        !finiteTuple(frame?.camera?.position, 3) ||
        !finiteTuple(frame?.camera?.quaternion, 4),
    )
  ) {
    return null;
  }
  const steps = frames.slice(1).map((frame, index) => {
    const previous = frames[index].camera;
    const current = frame.camera;
    return {
      frame: index + 1,
      translation: cameraPositionStep(previous, current),
      angleDegrees: cameraAngularStepDegrees(previous, current),
    };
  });
  const firstTranslation = steps.find(
    ({ translation }) => translation > cameraPositionEpsilon,
  );
  const firstOrientation = steps.find(
    ({ angleDegrees }) => angleDegrees > cameraAngleEpsilonDegrees,
  );
  let orientationOnlyPlateau = 0;
  let maxOrientationOnlyPlateau = 0;
  for (const step of steps) {
    if (
      step.angleDegrees > cameraAngleEpsilonDegrees &&
      step.translation <= cameraPositionEpsilon
    ) {
      orientationOnlyPlateau += 1;
      maxOrientationOnlyPlateau = Math.max(
        maxOrientationOnlyPlateau,
        orientationOnlyPlateau,
      );
    } else {
      orientationOnlyPlateau = 0;
    }
  }
  return {
    firstTranslationFrame: firstTranslation?.frame ?? Number.POSITIVE_INFINITY,
    firstOrientationFrame: firstOrientation?.frame ?? Number.POSITIVE_INFINITY,
    maxAngularStepDegrees: Math.max(
      ...steps.map(({ angleDegrees }) => angleDegrees),
    ),
    maxOrientationOnlyPlateauFrames: maxOrientationOnlyPlateau,
  };
}

function journalMotionIssues(frames) {
  const metrics = journalMotionMetrics(frames);
  if (!metrics) return ["actual camera samples are incomplete"];
  const issues = [];
  if (
    metrics.firstTranslationFrame > 1 ||
    metrics.firstOrientationFrame > 1 ||
    metrics.firstTranslationFrame !== metrics.firstOrientationFrame
  ) {
    issues.push(
      `position and orientation must begin coupled at frame 1; got translation frame ${metrics.firstTranslationFrame} and orientation frame ${metrics.firstOrientationFrame}`,
    );
  }
  if (metrics.maxAngularStepDegrees > maximumJournalAngularStepDegrees) {
    issues.push(
      `actual max angular step ${metrics.maxAngularStepDegrees.toFixed(3)}deg exceeds ${maximumJournalAngularStepDegrees}deg`,
    );
  }
  if (
    metrics.maxOrientationOnlyPlateauFrames > maximumOrientationOnlyPlateauSteps
  ) {
    issues.push(
      `orientation-only plateau lasts ${metrics.maxOrientationOnlyPlateauFrames} frames; maximum is ${maximumOrientationOnlyPlateauSteps}`,
    );
  }
  return issues;
}

function journalDeclaredMotionIssues(transition, metrics) {
  const issues = [];
  if (
    transition?.journalHeadLeadSeconds !== 0 ||
    !Number.isFinite(transition?.fps) ||
    transition.fps <= 0 ||
    !Number.isFinite(transition?.translationStartsAtSeconds) ||
    transition.translationStartsAtSeconds > 1 / transition.fps ||
    transition?.motionModel !== "coupled-hip-pivot" ||
    !Number.isFinite(transition?.maxAngularStepDegrees) ||
    transition.maxAngularStepDegrees > maximumJournalAngularStepDegrees
  ) {
    issues.push(
      "declared motion must use zero head lead, translation by frame 1, coupled-hip-pivot, and <=3 degree steps",
    );
  }
  if (!metrics || !Number.isFinite(transition?.fps) || transition.fps <= 0) {
    return [
      ...issues,
      "declared motion cannot be checked against derived samples",
    ];
  }
  const derivedTranslationStart =
    metrics.firstTranslationFrame / transition.fps;
  if (
    !Number.isFinite(transition.translationStartsAtSeconds) ||
    Math.abs(transition.translationStartsAtSeconds - derivedTranslationStart) >
      declaredMetricTolerance
  ) {
    issues.push(
      `declared translation start ${String(transition.translationStartsAtSeconds)} does not match derived ${derivedTranslationStart}`,
    );
  }
  if (
    !Number.isFinite(transition.maxAngularStepDegrees) ||
    Math.abs(transition.maxAngularStepDegrees - metrics.maxAngularStepDegrees) >
      declaredMetricTolerance
  ) {
    issues.push(
      `declared max angular step ${String(transition.maxAngularStepDegrees)} does not match derived ${metrics.maxAngularStepDegrees}`,
    );
  }
  return issues;
}

function journalDeclaredEndpointIssues(transition, metrics) {
  const issues = [];
  if (
    !Number.isFinite(transition?.endpointBaselineRotationDegrees) ||
    transition.endpointBaselineRotationDegrees >
      maximumJournalBaselineRotationDegrees
  ) {
    issues.push(
      `endpointBaselineRotationDegrees must be finite and <=${maximumJournalBaselineRotationDegrees}`,
    );
  }
  if (
    !Number.isFinite(transition?.endpointCoverage) ||
    transition.endpointCoverage < minimumJournalEndpointCoverage ||
    transition.endpointCoverage > maximumJournalEndpointCoverage
  ) {
    issues.push(
      `endpointCoverage must be finite and within ${minimumJournalEndpointCoverage}..${maximumJournalEndpointCoverage}`,
    );
  }
  if (!metrics) {
    return [
      ...issues,
      "declared endpoint values cannot be checked against projected metrics",
    ];
  }
  for (const key of ["endpointBaselineRotationDegrees", "endpointCoverage"]) {
    if (
      !Number.isFinite(transition?.[key]) ||
      Math.abs(transition[key] - metrics[key]) > declaredMetricTolerance
    ) {
      issues.push(
        `declared ${key} ${String(transition?.[key])} does not match projected ${metrics[key]}`,
      );
    }
  }
  return issues;
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
    if (value === "--verify" || value === "--verify-only") args.verify = true;
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
    let stdout = options.binary ? [] : "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      if (options.binary) stdout.push(chunk);
      else stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise({
          stdout: options.binary ? Buffer.concat(stdout) : stdout,
          stderr,
        });
      } else
        reject(
          new Error(
            `${command} exited ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
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
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    issues.push(
      `${label} must be exactly ${expected.join(", ")}; got ${actual.join(", ") || "none"}`,
    );
  }
}

function finiteTuple(value, length) {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every(Number.isFinite)
  );
}

function normalizedQuadArea(quad) {
  if (!finiteTuple(quad, 8)) return 0;
  let area = 0;
  for (let index = 0; index < quad.length; index += 2) {
    const next = (index + 2) % quad.length;
    area += quad[index] * quad[next + 1] - quad[next] * quad[index + 1];
  }
  return Math.abs(area) / 2;
}

function finiteWorldQuad(value) {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((point) => finiteTuple(point, 3))
  );
}

function vectorAngleDegrees(first, second) {
  if (!finiteTuple(first, 3) || !finiteTuple(second, 3)) {
    return Number.POSITIVE_INFINITY;
  }
  const firstVector = new Vector3(...first);
  const secondVector = new Vector3(...second);
  if (firstVector.lengthSq() < 1e-18 || secondVector.lengthSq() < 1e-18) {
    return Number.POSITIVE_INFINITY;
  }
  return (firstVector.angleTo(secondVector) * 180) / Math.PI;
}

function rayIntersectsWorldQuad(origin, direction, quad) {
  if (
    !finiteTuple(origin, 3) ||
    !finiteTuple(direction, 3) ||
    !finiteWorldQuad(quad)
  ) {
    return false;
  }
  const rayOrigin = new Vector3(...origin);
  const rayDirection = new Vector3(...direction);
  if (rayDirection.lengthSq() < 1e-18) return false;
  rayDirection.normalize();
  const rayTriangleDistance = (first, second, third) => {
    const edge1 = second.clone().sub(first);
    const edge2 = third.clone().sub(first);
    const p = rayDirection.clone().cross(edge2);
    const determinant = edge1.dot(p);
    if (Math.abs(determinant) < 1e-9) return null;
    const inverse = 1 / determinant;
    const t = rayOrigin.clone().sub(first);
    const u = t.dot(p) * inverse;
    if (u < -1e-4 || u > 1 + 1e-4) return null;
    const q = t.clone().cross(edge1);
    const v = rayDirection.dot(q) * inverse;
    if (v < -1e-4 || u + v > 1 + 1e-4) return null;
    const distance = edge2.dot(q) * inverse;
    return distance >= 0 ? distance : null;
  };
  const points = quad.map((point) => new Vector3(...point));
  return (
    rayTriangleDistance(points[0], points[1], points[2]) !== null ||
    rayTriangleDistance(points[0], points[2], points[3]) !== null
  );
}

function sourceRelationshipPayload(authoring) {
  const lightSource = { ...authoring?.lightSource };
  delete lightSource.relationshipSha256;
  return {
    sources: authoring?.sources,
    receiverGeometry: {
      desk: authoring?.geometry?.desk,
      contactPaper: authoring?.geometry?.contactPaper,
    },
    lightSource,
  };
}

function receiverGeometrySha256(authoring) {
  return sha256Canonical({
    desk: authoring?.geometry?.desk?.geometrySha256,
    contactPaper: authoring?.geometry?.contactPaper?.geometrySha256,
  });
}

function practicalAuthoringDeclarationIssues(manifest) {
  const issues = [];
  if (
    manifest?.verification?.contactPracticalAuthoringManifest !==
      practicalAuthoringManifest ||
    !isSha256(manifest?.verification?.contactPracticalAuthoringManifestSha256)
  ) {
    issues.push(
      "manifest must pin the immutable practical-light authoring manifest by SHA-256",
    );
  }
  return issues;
}

function practicalAuthoringContractIssues(authoring) {
  const issues = [];
  if (
    authoring?.version !== 2 ||
    authoring?.immutable !== true ||
    authoring?.generator?.identity !== practicalAuthoringGenerator ||
    authoring?.generator?.browserRuntime !== false
  ) {
    issues.push(
      "practical-light authoring must be immutable non-browser Blender output",
    );
  }
  for (const [key, expectedPath] of [
    ["masterBlend", practicalMasterBlend],
    ["renderScript", practicalRenderScript],
  ]) {
    const source = authoring?.sources?.[key];
    if (source?.path !== expectedPath || !isSha256(source?.sha256)) {
      issues.push(`${key} path and SHA-256 source relationship is invalid`);
    }
  }
  const expectedGeometry = [
    ["bulb", practicalBulbObject],
    ["shadeInterior", practicalShadeObject],
    ["desk", practicalDeskObject],
    ["contactPaper", practicalContactPaperObject],
  ];
  for (const [key, object] of expectedGeometry) {
    if (
      authoring?.geometry?.[key]?.object !== object ||
      !isSha256(authoring?.geometry?.[key]?.geometrySha256)
    ) {
      issues.push(`${object} source geometry hash is invalid`);
    }
  }
  for (const key of ["desk", "contactPaper"]) {
    if (!finiteWorldQuad(authoring?.geometry?.[key]?.worldQuad)) {
      issues.push(`${key} receiver world quad is invalid`);
    }
  }
  const lightSource = authoring?.lightSource;
  const sourceRelationshipSha256 = sha256Canonical(
    sourceRelationshipPayload(authoring),
  );
  if (
    lightSource?.relationship !== "shade-origin-ray-v1" ||
    lightSource?.lampObject !== "scan_lamp" ||
    !finiteTuple(lightSource?.shadeOpening, 3) ||
    !Number.isFinite(lightSource?.shadeOpeningRadius) ||
    lightSource.shadeOpeningRadius <= 0 ||
    !finiteTuple(lightSource?.shadeAxis, 3) ||
    !finiteTuple(lightSource?.origin, 3) ||
    !finiteTuple(lightSource?.direction, 3) ||
    !finiteTuple(lightSource?.target, 3) ||
    !Number.isFinite(lightSource?.axisErrorDegrees) ||
    !Number.isFinite(lightSource?.spotAngleDegrees) ||
    lightSource.spotAngleDegrees <= 0 ||
    lightSource.spotAngleDegrees >= 180 ||
    lightSource?.relationshipSha256 !== sourceRelationshipSha256
  ) {
    issues.push(
      "shade-origin source relationship must bind exact master/render hashes and receiver geometry",
    );
  } else {
    const openingOffset = new Vector3(...lightSource.origin).distanceTo(
      new Vector3(...lightSource.shadeOpening),
    );
    const targetDirection = new Vector3(...lightSource.target)
      .sub(new Vector3(...lightSource.origin))
      .toArray();
    const measuredAxisError = vectorAngleDegrees(
      lightSource.shadeAxis,
      lightSource.direction,
    );
    if (
      openingOffset > lightSource.shadeOpeningRadius ||
      vectorAngleDegrees(targetDirection, lightSource.direction) > 0.01 ||
      measuredAxisError > 12 ||
      Math.abs(measuredAxisError - lightSource.axisErrorDegrees) > 0.01
    ) {
      issues.push(
        "light origin/direction must remain inside the real shade opening and follow its measured axis",
      );
    }
    if (
      !rayIntersectsWorldQuad(
        lightSource.origin,
        lightSource.direction,
        authoring?.geometry?.contactPaper?.worldQuad,
      ) ||
      !rayIntersectsWorldQuad(
        lightSource.origin,
        lightSource.direction,
        authoring?.geometry?.desk?.worldQuad,
      )
    ) {
      issues.push(
        "shade-origin light ray must intersect the contact paper and desk receivers",
      );
    }
  }
  const expectedReceiverSha256 = receiverGeometrySha256(authoring);
  for (const profile of expectedVariants) {
    const projection = authoring?.profiles?.[profile];
    if (!projection) {
      issues.push(`${profile} practical-light projection is missing`);
      continue;
    }
    if (
      JSON.stringify(projection.viewport) !==
        JSON.stringify(practicalViewports[profile]) ||
      projection.deskCameraSha256 !==
        sha256Canonical(approvedR3EndpointCameras[profile].desk)
    ) {
      issues.push(
        `${profile} projection must use the exact immutable desk camera hash`,
      );
    }
    const projectionPayload = { ...projection };
    delete projectionPayload.projectionSha256;
    if (
      !isSha256(projection.projectionSha256) ||
      projection.projectionSha256 !== sha256Canonical(projectionPayload)
    ) {
      issues.push(`${profile} geometry projection hash is invalid`);
    }
    if (projection.lightSourceRelationshipSha256 !== sourceRelationshipSha256) {
      issues.push(`${profile} source relationship hash is invalid`);
    }
    if (profile === "wide") {
      if (projection.kind !== widePracticalRelationship) {
        issues.push("wide practical relationship must expose the real source");
      }
      for (const [key, object] of expectedGeometry.slice(0, 2)) {
        const region = projection[key];
        if (
          region?.object !== object ||
          region?.geometrySha256 !== authoring?.geometry?.[key]?.geometrySha256
        ) {
          issues.push(`${profile} ${key} geometry hash does not match source`);
        }
        if (
          !finiteTuple(region?.quad, 8) ||
          region.quad.some((value) => value < 0 || value > 1) ||
          normalizedQuadArea(region.quad) < 0.00001
        ) {
          issues.push(`${profile} ${key} projected quad is invalid`);
        }
        if (
          !/^[a-z0-9][a-z0-9._-]*\.png$/.test(region?.mask?.path ?? "") ||
          !isSha256(region?.mask?.sha256)
        ) {
          issues.push(
            `${profile} ${key} projected mask relationship is invalid`,
          );
        }
      }
      if (
        projection.bulb?.mask?.path === projection.shadeInterior?.mask?.path ||
        projection.bulb?.mask?.sha256 ===
          projection.shadeInterior?.mask?.sha256 ||
        JSON.stringify(projection.bulb?.quad) ===
          JSON.stringify(projection.shadeInterior?.quad)
      ) {
        issues.push(
          "wide bulb and shade interior need distinct geometry projections",
        );
      }
      continue;
    }
    if (projection.kind !== portraitPracticalRelationship) {
      issues.push(
        "portrait practical relationship must use the offscreen source-derived pool",
      );
    }
    if (
      projection.receivers?.deskGeometrySha256 !==
        authoring?.geometry?.desk?.geometrySha256 ||
      projection.receivers?.contactPaperGeometrySha256 !==
        authoring?.geometry?.contactPaper?.geometrySha256 ||
      projection.receivers?.receiverGeometrySha256 !== expectedReceiverSha256
    ) {
      issues.push("portrait receiver geometry relationship is invalid");
    }
    const lightPool = projection.lightPool;
    if (
      lightPool?.derivation !== portraitPoolDerivation ||
      lightPool?.runtimeAuthored !== false ||
      lightPool?.lightSourceRelationshipSha256 !== sourceRelationshipSha256 ||
      lightPool?.receiverGeometrySha256 !== expectedReceiverSha256 ||
      !finiteTuple(lightPool?.quad, 8) ||
      lightPool.quad.some((value) => value < 0 || value > 1) ||
      normalizedQuadArea(lightPool.quad) < 0.0001 ||
      !/^[a-z0-9][a-z0-9._-]*\.png$/.test(lightPool?.mask?.path ?? "") ||
      !isSha256(lightPool?.mask?.sha256)
    ) {
      issues.push(
        "portrait light pool must be a non-runtime-authored Blender receiver mask",
      );
    }
    if (lightPool?.runtimeAuthored === true) {
      issues.push("portrait light pool cannot use a runtime-authored mask");
    }
  }
  return issues;
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
    (frame.hero === null && frame.heroReciprocalW !== null) ||
    (frame.hero !== null &&
      (!finiteTuple(frame.heroReciprocalW, 4) ||
        frame.heroReciprocalW.some((value) => value <= 0)))
  ) {
    issues.push(`${label} hero reciprocal-depth weights are malformed`);
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
  if (frame.contactIndentDepth !== expectedContactIndentDepth) {
    issues.push(
      `${label} CONTACT indentation depth must stay fixed at ${expectedContactIndentDepth}m`,
    );
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

function validateManifest(
  manifest,
  practicalAuthoring = null,
  practicalAuthoringLoadIssues = [],
) {
  const issues = [
    ...practicalAuthoringDeclarationIssues(manifest),
    ...practicalAuthoringLoadIssues,
    ...(practicalAuthoring
      ? practicalAuthoringContractIssues(practicalAuthoring)
      : []),
  ];
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
    issues.push(
      "camera rotation export must declare the verified basis-similarity conversion",
    );
  }
  if (manifest.fps !== 30) issues.push("manifest fps must be 30");
  if (
    JSON.stringify(manifest.endpointIds) !== JSON.stringify(expectedEndpoints)
  ) {
    issues.push("manifest endpointIds are incomplete or out of order");
  }
  if (
    manifest.hero?.object !== "Mesh_170" ||
    manifest.hero?.firstFrameSource !==
      "assets/master/hero/hero-print-first-frame.png" ||
    manifest.hero?.restingMechanism !== "baked-physical-poster" ||
    manifest.hero?.liveProjection !==
      "plate-space-reciprocal-depth-projective" ||
    manifest.hero?.compositor !== "plate-space-affine-soft-coverage" ||
    manifest.hero?.occlusion !== "authored-msaa-coverage" ||
    manifest.hero?.treatment?.kind !==
      "scene-linear-blender-agx-lut-room-response" ||
    !manifest.hero?.treatment?.gain?.endsWith("/hero-room-gain.png") ||
    !manifest.hero?.treatment?.offset?.endsWith("/hero-room-offset.png") ||
    manifest.hero?.treatment?.gainRange !== 1 ||
    manifest.hero?.treatment?.offsetRange !== 0.05 ||
    !manifest.hero?.treatment?.displayLut?.endsWith(
      "/hero-blender-agx-lut.png",
    ) ||
    manifest.hero?.treatment?.displayLutSize !== 64 ||
    !manifest.hero?.geometry?.source?.endsWith("/hero-compositor.glb") ||
    manifest.hero?.geometry?.runtimeRole !== "offscreen-coverage-only" ||
    !manifest.hero?.geometry?.occluders?.includes("Mesh_31") ||
    manifest.hero?.maskResolution !== undefined ||
    manifest.hero?.verification?.presentationEvent !== presentedFrameEvent ||
    manifest.hero?.verification?.presentedPixelReferences !==
      presentedPixelReferences ||
    manifest.hero?.verification?.presentedPixelAuthoringManifest !==
      presentedPixelAuthoringManifest ||
    !isSha256(
      manifest.hero?.verification?.presentedPixelAuthoringManifestSha256,
    ) ||
    manifest.hero?.verification?.referenceKind !==
      presentedPixelReferenceKind ||
    manifest.hero?.verification?.regionEncoding !== presentedPixelRegionEncoding
  ) {
    issues.push(
      "manifest hero must use plate-space affine treatment, authored MSAA coverage, and captured-pixel references",
    );
  }
  exactKeys(manifest.variants, expectedVariants, "variants", issues);

  for (const variantId of expectedVariants) {
    const variant = manifest.variants?.[variantId];
    if (!variant) continue;
    if (!Number.isFinite(variant.fov))
      issues.push(`${variantId} fov is missing`);
    exactKeys(
      variant.endpoints,
      expectedEndpoints,
      `${variantId} endpoints`,
      issues,
    );
    exactKeys(
      variant.transitions,
      expectedTransitions,
      `${variantId} transitions`,
      issues,
    );
    const variantProjections = [
      ...Object.values(variant.endpoints ?? {}).map(
        (endpoint) => endpoint.projection,
      ),
      ...Object.values(variant.transitions ?? {}).flatMap(
        (transition) => transition.frames ?? [],
      ),
    ];
    if (
      variantProjections.some(
        (projection) =>
          Object.hasOwn(projection ?? {}, "heroOcclusionMask") ||
          Object.hasOwn(projection ?? {}, "heroOccluders"),
      )
    ) {
      issues.push(
        `${variantId} projections must omit legacy RLE and polygon occlusion payloads`,
      );
    }

    const endpointFovs = new Set();
    for (const endpointId of expectedEndpoints) {
      const endpoint = variant.endpoints?.[endpointId];
      if (!endpoint) continue;
      validateProjection(
        endpoint.projection,
        `${variantId}/${endpointId}`,
        issues,
      );
      endpointFovs.add(endpoint.projection?.camera?.fov);
      if (endpoint.id !== endpointId)
        issues.push(`${variantId}/${endpointId} id mismatch`);
    }
    if (endpointFovs.size !== 1 || !endpointFovs.has(variant.fov)) {
      issues.push(
        `${variantId} must keep one constant ${variant.fov}-degree lens`,
      );
    }
    for (const endpointId of ["opening", "desk", "films", "contact"]) {
      const expected = approvedR3EndpointCameras[variantId][endpointId];
      const actual = variant.endpoints?.[endpointId]?.projection?.camera;
      if (firstSemanticDifference(expected, actual)) {
        issues.push(`${variantId}/${endpointId} approved R3 endpoint changed`);
      }
    }

    for (const transitionId of expectedTransitions) {
      const transition = variant.transitions?.[transitionId];
      if (!transition) continue;
      const expectedDuration =
        transitionId === "opening-desk"
          ? 2.6
          : transitionId === "desk-contact"
            ? 1.9
            : 0.9;
      if (transition.duration !== expectedDuration) {
        issues.push(
          `${variantId}/${transitionId} duration must be ${expectedDuration}s`,
        );
      }
      if (transition.fps !== 30)
        issues.push(`${variantId}/${transitionId} fps must be 30`);
      if (transition.frameCount !== Math.round(expectedDuration * 30) + 1) {
        issues.push(
          `${variantId}/${transitionId} frameCount does not span its exact duration`,
        );
      }
      if (
        !Array.isArray(transition.frames) ||
        transition.frames.length !== transition.frameCount
      ) {
        issues.push(
          `${variantId}/${transitionId} per-frame projection samples are incomplete`,
        );
      } else {
        transition.frames.forEach((frame, index) =>
          validateProjection(
            frame,
            `${variantId}/${transitionId} frame ${index}`,
            issues,
          ),
        );
      }
      if (
        transition.reverse?.source === transition.forward ||
        transition.reverse?.playbackRate !== 1 ||
        transition.reverse?.from !== transition.to ||
        transition.reverse?.to !== transition.from
      ) {
        issues.push(
          `${variantId}/${transitionId} reverse metadata must name a packaged destination-to-source clip`,
        );
      }
    }

    const journal = variant.transitions?.["desk-journal"];
    const journalFrames = journal?.frames ?? [];
    issues.push(
      ...journalMotionIssues(journalFrames).map(
        (issue) => `${variantId}/desk-journal ${issue}`,
      ),
      ...journalDeclaredMotionIssues(
        journal,
        journalMotionMetrics(journalFrames),
      ).map((issue) => `${variantId}/desk-journal ${issue}`),
    );
    const contact = variant.transitions?.["desk-contact"];
    const deskCamera = variant.endpoints?.desk?.projection?.camera;
    const filmsCamera = variant.endpoints?.films?.projection?.camera;
    const journalCamera = variant.endpoints?.journal?.projection?.camera;
    const contactCamera = variant.endpoints?.contact?.projection?.camera;
    const contactFrames = contact?.frames ?? [];
    const activationFrames = contactFrames.slice(0, contactActivationSamples);
    const levelsRise = (property) =>
      activationFrames.length === contactActivationSamples &&
      activationFrames.every(
        (frame, index) =>
          Number.isFinite(frame[property]) &&
          (index === 0 ||
            frame[property] >= activationFrames[index - 1][property]),
      ) &&
      activationFrames.at(-1)?.[property] > activationFrames[0]?.[property];
    const postHoldPath = contactFrames
      .slice(contactActivationSamples)
      .map(({ camera }) => camera);
    const postHoldHash = createHash("sha256")
      .update(JSON.stringify(postHoldPath))
      .digest("hex");
    if (
      variant.contact?.activationHoldSeconds !== 1 ||
      variant.contact?.practicalRelationship !==
        (variantId === "wide"
          ? widePracticalRelationship
          : portraitPracticalRelationship) ||
      (variantId === "wide" &&
        (variant.contact?.visibleBulb !== true ||
          variant.contact?.visibleShadeInterior !== true)) ||
      !(variant.contact?.shadeAxisErrorDegrees <= 12) ||
      variant.contact?.lightIntersectsPaper !== true ||
      variant.contact?.lightIntersectsDesk !== true ||
      !deskCamera ||
      activationFrames.some(
        (frame) => JSON.stringify(frame.camera) !== JSON.stringify(deskCamera),
      ) ||
      !levelsRise("visibleBulbLevel") ||
      !levelsRise("lampLevel") ||
      !contactFrames[contactActivationSamples] ||
      JSON.stringify(contactFrames[contactActivationSamples]?.camera) ===
        JSON.stringify(deskCamera) ||
      postHoldPath.length !== 27 ||
      postHoldHash !== approvedR3ContactPathSha256[variantId]
    ) {
      issues.push(
        `${variantId}/desk-contact must hold the exact desk camera for 1.0s while its approved practical relationship rises, then preserve the approved R3 path`,
      );
    }
    if (
      JSON.stringify(contactCamera) === JSON.stringify(deskCamera) ||
      contact?.frames?.every(
        (frame) => JSON.stringify(frame.camera) === JSON.stringify(deskCamera),
      )
    ) {
      issues.push(
        `${variantId}/desk-contact must use an authored lean/pan away from desk`,
      );
    }
    if (
      JSON.stringify(filmsCamera?.position) !==
        JSON.stringify(deskCamera?.position) ||
      filmsCamera?.fov !== deskCamera?.fov ||
      JSON.stringify(filmsCamera?.quaternion) ===
        JSON.stringify(deskCamera?.quaternion)
    ) {
      issues.push(
        `${variantId}/films must preserve the exact desk position/FOV and change only head rotation`,
      );
    }
    const notebookWorldQuad = variant.journal?.notebookWorldQuad;
    const journalMetrics = projectedJournalEndpointMetrics(
      variant,
      journalCamera,
      notebookWorldQuad,
    );
    issues.push(
      ...journalDeclaredEndpointIssues(journal, journalMetrics).map(
        (issue) => `${variantId}/desk-journal ${issue}`,
      ),
      ...journalReadingSightlineIssues(
        journalFrames,
        notebookWorldQuad,
        journal?.notebookWorldQuad,
      ).map((issue) => `${variantId}/desk-journal ${issue}`),
    );
    const journalMotion = journalMotionMetrics(journalFrames);
    const firstJournalTranslation = journalMotion?.firstTranslationFrame ?? -1;
    if (
      firstJournalTranslation < 0 ||
      firstJournalTranslation > 1 ||
      !journalMetrics ||
      journalMetrics.endpointBaselineRotationDegrees >
        maximumJournalBaselineRotationDegrees ||
      journalMetrics.endpointCoverage < minimumJournalEndpointCoverage ||
      journalMetrics.endpointCoverage > maximumJournalEndpointCoverage
    ) {
      issues.push(
        `${variantId}/journal must translate by frame 1 and end with readable physical notebook framing`,
      );
    }
    if (
      variant.navigation?.rows?.length !== 4 ||
      !variant.navigation?.plane ||
      variant.navigation?.containment !== "half-open" ||
      variant.contact?.mechanism !== "applied-exact-pressure-indentation" ||
      variant.contact?.materialMechanism !==
        "lamp-reactive-compressed-fiber-groove" ||
      variant.contact?.coloredRevealMixCount !== 1 ||
      variant.contact?.fiberResponseAnimated !== true ||
      variant.contact?.fiberResponseNormalWeighted !== true ||
      variant.contact?.physicalOcclusionResponse !== true ||
      !(
        variant.contact?.fiberResponseFloorPeak <
        variant.contact?.fiberResponseWallPeak
      ) ||
      variant.contact?.geometryAnimated !== false ||
      variant.contact?.lightInsideShade !== true ||
      variant.contact?.lightIntersectsPaper !== true ||
      !finiteTuple(variant.contact?.lightOrigin, 3) ||
      !finiteTuple(variant.contact?.lightTarget, 3) ||
      !Number.isFinite(variant.contact?.grazingAngleDegrees) ||
      variant.contact.grazingAngleDegrees > 35 ||
      variant.contact?.standalonePlaneCount !== 0 ||
      variant.contact?.paperOpacity !== 1 ||
      variant.contact?.indentDepth !== expectedContactIndentDepth
    ) {
      issues.push(
        `${variantId} physical navigation or CONTACT projection contract is incomplete`,
      );
    }
    if (
      variant.contact?.geometryStats?.indentedVertices <=
        variant.contact?.geometryStats?.baseVertices ||
      variant.contact?.geometryStats?.indentedPolygons <=
        variant.contact?.geometryStats?.basePolygons
    ) {
      issues.push(
        `${variantId} Mesh_56 applied geometry does not prove the exact pressure indentation`,
      );
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
            Math.abs(row.rect.y - rows[index - 1].rect.y - expectedRowPitch) >
              1e-9),
      )
    ) {
      issues.push(
        `${variantId} navigation must use exact 0.026 rows on a 0.044 pitch in left-aligned Noteworthy graphite`,
      );
    }
    const boundary = 0.09;
    if (
      variant.navigation?.rows?.some(
        ({ rect }) => boundary >= rect.y && boundary < rect.y + rect.height,
      )
    ) {
      issues.push(
        `${variantId} row containment includes the y=0.09 gap boundary`,
      );
    }
    for (const endpointId of expectedEndpoints) {
      const expected = variant.navigation?.screenQuads?.[endpointId];
      if (!finiteTuple(expected, 8)) {
        issues.push(
          `${variantId}/${endpointId} navigation screen quad is missing`,
        );
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
      variant.logo?.object !== "Mesh_31" ||
      variant.logo?.geometryCreated !== false ||
      variant.logo?.uvBinding !== "explicit-uv-map" ||
      variant.logo?.source !==
        "assets/master/brand/lazy-a-logo-letterpress.png" ||
      JSON.stringify(variant.logo?.sourceResolution) !==
        JSON.stringify([2000, 1588])
    ) {
      issues.push(
        `${variantId} logo must bind the pinned 2000x1588 source to the upright UV map on existing Mesh_31`,
      );
    }
    for (const endpointId of ["desk"]) {
      const logoQuad = variant.logo?.screenQuads?.[endpointId];
      if (variantId === "portrait" && !quadInsideFrame(logoQuad, 0.01)) {
        issues.push(
          `portrait/${endpointId} must include the full existing Mesh_31 logo card`,
        );
      }
      for (const row of variant.navigation?.rows ?? []) {
        const labelQuad =
          variant.navigation?.labelScreenQuads?.[endpointId]?.[row.id];
        if (
          variantId === "portrait" &&
          quadPixelWidth(labelQuad, variant.width) < minimumPortraitLabelWidth
        ) {
          issues.push(
            `portrait/${endpointId} ${row.label} must project at least ${minimumPortraitLabelWidth}px wide`,
          );
        }
        if (
          variantId === "portrait" &&
          quadPixelHeight(labelQuad, variant.height) <
            minimumPortraitLabelHeight
        ) {
          issues.push(
            `portrait/${endpointId} ${row.label} must project at least ${minimumPortraitLabelHeight}px high`,
          );
        }
      }
      if (
        variantId === "portrait" &&
        quadPixelHeight(
          variant.navigation?.screenQuads?.[endpointId],
          variant.height,
        ) < minimumPortraitSheetHeight
      ) {
        issues.push(
          `portrait/${endpointId} navigation sheet must project at least ${minimumPortraitSheetHeight}px high`,
        );
      }
    }
    if (variantId === "portrait") {
      if (
        !quadIntersectsFrame(variant.contact?.lampScreenQuads?.contact) ||
        !quadInsideFrame(variant.contact?.paperScreenQuads?.contact, 0.01)
      ) {
        issues.push(
          "portrait/contact must frame the current lamp and full contact paper together",
        );
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
      variant.contact?.addressCopy !== expectedContactCopy ||
      !quadInsideFrame(variant.contact?.addressScreenQuads?.contact, 0.02) ||
      quadPixelWidth(
        variant.contact?.addressScreenQuads?.contact,
        variant.width,
      ) < 100
    ) {
      issues.push(
        `${variantId} CONTACT must expose the one-time-positioned physical indentation in frame`,
      );
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

async function loadPracticalAuthoring(manifest) {
  const declarationIssues = practicalAuthoringDeclarationIssues(manifest);
  if (declarationIssues.length > 0) {
    return { authoring: null, issues: [] };
  }
  const path = publicUrlToPath(practicalAuthoringManifest);
  try {
    const bytes = await readFile(path);
    if (bytes.length > maximumPracticalAuthoringBytes) {
      return {
        authoring: null,
        issues: ["practical-light authoring manifest exceeds 256 KiB"],
      };
    }
    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    if (
      actualSha256 !==
      manifest.verification.contactPracticalAuthoringManifestSha256
    ) {
      return {
        authoring: null,
        issues: [
          `practical-light authoring SHA-256 ${actualSha256} does not match the manifest declaration`,
        ],
      };
    }
    const authoring = JSON.parse(bytes.toString("utf8"));
    const issues = [];
    for (const [key, expectedPath] of [
      ["masterBlend", practicalMasterBlend],
      ["renderScript", practicalRenderScript],
    ]) {
      const source = authoring?.sources?.[key];
      if (source?.path !== expectedPath || !isSha256(source?.sha256)) continue;
      try {
        const sourceBytes = await readFile(
          resolve(repositoryRoot, source.path),
        );
        const sourceSha256 = createHash("sha256")
          .update(sourceBytes)
          .digest("hex");
        if (sourceSha256 !== source.sha256) {
          issues.push(
            `${key} SHA-256 ${sourceSha256} does not match ${source.sha256}`,
          );
        }
      } catch (error) {
        issues.push(`${key} source cannot be read: ${error.message}`);
      }
    }
    for (const profile of expectedVariants) {
      const keys =
        authoring?.profiles?.[profile]?.kind === portraitPracticalRelationship
          ? ["lightPool"]
          : ["bulb", "shadeInterior"];
      for (const key of keys) {
        const mask = authoring?.profiles?.[profile]?.[key]?.mask;
        if (
          !/^[a-z0-9][a-z0-9._-]*\.png$/.test(mask?.path ?? "") ||
          !isSha256(mask?.sha256)
        ) {
          continue;
        }
        try {
          const maskBytes = await readFile(resolve(dirname(path), mask.path));
          const maskSha256 = createHash("sha256")
            .update(maskBytes)
            .digest("hex");
          if (maskSha256 !== mask.sha256) {
            issues.push(
              `${profile} ${key} mask SHA-256 ${maskSha256} does not match ${mask.sha256}`,
            );
          }
        } catch (error) {
          issues.push(
            `${profile} ${key} projected mask cannot be read: ${error.message}`,
          );
        }
      }
    }
    return { authoring, issues };
  } catch (error) {
    return {
      authoring: null,
      issues: [
        `practical-light authoring manifest unavailable: ${error.message}`,
      ],
    };
  }
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
    for (const [transitionId, transition] of Object.entries(
      variant.transitions,
    )) {
      if (!selected(args, variantId, transitionId)) continue;
      const frameDirectory = publicUrlToPath(transition.framesDirectory);
      const firstFrame = resolve(frameDirectory, "0000.png");
      if (!(await exists(firstFrame))) {
        console.log(
          `PENDING ${variantId}/${transitionId}: no rendered frame sequence`,
        );
        pending += 1;
        continue;
      }
      const output = publicUrlToPath(transition.forward);
      await mkdir(dirname(output), { recursive: true });
      // Short desk routes retain fine prop edges and survive the still/video
      // handoff without a visible codec pulse. CONTACT is nearly twice as long,
      // so a visually transparent web encode prevents cold-CDN return stalls.
      // The longer arrival stays lean.
      const crf =
        transitionId === "opening-desk"
          ? "26"
          : transitionId === "desk-contact"
            ? "14"
            : "8";
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
        `scale=${variant.width}:${variant.height}:flags=lanczos,pad=ceil(iw/2)*2:ceil(ih/2)*2`,
        "-c:v",
        "libx264",
        "-crf",
        crf,
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
        `reverse,scale=${variant.width}:${variant.height}:flags=lanczos,pad=ceil(iw/2)*2:ceil(ih/2)*2`,
        "-c:v",
        "libx264",
        "-crf",
        crf,
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        reverseOutput,
      ]);
      console.log(
        `ENCODED ${variantId}/${transitionId}: ${output} + ${reverseOutput}`,
      );
      encoded += 2;
    }
  }
  console.log(
    `Encode summary: ${encoded} encoded, ${pending} pending frame sequences.`,
  );
}

async function probe(path) {
  const { stdout } = await run(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name,pix_fmt,width,height,nb_frames:format=duration",
      "-of",
      "json",
      path,
    ],
    { capture: true },
  );
  return JSON.parse(stdout);
}

function sampledFrameIndices(frameCount) {
  return [0, Math.floor((frameCount - 1) / 2), frameCount - 1];
}

async function decodeSamples(inputArgs, indices, reverse = false) {
  const selectExpression = indices.map((index) => `eq(n,${index})`).join("+");
  const filters = [
    `select='${selectExpression}'`,
    reverse ? "reverse" : null,
    `scale=${decodedSampleSize}:${decodedSampleSize}:flags=area`,
    "format=gray",
  ].filter(Boolean);
  const { stdout } = await run(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      ...inputArgs,
      "-vf",
      filters.join(","),
      "-frames:v",
      String(indices.length),
      "-fps_mode",
      "passthrough",
      "-pix_fmt",
      "gray",
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    { capture: true, binary: true },
  );
  const bytesPerSample = decodedSampleSize * decodedSampleSize;
  if (stdout.length !== bytesPerSample * indices.length) {
    throw new Error(
      `decoded ${stdout.length} bytes instead of ${bytesPerSample * indices.length}`,
    );
  }
  return indices.map((_, index) =>
    stdout.subarray(index * bytesPerSample, (index + 1) * bytesPerSample),
  );
}

async function decodeTransitionRelationships(frameDirectory, transition) {
  const indices = sampledFrameIndices(transition.frameCount);
  const reverseSourceIndices = [
    0,
    transition.frameCount - 1 - indices[1],
    transition.frameCount - 1,
  ];
  const sequenceInput = [
    "-framerate",
    String(transition.fps),
    "-start_number",
    "0",
    "-i",
    resolve(frameDirectory, "%04d.png"),
  ];
  return Promise.all([
    decodeSamples(sequenceInput, indices),
    decodeSamples(["-i", publicUrlToPath(transition.forward)], indices),
    decodeSamples(["-i", publicUrlToPath(transition.reverse.source)], indices),
    decodeSamples(sequenceInput, reverseSourceIndices, true),
  ]);
}

async function decodeImage(path) {
  const [sample] = await decodeSamples(["-i", path], [0]);
  return sample;
}

async function frameInventoryIssues(frameDirectory, transition, label) {
  let actual;
  try {
    actual = (await readdir(frameDirectory))
      .filter((name) => name.endsWith(".png"))
      .sort();
  } catch {
    return [`${label} has packaged media but no source frame directory`];
  }
  const expected = Array.from(
    { length: transition.frameCount },
    (_, index) => `${String(index).padStart(4, "0")}.png`,
  );
  if (
    actual.length !== expected.length ||
    actual.some((name, index) => name !== expected[index])
  ) {
    return [
      `${label} source frame inventory must be exactly 0000.png..${expected.at(-1)}; found ${actual.length} PNGs`,
    ];
  }
  return [];
}

async function verifyMedia(manifest) {
  const issues = [];
  let verified = 0;
  let pending = 0;
  let relationships = 0;
  for (const [variantId, variant] of Object.entries(manifest.variants)) {
    const endpointReferences = new Map(
      expectedEndpoints.map((endpointId) => [endpointId, []]),
    );
    for (const [transitionId, transition] of Object.entries(
      variant.transitions,
    )) {
      const label = `${variantId}/${transitionId}`;
      const paths = [transition.forward, transition.reverse.source];
      if (!(await exists(publicUrlToPath(transition.forward)))) {
        console.log(`PENDING ${label} clip (not rendered yet)`);
        pending += 1;
        continue;
      }
      const frameDirectory = publicUrlToPath(transition.framesDirectory);
      const inventoryIssues = await frameInventoryIssues(
        frameDirectory,
        transition,
        label,
      );
      issues.push(...inventoryIssues);

      for (const mediaUrl of paths) {
        const path = publicUrlToPath(mediaUrl);
        if (!(await exists(path))) {
          issues.push(`${mediaUrl} is missing`);
          continue;
        }
        try {
          const result = await probe(path);
          const stream = result.streams?.[0];
          const duration = Number(result.format?.duration);
          if (stream?.codec_name !== "h264")
            issues.push(`${mediaUrl} codec is not H.264`);
          if (stream?.pix_fmt !== "yuv420p")
            issues.push(`${mediaUrl} pixel format is not yuv420p`);
          const encodedWidth = variant.width + (variant.width % 2);
          const encodedHeight = variant.height + (variant.height % 2);
          if (
            stream?.width !== encodedWidth ||
            stream?.height !== encodedHeight
          ) {
            issues.push(
              `${mediaUrl} dimensions do not match codec-safe ${encodedWidth}x${encodedHeight}`,
            );
          }
          if (Number(stream?.nb_frames) !== transition.frameCount) {
            issues.push(
              `${mediaUrl} contains ${stream?.nb_frames ?? "unknown"} frames instead of ${transition.frameCount}`,
            );
          }
          if (
            !Number.isFinite(duration) ||
            Math.abs(duration - transition.duration) > 0.08
          ) {
            issues.push(
              `${mediaUrl} duration ${duration} does not match ${transition.duration}s`,
            );
          }
          verified += 1;
        } catch (error) {
          issues.push(`${mediaUrl} could not be probed: ${error.message}`);
        }
      }

      if (
        inventoryIssues.length === 0 &&
        (await exists(publicUrlToPath(transition.reverse.source)))
      ) {
        try {
          const [
            sourceSamples,
            forwardSamples,
            reverseSamples,
            reverseSourceSamples,
          ] = await decodeTransitionRelationships(frameDirectory, transition);
          issues.push(
            ...decodedRelationshipIssues(
              label,
              sourceSamples,
              forwardSamples,
              reverseSamples,
              reverseSourceSamples,
            ),
          );
          endpointReferences.get(transition.from)?.push({
            source: `${transition.framesDirectory}/0000.png`,
            sample: sourceSamples[0],
          });
          endpointReferences.get(transition.to)?.push({
            source: `${transition.framesDirectory}/${String(transition.frameCount - 1).padStart(4, "0")}.png`,
            sample: sourceSamples[2],
          });
          relationships += 1;
        } catch (error) {
          issues.push(
            `${label} decoded relationship check failed: ${error.message}`,
          );
        }
      }
    }

    for (const endpoint of Object.values(variant.endpoints)) {
      const path = publicUrlToPath(endpoint.still);
      if (!(await exists(path))) {
        console.log(
          `PENDING ${variantId}/${endpoint.id} still (not required yet)`,
        );
        pending += 1;
        continue;
      }
      const details = await stat(path);
      if (details.size === 0) {
        issues.push(`${endpoint.still} is empty`);
        continue;
      }
      try {
        const sample = await decodeImage(path);
        issues.push(
          ...decodedEndpointIssues(
            `${variantId}/${endpoint.id} endpoint`,
            sample,
            endpointReferences.get(endpoint.id) ?? [],
          ),
        );
        verified += 1;
        relationships += 1;
      } catch (error) {
        issues.push(`${endpoint.still} could not be decoded: ${error.message}`);
      }
    }
  }
  return { issues, verified, pending, relationships };
}

async function verify(manifest) {
  const practicalAuthoring = await loadPracticalAuthoring(manifest);
  const issues = validateManifest(
    manifest,
    practicalAuthoring.authoring,
    practicalAuthoring.issues,
  );
  const generatedTypes = await readFile(generatedTypesPath, "utf8");
  issues.push(...generatedManifestIssues(manifest, generatedTypes));
  const media = await verifyMedia(manifest);
  issues.push(...media.issues);
  if (issues.length > 0) {
    console.error(`Master-shot verification failed (${issues.length} issues):`);
    issues.forEach((issue) => console.error(`  - ${issue}`));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Master-shot contract verified: 2 profiles, 12 endpoints, 10 forward/reverse paths; ${media.verified} media files and ${media.relationships} decoded source relationships checked, ${media.pending} intentionally pending.`,
  );
}

if (process.argv.includes("--self-test")) {
  await runSelfTests();
} else {
  const args = parseArgs(process.argv.slice(2));
  const manifest = await loadManifest();
  if (args.encode) await encode(manifest, args);
  if (args.verify) await verify(manifest);
}
