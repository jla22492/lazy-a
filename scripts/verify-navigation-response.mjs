/**
 * WO 0119 gate: physical navigation must react on the first visible beat.
 *
 * Usage:
 *   node scripts/verify-navigation-response.mjs [url]
 *   node scripts/verify-navigation-response.mjs --source-only
 */

import { readFile } from "node:fs/promises";

import { chromium } from "playwright";

const args = process.argv.slice(2);
const sourceOnly = args.includes("--source-only");
const url =
  args.find((argument) => !argument.startsWith("--")) ??
  "http://localhost:3000/";
const DESTINATIONS = ["films", "journal", "contact", "about"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "phone", width: 375, height: 812 },
];
const RESPONSE_LIMIT_MS = 100;
const CONTACT_HOLD_MIN_MS = 900;
const CONTACT_HOLD_MAX_MS = 1150;
const ARRIVAL_TIMEOUT_MS = 15_000;
const TRANSITION_TIMEOUT_MS = 10_000;

let failures = 0;

function fail(label, message) {
  failures += 1;
  console.log(`FAIL ${label}: ${message}`);
}

function pass(label, message) {
  console.log(`PASS ${label}: ${message}`);
}

async function verifySource() {
  const [assets, room, compositor] = await Promise.all([
    readFile("lib/plateAssets.ts", "utf8"),
    readFile("components/room/PlateRoom.tsx", "utf8"),
    readFile("components/room/PlateCompositor.tsx", "utf8"),
  ]);
  const checks = [
    [
      assets.includes("claimPreparedPlateVideo"),
      "plate assets must expose transferable prepared-video ownership",
    ],
    [
      assets.includes("preloadForwardTransitions"),
      "plate assets must expose active-profile forward warming",
    ],
    [
      room.includes("lazy-a:plate-transition-playing"),
      "PlateRoom must begin forward warming from actual opening playback",
    ],
    [
      compositor.includes("claimPreparedPlateVideo"),
      "PlateCompositor must claim the already decoded video element",
    ],
    [
      compositor.includes("__lazyAMediaTransition"),
      "PlateCompositor must publish prepared-media diagnostics",
    ],
  ];
  for (const [ok, message] of checks) {
    if (ok) pass("source", message);
    else fail("source", message);
  }
}

async function projectedRowCenter(page, destination) {
  return page.evaluate((id) => {
    const debug = window.__lazyANavigationDebug;
    const row = debug?.sheet?.rows?.find((candidate) => candidate.id === id);
    if (!row || typeof debug?.projectSheetPoint !== "function") return null;
    return debug.projectSheetPoint(
      row.rect.x + row.rect.width / 2,
      row.rect.y + row.rect.height / 2,
    );
  }, destination);
}

async function measureDestination(browser, viewport, destination) {
  const page = await browser.newPage({ viewport });
  const label = `${viewport.name} ${destination}`;
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => window.__arrivalDone === true, null, {
      timeout: ARRIVAL_TIMEOUT_MS,
    });
    const point = await projectedRowCenter(page, destination);
    if (!point) throw new Error("physical row center is unavailable");
    await page.mouse.move(point.x, point.y, { steps: 2 });
    await page.waitForFunction(
      (id) => window.__lazyANavCandidate === id,
      destination,
      { timeout: 2_000 },
    );
    await page.evaluate(() => {
      const baseline = window.__lazyACameraDebug?.snapshot?.()?.camera ?? null;
      const probe = {
        baseline,
        clickAt: null,
        firstCameraAt: null,
        firstLampAt: null,
      };
      window.__lazyAResponseProbe = probe;
      const onClick = () => {
        probe.clickAt = performance.now();
        window.removeEventListener("click", onClick, true);
      };
      window.addEventListener("click", onClick, true);
      const sample = (now) => {
        if (probe.clickAt !== null) {
          const camera = window.__lazyACameraDebug?.snapshot?.()?.camera;
          const currentValues = camera
            ? [...camera.position, ...camera.quaternion, camera.fov]
            : [];
          const baselineValues = baseline
            ? [...baseline.position, ...baseline.quaternion, baseline.fov]
            : [];
          const changed = currentValues.some(
            (value, index) =>
              Number.isFinite(value) &&
              Number.isFinite(baselineValues[index]) &&
              Math.abs(value - baselineValues[index]) > 1e-7,
          );
          if (probe.firstCameraAt === null && changed) {
            probe.firstCameraAt = now;
          }
          const lamp = window.__lazyAContactReveal?.lampLevel ?? 0;
          if (probe.firstLampAt === null && lamp > 0.0001) {
            probe.firstLampAt = now;
          }
        }
        if (
          probe.firstCameraAt === null ||
          (window.__lazyAConversation === "contact" &&
            probe.firstLampAt === null)
        ) {
          requestAnimationFrame(sample);
        }
      };
      requestAnimationFrame(sample);
    });
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(
      (id) =>
        window.__lazyAPlateState?.state === `resting:${id}` &&
        window.__lazyACameraDebug?.snapshot?.()?.endpoint === id,
      destination,
      { timeout: TRANSITION_TIMEOUT_MS },
    );
    const result = await page.evaluate(() => {
      const probe = window.__lazyAResponseProbe;
      return {
        cameraMs:
          probe?.firstCameraAt != null && probe?.clickAt != null
            ? probe.firstCameraAt - probe.clickAt
            : null,
        lampMs:
          probe?.firstLampAt != null && probe?.clickAt != null
            ? probe.firstLampAt - probe.clickAt
            : null,
        media: window.__lazyAMediaTransition ?? null,
      };
    });
    const visibleMs =
      destination === "contact" ? result.lampMs : result.cameraMs;
    if (visibleMs === null || visibleMs > RESPONSE_LIMIT_MS) {
      fail(
        label,
        `first visible response was ${String(visibleMs)}ms (limit ${RESPONSE_LIMIT_MS}ms)`,
      );
    } else {
      pass(label, `first visible response ${visibleMs.toFixed(1)}ms`);
    }
    if (destination === "contact") {
      const holdMs =
        result.cameraMs !== null && result.lampMs !== null
          ? result.cameraMs - result.lampMs
          : null;
      if (
        holdMs === null ||
        holdMs < CONTACT_HOLD_MIN_MS ||
        holdMs > CONTACT_HOLD_MAX_MS
      ) {
        fail(
          label,
          `lamp-to-camera hold was ${String(holdMs)}ms (expected ${CONTACT_HOLD_MIN_MS}-${CONTACT_HOLD_MAX_MS}ms)`,
        );
      } else {
        pass(label, `stationary lamp beat ${holdMs.toFixed(1)}ms`);
      }
    }
    if (result.media?.preparedReused !== true) {
      fail(label, "transition did not reuse the prepared video element");
    } else {
      pass(label, "transition reused the prepared video element");
    }
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  } finally {
    await page.close();
  }
}

await verifySource();

if (!sourceOnly) {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  try {
    for (const viewport of VIEWPORTS) {
      for (const destination of DESTINATIONS) {
        await measureDestination(browser, viewport, destination);
      }
    }
  } finally {
    await browser.close();
  }
}

process.exit(failures ? 1 : 0);
