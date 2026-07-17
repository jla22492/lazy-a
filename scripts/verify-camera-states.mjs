/**
 * WO 0117-R red gate: authored camera endpoints and desk-routed switching.
 *
 * The page must expose window.__lazyACameraDebug with:
 *   snapshot(): CameraSnapshot
 *   history(): CameraSnapshot[]
 *   clearHistory(): void
 *   requestDestination(id): void
 *   close(): void
 *
 * CameraSnapshot contains endpoint, phase, camera { position, quaternion,
 * fov }, and framing.coverage { notebook, contactPaper, charger, leftHistory }.
 * Coverage values are actual projected fractions of the current frame.
 *
 * Usage:
 *   node scripts/verify-camera-states.mjs [url]
 */

import { readFile } from "node:fs/promises";

import { chromium } from "playwright";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";

const args = process.argv.slice(2);
const manifestOnly = args.includes("--manifest-only");
const url =
  args.find((argument) => !argument.startsWith("--")) ??
  "http://localhost:3000/";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "phone", width: 375, height: 812 },
];
const ARRIVAL_TIMEOUT_MS = 12_000;
const TRANSITION_TIMEOUT_MS = 12_000;
const JOURNAL_MIN_COVERAGE = 0.4;
const JOURNAL_MAX_COVERAGE = 0.6;
const MIN_JOURNAL_TRAVEL = 0.05;
const MAX_CONTACT_YAW_FROM_DESK = 0.12;
const MIN_ABOUT_LEFT_YAW = 0.05;
const APPROVED_R3_ENDPOINT_CAMERAS = {
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
    about: {
      position: [0.019999999553, 1.580000042915, 1.450000047684],
      quaternion: [
        -0.083158425987, 0.343562364578, 0.030558215454, 0.934941589832,
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
    about: {
      position: [0.219999998808, 1.580000042915, 2.269999980927],
      quaternion: [
        -0.105192042887, 0.311378329992, 0.034704685211, 0.943808138371,
      ],
      fov: 35,
    },
  },
};

function sameTuple(left, right, tolerance = 1e-9) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => Math.abs(value - right[index]) <= tolerance)
  );
}

