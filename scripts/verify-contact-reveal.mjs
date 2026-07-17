/**
 * Work Order 0117-R CONTACT material-reveal gate.
 *
 * The page must expose this diagnostic marker on every animation frame.
 * Missing observability is a failure:
 *
 *   window.__lazyAContactReveal = {
 *     phase: "idle" | "revealing" | "hold" | "reversing",
 *     mechanism: "raking-light",
 *     lampLevel: number,             // 0..1
 *     revealLevel: number,           // 0..1
 *     paperOpacity: number,          // fixed across every phase
 *     standalonePlaneCount: number,  // CONTACT/email planes; must be 0
 *   };
 *
 * Usage:
 *   node scripts/verify-contact-reveal.mjs [url] [--out-dir path]
 */

import { mkdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";

import { chromium } from "playwright";
import sharp from "sharp";

const args = process.argv.slice(2);
const manifestOnly = args.includes("--manifest-only");
const selfTest = args.includes("--self-test");
const baseUrl =
  args.find((argument) => !argument.startsWith("--")) ??
  "http://localhost:3000/";
const outDirIndex = args.indexOf("--out-dir");
const outDir = resolve(
  outDirIndex >= 0
    ? args[outDirIndex + 1]
    : `${tmpdir()}/lazy-a-0117-r-contact`,
);
const CONTACT_VIEWPORTS = {
  wide: { width: 1280, height: 720 },
  portrait: { width: 375, height: 812 },
};
const viewport = CONTACT_VIEWPORTS.wide;
const SAMPLE_INTERVAL_MS = 100;
const MID_REVEAL_MIN = 0.68;
const MID_REVEAL_MAX = 0.82;
const EXPECTED_CONTACT_COPY = [
  "Jonathan Adelson",
  "JonathanAdelson1@gmail.com",
  "1-310-709-9283",
].join("\n");
const EXPECTED_INDENT_DEPTH = 0.0003;
const MAX_GRAZING_ANGLE_DEGREES = 35;
const CONTACT_ACTIVATION_SAMPLES = 31;
const PRACTICAL_AUTHORING_MANIFEST =
  "/room/contact/practical-light-authoring-manifest.json";
const PRACTICAL_AUTHORING_GENERATOR = "blender-background-python";
const PRACTICAL_MASTER_BLEND = "build/wo-0117-r/master.blend";
const PRACTICAL_RENDER_SCRIPT = "scripts/render-master-shots.py";
const PRACTICAL_BULB_OBJECT = "ContactPracticalBulb";
const PRACTICAL_SHADE_OBJECT = "ContactPracticalShadeInterior";
const MAX_PRACTICAL_AUTHORING_BYTES = 256 * 1024;
const MIN_BULB_LUMINANCE_RISE = 20;
const MIN_SHADE_INTERIOR_LUMINANCE_RISE = 8;
const APPROVED_R3_CONTACT_PATH_SHA256 = {
  wide: "f9432c37d2e081d41d9e745ffe6dc8807f8e0255dec6f9701a130d0706aba375",
  portrait: "496a618f0a311cdf52717a7376387da075c173639899ff88af4361b3df48054c",
};
const APPROVED_R3_DESK_CAMERAS = {
  wide: {
    position: [0.050000000745, 1.600000023842, 1.450000047684],
    quaternion: [
      -0.142799422145, 0.007813094184, 0.001127292984, 0.989720225334,
    ],
    fov: 35,
  },
  portrait: {
    position: [0.299162566662, 1.600000023842, 2.349999904633],
    quaternion: [
      -0.098435617983, -0.020484184846, -0.002026646631, 0.994930505753,
    ],
    fov: 35,
  },
};
const MID_LAMP_POOL_REGION = {
  x: 0.28,
  y: 0.22,
  width: 0.05,
  height: 0.08,
};
const MID_UNLIT_TABLE_REGION = {
  x: 0.72,
  y: 0.22,
  width: 0.05,
  height: 0.08,
};

function exactCameraMatch(left, right) {
  return (
    JSON.stringify(left?.camera ?? left) ===
    JSON.stringify(right?.camera ?? right)
  );
}

function monotonicallyRises(values) {
  return (
    values.length > 1 &&
    values.every(
      (value, index) =>
        Number.isFinite(value) && (index === 0 || value >= values[index - 1]),
    ) &&
    values.at(-1) > values[0]
  );
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

function quadArea(quad) {
  let area = 0;
  for (let index = 0; index < quad.length; index += 2) {
    const next = (index + 2) % quad.length;
    area += quad[index] * quad[next + 1] - quad[next] * quad[index + 1];
  }
  return Math.abs(area) / 2;
}

function practicalAuthoringContractIssues(authoring) {
  const issues = [];
  if (
    authoring?.version !== 1 ||
    authoring?.immutable !== true ||
    authoring?.generator?.identity !== PRACTICAL_AUTHORING_GENERATOR ||
    authoring?.generator?.browserRuntime !== false
  ) {
    issues.push(
      "practical-light authoring must be immutable non-browser Blender output",
    );
  }
  for (const [key, expectedPath] of [
    ["masterBlend", PRACTICAL_MASTER_BLEND],
    ["renderScript", PRACTICAL_RENDER_SCRIPT],
  ]) {
    const source = authoring?.sources?.[key];
    if (source?.path !== expectedPath || !isSha256(source?.sha256)) {
      issues.push(`${key} path and SHA-256 source relationship is invalid`);
    }
  }
  const expectedGeometry = [
    ["bulb", PRACTICAL_BULB_OBJECT],
    ["shadeInterior", PRACTICAL_SHADE_OBJECT],
  ];
  for (const [key, object] of expectedGeometry) {
    if (
      authoring?.geometry?.[key]?.object !== object ||
      !isSha256(authoring?.geometry?.[key]?.geometrySha256)
    ) {
      issues.push(`${object} source geometry hash is invalid`);
    }
  }
  for (const [profile, expectedViewport] of Object.entries(CONTACT_VIEWPORTS)) {
    const projection = authoring?.profiles?.[profile];
    if (!projection) {
      issues.push(`${profile} practical-light projection is missing`);
      continue;
    }
    if (
      JSON.stringify(projection.viewport) !==
        JSON.stringify([expectedViewport.width, expectedViewport.height]) ||
      projection.deskCameraSha256 !==
        sha256Canonical(APPROVED_R3_DESK_CAMERAS[profile])
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
    for (const [key, object] of expectedGeometry) {
      const region = projection[key];
      const topGeometry = authoring?.geometry?.[key];
      if (
        region?.object !== object ||
        region?.geometrySha256 !== topGeometry?.geometrySha256
      ) {
        issues.push(`${profile} ${key} geometry hash does not match source`);
      }
      if (
        !Array.isArray(region?.quad) ||
        region.quad.length !== 8 ||
        region.quad.some(
          (value) => !Number.isFinite(value) || value < 0 || value > 1,
        ) ||
        quadArea(region.quad) < 0.00001
      ) {
        issues.push(`${profile} ${key} projected quad is invalid`);
      }
      if (
        typeof region?.mask?.path !== "string" ||
        !/^[a-z0-9][a-z0-9._-]*\.png$/.test(region.mask.path) ||
        !isSha256(region?.mask?.sha256)
      ) {
        issues.push(`${profile} ${key} projected mask relationship is invalid`);
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
        `${profile} bulb and shade interior need distinct geometry projections`,
      );
    }
  }
  return issues;
}

function practicalAuthoringDeclarationIssues(manifest) {
  const verification = manifest?.verification;
  const issues = [];
  if (
    verification?.contactPracticalAuthoringManifest !==
      PRACTICAL_AUTHORING_MANIFEST ||
    !isSha256(verification?.contactPracticalAuthoringManifestSha256)
  ) {
    issues.push(
      "manifest must pin the immutable practical-light authoring manifest by SHA-256",
    );
  }
  return issues;
}

async function localPracticalAuthoringSourceIssues(authoring) {
  const issues = [];
  for (const [key, expectedPath] of [
    ["masterBlend", PRACTICAL_MASTER_BLEND],
    ["renderScript", PRACTICAL_RENDER_SCRIPT],
  ]) {
    const source = authoring?.sources?.[key];
    if (source?.path !== expectedPath || !isSha256(source?.sha256)) continue;
    try {
      const bytes = await readFile(resolve(source.path));
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== source.sha256) {
        issues.push(`${key} SHA-256 ${actual} does not match ${source.sha256}`);
      }
    } catch (error) {
      issues.push(`${key} source cannot be read: ${error.message}`);
    }
  }
  return issues;
}

function assertR4ContactContract(contact, transition) {
  assert.equal(contact.activationHoldSeconds, 1);
  assert.equal(contact.visibleBulb, true);
  assert.equal(contact.visibleShadeInterior, true);
  assert.ok(contact.shadeAxisErrorDegrees <= 12);
  assert.equal(contact.lightIntersectsPaper, true);
  assert.equal(transition.duration, 1.9);
}

function assertR4ContactStubsFail() {
  const contact = {
    activationHoldSeconds: 1,
    visibleBulb: true,
    visibleShadeInterior: true,
    shadeAxisErrorDegrees: 12,
    lightIntersectsPaper: true,
  };
  const transition = { duration: 1.9 };
  assert.doesNotThrow(() => assertR4ContactContract(contact, transition));
  const stubs = [
    [{ ...contact, activationHoldSeconds: 0 }, transition],
    [{ ...contact, visibleBulb: false }, transition],
    [{ ...contact, visibleShadeInterior: false }, transition],
    [{ ...contact, shadeAxisErrorDegrees: 13 }, transition],
    [{ ...contact, lightIntersectsPaper: false }, transition],
    [contact, { duration: 0.9 }],
  ];
  for (const [stubContact, stubTransition] of stubs) {
    assert.throws(() => assertR4ContactContract(stubContact, stubTransition));
  }
}

function contactManifestFailures(manifest, authoring = null) {
  const failures = practicalAuthoringDeclarationIssues(manifest);
  if (authoring) {
    failures.push(...practicalAuthoringContractIssues(authoring));
  }
  for (const [profile, variant] of Object.entries(manifest.variants ?? {})) {
    const contact = variant.contact;
    if (!contact) {
      failures.push(`${profile}: CONTACT manifest data missing`);
      continue;
    }
    const transition = variant.transitions?.["desk-contact"];
    try {
      assertR4ContactContract(contact, transition ?? {});
    } catch (error) {
      failures.push(
        `${profile}: CONTACT requires a visible practical and a 1.0s activation hold (${error.message})`,
      );
    }
    if (
      contact.materialMechanism !== "lamp-reactive-compressed-fiber-groove" ||
      contact.coloredRevealMixCount !== 1 ||
      contact.fiberResponseAnimated !== true ||
      contact.fiberResponseNormalWeighted !== true ||
      contact.normalResponseAnimated !== true ||
      contact.physicalOcclusionResponse !== true ||
      !(contact.fiberResponseFloorPeak < contact.fiberResponseWallPeak) ||
      contact.idleFillStrength !== 0.15 ||
      contact.geometryAnimated !== false ||
      contact.indentDepth !== EXPECTED_INDENT_DEPTH ||
      !Number.isFinite(contact.grazingAngleDegrees) ||
      contact.grazingAngleDegrees > MAX_GRAZING_ANGLE_DEGREES
    ) {
      failures.push(
        `${profile}: CONTACT must use fixed geometry and a lamp-reactive compressed-fiber groove`,
      );
    }
    if (
      !Array.isArray(contact.lightOrigin) ||
      contact.lightOrigin.length !== 3 ||
      !Array.isArray(contact.lightTarget) ||
      contact.lightTarget.length !== 3 ||
      contact.lightInsideShade !== true ||
      contact.lightIntersectsPaper !== true
    ) {
      failures.push(
        `${profile}: CONTACT light must originate inside the visible lamp shade and intersect the contact paper`,
      );
    }
    const frames = transition?.frames ?? [];
    if (
      frames.length === 0 ||
      frames.some((frame) => frame.contactIndentDepth !== contact.indentDepth)
    ) {
      failures.push(
        `${profile}: CONTACT indentation depth must remain physically fixed through the light reveal`,
      );
    }
    const desk = variant.endpoints?.desk?.projection?.camera;
    const approvedDesk = APPROVED_R3_DESK_CAMERAS[profile];
    const activationFrames = frames.slice(0, CONTACT_ACTIVATION_SAMPLES);
    if (
      !desk ||
      !exactCameraMatch(desk, approvedDesk) ||
      activationFrames.length !== CONTACT_ACTIVATION_SAMPLES ||
      activationFrames.some((frame) => !exactCameraMatch(frame.camera, desk))
    ) {
      failures.push(
        `${profile}: CONTACT must hold the approved R3 desk camera for the first ${CONTACT_ACTIVATION_SAMPLES} authored samples`,
      );
    }
    if (
      !monotonicallyRises(
        activationFrames.map((frame) => frame.visibleBulbLevel),
      ) ||
      !monotonicallyRises(activationFrames.map((frame) => frame.lampLevel))
    ) {
      failures.push(
        `${profile}: CONTACT visibleBulbLevel and lampLevel must rise monotonically during the 1.0s activation hold`,
      );
    }
    if (
      !frames[CONTACT_ACTIVATION_SAMPLES] ||
      exactCameraMatch(frames[CONTACT_ACTIVATION_SAMPLES].camera, desk)
    ) {
      failures.push(
        `${profile}: CONTACT camera movement must begin at sample ${CONTACT_ACTIVATION_SAMPLES}`,
      );
    }
    const approvedPath = frames
      .slice(CONTACT_ACTIVATION_SAMPLES)
      .map(({ camera }) => camera);
    const approvedHash = createHash("sha256")
      .update(JSON.stringify(approvedPath))
      .digest("hex");
    if (
      approvedPath.length !== 27 ||
      approvedHash !== APPROVED_R3_CONTACT_PATH_SHA256[profile]
    ) {
      failures.push(
        `${profile}: CONTACT post-hold normalized camera samples must equal the approved R3 path`,
      );
    }
  }
  assertR4ContactStubsFail();
  return failures;
}

async function loadLocalPracticalAuthoring(manifest) {
  const declarationIssues = practicalAuthoringDeclarationIssues(manifest);
  if (declarationIssues.length > 0) {
    return { authoring: null, issues: declarationIssues };
  }
  const declaredPath = manifest.verification.contactPracticalAuthoringManifest;
  const localPath = resolve("public", declaredPath.replace(/^\/+/, ""));
  try {
    const bytes = await readFile(localPath);
    if (bytes.length > MAX_PRACTICAL_AUTHORING_BYTES) {
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
    return {
      authoring,
      issues: await localPracticalAuthoringSourceIssues(authoring),
    };
  } catch (error) {
    return {
      authoring: null,
      issues: [
        `practical-light authoring manifest unavailable: ${error.message}`,
      ],
    };
  }
}

if (selfTest) {
  assertR4ContactStubsFail();
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
  const practicalGeometry = {
    bulb: {
      object: "ContactPracticalBulb",
      geometrySha256: fixtureHash("bulb-geometry"),
    },
    shadeInterior: {
      object: "ContactPracticalShadeInterior",
      geometrySha256: fixtureHash("shade-geometry"),
    },
  };
  const practicalProfiles = Object.fromEntries(
    Object.entries(APPROVED_R3_DESK_CAMERAS).map(([profile, camera]) => {
      const projection = {
        viewport: profile === "wide" ? [1280, 720] : [375, 812],
        deskCameraSha256: createHash("sha256")
          .update(canonicalFixture(camera))
          .digest("hex"),
        bulb: {
          ...practicalGeometry.bulb,
          quad: [0.1, 0.1, 0.2, 0.1, 0.2, 0.2, 0.1, 0.2],
          mask: {
            path: `${profile}-bulb-mask.png`,
            sha256: fixtureHash(`${profile}-bulb-mask`),
          },
        },
        shadeInterior: {
          ...practicalGeometry.shadeInterior,
          quad: [0.3, 0.1, 0.5, 0.1, 0.5, 0.25, 0.3, 0.25],
          mask: {
            path: `${profile}-shade-mask.png`,
            sha256: fixtureHash(`${profile}-shade-mask`),
          },
        },
      };
      return [
        profile,
        {
          ...projection,
          projectionSha256: createHash("sha256")
            .update(canonicalFixture(projection))
            .digest("hex"),
        },
      ];
    }),
  );
  const practicalAuthoring = {
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
    },
    geometry: practicalGeometry,
    profiles: practicalProfiles,
  };
  assert.deepEqual(
    practicalAuthoringContractIssues(practicalAuthoring),
    [],
    "geometry-projected practical authoring for wide and portrait should pass",
  );
  const wrongCameraAuthoring = structuredClone(practicalAuthoring);
  wrongCameraAuthoring.profiles.wide.deskCameraSha256 =
    fixtureHash("wrong-camera");
  assert.match(
    practicalAuthoringContractIssues(wrongCameraAuthoring).join("\n"),
    /camera/,
    "mismatched immutable desk-camera hashes must fail",
  );
  const wrongGeometryAuthoring = structuredClone(practicalAuthoring);
  wrongGeometryAuthoring.profiles.wide.bulb.geometrySha256 =
    fixtureHash("wrong-bulb");
  assert.match(
    practicalAuthoringContractIssues(wrongGeometryAuthoring).join("\n"),
    /geometry/,
    "mismatched bulb/shade geometry hashes must fail",
  );
  const missingPortraitAuthoring = structuredClone(practicalAuthoring);
  delete missingPortraitAuthoring.profiles.portrait;
  assert.match(
    practicalAuthoringContractIssues(missingPortraitAuthoring).join("\n"),
    /portrait/,
    "missing portrait practical evidence must fail",
  );
  const grayFixture = (value = 20) => ({
    data: Buffer.alloc(20 * 20, value),
    width: 20,
    height: 20,
  });
  const practicalRegions = {
    bulb: [0.1, 0.1, 0.2, 0.1, 0.2, 0.2, 0.1, 0.2],
    shadeInterior: [0.3, 0.1, 0.5, 0.1, 0.5, 0.25, 0.3, 0.25],
  };
  const brighten = (image, quad, amount) => {
    const bounds = boundsFromQuad(quad, image);
    for (let y = bounds.top; y < bounds.bottom; y += 1) {
      for (let x = bounds.left; x < bounds.right; x += 1) {
        image.data[y * image.width + x] += amount;
      }
    }
  };
  const rest = grayFixture();
  const lit = grayFixture();
  brighten(lit, practicalRegions.bulb, 40);
  brighten(lit, practicalRegions.shadeInterior, 20);
  const maskFor = (quad) => {
    const mask = grayFixture(0);
    const bounds = boundsFromQuad(quad, mask);
    for (let y = bounds.top; y < bounds.bottom; y += 1) {
      for (let x = bounds.left; x < bounds.right; x += 1) {
        mask.data[y * mask.width + x] = 255;
      }
    }
    return mask;
  };
  const practicalMasks = {
    bulb: maskFor(practicalRegions.bulb),
    shadeInterior: maskFor(practicalRegions.shadeInterior),
  };
  assert.deepEqual(
    practicalLightMaskIssues(rest, lit, practicalMasks),
    [],
    "geometry-projected bulb and shade-interior luminance rises should pass",
  );

  const independentDeskLight = grayFixture();
  brighten(
    independentDeskLight,
    [0.65, 0.65, 0.95, 0.65, 0.95, 0.95, 0.65, 0.95],
    80,
  );
  assert.match(
    practicalLightMaskIssues(rest, independentDeskLight, practicalMasks).join(
      "; ",
    ),
    /bulb[\s\S]*shade interior|shade interior[\s\S]*bulb/,
    "an independent desk light with an invisible practical must fail",
  );
  assert.match(
    practicalLightMaskIssues(rest, independentDeskLight, {
      bulb: maskFor(practicalRegions.bulb),
      shadeInterior: maskFor(practicalRegions.shadeInterior),
    }).join("\n"),
    /bulb[\s\S]*shade interior|shade interior[\s\S]*bulb/,
    "arbitrary bright regions outside geometry-projected masks must fail",
  );

  console.log(
    "contact-reveal self-tests passed (camera/geometry hash, portrait, arbitrary-region, and invisible-practical negatives).",
  );
  process.exit(0);
}

if (manifestOnly) {
  const manifest = JSON.parse(
    await readFile(resolve("public/room/manifest.json"), "utf8"),
  );
  const loadedAuthoring = await loadLocalPracticalAuthoring(manifest);
  const failures = [
    ...new Set([
      ...contactManifestFailures(manifest, loadedAuthoring.authoring),
      ...loadedAuthoring.issues,
    ]),
  ];
  failures.forEach((failure) => console.log(`FAIL ${failure}`));
  if (failures.length === 0) {
    console.log(
      "PASS CONTACT manifest uses fixed physical indentation and lamp-origin fiber response",
    );
  }
  process.exit(failures.length === 0 ? 0 : 1);
}

function inspectContact() {
  const marker = window.__lazyAContactReveal ?? null;
  const visible = (element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) > 0 &&
      bounds.width > 0 &&
      bounds.height > 0
    );
  };
  const standaloneDomPlanes = [
    ...document.querySelectorAll(
      '[data-contact-plane="true"], [data-email-plane="true"], [data-contact-overlay="true"]',
    ),
  ]
    .filter(visible)
    .map((element) => element.outerHTML.slice(0, 180));
  return {
    at: performance.now(),
    endpoint: window.__lazyAEndpoint ?? window.__lazyAConversation ?? null,
    camera: window.__lazyACameraDebug?.snapshot?.() ?? null,
    marker,
    standaloneDomPlanes,
  };
}

