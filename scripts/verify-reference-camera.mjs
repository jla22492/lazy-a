/**
 * WO 0117-R2 gate: runtime profile selection and rendered camera samples must
 * agree with the canonical camera contract.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PerspectiveCamera, Vector3 } from "three";

const root = path.resolve(import.meta.dirname, "..");
const cameraContract = JSON.parse(
  fs.readFileSync(
    path.join(root, "assets/master/camera-contract.json"),
    "utf8",
  ),
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "public/room/manifest.json"), "utf8"),
);

const failures = [];
const APPROXIMATE_EPSILON = 1e-5;

function assertVectorClose(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label} dimensionality`);
  actual.forEach((value, index) => {
    assert.ok(
      Math.abs(value - expected[index]) <= APPROXIMATE_EPSILON,
      `${label}[${index}] expected ${expected[index]}, got ${value}`,
    );
  });
}

function assertQuaternionClose(actual, expected, label) {
  assert.equal(actual.length, 4, `${label} actual dimensionality`);
  assert.equal(expected.length, 4, `${label} expected dimensionality`);
  const actualLength = Math.hypot(...actual);
  const expectedLength = Math.hypot(...expected);
  const dot = Math.abs(
    actual.reduce((sum, value, index) => sum + value * expected[index], 0) /
      (actualLength * expectedLength),
  );
  assert.ok(
    1 - dot <= APPROXIMATE_EPSILON,
    `${label} expected equivalent orientation, quaternion dot was ${dot}`,
  );
}

function targetQuaternion(profile) {
  const camera = new PerspectiveCamera(profile.fov);
  camera.position.fromArray(profile.position);
  camera.lookAt(new Vector3().fromArray(profile.target));
  return camera.quaternion.toArray();
}

function assertCameraClose(actual, expected, label) {
  assertVectorClose(actual.position, expected.position, `${label} position`);
  assertQuaternionClose(
    actual.quaternion,
    expected.quaternion,
    `${label} orientation`,
  );
  assert.equal(actual.fov, expected.fov, `${label} fov`);
}

async function loadPlateSpace(contract) {
  const probeRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "lazy-a-camera-contract-"),
  );
  try {
    fs.mkdirSync(path.join(probeRoot, "lib"), { recursive: true });
    fs.mkdirSync(path.join(probeRoot, "assets/master"), { recursive: true });
    fs.copyFileSync(
      path.join(root, "lib/plateSpace.ts"),
      path.join(probeRoot, "lib/plateSpace.ts"),
    );
    fs.writeFileSync(
      path.join(probeRoot, "assets/master/camera-contract.json"),
      JSON.stringify(contract),
    );
    fs.writeFileSync(
      path.join(probeRoot, "package.json"),
      JSON.stringify({ type: "module" }),
    );
    return await import(
      pathToFileURL(path.join(probeRoot, "lib/plateSpace.ts")).href
    );
  } finally {
    fs.rmSync(probeRoot, { recursive: true, force: true });
  }
}

async function check(name, operation) {
  try {
    await operation();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}: ${error.message}`);
  }
}

const runtime = await loadPlateSpace(cameraContract);

await check(
  "runtime phone breakpoint is derived from the camera contract",
  async () => {
    assert.equal(
      runtime.PHONE_MAX_WIDTH,
      cameraContract.selection.phoneMaxWidth,
    );

    const probeWidth = cameraContract.selection.phoneMaxWidth - 127;
    const probeContract = structuredClone(cameraContract);
    probeContract.selection.phoneMaxWidth = probeWidth;
    const probe = await loadPlateSpace(probeContract);
    assert.equal(probe.PHONE_MAX_WIDTH, probeWidth);
    assert.equal(probe.selectPlateVariant(probeWidth), "portrait");
    assert.equal(probe.selectPlateVariant(probeWidth + 1), "wide");
  },
);

await check(
  "desktop, tall desktop, and breakpoint widths select by layout",
  () => {
    const cases = [
      { label: "desktop", width: 1280, expected: "wide" },
      { label: "tall desktop", width: 900, expected: "wide" },
      {
        label: "phone breakpoint",
        width: cameraContract.selection.phoneMaxWidth,
        expected: "portrait",
      },
      {
        label: "above phone breakpoint",
        width: cameraContract.selection.phoneMaxWidth + 1,
        expected: "wide",
      },
      { label: "phone", width: 375, expected: "portrait" },
    ];

    for (const testCase of cases) {
      assert.equal(
        runtime.selectPlateVariant(testCase.width),
        testCase.expected,
        `${testCase.label} at ${testCase.width}px`,
      );
    }
  },
);

const profiles = [
  { variantId: "wide", contractId: "desktop" },
  { variantId: "portrait", contractId: "phone" },
];

for (const { variantId, contractId } of profiles) {
  const profile = cameraContract[contractId];
  const variant = manifest.variants[variantId];

  await check(
    `${variantId} desk orientation is derived from its target`,
    () => {
      const desk = variant.endpoints.desk.projection.camera;
      assertVectorClose(
        desk.position,
        profile.position,
        `${variantId} desk position`,
      );
      assert.equal(desk.fov, profile.fov, `${variantId} desk fov`);
      assertQuaternionClose(
        desk.quaternion,
        targetQuaternion(profile),
        `${variantId} desk orientation`,
      );
    },
  );

  await check(`${variantId} arrival hands off to its exact desk camera`, () => {
    const arrival = variant.transitions["opening-desk"];
    const desk = variant.endpoints.desk.projection.camera;
    const expectedDuration =
      cameraContract.arrival.openingSeconds +
      cameraContract.arrival.walkSeconds +
      cameraContract.arrival.settleSeconds;

    assert.equal(arrival.duration, expectedDuration);
    assert.equal(arrival.frames.length, arrival.frameCount);
    assert.ok(arrival.frames.length > 2, "arrival requires sampled motion");
    const first = arrival.frames[0].camera;
    const last = arrival.frames.at(-1).camera;
    assert.notDeepEqual(
      first.position,
      last.position,
      "arrival cannot be a cut",
    );
    assertCameraClose(last, desk, `${variantId} arrival handoff`);
    assertVectorClose(
      last.position,
      profile.position,
      `${variantId} contract handoff`,
    );
    assertQuaternionClose(
      last.quaternion,
      targetQuaternion(profile),
      `${variantId} contract handoff orientation`,
    );
  });
}

if (failures.length > 0) {
  console.error(`Reference camera gate failed (${failures.length} checks).`);
  process.exit(1);
}

console.log("Reference camera gate passed.");
