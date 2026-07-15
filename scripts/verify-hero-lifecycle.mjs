/**
 * Work Order 0117-R behavioral gate: the hero film plays exactly once per
 * page visit, independently of destination navigation.
 *
 * Usage:
 *   node scripts/verify-hero-lifecycle.mjs [url]
 */

import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/";
const VIEWPORT = { width: 1316, height: 1329 };
const TIME_EPSILON = 0.04;

let failures = 0;
let checks = 0;

function check(ok, name, detail) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

function fixed(value) {
  return Number.isFinite(value) ? `${value.toFixed(3)}s` : "unavailable";
}

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

const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();

await page.addInitScript(() => {
  const records = [];
  const tracked = new WeakMap();
  const events = [];

  const eventSnapshot = (type, video) => ({
    type,
    at: performance.now(),
    arrivalDone: window.__arrivalDone === true,
    conversation: window.__lazyAConversation ?? null,
    currentTime: video.currentTime,
    duration: video.duration,
  });

  const track = (element) => {
    if (!(element instanceof HTMLVideoElement)) return null;
    const existing = tracked.get(element);
    if (existing) return existing;

    const record = {
      element,
      createdAt: performance.now(),
      createdBeforeSettle: window.__arrivalDone !== true,
      initialTime: element.currentTime,
      preSettleObserved: false,
      preSettleMaxTime: 0,
      playCalls: 0,
      playStarts: 0,
      endedEvents: 0,
    };
    tracked.set(element, record);
    records.push(record);

    element.addEventListener("play", () => {
      record.playStarts += 1;
      events.push(eventSnapshot("play", element));
    });
    element.addEventListener("ended", () => {
      record.endedEvents += 1;
      events.push(eventSnapshot("ended", element));
    });
    return record;
  };

  const nativeCreateElement = Document.prototype.createElement;
  Document.prototype.createElement = function createElement(
    localName,
    options,
  ) {
    const element = nativeCreateElement.call(this, localName, options);
    track(element);
    return element;
  };

  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play() {
    const record = track(this);
    if (record) {
      record.playCalls += 1;
      events.push(eventSnapshot("play-call", this));
    }
    return nativePlay.call(this);
  };

  const sampleBeforeSettle = () => {
    if (window.__arrivalDone !== true) {
      for (const record of records) {
        record.preSettleObserved = true;
        record.preSettleMaxTime = Math.max(
          record.preSettleMaxTime,
          record.element.currentTime,
        );
      }
    }
    requestAnimationFrame(sampleBeforeSettle);
  };
  requestAnimationFrame(sampleBeforeSettle);

  Object.defineProperty(window, "__heroLifecycleProbe", {
    configurable: false,
    value: { records, events },
  });
});

function heroSnapshot() {
  return page.evaluate(() => {
    const probe = window.__heroLifecycleProbe;
    if (!probe) return { supported: false, reason: "media probe missing" };

    const records = probe.records.filter((record) => {
      const source = record.element.currentSrc || record.element.src || "";
      return source.length > 0;
    });
    const heroRecords = records.filter(
      (record) => record.element.dataset.lazyAHero === "true",
    );
    const record = heroRecords.length === 1 ? heroRecords[0] : null;
    if (!record) {
      return {
        supported: false,
        reason: `expected one data-lazy-a-hero video; found ${records.length} videos (${heroRecords.length} marked hero)`,
      };
    }

    const video = record.element;
    return {
      supported: true,
      source: video.currentSrc || video.src,
      createdBeforeSettle: record.createdBeforeSettle,
      initialTime: record.initialTime,
      preSettleObserved: record.preSettleObserved,
      preSettleMaxTime: record.preSettleMaxTime,
      playCalls: record.playCalls,
      playStarts: record.playStarts,
      endedEvents: record.endedEvents,
      playEvents: probe.events.filter(
        (event) => event.type === "play" && event.duration === video.duration,
      ),
      currentTime: video.currentTime,
      duration: video.duration,
      loop: video.loop,
      paused: video.paused,
      ended: video.ended,
      readyState: video.readyState,
    };
  });
}

async function waitForHero(predicate, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  let snapshot = await heroSnapshot();
  while (Date.now() < deadline) {
    if (snapshot.supported && predicate(snapshot)) return snapshot;
    await page.waitForTimeout(50);
    snapshot = await heroSnapshot();
  }
  return snapshot;
}

async function conversationState() {
  return page.evaluate(() => ({
    observable: Boolean(window.__lazyANavigationDebug),
    value: window.__lazyAConversation ?? null,
    candidate: window.__lazyANavCandidate ?? null,
  }));
}

