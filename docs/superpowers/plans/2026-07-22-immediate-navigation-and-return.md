# Immediate Navigation And Physical Return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every destination respond visibly within one frame, add a clear room-native return control, and make CONTACT typography invisible until the lamp illuminates its physical indentation.

**Architecture:** Prepared video elements become transferable resources shared by warming and the compositor, eliminating duplicate network/decode work. Stage remains the canonical experience owner and gains a single accessible return component plus browser-history routing. CONTACT is corrected at the Blender material source and every affected delivery frame is regenerated.

**Tech Stack:** Next.js 16, React 19, React Three Fiber, Three.js `VideoTexture`, Playwright/Chrome behavioral gates, Blender Cycles authoring, ffmpeg H.264 delivery, GitHub Pages.

## Global Constraints

- FILMS, JOURNAL, and ABOUT show camera motion within 100 ms of click or tap.
- CONTACT shows lamp rise within 100 ms, holds the desk camera for exactly 1.0 second, then uses the existing approved move.
- Destination endpoints, camera paths, hero continuity, and room composition do not change.
- The return control is a lower-edge graphite `← DESK` paper tab with a minimum 48-by-48 CSS-pixel target and accessible name `Return to desk`.
- Escape, empty-space click/tap, browser Back, and the paper tab share the canonical CLOSE path.
- CONTACT address copy is visually absent at rest and readable only under the lamp.
- No screen-space CONTACT patch, text-plane crossfade, or painted-over plate.
- Completion requires local and canonical-domain behavioral and visual proof.

---

### Task 1: Pin The Regressions With Behavioral RED Gates

**Files:**

- Create: `scripts/verify-navigation-response.mjs`
- Create: `scripts/verify-physical-return.mjs`
- Modify: `scripts/verify-contact-reveal.mjs`
- Modify: `tasks/todo.md`

**Interfaces:**

- Consumes: `window.__lazyANavigationDebug`, `window.__lazyACameraDebug`, `window.__lazyACompositor`, and `window.__lazyAContactReveal`.
- Produces: executable Chrome gates for click-to-effect latency, return behavior, and latent-copy pixel contrast.

- [ ] **Step 1: Add the response-latency gate**

Create a real physical-row click test at 1280x720 and 375x812. Arm a page-local probe before click, record the click event timestamp, and sample the canonical camera plus CONTACT lamp level on each animation frame:

```js
const limits = { cameraMs: 100, contactLampMs: 100, contactHoldMs: 1000 };
const destinations = ["films", "journal", "contact", "about"];
// Click the projected row center, not the debug request API.
// FILMS/JOURNAL/ABOUT pass on first changed camera sample.
// CONTACT passes on first lampLevel > 0 and separately proves the camera
// stays exact for 1.0s before the approved move begins.
```

Also count video elements carrying `data-lazy-a-plate` before and after selection and require the transition diagnostic to report `preparedReused: true`.

- [ ] **Step 2: Add the physical-return gate**

At both viewports, enter every destination through its physical row and verify:

```js
const button = page.getByRole("button", { name: "Return to desk" });
await expectVisibleWithMinimumBounds(button, 48, 48);
await button.click();
await expectExactDeskRestoration(page);
```

Repeat one route with `page.goBack()`, one with Escape, and one with an empty-space click. Assert that the tab is absent during opening, at desk, and during reverse motion.

- [ ] **Step 3: Tighten the CONTACT resting-copy gate**

Replace the permissive typography-only threshold with an adjacent-paper parity check over the authored address quad:

```js
const restParity = compareAddressToAdjacentPaper(restImage, restAddress);
if (restParity.meanLumaDelta > 1 || restParity.gradientP95 > 3) {
  failures.push("CONTACT address is visible before lamp activation");
}
```

Keep the existing lit-hold minimums and reverse-to-rest comparison unchanged.

- [ ] **Step 4: Run RED**

Run sequentially against the canonical site:

```bash
node scripts/verify-navigation-response.mjs https://www.lazyaproductions.com/
node scripts/verify-physical-return.mjs https://www.lazyaproductions.com/
node scripts/verify-contact-reveal.mjs https://www.lazyaproductions.com/ --out-dir /tmp/lazy-a-0119-red-contact
```

Expected: navigation fails with observed 0.48-1.95 second visible latency and no prepared reuse; return fails because the button is absent; CONTACT fails because the white resting copy exceeds the new parity threshold.

- [ ] **Step 5: Commit RED gates**