function isFiniteLevel(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function longestTrueDuration(samples, predicate) {
  let longest = 0;
  let startedAt = null;
  for (const sample of samples) {
    if (predicate(sample)) {
      if (startedAt === null) startedAt = sample.at;
      longest = Math.max(longest, sample.at - startedAt);
    } else {
      startedAt = null;
    }
  }
  return longest;
}

async function collect(page, durationMs, onSample) {
  const samples = [];
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    const sample = await page.evaluate(inspectContact);
    samples.push(sample);
    if (onSample) await onSample(sample);
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }
  return samples;
}

async function activatePhysicalContact(page) {
  await page.waitForFunction(() => window.__arrivalDone === true, null, {
    timeout: 15_000,
  });
  const screen = await page.evaluate(() => {
    const debug = window.__lazyANavigationDebug;
    const row = debug?.sheet?.rows?.find(({ id }) => id === "contact");
    if (!row || typeof debug?.projectSheetPoint !== "function") return null;
    return debug.projectSheetPoint(
      row.rect.x + row.rect.width / 2,
      row.rect.y + row.rect.height / 2,
    );
  });
  if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
    throw new Error("CONTACT physical row center is unavailable");
  }
  await page.mouse.move(screen.x, screen.y, { steps: 4 });
  await page.waitForTimeout(120);
  const candidate = await page.evaluate(
    () => window.__lazyANavCandidate ?? null,
  );
  if (candidate !== "contact") {
    throw new Error(`CONTACT physical row resolved to ${String(candidate)}`);
  }
  await page.mouse.click(screen.x, screen.y);
}

