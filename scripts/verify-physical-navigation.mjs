/**
 * WO 0117-R red gate: the physical production sheet owns navigation.
 *
 * The page must expose window.__lazyANavigationDebug with:
 *   sheet: { bounds: Rect, rows: Array<{ id, rect: Rect }> }
 *   projectSheetPoint(localX, localY): { x, y }
 *   matchesAtScreenPoint(screenX, screenY): DestinationId[]
 *
 * matchesAtScreenPoint must return every matching destination. A winner-only
 * candidate cannot prove that authored hit regions are disjoint.
 *
 * Usage:
 *   node scripts/verify-physical-navigation.mjs [url]
 */

import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/";

const DESTINATIONS = ["films", "journal", "contact", "about"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "phone", width: 375, height: 812 },
];
const GRID_COLUMNS = 41;
const GRID_ROWS = 61;
const ARRIVAL_TIMEOUT_MS = 12_000;
const TRANSITION_TIMEOUT_MS = 8_000;

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

function isRect(value) {
  return (
    value &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    value.width > 0 &&
    value.height > 0
  );
}

function centerOf(rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function contains(rect, point) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function expectedDestination(rows, point) {
  return rows.find((row) => contains(row.rect, point))?.id ?? null;
}

function cameraLabel(viewport) {
  return `${viewport.name} ${viewport.width}x${viewport.height}`;
}

async function waitForArrival(page, profile) {
  try {
    await page.waitForFunction(() => window.__arrivalDone === true, null, {
      timeout: ARRIVAL_TIMEOUT_MS,
    });
    return true;
  } catch {
    fail(profile, "arrival did not expose window.__arrivalDone=true");
    return false;
  }
}

async function waitForRestingEndpoint(page, endpoint) {
  await page.waitForFunction(
    (id) => {
      const camera = window.__lazyACameraDebug?.snapshot?.();
      return (
        window.__lazyAPlateState?.state === `resting:${id}` &&
        camera?.phase === "resting" &&
        camera?.endpoint === id
      );
    },
    endpoint,
    { timeout: TRANSITION_TIMEOUT_MS },
  );
}

async function readNavigationDebug(page) {
  return page.evaluate(() => {
    const debug = window.__lazyANavigationDebug;
    return {
      available: Boolean(debug),
      hasProjector: typeof debug?.projectSheetPoint === "function",
      hasAllMatches: typeof debug?.matchesAtScreenPoint === "function",
      sheet: debug?.sheet ?? null,
    };
  });
}

async function matchesAtSheetPoint(page, point) {
  return page.evaluate(({ x, y }) => {
    const debug = window.__lazyANavigationDebug;
    const screen = debug.projectSheetPoint(x, y);
    return {
      screen,
      matches: debug.matchesAtScreenPoint(screen.x, screen.y),
    };
  }, point);
}

function validateSheet(profile, sheet) {
  if (!sheet || !isRect(sheet.bounds) || !Array.isArray(sheet.rows)) {
    fail(
      profile,
      "navigation observability has invalid sheet data; expected sheet.bounds Rect and sheet.rows[]",
    );
    return false;
  }
  if (sheet.rows.length !== DESTINATIONS.length) {
    fail(profile, `expected four authored rows, got ${sheet.rows.length}`);
    return false;
  }

  const ids = sheet.rows.map((row) => row?.id);
  if (ids.join(",") !== DESTINATIONS.join(",")) {
    fail(
      profile,
      `row order must be ${DESTINATIONS.join(" -> ")}; got ${ids.join(" -> ")}`,
    );
    return false;
  }
  if (sheet.rows.some((row) => !isRect(row.rect))) {
    fail(profile, "every authored navigation row must expose a valid rect");
    return false;
  }

  const { bounds, rows } = sheet;
  const outside = rows.find(
    ({ rect }) =>
      rect.x <= bounds.x ||
      rect.y <= bounds.y ||
      rect.x + rect.width >= bounds.x + bounds.width ||
      rect.y + rect.height >= bounds.y + bounds.height,
  );
  if (outside) {
    fail(
      profile,
      `${outside.id} must leave selectable-empty sheet margins on every side`,
    );
    return false;
  }

  const first = rows[0].rect;
  const inconsistentWidth = rows.find(
    ({ rect }) =>
      Math.abs(rect.x - first.x) > 1e-9 ||
      Math.abs(rect.width - first.width) > 1e-9,
  );
  if (inconsistentWidth) {
    fail(
      profile,
      `${inconsistentWidth.id} does not share the authored full-row width`,
    );
    return false;
  }

  const geometricallySorted = [...rows].sort((a, b) => a.rect.y - b.rect.y);
  for (let index = 0; index < geometricallySorted.length - 1; index += 1) {
    const current = geometricallySorted[index];
    const next = geometricallySorted[index + 1];
    const gap = next.rect.y - (current.rect.y + current.rect.height);
    if (gap <= 0) {
      fail(
        profile,
        `${current.id}/${next.id} rows overlap or have no inter-row gap (${gap})`,
      );
      return false;
    }
  }
  return true;
}

function emptyRegionPoints(sheet) {
  const { bounds, rows } = sheet;
  const points = [];
  for (const row of rows) {
    const centerY = row.rect.y + row.rect.height / 2;
    points.push({
      name: `${row.id} left margin`,
      x: bounds.x + (row.rect.x - bounds.x) / 2,
      y: centerY,
    });
    points.push({
      name: `${row.id} right margin`,
      x:
        row.rect.x +
        row.rect.width +
        (bounds.x + bounds.width - row.rect.x - row.rect.width) / 2,
      y: centerY,
    });
  }

  const sorted = [...rows].sort((a, b) => a.rect.y - b.rect.y);
  const centerX = sorted[0].rect.x + sorted[0].rect.width / 2;
  points.push({
    name: "outer margin before first row",
    x: centerX,
    y: bounds.y + (sorted[0].rect.y - bounds.y) / 2,
  });
  points.push({
    name: "outer margin after last row",
    x: centerX,
    y:
      sorted.at(-1).rect.y +
      sorted.at(-1).rect.height +
      (bounds.y +
        bounds.height -
        sorted.at(-1).rect.y -
        sorted.at(-1).rect.height) /
        2,
  });

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    points.push({
      name: `${current.id}/${next.id} inter-row gap`,
      x: centerX,
      y: (current.rect.y + current.rect.height + next.rect.y) / 2,
    });
  }
  return points;
}

