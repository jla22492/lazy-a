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

async function verifyBreakpointTransitionContinuity() {
  const scenarios = [
    {
      name: "forward",
      initial: { width: 1280, height: 720 },
      initialProfile: "wide",
      replacement: { width: 375, height: 812 },
      replacementProfile: "portrait",
      transition: "desk-films",
      begin: async (page) => {
        await page.evaluate(() =>
          window.__lazyACameraDebug.requestDestination("films"),
        );
      },
      endpoint: "films",
    },
    {
      name: "reverse",
      initial: { width: 375, height: 812 },
      initialProfile: "portrait",
      replacement: { width: 1280, height: 720 },
      replacementProfile: "wide",
      transition: "films-desk",
      begin: async (page) => {
        await page.evaluate(() =>
          window.__lazyACameraDebug.requestDestination("films"),
        );
        await page.waitForFunction(
          () => {
            const snapshot = window.__lazyACameraDebug?.snapshot?.();
            return (
              snapshot?.endpoint === "films" && snapshot?.phase === "resting"
            );
          },
          null,
          { timeout: 6_000 },
        );
        await page.evaluate(() => window.__lazyACameraDebug.close());
      },
      endpoint: "desk",
    },
  ];

  for (const scenario of scenarios) {
    const context = await browser.newContext({ viewport: scenario.initial });
    const page = await context.newPage();
    await page.route(
      `**/room/${scenario.replacementProfile}/transitions/${scenario.transition}.mp4`,
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 900));
        await route.continue();
      },
    );
    await page.addInitScript(
      ({ eventName, transition }) => {
        window.__motionSwapProbe = [];
        window.addEventListener(eventName, (event) => {
          const detail = event.detail;
          if (detail?.plateSource?.includes(`/transitions/${transition}.mp4`)) {
            window.__motionSwapProbe.push({
              profile: detail.profile,
              time: detail.plateMediaTime,
            });
          }
        });
      },
      { eventName: compositorEvent, transition: scenario.transition },
    );
    try {
      await page.goto(url, { waitUntil: "load" });
      await waitForDesk(page);
      await scenario.begin(page);
      await page.waitForFunction(
        ({ profile, transition }) =>
          window.__lazyACompositor?.profile === profile &&
          window.__lazyACompositor?.plateSource.includes(
            `/${profile}/transitions/${transition}`,
          ) &&
          window.__lazyACompositor.plateMediaTime >= 0.45,
        {
          profile: scenario.initialProfile,
          transition: scenario.transition,
        },
        { timeout: 6_000 },
      );
      await page.setViewportSize(scenario.replacement);
      await page.waitForFunction(
        ({ profile, transition }) =>
          window.__lazyACompositor?.profile === profile &&
          window.__lazyACompositor?.plateSource.includes(
            `/${profile}/transitions/${transition}`,
          ),
        {
          profile: scenario.replacementProfile,
          transition: scenario.transition,
        },
        { timeout: 8_000 },
      );
      const handoff = await page.evaluate((replacementProfile) => {
        const samples = window.__motionSwapProbe;
        const replacementIndex = samples.findIndex(
          ({ profile }) => profile === replacementProfile,
        );
        return {
          before: samples[replacementIndex - 1]?.time ?? null,
          after: samples[replacementIndex]?.time ?? null,
        };
      }, scenario.replacementProfile);
      assert.ok(
        handoff.before !== null &&
          handoff.after !== null &&
          handoff.after >= handoff.before - 0.12,
        `${scenario.name} transition rewound at presented handoff: ${JSON.stringify(handoff)}`,
      );
      await page.waitForFunction(
        (endpoint) => {
          const snapshot = window.__lazyACameraDebug?.snapshot?.();
          return (
            snapshot?.endpoint === endpoint && snapshot?.phase === "resting"
          );
        },
        scenario.endpoint,
        { timeout: 6_000 },
      );
    } finally {
      await context.close();
    }
  }
  console.log(
    "PASS delayed breakpoint swaps preserve consecutive forward and reverse transition frames",
  );
}

async function verifyDecodedPlateClock() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.addInitScript(
    ({ eventName }) => {
      window.__decodedPlateTimes = {};
      window.__decodedPlateClockProbe = [];
      const nativeRequestVideoFrameCallback =
        HTMLVideoElement.prototype.requestVideoFrameCallback;
      HTMLVideoElement.prototype.requestVideoFrameCallback = function request(
        callback,
      ) {
        return nativeRequestVideoFrameCallback.call(this, (now, metadata) => {
          if (this.dataset.lazyAPlate) {
            window.__decodedPlateTimes[this.dataset.lazyAPlate] =
              metadata.mediaTime;
          }
          callback(now, metadata);
        });
      };
      window.addEventListener(eventName, (event) => {
        const detail = event.detail;
        const transition = detail?.plateSource
          ?.split("/")
          .at(-1)
          ?.replace(/\.mp4$/, "");
        const decoded = window.__decodedPlateTimes[transition];
        if (transition === "desk-films" && Number.isFinite(decoded)) {
          window.__decodedPlateClockProbe.push({
            decoded,
            selected: detail.plateMediaTime,
          });
        }
      });
    },
    { eventName: compositorEvent },
  );
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
    const samples = await page.evaluate(() => window.__decodedPlateClockProbe);
    const terminalDecodedTime = Math.max(
      ...samples.map(({ decoded }) => decoded),
    );
    const activeSamples = samples.filter(
      ({ decoded }) => decoded < terminalDecodedTime - 1e-6,
    );
    const deltas = activeSamples.map(
      ({ decoded, selected }) => selected - decoded,
    );
    const maximumError = Math.max(...deltas.map(Math.abs));
    const worst =
      activeSamples[
        deltas.findIndex((delta) => Math.abs(delta) === maximumError)
      ];
    const mismatches = activeSamples
      .filter(({ decoded, selected }) => Math.abs(selected - decoded) > 1 / 60)
      .slice(0, 8);
    assert.ok(
      activeSamples.length >= 12,
      `active decoded clock samples=${activeSamples.length}`,
    );
    assert.ok(
      maximumError <= 1 / 60,
      `camera/decoded plate mismatch ${maximumError.toFixed(4)}s: ${JSON.stringify({ worst, mismatches })}`,
    );
    console.log(
      `PASS compositor camera follows decoded plate time (max ${maximumError.toFixed(4)}s)`,
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
  ["motion", verifyBreakpointTransitionContinuity],
  ["clock", verifyDecodedPlateClock],
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