async function captureStationaryPracticalProfile(
  browserInstance,
  profile,
  paths,
) {
  const profileViewport = CONTACT_VIEWPORTS[profile];
  const restPage = await browserInstance.newPage({
    viewport: profileViewport,
  });
  await restPage.goto(baseUrl, { waitUntil: "load" });
  await restPage.waitForFunction(() => window.__arrivalDone === true, null, {
    timeout: 15_000,
  });
  const rest = await restPage.evaluate(inspectContact);
  await restPage.screenshot({ path: paths.rest });
  await restPage.close();

  const activationPage = await browserInstance.newPage({
    viewport: profileViewport,
  });
  await activationPage.goto(baseUrl, { waitUntil: "load" });
  await activatePhysicalContact(activationPage);
  let activation = null;
  await collect(activationPage, 2_200, async (sample) => {
    if (
      !activation &&
      exactCameraMatch(sample.camera, APPROVED_R3_DESK_CAMERAS[profile]) &&
      sample.marker?.lampLevel >= 0.9
    ) {
      activation = sample;
      await activationPage.screenshot({ path: paths.activationLit });
    }
  });
  if (!activation) {
    await activationPage.screenshot({ path: paths.activationLit });
  }
  await activationPage.close();
  return { rest, activation };
}

async function readGrayImage(path) {
  const { data, info } = await sharp(path)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function loadPracticalMaskAssets(authoring) {
  const authoringPath = resolve(
    "public",
    PRACTICAL_AUTHORING_MANIFEST.replace(/^\/+/, ""),
  );
  const profiles = {};
  const issues = [];
  for (const [profile, viewportSize] of Object.entries(CONTACT_VIEWPORTS)) {
    profiles[profile] = {};
    for (const key of ["bulb", "shadeInterior"]) {
      const region = authoring?.profiles?.[profile]?.[key];
      try {
        const path = resolve(dirname(authoringPath), region.mask.path);
        const bytes = await readFile(path);
        const actualSha256 = createHash("sha256").update(bytes).digest("hex");
        if (actualSha256 !== region.mask.sha256) {
          issues.push(
            `${profile} ${key} mask SHA-256 ${actualSha256} does not match ${region.mask.sha256}`,
          );
          continue;
        }
        const { data, info } = await sharp(bytes)
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const mask = { data, width: info.width, height: info.height };
        issues.push(
          ...practicalMaskProjectionIssues(mask, region.quad, viewportSize).map(
            (issue) => `${profile} ${key}: ${issue}`,
          ),
        );
        profiles[profile][key] = mask;
      } catch (error) {
        issues.push(
          `${profile} ${key} geometry-projected mask unavailable: ${error.message}`,
        );
      }
    }
  }
  return { profiles, issues };
}

function boundsFromQuad(quad, image) {
  const xs = quad.filter((_, index) => index % 2 === 0);
  const ys = quad.filter((_, index) => index % 2 === 1);
  const left = Math.max(0, Math.floor(Math.min(...xs) * image.width));
  const right = Math.min(image.width, Math.ceil(Math.max(...xs) * image.width));
  const top = Math.max(0, Math.floor(Math.min(...ys) * image.height));
  const bottom = Math.min(
    image.height,
    Math.ceil(Math.max(...ys) * image.height),
  );
  return { left, top, right, bottom };
}

function boundsFromRegion(region, image) {
  return {
    left: Math.floor(region.x * image.width),
    top: Math.floor(region.y * image.height),
    right: Math.ceil((region.x + region.width) * image.width),
    bottom: Math.ceil((region.y + region.height) * image.height),
  };
}

function regionValues(image, bounds) {
  const values = [];
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      values.push(image.data[y * image.width + x]);
    }
  }
  return values;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function practicalLightMaskMetrics(rest, lit, masks) {
  const rises = {};
  for (const key of ["bulb", "shadeInterior"]) {
    const mask = masks[key];
    const differences = [];
    for (let index = 0; index < mask.data.length; index += 1) {
      if (mask.data[index] >= 128) {
        differences.push(lit.data[index] - rest.data[index]);
      }
    }
    rises[key] = differences.length > 0 ? mean(differences) : Number.NaN;
  }
  return rises;
}