```bash
git add scripts/verify-navigation-response.mjs scripts/verify-physical-return.mjs scripts/verify-contact-reveal.mjs tasks/todo.md
git commit -m "Add immediate navigation and return regression gates"
```

---

### Task 2: Transfer Prepared Media Into The Compositor

**Files:**

- Modify: `lib/plateAssets.ts`
- Modify: `components/room/PlateRoom.tsx`
- Modify: `components/room/PlateCompositor.tsx`
- Modify: `scripts/encode-master-shots.mjs`
- Modify: generated destination transition MP4s under `public/room/{wide,portrait}/transitions/`
- Test: `scripts/verify-navigation-response.mjs`
- Test: `scripts/verify-compositor-resilience.mjs`
- Test: `scripts/perf-gate.mjs`

**Interfaces:**

- Produces: `preparePlateVideo(asset): Promise<PreparedPlateVideo>`, `claimPreparedPlateVideo(asset): Promise<PreparedPlateVideo>`, and `preloadForwardTransitions(manifest, variant): Promise<PromiseSettledResult<PlateAsset>[]>`.
- `PreparedPlateVideo` owns `{ asset, video, readyAt }`; claiming removes it from the warming cache and transfers disposal to `PlateCompositor`.

- [ ] **Step 1: Verify the source gate fails before implementation**

Add source assertions to `verify-navigation-response.mjs` requiring a claim path and forbidding a second `document.createElement("video")` when a prepared source exists. Run `node scripts/verify-navigation-response.mjs --source-only`; expect failure.

- [ ] **Step 2: Implement prepared-video ownership**

Refactor `loadVideo` into one prepared resource path:

```ts
export interface PreparedPlateVideo {
  asset: PlateAsset;
  video: HTMLVideoElement;
  readyAt: number;
}

export function preparePlateVideo(
  asset: PlateAsset,
): Promise<PreparedPlateVideo>;
export function claimPreparedPlateVideo(
  asset: PlateAsset,
): Promise<PreparedPlateVideo>;
```

The claim operation reuses the cached promise, removes the resolved entry from
the cache exactly once, and returns a video still parked at time zero. Failed
entries evict themselves. Image preloads retain the existing promise cache.

- [ ] **Step 3: Warm the active profile at the settled-desk handoff**

Begin `preloadForwardTransitions` for only the active responsive profile when
the opening transition hands off to the settled desk. Starting this batch
during arrival violates the locked 3 MB pre-settle budget; the settled handoff
keeps that budget intact while preparing routes before normal visitor intent.
Candidate events continue to prioritize one destination, and destination rest
continues to warm only its reverse.

- [ ] **Step 4: Claim prepared media in the compositor**

Change `loadVideoMedia` to accept a prepared video. Register frame callbacks,
create the `VideoTexture`, and call `play()` on that same decoded element. Set a
read-only diagnostic:

```ts
window.__lazyAMediaTransition = {
  source: asset.src,
  preparedReused: prepared.readyAt <= performance.now(),
  playRequestedAt: performance.now(),
};
```

Fallback and responsive replacement behavior remain unchanged.

- [ ] **Step 5: Re-encode destination clips at CRF 14**

Set destination forward and reverse clips to CRF 14 while leaving
`opening-desk` at CRF 26. Run:

```bash
node scripts/encode-master-shots.mjs
node scripts/encode-master-shots.mjs --verify
```

Verify dimensions, 30fps, frame counts, durations, and first/last endpoint
parity remain exact. Inspect full-resolution CRF 8 versus CRF 14 crops for hero,
pencils, paper edges, and camera strap before accepting.

- [ ] **Step 6: Run GREEN and performance checks**

```bash
node scripts/verify-navigation-response.mjs http://localhost:3000/
node scripts/verify-compositor-resilience.mjs http://localhost:3000/
node scripts/perf-gate.mjs http://localhost:3000/ --budget-mb 3 --total-mb 20
```

Expected: every click-to-effect sample passes 100 ms, prepared reuse is true,
fallbacks pass, pre-settle remains at or below 3 MB, and total transfer remains
at or below 20 MB.

- [ ] **Step 7: Commit prepared-media integration**

```bash
git add lib/plateAssets.ts components/room/PlateRoom.tsx components/room/PlateCompositor.tsx scripts/encode-master-shots.mjs public/room
git commit -m "Start destination motion without decode delay"
```

---

### Task 3: Add The Physical Return Tab And Browser Back Routing

**Files:**

- Create: `components/site/ReturnToDesk.tsx`
- Modify: `three/scene/Stage.tsx`
- Modify: `app/globals.css`
- Test: `scripts/verify-physical-return.mjs`
- Test: `scripts/verify-camera-states.mjs`