function denseGrid(bounds) {
  const points = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      points.push({
        x: bounds.x + (bounds.width * column) / (GRID_COLUMNS - 1),
        y: bounds.y + (bounds.height * row) / (GRID_ROWS - 1),
      });
    }
  }
  return points;
}

async function probeDenseGrid(page, sheet) {
  const points = denseGrid(sheet.bounds);
  const probes = await page.evaluate((localPoints) => {
    const debug = window.__lazyANavigationDebug;
    return localPoints.map((local) => {
      const screen = debug.projectSheetPoint(local.x, local.y);
      return {
        local,
        screen,
        matches: debug.matchesAtScreenPoint(screen.x, screen.y),
      };
    });
  }, points);

  const issues = [];
  for (const probe of probes) {
    if (!Array.isArray(probe.matches)) {
      issues.push(
        `${JSON.stringify(probe.local)} returned a non-array match set`,
      );
      continue;
    }
    const unique = [...new Set(probe.matches)];
    if (unique.length !== probe.matches.length) {
      issues.push(
        `${JSON.stringify(probe.local)} returned duplicate matches ${JSON.stringify(probe.matches)}`,
      );
    }
    if (unique.length > 1) {
      issues.push(
        `${JSON.stringify(probe.local)} maps to multiple destinations: ${unique.join(", ")}`,
      );
    }
    const expected = expectedDestination(sheet.rows, probe.local);
    if (expected === null && unique.length > 0) {
      issues.push(
        `empty sheet point ${JSON.stringify(probe.local)} selects ${unique.join(", ")}`,
      );
    } else if (expected && unique.some((id) => id !== expected)) {
      issues.push(
        `${expected} row point ${JSON.stringify(probe.local)} selects ${unique.join(", ")}`,
      );
    }
  }
  return { count: probes.length, issues };
}

async function verifyEmptyRegions(page, profile, sheet) {
  let ok = true;
  for (const point of emptyRegionPoints(sheet)) {
    const probe = await matchesAtSheetPoint(page, point);
    if (!Array.isArray(probe.matches) || probe.matches.length !== 0) {
      fail(
        profile,
        `${point.name} must select nothing; got ${JSON.stringify(probe.matches)}`,
      );
      ok = false;
      continue;
    }
    await page.mouse.move(probe.screen.x, probe.screen.y, { steps: 2 });
    await page.waitForTimeout(80);
    const candidate = await page.evaluate(
      () => window.__lazyANavCandidate ?? null,
    );
    if (candidate !== null) {
      fail(profile, `${point.name} produced runtime candidate ${candidate}`);
      ok = false;
    }
  }
  if (ok)
    pass(profile, "sheet margins and all three inter-row gaps select nothing");
}