async function heroProjectionState() {
  return page.evaluate(() => {
    const live = window.__lazyAHeroProjection ?? null;
    const authored = window.__lazyAPlateProjection?.hero ?? null;
    const profile = window.__lazyAPlateState?.profile ?? "wide";
    const source = profile === "portrait"
      ? { width: 375, height: 812 }
      : { width: 1280, height: 720 };
    const scale = Math.max(
      innerWidth / source.width,
      innerHeight / source.height,
    );
    const offsetX = (innerWidth - source.width * scale) / 2;
    const offsetY = (innerHeight - source.height * scale) / 2;
    const expected = Array.isArray(authored)
      ? authored.flatMap((value, index) => {
          const pixels = index % 2 === 0
            ? offsetX + value * source.width * scale
            : offsetY + value * source.height * scale;
          return [pixels / (index % 2 === 0 ? innerWidth : innerHeight)];
        })
      : null;
    return { live, expected, profile };
  });
}

async function waitForRestingEndpoint(id) {
  await page.waitForFunction(
    (endpoint) => {
      const camera = window.__lazyACameraDebug?.snapshot?.();
      return (
        window.__lazyAPlateState?.state === `resting:${endpoint}` &&
        camera?.phase === "resting" &&
        camera?.endpoint === endpoint
      );
    },
    id,
    { timeout: 8_000 },
  );
}

async function openDestination(id) {
  const point = await page.evaluate((destination) => {
    const debug = window.__lazyANavigationDebug;
    const row = debug?.sheet.rows.find(({ id: rowId }) => rowId === destination);
    if (!debug || !row) return null;
    return debug.projectSheetPoint(
      row.rect.x + row.rect.width / 2,
      row.rect.y + row.rect.height / 2,
    );
  }, id);
  if (!point) {
    return { ok: false, detail: `authored ${id} row is unavailable` };
  }
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await page.waitForTimeout(300);
  const beforeClick = await conversationState();
  await page.mouse.click(point.x, point.y);
  try {
    await page.waitForFunction(
      (expected) => window.__lazyAConversation === expected,
      id,
      { timeout: 2_000 },
    );
  } catch {
    const state = await conversationState();
    return {
      ok: false,
      detail: `candidate=${beforeClick.candidate ?? "null"}; expected ${id}, got ${state.value ?? "null"}`,
    };
  }
  try {
    await waitForRestingEndpoint(id);
  } catch {
    const state = await page.evaluate(() => ({
      plate: window.__lazyAPlateState?.state ?? null,
      camera: window.__lazyACameraDebug?.snapshot?.() ?? null,
    }));
    return {
      ok: false,
      detail: `${id} did not settle: ${JSON.stringify(state)}`,
    };
  }
  return {
    ok: true,
    detail: `${id} opened at (${point.x.toFixed(1)}, ${point.y.toFixed(1)}); candidate=${beforeClick.candidate ?? "null"}`,
  };
}