function practicalLightMaskIssues(rest, lit, masks) {
  const issues = [];
  if (
    rest?.width !== lit?.width ||
    rest?.height !== lit?.height ||
    !Buffer.isBuffer(rest?.data) ||
    !Buffer.isBuffer(lit?.data) ||
    rest.data.length !== rest.width * rest.height ||
    lit.data.length !== lit.width * lit.height
  ) {
    return [...issues, "rest and lit practical-light images must match"];
  }
  for (const [label, mask] of [
    ["bulb", masks?.bulb],
    ["shade interior", masks?.shadeInterior],
  ]) {
    const marked = Buffer.isBuffer(mask?.data)
      ? [...mask.data].filter((value) => value >= 128).length
      : 0;
    if (
      mask?.width !== rest.width ||
      mask?.height !== rest.height ||
      mask?.data?.length !== rest.data.length ||
      marked < 4
    ) {
      issues.push(`${label} geometry-projected mask is invalid`);
    }
  }
  if (issues.length > 0) return issues;
  const rises = practicalLightMaskMetrics(rest, lit, masks);
  if (!Number.isFinite(rises.bulb) || rises.bulb < MIN_BULB_LUMINANCE_RISE) {
    issues.push(
      `bulb luminance rise ${String(rises.bulb)} is below ${MIN_BULB_LUMINANCE_RISE}`,
    );
  }
  if (
    !Number.isFinite(rises.shadeInterior) ||
    rises.shadeInterior < MIN_SHADE_INTERIOR_LUMINANCE_RISE
  ) {
    issues.push(
      `shade interior luminance rise ${String(rises.shadeInterior)} is below ${MIN_SHADE_INTERIOR_LUMINANCE_RISE}`,
    );
  }
  return issues;
}