**Interfaces:**

- Consumes: `PlateExperienceState` and `onClose(): void` from Stage.
- Produces: one semantic `button[data-lazy-a-return="desk"]` and one history entry per active destination.

- [ ] **Step 1: Confirm the return gate is RED locally**

Run `node scripts/verify-physical-return.mjs http://localhost:3000/`; expect the
button-presence assertion to fail while Escape and empty-space behavior pass.

- [ ] **Step 2: Implement the return component**

Create a focused client component:

```tsx
export function ReturnToDesk({ experience, onClose }: Props) {
  const visible =
    experience.phase === "resting" &&
    !["opening", "desk"].includes(experience.endpoint);
  return (
    <button
      type="button"
      aria-label="Return to desk"
      data-lazy-a-return="desk"
      hidden={!visible}
      onClick={onClose}
    >
      <span aria-hidden="true">← DESK</span>
    </button>
  );
}
```

Style it as square-edged paper with graphite text, subtle fiber, restrained
shadow, a transparent 48px minimum hit area, and `env(safe-area-inset-bottom)`.
No border radius, pill, panel, animation flourish, or explanatory text.

- [ ] **Step 3: Route all close paths through Stage history**

Stage pushes one marked state when a desk-to-destination transition begins.
Explicit CLOSE calls `history.back()` when that marker is active; `popstate`
dispatches the reducer CLOSE event. Direct/non-history states dispatch CLOSE
immediately. AttentionNavigation and ReturnToDesk both receive the same handler.

- [ ] **Step 4: Run GREEN**

```bash
node scripts/verify-physical-return.mjs http://localhost:3000/
node scripts/verify-camera-states.mjs http://localhost:3000/
node scripts/verify-physical-navigation.mjs http://localhost:3000/
```

Expected: all return mechanisms restore the exact desk camera at desktop and
phone sizes; route rows remain exclusive and the tab never blocks them.

- [ ] **Step 5: Commit the return affordance**

```bash
git add components/site/ReturnToDesk.tsx three/scene/Stage.tsx app/globals.css scripts/verify-physical-return.mjs
git commit -m "Add a physical return path to the desk"
```

---

### Task 4: Make CONTACT Truly Latent At The Authored Source

**Files:**

- Modify: `scripts/render-master-shots.py`
- Modify: `scripts/encode-master-shots.mjs`
- Modify: `three/scene/plateManifest.ts`
- Modify: `public/room/contact/practical-light-authoring-manifest.json`
- Modify: affected stills, frame sequences, and transition MP4s under `public/room/`
- Modify: `build/wo-0117-r/master.blend` and provenance when source hashes change
- Test: `scripts/verify-contact-reveal.mjs`
- Test: `scripts/verify-master-assets.mjs`

**Interfaces:**

- Preserves: 0.30 mm fixed indentation, exact three-line copy, 31-sample lamp smoothstep, 1.0-second stationary camera, and approved post-hold path.
- Changes: zero-lamp groove material parity and its strict visual acceptance thresholds.

- [ ] **Step 1: Run the new CONTACT gate RED against current local media**

```bash
node scripts/verify-contact-reveal.mjs http://localhost:3000/ --out-dir /tmp/lazy-a-0119-contact-red
```

Expected: `CONTACT address is visible before lamp activation`.

- [ ] **Step 2: Remove the idle white overshoot in Blender authoring**

Keep host color and normal links at lamp level zero. Set the ambient-match
emission/fill to `0.0` for the first proof. If the recess becomes darker than
adjacent paper, test `0.03`, `0.06`, `0.09`, and `0.12` in that order and select
the first value that passes mean-luma delta `<= 1` and gradient p95 `<= 3` at
both profiles. Lamp-level multiplication remains the only path to fiber
darkening, bevel normal, and groove occlusion. Update manifest metadata and
validators to pin the selected numeric value.

- [ ] **Step 3: Render low-sample wide and portrait proofs**

```bash
Blender -b build/wo-0117-r/master.blend -P scripts/render-master-shots.py -- --proof --samples 16 --only wide:desk --only wide:contact --only portrait:desk --only portrait:contact
```

Inspect original-resolution address crops. Evaluate only the bounded idle-fill
sequence defined in Step 2 until rest passes both numeric limits and the lit
hold retains its existing minimums; do not alter geometry or light choreography.

- [ ] **Step 4: Regenerate authoritative source and delivery media**