function projectedJournalEndpointMetrics(
  variant,
  cameraSample,
  notebookWorldQuad,
) {
  if (
    !cameraSample ||
    !Array.isArray(notebookWorldQuad) ||
    notebookWorldQuad.length !== 4 ||
    notebookWorldQuad.some((point) => !isNumberTuple(point, 3))
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
  const signedArea = points.reduce((area, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return area + x * nextY - y * nextX;
  }, 0);
  const [start, end] = points;
  const baselineRotationDegrees =
    (Math.abs(Math.atan2(end[1] - start[1], end[0] - start[0])) * 180) /
    Math.PI;
  return {
    endpointCoverage: Math.abs(signedArea) / 2,
    endpointBaselineRotationDegrees: Math.min(
      baselineRotationDegrees,
      180 - baselineRotationDegrees,
    ),
  };
}

function sightlineIntersectsNotebook(camera, notebookWorldQuad) {
  if (
    !Array.isArray(notebookWorldQuad) ||
    notebookWorldQuad.length !== 4 ||
    notebookWorldQuad.some((point) => !isNumberTuple(point, 3))
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

function cameraContractFailures(manifest) {
  const failures = [];
  for (const profile of ["wide", "portrait"]) {
    const variant = manifest.variants?.[profile];
    const endpoints = variant?.endpoints;
    const desk = endpoints?.desk?.projection?.camera;
    const films = endpoints?.films?.projection?.camera;
    const journalEndpoint = endpoints?.journal?.projection?.camera;
    const about = endpoints?.about?.projection?.camera;
    const transition = variant?.transitions?.["desk-journal"];
    const frames = transition?.frames ?? [];
    if (!desk || !films || !journalEndpoint || !about || frames.length < 3) {
      failures.push(`${profile}: camera manifest is incomplete`);
      continue;
    }
    for (const endpointId of ["opening", "desk", "films", "contact"]) {
      const expected = APPROVED_R3_ENDPOINT_CAMERAS[profile][endpointId];
      const actual = endpoints?.[endpointId]?.projection?.camera;
      if (
        !sameTuple(actual?.position, expected.position) ||
        !sameTuple(actual?.quaternion, expected.quaternion) ||
        actual?.fov !== expected.fov
      ) {
        failures.push(`${profile}: approved R3 ${endpointId} endpoint changed`);
      }
    }
    if (
      !sameTuple(films.position, desk.position) ||
      films.fov !== desk.fov ||
      sameTuple(films.quaternion, desk.quaternion)
    ) {
      failures.push(
        `${profile}: FILMS must preserve the exact desk position/FOV while changing only head rotation`,
      );
    }
    const journal = { ...variant.journal, ...transition };
    if (
      journal.journalHeadLeadSeconds !== 0 ||
      !(journal.translationStartsAtSeconds <= 1 / journal.fps) ||
      journal.motionModel !== "coupled-hip-pivot" ||
      !(journal.maxAngularStepDegrees <= 3)
    ) {
      failures.push(
        `${profile}: JOURNAL must use the coupled-hip-pivot path with no head lead, translation by frame 1, <=3 degree steps, <=12 degree baseline, and 40-60% notebook coverage`,
      );
    }
    const journalMetrics = projectedJournalEndpointMetrics(
      variant,
      journalEndpoint,
      journal.notebookWorldQuad,
    );
    if (
      !journalMetrics ||
      journalMetrics.endpointBaselineRotationDegrees > 12 ||
      journalMetrics.endpointCoverage < 0.4 ||
      journalMetrics.endpointCoverage > 0.6
    ) {
      failures.push(
        `${profile}: JOURNAL notebookWorldQuad projection must produce <=12 degree paragraph baseline rotation and 40-60% notebook coverage`,
      );
    }
    const firstTranslation = frames.findIndex(
      (frame) => !sameTuple(frame.camera?.position, desk.position),
    );
    if (firstTranslation < 0 || firstTranslation > 1) {
      failures.push(
        `${profile}: JOURNAL translation must begin at authored frame 1 or earlier; got frame ${firstTranslation}`,
      );
    }
    const missedNotebookAt = frames
      .slice(Math.max(firstTranslation, 0))
      .findIndex(
        (frame) =>
          !sightlineIntersectsNotebook(frame.camera, journal.notebookWorldQuad),
      );
    if (missedNotebookAt >= 0) {
      failures.push(
        `${profile}: JOURNAL sightline must intersect notebookWorldQuad at frame ${Math.max(firstTranslation, 0) + missedNotebookAt}`,
      );
    }
    const approvedAbout = APPROVED_R3_ENDPOINT_CAMERAS[profile].about;
    if (
      !sameTuple(about.position, approvedAbout.position) ||
      !sameTuple(about.quaternion, approvedAbout.quaternion) ||
      about.fov !== approvedAbout.fov
    ) {
      failures.push(`${profile}: approved ABOUT endpoint changed`);
    }
  }
  return failures;
}

if (manifestOnly) {
  const manifest = JSON.parse(
    await readFile("public/room/manifest.json", "utf8"),
  );
  const failures = cameraContractFailures(manifest);
  failures.forEach((failure) => console.log(`FAIL manifest: ${failure}`));
  if (failures.length === 0) {
    console.log(
      "PASS manifest: FILMS head-only, JOURNAL seated hinge, and approved ABOUT contracts",
    );
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

let failures = 0;

function fail(profile, message) {
  failures += 1;
  console.log(`FAIL ${profile}: ${message}`);
}

function pass(profile, message) {
  console.log(`PASS ${profile}: ${message}`);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNumberTuple(value, length) {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every(isFiniteNumber)
  );
}

function cameraSample(snapshot) {
  return snapshot?.camera ?? null;
}

function exactCameraMatch(a, b) {
  return JSON.stringify(cameraSample(a)) === JSON.stringify(cameraSample(b));
}

function positionDistance(a, b) {
  const left = cameraSample(a).position;
  const right = cameraSample(b).position;
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function yawOf(snapshot) {
  const quaternion = new Quaternion(...cameraSample(snapshot).quaternion);
  const direction = new Vector3(0, 0, -1).applyQuaternion(quaternion);
  return Math.atan2(direction.x, -direction.z);
}

function yawDelta(from, to) {
  let delta = yawOf(to) - yawOf(from);
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function validateSnapshot(profile, snapshot, expectedEndpoint) {
  const coverage = snapshot?.framing?.coverage;
  const valid =
    snapshot?.endpoint === expectedEndpoint &&
    snapshot?.phase === "resting" &&
    isNumberTuple(snapshot?.camera?.position, 3) &&
    isNumberTuple(snapshot?.camera?.quaternion, 4) &&
    isFiniteNumber(snapshot?.camera?.fov) &&
    coverage &&
    ["notebook", "contactPaper", "charger", "leftHistory"].every(
      (key) =>
        isFiniteNumber(coverage[key]) &&
        coverage[key] >= 0 &&
        coverage[key] <= 1,
    );
  if (!valid) {
    fail(
      profile,
      `${expectedEndpoint} camera snapshot is incomplete; expected resting endpoint, exact camera position/quaternion/fov, and projected framing coverage for notebook, contactPaper, charger, and leftHistory`,
    );
  }
  return valid;
}

async function cameraApiStatus(page) {
  return page.evaluate(() => {
    const debug = window.__lazyACameraDebug;
    return {
      available: Boolean(debug),
      methods: {
        snapshot: typeof debug?.snapshot === "function",
        history: typeof debug?.history === "function",
        clearHistory: typeof debug?.clearHistory === "function",
        requestDestination: typeof debug?.requestDestination === "function",
        close: typeof debug?.close === "function",
      },
    };
  });
}

async function snapshot(page) {
  return page.evaluate(() => window.__lazyACameraDebug.snapshot());
}

async function history(page) {
  return page.evaluate(() => window.__lazyACameraDebug.history());
}

async function clearHistory(page) {
  await page.evaluate(() => window.__lazyACameraDebug.clearHistory());
}

async function requestDestination(page, destination) {
  await page.evaluate(
    (id) => window.__lazyACameraDebug.requestDestination(id),
    destination,
  );
}

async function closeDestination(page) {
  await page.evaluate(() => window.__lazyACameraDebug.close());
}

async function waitForEndpoint(page, endpoint) {
  await page.waitForFunction(
    (id) => {
      const state = window.__lazyACameraDebug.snapshot();
      return state?.phase === "resting" && state?.endpoint === id;
    },
    endpoint,
    { timeout: TRANSITION_TIMEOUT_MS },
  );
  await page.waitForFunction(
    (id) => window.__lazyAPlateState?.state === `resting:${id}`,
    endpoint,
    { timeout: TRANSITION_TIMEOUT_MS },
  );
  return snapshot(page);
}

function assertConstantFov(profile, desk, endpoint, name) {
  if (cameraSample(endpoint).fov !== cameraSample(desk).fov) {
    fail(
      profile,
      `${name} changed focal length from ${cameraSample(desk).fov} to ${cameraSample(endpoint).fov}`,
    );
    return false;
  }
  return true;
}

function assertExactDesk(profile, expectedDesk, actualDesk, context) {
  if (!exactCameraMatch(expectedDesk, actualDesk)) {
    fail(
      profile,
      `${context} did not restore the exact desk camera; expected ${JSON.stringify(cameraSample(expectedDesk))}, got ${JSON.stringify(cameraSample(actualDesk))}`,
    );
    return false;
  }
  pass(profile, `${context} restores the exact desk camera sample`);
  return true;
}

function assertDeskRouted(profile, routeHistory, from, to) {
  if (!Array.isArray(routeHistory)) {
    fail(profile, `${from} -> ${to} history is not an array`);
    return;
  }
  const settledEndpoints = routeHistory
    .filter((entry) => entry?.phase === "resting")
    .map((entry) => entry.endpoint);
  const deskIndex = settledEndpoints.indexOf("desk");
  const targetIndex = settledEndpoints.lastIndexOf(to);
  if (deskIndex === -1 || targetIndex === -1 || deskIndex > targetIndex) {
    fail(
      profile,
      `${from} -> ${to} must settle at desk before ${to}; observed resting endpoints ${JSON.stringify(settledEndpoints)}`,
    );
  } else {
    pass(profile, `${from} -> ${to} routes through a settled desk state`);
  }
}

function assertJournal(profile, desk, journal) {
  const coverage = journal.framing.coverage.notebook;
  const travel = positionDistance(desk, journal);
  if (travel < MIN_JOURNAL_TRAVEL) {
    fail(
      profile,
      `JOURNAL endpoint moved only ${travel.toFixed(4)}m; expected an observable upper-body lean of at least ${MIN_JOURNAL_TRAVEL}m`,
    );
  }
  if (coverage < JOURNAL_MIN_COVERAGE || coverage > JOURNAL_MAX_COVERAGE) {
    fail(
      profile,
      `JOURNAL notebook framing is ${(coverage * 100).toFixed(1)}%; expected approximately half the frame (${JOURNAL_MIN_COVERAGE * 100}-${JOURNAL_MAX_COVERAGE * 100}%)`,
    );
  }
  if (
    travel >= MIN_JOURNAL_TRAVEL &&
    coverage >= JOURNAL_MIN_COVERAGE &&
    coverage <= JOURNAL_MAX_COVERAGE
  ) {
    pass(
      profile,
      `JOURNAL reaches an observable ${travel.toFixed(3)}m lean with ${(coverage * 100).toFixed(1)}% notebook framing`,
    );
  }
}

function assertContact(profile, desk, contact) {
  const coverage = contact.framing.coverage;
  const turn = yawDelta(desk, contact);
  if (turn > MAX_CONTACT_YAW_FROM_DESK) {
    fail(
      profile,
      `CONTACT turns ${turn.toFixed(3)}rad right from desk; the old right-facing charger pose is forbidden (max ${MAX_CONTACT_YAW_FROM_DESK}rad)`,
    );
  }
  if (coverage.contactPaper <= 0 || coverage.contactPaper <= coverage.charger) {
    fail(
      profile,
      `CONTACT framing must favor the contact paper over the charger; contactPaper=${coverage.contactPaper}, charger=${coverage.charger}`,
    );
  }
  if (
    turn <= MAX_CONTACT_YAW_FROM_DESK &&
    coverage.contactPaper > 0 &&
    coverage.contactPaper > coverage.charger
  ) {
    pass(
      profile,
      "CONTACT remains desk-oriented and frames the contact paper, not the charger",
    );
  }
}

function assertAbout(profile, desk, about) {
  const turn = yawDelta(desk, about);
  const leftHistory = about.framing.coverage.leftHistory;
  if (turn > -MIN_ABOUT_LEFT_YAW) {
    fail(
      profile,
      `ABOUT yaw delta is ${turn.toFixed(3)}rad; expected a left turn of at least ${MIN_ABOUT_LEFT_YAW}rad`,
    );
  }
  if (leftHistory <= 0) {
    fail(profile, "ABOUT endpoint does not frame the left-history region");
  }
  if (turn <= -MIN_ABOUT_LEFT_YAW && leftHistory > 0) {
    pass(
      profile,
      `ABOUT reaches the left endpoint (${turn.toFixed(3)}rad, ${(leftHistory * 100).toFixed(1)}% history framing)`,
    );
  }
}

try {
  for (const viewport of VIEWPORTS) {
    const profile = `${viewport.name} ${viewport.width}x${viewport.height}`;
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(url, { waitUntil: "load" });
      try {
        await page.waitForFunction(() => window.__arrivalDone === true, null, {
          timeout: ARRIVAL_TIMEOUT_MS,
        });
      } catch {
        fail(profile, "arrival did not expose window.__arrivalDone=true");
        continue;
      }

      const api = await cameraApiStatus(page);
      if (
        !api.available ||
        Object.values(api.methods).some((value) => !value)
      ) {
        fail(
          profile,
          "camera observability is insufficient: window.__lazyACameraDebug must expose snapshot(), history(), clearHistory(), requestDestination(id), and close(). Snapshots must report endpoint, phase, camera position/quaternion/fov, and projected framing coverage. window.__lazyAConversation alone cannot prove endpoint transforms, exact desk restoration, framing, or desk-routed switches.",
        );
        continue;
      }

      const desk = await waitForEndpoint(page, "desk");
      if (!validateSnapshot(profile, desk, "desk")) continue;

      await requestDestination(page, "journal");
      const firstJournal = await waitForEndpoint(page, "journal");
      if (validateSnapshot(profile, firstJournal, "journal")) {
        assertConstantFov(profile, desk, firstJournal, "JOURNAL");
        assertJournal(profile, desk, firstJournal);
      }

      await closeDestination(page);
      const deskAfterJournal = await waitForEndpoint(page, "desk");
      if (validateSnapshot(profile, deskAfterJournal, "desk")) {
        assertExactDesk(profile, desk, deskAfterJournal, "JOURNAL return");
      }

      await requestDestination(page, "journal");
      await waitForEndpoint(page, "journal");

      await clearHistory(page);
      await requestDestination(page, "contact");
      const contact = await waitForEndpoint(page, "contact");
      assertDeskRouted(profile, await history(page), "journal", "contact");
      if (validateSnapshot(profile, contact, "contact")) {
        assertConstantFov(profile, desk, contact, "CONTACT");
        assertContact(profile, desk, contact);
      }

      await clearHistory(page);
      await requestDestination(page, "about");
      const about = await waitForEndpoint(page, "about");
      assertDeskRouted(profile, await history(page), "contact", "about");
      if (validateSnapshot(profile, about, "about")) {
        assertConstantFov(profile, desk, about, "ABOUT");
        assertAbout(profile, desk, about);
      }

      await clearHistory(page);
      await requestDestination(page, "films");
      const films = await waitForEndpoint(page, "films");
      assertDeskRouted(profile, await history(page), "about", "films");
      if (validateSnapshot(profile, films, "films")) {
        assertConstantFov(profile, desk, films, "FILMS");
      }

      await closeDestination(page);
      const finalDesk = await waitForEndpoint(page, "desk");
      if (validateSnapshot(profile, finalDesk, "desk")) {
        assertExactDesk(
          profile,
          desk,
          finalDesk,
          "destination sequence return",
        );
      }
    } catch (error) {
      fail(
        profile,
        `camera gate could not complete: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

process.exit(failures ? 1 : 0);