function practicalMaskProjectionIssues(mask, quad, viewport) {
  const issues = [];
  if (
    mask?.width !== viewport.width ||
    mask?.height !== viewport.height ||
    !Buffer.isBuffer(mask?.data) ||
    mask.data.length !== viewport.width * viewport.height
  ) {
    return ["geometry-projected mask dimensions do not match its viewport"];
  }
  const bounds = boundsFromQuad(quad, mask);
  let marked = 0;
  let outside = 0;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x] < 128) continue;
      marked += 1;
      if (
        x < bounds.left ||
        x >= bounds.right ||
        y < bounds.top ||
        y >= bounds.bottom
      ) {
        outside += 1;
      }
    }
  }
  if (marked < 16) {
    issues.push("geometry-projected mask is not substantial");
  }
  if (marked > 0 && outside / marked > 0.01) {
    issues.push("geometry-projected mask escapes its projected geometry quad");
  }
  return issues;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function regionContrast(image, bounds) {
  const gradients = [];
  for (let y = bounds.top + 1; y < bounds.bottom - 1; y += 1) {
    for (let x = bounds.left + 1; x < bounds.right - 1; x += 1) {
      const index = y * image.width + x;
      gradients.push(
        Math.abs(image.data[index + 1] - image.data[index - 1]),
        Math.abs(
          image.data[index + image.width] - image.data[index - image.width],
        ),
      );
    }
  }
  return {
    meanGradient: mean(gradients),
    gradientP95: percentile(gradients, 0.95),
  };
}

