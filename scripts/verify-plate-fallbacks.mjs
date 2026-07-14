/**
 * Work Order 0117-R photographic fallback gate.
 *
 * The page must expose this diagnostic marker while the visitor-facing room
 * is mounted. Missing observability is a failure:
 *
 *   window.__lazyAPlateState = {
 *     profile: "wide" | "portrait",
 *     state: string,
 *     status: "ready" | "transitioning" | "retained",
 *     photographic: true,
 *     primitiveFallbackMounted: false,
 *   };
 *
 * After the initial document load, the gate blocks room pano/plate and
 * destination image/video requests. The last coherent photographic frame
 * must remain visible without primitive geometry, loading UI, or error UI.
 *
 * Usage:
 *   node scripts/verify-plate-fallbacks.mjs [url]
 */

import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://localhost:3000/";
const scenarios = [
  { name: "desktop", profile: "wide", viewport: { width: 1280, height: 720 } },
  { name: "phone", profile: "portrait", viewport: { width: 375, height: 812 } },
];

const ROOM_MEDIA =
  /(?:pano|plate|opening|desk|destination|transition|films|journal|contact|about)[^?#]*\.(?:avif|gif|jpe?g|png|webp|mp4|webm|mov)(?:[?#]|$)/i;
const SAMPLE_DELAYS_MS = [0, 1800, 1800, 1800];

function withContactRequest(url) {
  const target = new URL(url);
  target.searchParams.set("talk", "contact");
  return target.href;
}

function inspectSample() {
  const marker = window.__lazyAPlateState ?? null;
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
  const primitiveSelectors = [
    '[data-room-renderer="primitive"]',
    '[data-room-state="primitive"]',
    '[data-primitive-fallback="true"]',
  ];
  const chromeSelectors = [
    '[data-room-state="loading"]',
    '[data-room-state="error"]',
    '[data-loading-ui="true"]',
    '[data-error-ui="true"]',
    '[role="progressbar"]',
  ];
  const matches = (selectors) =>
    selectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
        .filter(visible)
        .map(
          (element) =>
            selector + ":" + (element.textContent?.trim() || element.tagName),
        ),
    );
  const textChrome = [...document.querySelectorAll("body *")]
    .filter(visible)
    .map((element) => element.textContent?.trim() ?? "")
    .filter((text) =>
      /^(?:loading(?: room)?|room (?:load )?failed|media error)$/i.test(text),
    );

  return {
    marker,
    primitiveUi: matches(primitiveSelectors),
    loadingOrErrorUi: [...matches(chromeSelectors), ...textChrome],
  };
}

function markerIssues(marker, expectedProfile) {
  if (!marker || typeof marker !== "object") {
    return ["window.__lazyAPlateState is missing"];
  }
  const issues = [];
  if (marker.profile !== expectedProfile) {
    issues.push(
      `profile=${String(marker.profile)} (expected ${expectedProfile})`,
    );
  }
  if (typeof marker.state !== "string" || marker.state.length === 0) {
    issues.push("state is not observable");
  }
  if (!["ready", "transitioning", "retained"].includes(marker.status)) {
    issues.push(
      `status=${String(marker.status)} is not ready/transitioning/retained`,
    );
  }
  if (marker.photographic !== true) {
    issues.push(`photographic=${String(marker.photographic)} (expected true)`);
  }
  if (marker.primitiveFallbackMounted !== false) {
    issues.push(
      `primitiveFallbackMounted=${String(marker.primitiveFallbackMounted)} (expected false)`,
    );
  }
  return issues;
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

let failures = 0;
try {
  for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport: scenario.viewport });
    const blocked = [];
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto(withContactRequest(baseUrl), { waitUntil: "load" });
    // Texture loaders may begin the opening image just after window.load.
    // Give that first coherent frame a chance to start before fault injection.
    await page.waitForTimeout(750);

    await page.route("**/*", async (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      const requestUrl = request.url();
      const isRoomMedia =
        (resourceType === "image" || resourceType === "media") &&
        ROOM_MEDIA.test(requestUrl) &&
        !/hero/i.test(requestUrl);
      if (isRoomMedia) {
        blocked.push(requestUrl);
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    const samples = [];
    for (const delay of SAMPLE_DELAYS_MS) {
      if (delay > 0) await page.waitForTimeout(delay);
      samples.push(await page.evaluate(inspectSample));
    }

    const issues = new Set();
    for (const sample of samples) {
      for (const issue of markerIssues(sample.marker, scenario.profile))
        issues.add(issue);
      for (const item of sample.primitiveUi)
        issues.add(`visible primitive UI: ${item}`);
      for (const item of sample.loadingOrErrorUi) {
        issues.add(`visible loading/error UI: ${item}`);
      }
    }

    if (issues.size === 0) {
      console.log(
        `PASS ${scenario.name} ${scenario.viewport.width}x${scenario.viewport.height}: photographic markers persisted with no primitive/loading/error UI`,
      );
    } else {
      failures += issues.size;
      console.log(
        `FAIL ${scenario.name} ${scenario.viewport.width}x${scenario.viewport.height}:`,
      );
      for (const issue of issues) console.log(`  - ${issue}`);
    }

    const uniqueBlocked = [...new Set(blocked)];
    console.log(
      `INFO ${scenario.name}: blocked ${uniqueBlocked.length} post-load room media request(s)`,
    );
    for (const requestUrl of uniqueBlocked) console.log(`  - ${requestUrl}`);
    if (pageErrors.length > 0) {
      console.log(
        `INFO ${scenario.name}: ${pageErrors.length} page error(s) observed after blocking`,
      );
    }
    await page.close();
  }
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
