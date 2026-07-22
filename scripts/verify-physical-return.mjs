/**
 * WO 0119 gate: every destination exposes one room-native return to desk.
 *
 * Usage:
 *   node scripts/verify-physical-return.mjs [url]
 */

import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/";
const DESTINATIONS = ["films", "journal", "contact", "about"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "phone", width: 375, height: 812 },
];
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

async function rowCenter(page, destination) {
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

async function waitForEndpoint(page, endpoint) {
  await page.waitForFunction(
    (id) =>
      window.__lazyAPlateState?.state === `resting:${id}` &&
      window.__lazyACameraDebug?.snapshot?.()?.endpoint === id,
    endpoint,
    { timeout: TRANSITION_TIMEOUT_MS },
  );
}

async function enter(page, destination) {
  const point = await rowCenter(page, destination);
  if (!point) throw new Error(`${destination} row center is unavailable`);
  await page.mouse.move(point.x, point.y, { steps: 2 });
  await page.waitForFunction(
    (id) => window.__lazyANavCandidate === id,
    destination,
    { timeout: 2_000 },
  );
  await page.mouse.click(point.x, point.y);
  await waitForEndpoint(page, destination);
}

async function expectTabAbsent(page, label, phase) {
  const visible = await page
    .locator('button[data-lazy-a-return="desk"]')
    .isVisible()
    .catch(() => false);
  if (visible) fail(label, `return tab must be absent ${phase}`);
  else pass(label, `return tab absent ${phase}`);
}

async function newSettledPage(browser, viewport, label) {
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: "load" });
  await expectTabAbsent(page, label, "during opening");
  await page.waitForFunction(() => window.__arrivalDone === true, null, {
    timeout: ARRIVAL_TIMEOUT_MS,
  });
  await expectTabAbsent(page, label, "at the desk");
  return page;
}

async function verifyTabRoute(browser, viewport, destination) {
  const label = `${viewport.name} ${destination}`;
  const page = await newSettledPage(browser, viewport, label);
  try {
    await enter(page, destination);
    const tab = page.getByRole("button", { name: "Return to desk" });
    const visible = await tab.isVisible().catch(() => false);
    if (!visible) {
      fail(label, "destination has no visible Return to desk paper tab");
      return;
    }
    const box = await tab.boundingBox();
    if (!box || box.width < 48 || box.height < 48) {
      fail(
        label,
        `return target is smaller than 48x48: ${JSON.stringify(box)}`,
      );
    } else {
      pass(
        label,
        `return target ${box.width.toFixed(0)}x${box.height.toFixed(0)}`,
      );
    }
    await tab.click();
    await expectTabAbsent(page, label, "during reverse");
    await waitForEndpoint(page, "desk");
    await expectTabAbsent(page, label, "after exact desk restoration");
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  } finally {
    await page.close();
  }
}

async function verifyAlternateClose(browser, viewport, mode, destination) {
  const label = `${viewport.name} ${mode}`;
  const page = await newSettledPage(browser, viewport, label);
  try {
    await enter(page, destination);
    if (mode === "Escape") {
      await page.keyboard.press("Escape");
    } else if (mode === "empty-room click") {
      await page.mouse.click(8, 8);
    } else {
      await page.goBack({ waitUntil: "commit" }).catch(() => null);
    }
    await waitForEndpoint(page, "desk");
    await expectTabAbsent(page, label, "after close");
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

try {
  for (const viewport of VIEWPORTS) {
    for (const destination of DESTINATIONS) {
      await verifyTabRoute(browser, viewport, destination);
    }
    await verifyAlternateClose(browser, viewport, "Escape", "films");
    await verifyAlternateClose(
      browser,
      viewport,
      "empty-room click",
      "journal",
    );
    await verifyAlternateClose(browser, viewport, "browser Back", "about");
  }
} finally {
  await browser.close();
}

process.exit(failures ? 1 : 0);