try {
  await page.goto(url, { waitUntil: "load" });

  const observed = await waitForHero(() => true);
  check(
    observed.supported,
    "hero video observability",
    observed.supported ? observed.source : observed.reason,
  );

  if (observed.supported) {
    await page.waitForFunction(() => window.__arrivalDone === true, null, {
      timeout: 12_000,
    });
    const settled = await heroSnapshot();
    check(
      settled.createdBeforeSettle && settled.preSettleObserved,
      "pre-settle video observation",
      `createdBeforeSettle=${settled.createdBeforeSettle} sampled=${settled.preSettleObserved}`,
    );
    check(
      Math.abs(settled.initialTime) <= TIME_EPSILON &&
        settled.preSettleMaxTime <= TIME_EPSILON,
      "pre-settle currentTime is zero",
      `initial=${fixed(settled.initialTime)} max=${fixed(settled.preSettleMaxTime)}`,
    );
    const projection = await heroProjectionState();
    const cornerErrors =
      Array.isArray(projection.live) && Array.isArray(projection.expected)
        ? [0, 1, 2, 3].map((index) =>
            Math.hypot(
              (projection.live[index * 2] - projection.expected[index * 2]) * VIEWPORT.width,
              (projection.live[index * 2 + 1] - projection.expected[index * 2 + 1]) * VIEWPORT.height,
            ),
          )
        : [];
    const projectionError = cornerErrors.length === 4
      ? Math.max(...cornerErrors)
      : Infinity;
    check(
      projection.profile === "wide" && projectionError <= 1,
      "all four live hero corners align to authored print",
      Number.isFinite(projectionError)
        ? `profile=${projection.profile} max corner error=${projectionError.toFixed(3)}px`
        : "live/authored hero projection diagnostics unavailable",
    );
    check(
      settled.loop === false,
      "looping is disabled",
      `loop=${settled.loop}`,
    );

    const started = await waitForHero(
      (snapshot) => snapshot.playStarts >= 1,
      8_000,
    );
    await page.waitForTimeout(150);
    const afterStart = await heroSnapshot();
    const firstPlay = afterStart.playEvents[0];
    check(
      afterStart.playCalls === 1 && afterStart.playStarts === 1,
      "one play start after settle",
      `calls=${afterStart.playCalls} starts=${afterStart.playStarts}`,
    );
    check(
      Boolean(firstPlay?.arrivalDone) &&
        firstPlay.currentTime <= TIME_EPSILON * 2,
      "play starts from zero after settle",
      firstPlay
        ? `arrivalDone=${firstPlay.arrivalDone} currentTime=${fixed(firstPlay.currentTime)}`
        : `no play event; currentTime=${fixed(started.currentTime)}`,
    );

    const debug = await conversationState();
    check(
      debug.observable,
      "destination state observability",
      debug.observable
        ? `conversation=${debug.value ?? "null"}`
        : "window.__lazyAConversation is unavailable",
    );

    const beforeOpen = await heroSnapshot();
    const films = await openDestination("films");
    await page.waitForTimeout(500);
    const afterOpen = await heroSnapshot();
    check(films.ok, "open destination during playback", films.detail);
    check(
      films.ok &&
        afterOpen.currentTime > beforeOpen.currentTime + 0.2 &&
        !afterOpen.paused,
      "currentTime advances while destination opens",
      `${fixed(beforeOpen.currentTime)} -> ${fixed(afterOpen.currentTime)} paused=${afterOpen.paused}`,
    );

    await page.keyboard.press("Escape");
    try {
      await waitForRestingEndpoint("desk");
    } catch {
      // The following destination assertion reports the stale state.
    }
    const journal = await openDestination("journal");
    await page.waitForTimeout(250);
    const afterSwitch = await heroSnapshot();
    check(journal.ok, "switch destination during playback", journal.detail);

    await page.keyboard.press("Escape");
    let closed = false;
    try {
      await page.waitForFunction(
        () => window.__lazyAConversation === null,
        null,
        { timeout: 2_000 },
      );
      closed = journal.ok;
    } catch {
      closed = false;
    }
    await page.waitForTimeout(250);
    const afterClose = await heroSnapshot();
    check(
      closed,
      "close destination during playback",
      `conversation=${(await conversationState()).value ?? "null"}`,
    );
    check(
      films.ok &&
        journal.ok &&
        closed &&
        afterSwitch.currentTime + TIME_EPSILON >= afterOpen.currentTime &&
        afterClose.currentTime + TIME_EPSILON >= afterSwitch.currentTime &&
        afterSwitch.playStarts === 1 &&
        afterClose.playStarts === 1 &&
        afterSwitch.playCalls === 1 &&
        afterClose.playCalls === 1,
      "destination close/switch preserves playback",
      `times=${fixed(afterOpen.currentTime)} -> ${fixed(afterSwitch.currentTime)} -> ${fixed(afterClose.currentTime)} calls=${afterClose.playCalls} starts=${afterClose.playStarts}`,
    );

    const endedSnapshot = await waitForHero(
      (snapshot) => snapshot.endedEvents >= 1 || snapshot.ended,
      Math.min(
        Math.max(
          (afterClose.duration - afterClose.currentTime + 2) * 1_000,
          4_000,
        ),
        16_000,
      ),
    );
    check(
      endedSnapshot.endedEvents === 1 && endedSnapshot.ended,
      "hero reaches ended once",
      `endedEvents=${endedSnapshot.endedEvents} ended=${endedSnapshot.ended} currentTime=${fixed(endedSnapshot.currentTime)}`,
    );

    const finalFrameTime = endedSnapshot.currentTime;
    await page.waitForTimeout(600);
    const held = await heroSnapshot();
    const atFinalFrame =
      Number.isFinite(held.duration) &&
      held.duration > 0 &&
      held.duration - held.currentTime <= 0.15;
    check(
      endedSnapshot.ended &&
        held.ended &&
        held.paused &&
        atFinalFrame &&
        Math.abs(held.currentTime - finalFrameTime) <= TIME_EPSILON,
      "ended hero holds final frame",
      `paused=${held.paused} ended=${held.ended} currentTime=${fixed(held.currentTime)} duration=${fixed(held.duration)}`,
    );
    check(
      held.playCalls === 1 && held.playStarts === 1,
      "final hold does not restart playback",
      `calls=${held.playCalls} starts=${held.playStarts}`,
    );
  } else {
    for (const name of [
      "pre-settle currentTime is zero",
      "looping is disabled",
      "one play start after settle",
      "currentTime advances while destination opens",
      "hero reaches ended once",
      "ended hero holds final frame",
      "destination close/switch preserves playback",
    ]) {
      check(false, name, "required hero video observability is unavailable");
    }
  }
} catch (error) {
  check(
    false,
    "gate execution",
    error instanceof Error ? error.message : String(error),
  );
} finally {
  await closeBrowser();
}

console.log(
  `${failures === 0 ? "PASS" : "FAIL"} hero lifecycle: ${checks - failures}/${checks} checks passed`,
);
process.exit(failures === 0 ? 0 : 1);