function meanAbsoluteDifference(first, second, bounds) {
  const differences = [];
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const index = y * first.width + x;
      differences.push(Math.abs(first.data[index] - second.data[index]));
    }
  }
  return mean(differences);
}

const runtimeManifest = JSON.parse(
  await readFile(resolve("public/room/manifest.json"), "utf8"),
);
const loadedPracticalAuthoring =
  await loadLocalPracticalAuthoring(runtimeManifest);
const practicalBootstrapIssues = [
  ...new Set([
    ...practicalAuthoringDeclarationIssues(runtimeManifest),
    ...(loadedPracticalAuthoring.authoring
      ? practicalAuthoringContractIssues(loadedPracticalAuthoring.authoring)
      : []),
    ...loadedPracticalAuthoring.issues,
  ]),
];
if (
  !loadedPracticalAuthoring.authoring ||
  practicalBootstrapIssues.length > 0
) {
  practicalBootstrapIssues.forEach((issue) => console.log(`FAIL ${issue}`));
  process.exit(1);
}
const loadedPracticalMasks = await loadPracticalMaskAssets(
  loadedPracticalAuthoring.authoring,
);
if (loadedPracticalMasks.issues.length > 0) {
  loadedPracticalMasks.issues.forEach((issue) => console.log(`FAIL ${issue}`));
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

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

const evidence = {
  rest: resolve(outDir, "contact-rest.png"),
  mid: resolve(outDir, "contact-reveal-mid.png"),
  activationLit: resolve(outDir, "contact-activation-lit.png"),
  hold: resolve(outDir, "contact-hold.png"),
  reversed: resolve(outDir, "contact-reversed.png"),
  portraitRest: resolve(outDir, "contact-portrait-rest.png"),
  portraitActivationLit: resolve(outDir, "contact-portrait-activation-lit.png"),
};

let restSample;
let riseSamples = [];
let reverseSamples = [];
let midCaptured = false;
let activationLitCaptured = false;
let activationLitSample = null;
let portraitCapture = null;
try {
  const restPage = await browser.newPage({ viewport });
  await restPage.goto(baseUrl, { waitUntil: "load" });
  await restPage.waitForTimeout(4800);
  restSample = await restPage.evaluate(inspectContact);
  await restPage.screenshot({ path: evidence.rest });
  await restPage.close();

  const page = await browser.newPage({ viewport });
  await page.goto(baseUrl, { waitUntil: "load" });
  await activatePhysicalContact(page);
  riseSamples = await collect(page, 7000, async (sample) => {
    const revealLevel = sample.marker?.revealLevel;
    const stationaryDesk = exactCameraMatch(
      sample.camera,
      APPROVED_R3_DESK_CAMERAS.wide,
    );
    if (
      !midCaptured &&
      stationaryDesk &&
      isFiniteLevel(revealLevel) &&
      revealLevel >= MID_REVEAL_MIN &&
      revealLevel <= MID_REVEAL_MAX
    ) {
      midCaptured = true;
      await page.screenshot({ path: evidence.mid });
    }
    if (
      !activationLitCaptured &&
      stationaryDesk &&
      sample.marker?.lampLevel >= 0.9
    ) {
      activationLitCaptured = true;
      activationLitSample = sample;
      await page.screenshot({ path: evidence.activationLit });
    }
  });
  if (!midCaptured) await page.screenshot({ path: evidence.mid });
  if (!activationLitCaptured) {
    await page.screenshot({ path: evidence.activationLit });
  }
  await page.screenshot({ path: evidence.hold });

  await page.keyboard.press("Escape");
  reverseSamples = await collect(page, 1800);
  await page.screenshot({ path: evidence.reversed });
  await page.close();
  portraitCapture = await captureStationaryPracticalProfile(
    browser,
    "portrait",
    {
      rest: evidence.portraitRest,
      activationLit: evidence.portraitActivationLit,
    },
  );
} finally {
  await closeBrowser();
}

const allSamples = [restSample, ...riseSamples, ...reverseSamples].filter(
  Boolean,
);
const markerSamples = allSamples.filter(
  (sample) => sample.marker && typeof sample.marker === "object",
);
const interactiveSamples = [...riseSamples, ...reverseSamples];
const firstInteractiveMarkerIndex = interactiveSamples.findIndex(
  (sample) => sample.marker && typeof sample.marker === "object",
);
const missingAfterInteractiveObservability =
  firstInteractiveMarkerIndex < 0
    ? interactiveSamples.length
    : interactiveSamples
        .slice(firstInteractiveMarkerIndex)
        .filter((sample) => !sample.marker || typeof sample.marker !== "object")
        .length;
const failures = [];
const passes = [];
let wideContact;

try {
  const manifest = JSON.parse(
    await readFile(resolve("public/room/manifest.json"), "utf8"),
  );
  wideContact = manifest.variants?.wide?.contact;
  const copies = Object.values(manifest.variants ?? {}).map(
    (variant) => variant.contact?.addressCopy,
  );
  const mechanisms = Object.values(manifest.variants ?? {}).map(
    (variant) => variant.contact?.mechanism,
  );
  if (
    copies.length !== 2 ||
    copies.some((copy) => copy !== EXPECTED_CONTACT_COPY)
  ) {
    failures.push(
      `CONTACT copy mismatch: expected ${JSON.stringify(EXPECTED_CONTACT_COPY)}, got ${JSON.stringify(copies)}`,
    );
  } else {
    passes.push("CONTACT manifest contains the exact approved three-line copy");
  }
  if (
    mechanisms.length !== 2 ||
    mechanisms.some(
      (mechanism) => mechanism !== "applied-exact-pressure-indentation",
    )
  ) {
    failures.push(
      `CONTACT mechanism mismatch: expected applied-exact-pressure-indentation, got ${JSON.stringify(mechanisms)}`,
    );
  } else {
    passes.push(
      "CONTACT uses an exact pressure indentation applied to the paper",
    );
  }
} catch (error) {
  failures.push(`CONTACT manifest copy unavailable: ${error.message}`);
}

if (
  !exactCameraMatch(restSample?.camera, APPROVED_R3_DESK_CAMERAS.wide) ||
  !midCaptured ||
  !activationLitCaptured ||
  !exactCameraMatch(
    activationLitSample?.camera,
    APPROVED_R3_DESK_CAMERAS.wide,
  ) ||
  !exactCameraMatch(
    portraitCapture?.rest?.camera,
    APPROVED_R3_DESK_CAMERAS.portrait,
  ) ||
  !exactCameraMatch(
    portraitCapture?.activation?.camera,
    APPROVED_R3_DESK_CAMERAS.portrait,
  )
) {
  failures.push(
    "CONTACT practical-light evidence was not captured at both exact stationary desk cameras during activation",
  );
} else {
  passes.push(
    "CONTACT practical-light evidence was captured during both stationary desk holds",
  );
}

try {
  if (!wideContact) throw new Error("wide CONTACT manifest data missing");
  const [
    restImage,
    midImage,
    activationLitImage,
    holdImage,
    reversedImage,
    portraitRestImage,
    portraitActivationLitImage,
  ] = await Promise.all([
    readGrayImage(evidence.rest),
    readGrayImage(evidence.mid),
    readGrayImage(evidence.activationLit),
    readGrayImage(evidence.hold),
    readGrayImage(evidence.reversed),
    readGrayImage(evidence.portraitRest),
    readGrayImage(evidence.portraitActivationLit),
  ]);
  const restAddress = boundsFromQuad(
    wideContact.addressScreenQuads.desk,
    restImage,
  );
  const holdAddress = boundsFromQuad(
    wideContact.addressScreenQuads.contact,
    holdImage,
  );
  const restContrast = regionContrast(restImage, restAddress);
  const holdContrast = regionContrast(holdImage, holdAddress);
  const holdValues = regionValues(holdImage, holdAddress);
  const holdRange = percentile(holdValues, 0.95) - percentile(holdValues, 0.05);
  const lampPoolMean = mean(
    regionValues(midImage, boundsFromRegion(MID_LAMP_POOL_REGION, midImage)),
  );
  const unlitTableMean = mean(
    regionValues(midImage, boundsFromRegion(MID_UNLIT_TABLE_REGION, midImage)),
  );
  const lampPoolLift = lampPoolMean - unlitTableMean;
  const widePracticalIssues = practicalLightMaskIssues(
    restImage,
    activationLitImage,
    loadedPracticalMasks.profiles.wide,
  );
  const portraitPracticalIssues = practicalLightMaskIssues(
    portraitRestImage,
    portraitActivationLitImage,
    loadedPracticalMasks.profiles.portrait,
  );
  const reverseDifference = meanAbsoluteDifference(
    restImage,
    reversedImage,
    restAddress,
  );

  if (restContrast.gradientP95 > 6 || restContrast.meanGradient > 1.8) {
    failures.push(
      `latent CONTACT paper exposed visible typography-like edges (gradient p95=${restContrast.gradientP95.toFixed(1)}, mean=${restContrast.meanGradient.toFixed(2)})`,
    );
  } else {
    passes.push("latent CONTACT paper remained visually clean at rest");
  }
  if (lampPoolLift < 20) {
    failures.push(
      `mid CONTACT reveal lacked a localized lamp-pool change (luma lift=${lampPoolLift.toFixed(1)})`,
    );
  } else {
    passes.push(
      `mid CONTACT reveal changed through the lamp pool (luma lift=${lampPoolLift.toFixed(1)})`,
    );
  }
  if (widePracticalIssues.length > 0 || portraitPracticalIssues.length > 0) {
    failures.push(
      `visible CONTACT practical did not rise in its geometry-projected masks: wide=${widePracticalIssues.join("; ") || "ok"}; portrait=${portraitPracticalIssues.join("; ") || "ok"}`,
    );
  } else {
    const widePracticalRises = practicalLightMaskMetrics(
      restImage,
      activationLitImage,
      loadedPracticalMasks.profiles.wide,
    );
    const portraitPracticalRises = practicalLightMaskMetrics(
      portraitRestImage,
      portraitActivationLitImage,
      loadedPracticalMasks.profiles.portrait,
    );
    passes.push(
      `visible bulb and shade interior rose during both stationary holds (wide=${widePracticalRises.bulb.toFixed(1)}/${widePracticalRises.shadeInterior.toFixed(1)}, portrait=${portraitPracticalRises.bulb.toFixed(1)}/${portraitPracticalRises.shadeInterior.toFixed(1)})`,
    );
  }
  if (
    holdContrast.gradientP95 < 14 ||
    holdContrast.meanGradient < 2.5 ||
    holdRange < 30 ||
    holdContrast.gradientP95 - restContrast.gradientP95 < 8 ||
    holdContrast.meanGradient - restContrast.meanGradient < 1
  ) {
    failures.push(
      `held CONTACT address lacked readable indentation contrast (gradient p95=${holdContrast.gradientP95.toFixed(1)}, mean=${holdContrast.meanGradient.toFixed(2)}, luma range=${holdRange.toFixed(1)}, rest deltas=${(holdContrast.gradientP95 - restContrast.gradientP95).toFixed(1)}/${(holdContrast.meanGradient - restContrast.meanGradient).toFixed(2)})`,
    );
  } else {
    passes.push("held CONTACT address showed readable indentation contrast");
  }
  if (reverseDifference > 2) {
    failures.push(
      `CONTACT reverse left visual residue on the paper (mean delta=${reverseDifference.toFixed(2)})`,
    );
  } else {
    passes.push("CONTACT reverse returned the paper cleanly to rest");
  }
} catch (error) {
  failures.push(`CONTACT pixel evidence unavailable: ${error.message}`);
}

if (
  !restSample?.marker ||
  markerSamples.length === 0 ||
  missingAfterInteractiveObservability > 0
) {
  failures.push(
    `window.__lazyAContactReveal missing after page-local observability began in ${missingAfterInteractiveObservability}/${interactiveSamples.length} interactive samples`,
  );
} else {
  passes.push(
    `CONTACT diagnostics remained present after hydration (${markerSamples.length}/${allSamples.length} samples)`,
  );
}

const malformed = markerSamples.filter(
  ({ marker }) =>
    !["idle", "revealing", "hold", "reversing"].includes(marker.phase) ||
    marker.mechanism !== "raking-light" ||
    !isFiniteLevel(marker.lampLevel) ||
    !isFiniteLevel(marker.revealLevel) ||
    !isFiniteLevel(marker.paperOpacity) ||
    !Number.isInteger(marker.standalonePlaneCount),
);
if (markerSamples.length === 0 || malformed.length > 0) {
  failures.push(
    `CONTACT diagnostic shape invalid in ${malformed.length || "all"} observed sample(s)`,
  );
} else {
  passes.push(
    "CONTACT diagnostics identify raking-light levels, paper opacity, phase, and plane count",
  );
}

const standaloneDiagnostic = markerSamples.some(
  ({ marker }) => marker.standalonePlaneCount !== 0,
);
const standaloneDom = allSamples.flatMap(
  (sample) => sample.standaloneDomPlanes,
);
if (
  markerSamples.length === 0 ||
  standaloneDiagnostic ||
  standaloneDom.length > 0
) {
  failures.push(
    `standalone CONTACT/email plane check failed (diagnostic=${standaloneDiagnostic}, DOM=${standaloneDom.length})`,
  );
} else {
  passes.push(
    "no standalone CONTACT/email plane reported or visible in the DOM",
  );
}

const opacities = markerSamples
  .map(({ marker }) => marker.paperOpacity)
  .filter(isFiniteLevel);
const opacitySpread =
  opacities.length > 0
    ? Math.max(...opacities) - Math.min(...opacities)
    : Infinity;
if (opacitySpread > 0.001) {
  failures.push(
    `paper opacity changed across reveal phases (spread=${opacitySpread.toFixed(4)})`,
  );
} else {
  passes.push(
    `paper opacity stayed fixed (spread=${opacitySpread.toFixed(4)})`,
  );
}

const validRise = riseSamples.filter(
  ({ marker }) =>
    marker &&
    isFiniteLevel(marker.lampLevel) &&
    isFiniteLevel(marker.revealLevel),
);
const riseLamp = validRise.map(({ marker }) => marker.lampLevel);
const riseReveal = validRise.map(({ marker }) => marker.revealLevel);
const hasIntermediate = validRise.some(
  ({ marker }) =>
    marker.lampLevel > 0.05 &&
    marker.lampLevel < 0.95 &&
    marker.revealLevel > 0.05 &&
    marker.revealLevel < 0.95,
);
const rose =
  riseLamp.length > 1 &&
  Math.max(...riseLamp) - Math.min(...riseLamp) >= 0.75 &&
  Math.max(...riseReveal) - Math.min(...riseReveal) >= 0.75 &&
  hasIntermediate;
if (!rose) {
  failures.push(
    "lamp/reveal progression did not observably rise through an intermediate state",
  );
} else {
  passes.push(
    "lamp and indentation reveal rose through observable intermediate states",
  );
}

const holdDuration = longestTrueDuration(
  riseSamples,
  ({ endpoint, marker }) =>
    endpoint === "contact" &&
    marker?.phase === "hold" &&
    marker.lampLevel >= 0.9 &&
    marker.revealLevel >= 0.9,
);
if (holdDuration < 500) {
  failures.push(
    `CONTACT hold was not observable for 500ms (observed ${Math.round(holdDuration)}ms)`,
  );
} else {
  passes.push(`CONTACT held lamp and reveal for ${Math.round(holdDuration)}ms`);
}

const validReverse = reverseSamples.filter(
  ({ marker }) =>
    marker &&
    isFiniteLevel(marker.lampLevel) &&
    isFiniteLevel(marker.revealLevel),
);
const firstReverse = validReverse.at(0)?.marker;
const lastReverse = validReverse.at(-1)?.marker;
const reversed =
  validReverse.some(({ marker }) => marker.phase === "reversing") &&
  firstReverse &&
  lastReverse &&
  firstReverse.lampLevel - lastReverse.lampLevel >= 0.75 &&
  firstReverse.revealLevel - lastReverse.revealLevel >= 0.75 &&
  lastReverse.lampLevel <= 0.1 &&
  lastReverse.revealLevel <= 0.1;
if (!reversed) {
  failures.push(
    "closing CONTACT did not observably reverse lamp and reveal to idle",
  );
} else {
  passes.push("Escape reversed lamp and reveal to idle");
}

for (const pass of passes) console.log(`PASS ${pass}`);
for (const failure of failures) console.log(`FAIL ${failure}`);
console.log(`INFO pixel evidence: ${evidence.rest}`);
console.log(`INFO pixel evidence: ${evidence.mid}`);
console.log(`INFO pixel evidence: ${evidence.activationLit}`);
console.log(`INFO pixel evidence: ${evidence.hold}`);
console.log(`INFO pixel evidence: ${evidence.reversed}`);
console.log(`INFO pixel evidence: ${evidence.portraitRest}`);
console.log(`INFO pixel evidence: ${evidence.portraitActivationLit}`);

process.exit(failures.length === 0 ? 0 : 1);