async function verifyRowCenters(page, profile, sheet) {
  let ok = true;
  for (const row of sheet.rows) {
    const local = centerOf(row.rect);
    const { screen, matches } = await matchesAtSheetPoint(page, local);
    if (JSON.stringify(matches) !== JSON.stringify([row.id])) {
      fail(
        profile,
        `${row.id} row center must map only to ${row.id}; got ${JSON.stringify(matches)}`,
      );
      ok = false;
      continue;
    }
    if (
      !isFiniteNumber(screen?.x) ||
      !isFiniteNumber(screen?.y) ||
      screen.x < 0 ||
      screen.x > page.viewportSize().width ||
      screen.y < 0 ||
      screen.y > page.viewportSize().height
    ) {
      fail(
        profile,
        `${row.id} row center projects outside the viewport: ${JSON.stringify(screen)}`,
      );
      ok = false;
      continue;
    }

    await page.mouse.move(screen.x, screen.y, { steps: 4 });
    await page.waitForTimeout(120);
    const candidate = await page.evaluate(
      () => window.__lazyANavCandidate ?? null,
    );
    if (candidate !== row.id) {
      fail(
        profile,
        `${row.id} row center produced runtime candidate ${candidate}`,
      );
      ok = false;
      continue;
    }

    await page.mouse.click(screen.x, screen.y);
    try {
      await page.waitForFunction(
        (id) => window.__lazyAConversation === id,
        row.id,
        { timeout: TRANSITION_TIMEOUT_MS },
      );
    } catch {
      const conversation = await page.evaluate(
        () => window.__lazyAConversation ?? null,
      );
      fail(
        profile,
        `${row.id} row center click expected conversation ${row.id}, got ${conversation}`,
      );
      ok = false;
      continue;
    }

    try {
      await waitForRestingEndpoint(page, row.id);
    } catch {
      const state = await page.evaluate(() => ({
        plate: window.__lazyAPlateState?.state ?? null,
        camera: window.__lazyACameraDebug?.snapshot?.() ?? null,
      }));
      fail(
        profile,
        `${row.id} did not reach its authored resting endpoint: ${JSON.stringify(state)}`,
      );
      ok = false;
      continue;
    }

    await page.mouse.move(0, 0, { steps: 2 });
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => (window.__lazyAConversation ?? null) === null,
      null,
      { timeout: TRANSITION_TIMEOUT_MS },
    );
    try {
      await waitForRestingEndpoint(page, "desk");
    } catch {
      const state = await page.evaluate(() => ({
        plate: window.__lazyAPlateState?.state ?? null,
        camera: window.__lazyACameraDebug?.snapshot?.() ?? null,
      }));
      fail(
        profile,
        `${row.id} did not return to the authored desk endpoint: ${JSON.stringify(state)}`,
      );
      ok = false;
    }
  }
  if (ok)
    pass(profile, "all four physical row centers open only their destination");
}

try {
  for (const viewport of VIEWPORTS) {
    const profile = cameraLabel(viewport);
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(url, { waitUntil: "load" });
      if (!(await waitForArrival(page, profile))) continue;

      const floatingLabels = await page.evaluate(() => {
        const labels = new Set(["FILMS", "JOURNAL", "CONTACT", "ABOUT"]);
        return [...document.querySelectorAll("div")]
          .filter((node) => labels.has(node.textContent?.trim() ?? ""))
          .map((node) => node.textContent?.trim());
      });
      if (floatingLabels.length > 0) {
        fail(
          profile,
          `floating website labels remain in DOM: ${floatingLabels.join(", ")}`,
        );
      } else {
        pass(profile, "no floating website labels remain in DOM");
      }

      const debug = await readNavigationDebug(page);
      if (!debug.available || !debug.hasProjector || !debug.hasAllMatches) {
        fail(
          profile,
          "navigation observability is insufficient: window.__lazyANavigationDebug must expose sheet.bounds, sheet.rows, projectSheetPoint(localX, localY), and matchesAtScreenPoint(screenX, screenY) returning every matching destination. window.__lazyANavCandidate exposes only one winner and cannot prove that hit regions do not overlap.",
        );
        continue;
      }
      if (!validateSheet(profile, debug.sheet)) continue;

      const grid = await probeDenseGrid(page, debug.sheet);
      if (grid.issues.length > 0) {
        for (const issue of grid.issues.slice(0, 8)) fail(profile, issue);
        if (grid.issues.length > 8) {
          fail(
            profile,
            `${grid.issues.length - 8} additional dense-grid failures`,
          );
        }
      } else {
        pass(
          profile,
          `${grid.count}-point dense grid has no multi-mapping or false empty-region selections`,
        );
      }

      await verifyEmptyRegions(page, profile, debug.sheet);
      await verifyRowCenters(page, profile, debug.sheet);
    } catch (error) {
      fail(
        profile,
        `navigation gate could not complete: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

process.exit(failures ? 1 : 0);
