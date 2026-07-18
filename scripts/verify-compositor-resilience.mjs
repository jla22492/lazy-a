#!/usr/bin/env node

import assert from "node:assert/strict";

import { chromium } from "playwright";

const url =
  process.argv.slice(2).find((argument) => !argument.startsWith("--")) ??
  "http://127.0.0.1:3000/";
const caseFilter = process.argv
  .find((argument) => argument.startsWith("--case="))
  ?.slice("--case=".length);
const compositorEvent = "lazy-a:compositor-frame-presented";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

async function waitForDesk(page) {
  await page.waitForFunction(
    () =>
      window.__arrivalDone === true &&
      window.__lazyACameraDebug?.snapshot?.().endpoint === "desk" &&
      window.__lazyACameraDebug?.snapshot?.().phase === "resting",
    null,
    { timeout: 15_000 },
  );
}

async function verifyDelayedHeroSurface() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.route("**/room/hero/hero-compositor.glb", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 7_000));
    await route.continue();
  });
  await page.addInitScript(() => {
    window.__heroSurfaceDelayProbe = { plays: [] };
    document.addEventListener(
      "play",
      (event) => {
        if (event.target?.dataset?.lazyAHero === "true") {
          window.__heroSurfaceDelayProbe.plays.push({
            time: event.target.currentTime,
            surfaceReady: window.__lazyAHeroSurfaceReady === true,
          });
        }
      },
      true,
    );
  });
  try {
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => window.__arrivalDone === true, null, {
      timeout: 12_000,
    });
    await page.waitForTimeout(2_300);
    const blocked = await page.evaluate(() => {
      const video = document.querySelector("[data-lazy-a-hero]");
      return {
        currentTime: video?.currentTime ?? null,
        paused: video?.paused ?? null,
        surfaceReady: window.__lazyAHeroSurfaceReady === true,
        plays: window.__heroSurfaceDelayProbe.plays,
      };
    });
    assert.equal(blocked.surfaceReady, false, "surface remains delayed");
    assert.ok(
      blocked.paused &&
        blocked.currentTime <= 0.04 &&
        blocked.plays.length === 0,
      `hero advanced before its surface was ready: ${JSON.stringify(blocked)}`,
    );
    try {
      await page.waitForFunction(
        () =>
          window.__lazyAHeroSurfaceReady === true &&
          window.__heroSurfaceDelayProbe.plays.length === 1,
        null,
        { timeout: 12_000 },
      );
    } catch {
      const stalled = await page.evaluate(() => {
        const video = document.querySelector("[data-lazy-a-hero]");
        return {
          currentTime: video?.currentTime ?? null,
          paused: video?.paused ?? null,
          readyState: video?.readyState ?? null,
          surfaceReady: window.__lazyAHeroSurfaceReady === true,
          plays: window.__heroSurfaceDelayProbe.plays,
          compositor: window.__lazyACompositor,
        };
      });
      throw new Error(
        `hero did not start after the delayed surface became ready: ${JSON.stringify(stalled)}`,
      );
    }
    const started = await page.evaluate(() => ({
      plays: window.__heroSurfaceDelayProbe.plays,
      currentTime: document.querySelector("[data-lazy-a-hero]")?.currentTime,
    }));
    assert.ok(
      started.plays[0].surfaceReady && started.plays[0].time <= 0.04,
      `hero did not begin from zero on the ready surface: ${JSON.stringify(started)}`,
    );
    console.log(
      "PASS delayed hero assets hold frame zero until the physical surface is ready",
    );
  } finally {
    await context.close();
  }
}

async function verifyBreakpointProfileSwap() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.addInitScript(
    ({ eventName }) => {
      window.__profileSwapProbe = [];
      window.addEventListener(eventName, (event) => {
        const detail = event.detail;
        if (detail?.profile && detail?.plateSource) {
          window.__profileSwapProbe.push({
            profile: detail.profile,
            plateSource: detail.plateSource,
          });
        }
      });
    },
    { eventName: compositorEvent },
  );
  try {
    await page.goto(url, { waitUntil: "load" });
    await waitForDesk(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForFunction(
      () =>
        window.__lazyACompositor?.profile === "portrait" &&
        window.__lazyACompositor?.plateSource.includes("/portrait/"),
      null,
      { timeout: 8_000 },
    );
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForFunction(
      () =>
        window.__lazyACompositor?.profile === "wide" &&
        window.__lazyACompositor?.plateSource.includes("/wide/"),
      null,
      { timeout: 8_000 },
    );
    const samples = await page.evaluate(() => window.__profileSwapProbe);
    assert.ok(samples.length > 0, "profile swap samples");
    assert.ok(
      samples.every(({ profile, plateSource }) =>
        plateSource.includes(`/${profile}/`),
      ),
      `profile/media mismatch reached the compositor: ${JSON.stringify(samples.filter(({ profile, plateSource }) => !plateSource.includes(`/${profile}/`)).slice(0, 5))}`,
    );
    console.log(
      "PASS desktop/phone breakpoint swaps preserve atomic profile/media ownership",
    );
  } finally {
    await context.close();
  }
}

async function verifyPostStartMediaFault() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      const result = nativePlay.call(this);
      if (
        this instanceof HTMLVideoElement &&
        this.dataset.lazyAPlate === "desk-films"
      ) {
        window.setTimeout(() => {
          this.pause();
          this.dispatchEvent(new Event("error"));
        }, 150);
      }
      return result;
    };
  });
  try {
    await page.goto(url, { waitUntil: "load" });
    await waitForDesk(page);
    await page.evaluate(() =>
      window.__lazyACameraDebug.requestDestination("films"),
    );
    await page.waitForFunction(
      () => {
        const snapshot = window.__lazyACameraDebug?.snapshot?.();
        return snapshot?.endpoint === "films" && snapshot?.phase === "resting";
      },
      null,
      { timeout: 6_000 },
    );
    const state = await page.evaluate(() => ({
      camera: window.__lazyACameraDebug.snapshot(),
      plate: window.__lazyAPlateState,
      compositor: window.__lazyACompositor,
    }));
    assert.equal(state.camera.endpoint, "films");
    assert.equal(state.camera.phase, "resting");
    console.log(
      "PASS a post-start plate-video fault retains a photographic endpoint and completes navigation",
    );
  } finally {
    await context.close();
  }
}

let failures = 0;
const cases = [
  ["surface", verifyDelayedHeroSurface],
  ["breakpoint", verifyBreakpointProfileSwap],
  ["fault", verifyPostStartMediaFault],
];
try {
  for (const [name, verify] of cases) {
    if (caseFilter && caseFilter !== name) continue;
    try {
      await verify();
    } catch (error) {
      failures += 1;
      console.error(
        `FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
} finally {
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 1_500)),
  ]);
}
assert.equal(failures, 0, `${failures} compositor resilience cases failed`);