```bash
Blender -b build/wo-0117-r/master.blend -P scripts/render-master-shots.py -- --build-authoring --samples 32
Blender -b build/wo-0117-r/master.blend -P scripts/render-master-shots.py -- --render-stills
Blender -b build/wo-0117-r/master.blend -P scripts/render-master-shots.py -- --render-transitions
node scripts/encode-master-shots.mjs
```

Use the verified Metal device path and resume selectors only when interrupted.
Every final frame uses the production sample count; disposable low-sample proof
never enters `public/room` delivery paths.

- [ ] **Step 5: Run source and behavioral GREEN**

```bash
Blender -b build/wo-0117-r/master.blend -P scripts/render-master-shots.py -- --validate
node scripts/encode-master-shots.mjs --verify
node scripts/verify-master-assets.mjs
node scripts/verify-contact-reveal.mjs http://localhost:3000/ --out-dir docs/progress/0119-contact-final
```

Expected: resting address parity passes at both profiles, all lamp and
indentation checks pass, reverse returns cleanly, and source hashes agree.

- [ ] **Step 6: Commit authored CONTACT correction**

```bash
git add scripts/render-master-shots.py scripts/encode-master-shots.mjs three/scene/plateManifest.ts public/room build/wo-0117-r/master.blend build/wo-0117-r/master.blend.provenance.json docs/progress/0119-contact-final
git commit -m "Hide CONTACT indentation until the lamp turns on"
```

---

### Task 5: Full Battery, Visual Review, Documentation, And Production Deploy

**Files:**

- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/BUILD_REPORT.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `tasks/todo.md`
- Modify: `tasks/lessons.md`
- Create: responsive 0119 proof captures under `docs/progress/`

**Interfaces:**

- Consumes: the complete 0119 implementation and every existing production gate.
- Produces: a deployed canonical build, live proof, and enumerated completion audit.

- [ ] **Step 1: Run the local source and browser battery sequentially**

```bash
npx tsc --noEmit
npx eslint components/site/ReturnToDesk.tsx components/site/AttentionNavigation.tsx components/room/PlateRoom.tsx components/room/PlateCompositor.tsx lib/plateAssets.ts three/scene/Stage.tsx
npm run build
node scripts/verify-navigation-response.mjs http://localhost:3000/
node scripts/verify-physical-return.mjs http://localhost:3000/
node scripts/verify-contact-reveal.mjs http://localhost:3000/ --out-dir docs/progress/0119-contact-final
node scripts/verify-camera-states.mjs http://localhost:3000/
node scripts/verify-physical-navigation.mjs http://localhost:3000/
node scripts/verify-arrival-continuity.mjs http://localhost:3000/
node scripts/verify-compositor-resilience.mjs http://localhost:3000/
node scripts/verify-plate-fallbacks.mjs http://localhost:3000/
node scripts/verify-hero-lifecycle.mjs http://localhost:3000/
node scripts/measure-clock.mjs http://localhost:3000/
node scripts/perf-gate.mjs http://localhost:3000/ --budget-mb 3 --total-mb 20
```

Run screenshot-heavy gates sequentially. Any failure returns to the owning task;
do not average or waive timing failures.

- [ ] **Step 2: Capture and inspect normal-speed desktop and phone journeys**

Capture desk, every destination, return tab, CONTACT off/on, and full reverse.
Inspect full frames for paper-tab integration, contact-copy invisibility, first
response, hero registration, foreground edges, text fit, and touch clearance.

- [ ] **Step 3: Update the standard artifacts and enumerated audit**

Record every original requirement as shipped plus behavioral proof, or as an
explicit residual. Add actionable lessons for transferable prepared media and
human-visible latent-copy thresholds.

- [ ] **Step 4: Commit and push the release candidate**

```bash
git add docs tasks components lib three scripts public build
git commit -m "Ship immediate room navigation and return"
git push origin main
```

Stage only 0119-owned paths; leave existing unrelated untracked files untouched.

- [ ] **Step 5: Wait for Pages and repeat the production battery**

Run response, return, CONTACT, camera, clock, performance, and responsive visual
proof against `https://www.lazyaproductions.com/`. Confirm HTTP/apex canonical
HTTPS routing, approved certificate state, and the exact deployed workflow SHA.

- [ ] **Step 6: Stop local servers and close the order**

Only after the canonical-domain battery and visual inspection pass, mark Work
Order 0119 complete in `PROJECT_STATUS`, `BUILD_REPORT`, `CHANGELOG`, and
`tasks/todo.md`, then push the final audit commit without triggering a redundant
artifact deployment.
