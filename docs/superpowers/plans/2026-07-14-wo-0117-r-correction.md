# Work Order 0117-R Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected mixed pano/primitive implementation with one reproducible photographic room, explicit physical navigation, authored human camera destinations, a real lamp-and-indentation CONTACT reveal, and one uninterrupted hero playback per visit.

**Architecture:** Blender owns the room, lighting, props, paper surfaces, and camera tracks. The browser presents authored wide or portrait plates/transitions and keeps only the hero film, CONTACT progression, and hit mapping live; all three consume projection data exported from the same camera. A typed experience reducer routes destination changes through desk while a separate hero reducer guarantees playback never depends on navigation.

**Tech Stack:** Blender 5.x/Cycles, Python, Next.js 16, React 19, React Three Fiber, Three.js, TypeScript, Playwright, ffmpeg.

## Global Constraints

- `docs/progress/0114-master-settled.jpg` is the lighting target; retain the current inward-facing `lamp2` and current approved object set.
- Use `TEST_PRINTS.prints[1]` for the logo. Delete the added `LogoProof`; do not create another card.
- Navigation is one inclined graphite production sheet with uppercase FILMS, JOURNAL, CONTACT, ABOUT in four separated rows.
- Hit regions are disjoint rectangles on the authored sheet plane. Margins and row gaps select nothing.
- JOURNAL is a head-first, upper-body-second forward/down lean with the notebook occupying approximately half the endpoint frame. Focal length does not change.
- CONTACT stays in the desk composition. The existing lamp visibly turns on in place and reveals true pressure indentation by raking light.
- ABOUT turns left toward the shelf and room history.
- The hero starts only after final desk settle, plays once from first to last frame, advances during every navigation state, and holds its last decoded frame until reload.
- No primitive fallback, loading chrome, floating label, hover response, opacity-based CONTACT text, or visitor-facing equirectangular panorama.
- Settle is at most 4 seconds; hero motion begins in the 4-6 second window; a destination answers by 6 seconds. Median FPS is at least 60; pre-settle transfer is at most 3 MB; total streamed transfer is at most 20 MB.
- Verify both `1280x720` and `375x812`.

---

### Task 1: Durable Master Inputs And Reproducibility Gate

**Files:**
- Create: `scripts/verify-master-assets.mjs`
- Create: `assets/master/README.md`
- Create: `assets/master/credits.json`
- Add: approved source archives and extracted files below `assets/master/scans/`
- Modify: `scripts/build-master-scene.py`
- Modify: `tasks/todo.md`

**Interfaces:**
- Consumes: `docs/progress/0108-scene.glb` plus the seven approved scan roots and blanket texture.
- Produces: `build/wo-0117-r/master.blend` and a machine-readable inventory with stable ids `vase`, `books`, `chair`, `camera`, `mug`, `lamp`, `plant`, `blanket`.

- [ ] **Step 1: Write the failing asset gate**

  Add a Node script with this required inventory and an existence/non-empty check:

  ```js
  const required = [
    "assets/master/scans/ceramic-vase/scene.gltf",
    "assets/master/scans/encyclopedia-books/scene.gltf",
    "assets/master/scans/vintage-office-chair/scene.gltf",
    "assets/master/scans/camera/scene.gltf",
    "assets/master/scans/coffee-cup/scene.gltf",
    "assets/master/scans/desk-lamp/scene.gltf",
    "assets/master/scans/potted-plant/scene.gltf",
    "assets/master/scans/blanket/texture.jpg",
  ];
  ```

  The gate must also reject `/private/tmp`, `~/Downloads`, and absolute user paths in `build-master-scene.py`.

- [ ] **Step 2: Prove the gate fails for the current expired paths**

  Run: `node scripts/verify-master-assets.mjs`

  Expected: non-zero with missing durable assets and forbidden `/private/tmp` references.

- [ ] **Step 3: Restore and document the exact approved sources**

  Restore the approved archives without substituting visually similar models. Normalize each extracted entry point to the paths above and record creator, source URL, license, original archive checksum, and normalized entry point in `assets/master/credits.json`. Preserve source texture files beside each model.

- [ ] **Step 4: Make the master builder path-stable**

  Resolve every asset relative to the repository root, rename imported object roots with the stable ids, and split the script into:

  ```py
  def asset_path(relative: str) -> str: ...
  def build_master(glb_path: str) -> bpy.types.Scene: ...
  def configure_grade(scene: bpy.types.Scene) -> None: ...
  def save_master(scene: bpy.types.Scene, output: str) -> None: ...
  ```

  Keep the approved grade values: Cycles 192 samples for finals, denoise on, AgX, exposure `0.25`, sun `5.5`, warm point `60`, desk area `23`, world `0.24`.

- [ ] **Step 5: Re-run the gate and build the persisted master**

  Run:

  ```bash
  node scripts/verify-master-assets.mjs
  /Applications/Blender.app/Contents/MacOS/Blender --factory-startup -b -P scripts/build-master-scene.py -- docs/progress/0108-scene.glb build/wo-0117-r/master.blend
  ```

  Expected: gate exits 0; Blender saves the master and reports all eight stable ids once.

- [ ] **Step 6: Commit the reproducible master-source correction**

  ```bash
  git add assets/master scripts/build-master-scene.py scripts/verify-master-assets.mjs tasks/todo.md
  git commit -m "build: make the Lazy A master reproducible"
  git push origin main
  ```

### Task 2: Authored Shot Manifest And Render Outputs

**Files:**
- Create: `scripts/render-master-shots.py`
- Create: `scripts/encode-master-shots.mjs`
- Create: `three/scene/plateManifest.ts`
- Create: `public/room/.gitkeep`
- Modify: `scripts/build-master-scene.py`

**Interfaces:**
- Produces: `opening`, `desk`, `films`, `journal`, `contact`, `about` stills for `wide` and `portrait`; forward transition clips; reverse playback metadata; per-frame camera samples; hero quad; nav plane/row rectangles; CONTACT paper quad.
- Browser manifest types:

  ```ts
  export type Variant = "wide" | "portrait";
  export type EndpointId = "opening" | "desk" | "films" | "journal" | "contact" | "about";
  export type DestinationId = Exclude<EndpointId, "opening" | "desk">;
  export interface CameraSample {
    position: readonly [number, number, number];
    quaternion: readonly [number, number, number, number];
    fov: number;
  }
  export interface Rect { x: number; y: number; width: number; height: number }
  export interface ProjectionFrame {
    camera: CameraSample;
    hero: readonly [number, number, number, number, number, number, number, number] | null;
  }
  ```

- [ ] **Step 1: Add a manifest validation mode that fails before outputs exist**

  `render-master-shots.py --validate` must verify exact shot ids, two profiles, constant lens within each profile, 2.6-second arrival, 0.9-second destination transitions, head-first JOURNAL key timing, fixed CONTACT lamp transform, and all required projection fields.

  Run: `/Applications/Blender.app/Contents/MacOS/Blender -b build/wo-0117-r/master.blend -P scripts/render-master-shots.py -- --validate`

  Expected before implementation: non-zero listing absent shot definitions.

- [ ] **Step 2: Author the physical corrections in the master**

  Assign the Lazy A material to existing test print `Mesh_33`; remove the rejected extra-card concept. Build the inclined production sheet and graphite rows into the master. Put indentation height/normal on top loose sheet `Mesh_56`. Add an emissive bulb and stationary grazing light parented to the approved lamp without changing lamp transform.

- [ ] **Step 3: Author the six endpoints and five forward paths per profile**

  Opening-to-desk uses the existing 2.6-second human walk. FILMS is a restrained attention shift. JOURNAL rotates the head during the first third, then translates the upper body, with notebook near half-frame. CONTACT lowers attention in the desk composition while lamp energy rises. ABOUT turns left. All paths retain the same lens.

- [ ] **Step 4: Export projection and hit data from the render camera**

  For every rendered frame, project the hero corners. At desk, export the production-sheet plane and four exact disjoint row rectangles. Export the CONTACT paper quad and lamp/reveal scalar. Write JSON beside the media and generate `plateManifest.ts` from it; do not manually duplicate camera numbers.

- [ ] **Step 5: Render proof stills before the full transition batch**

  Render the 12 endpoint stills at 192 samples. Inspect them against `0114-master-settled.jpg` and `0116-lamp-inward.jpg` before spending the transition render budget.

- [ ] **Step 6: Render and encode transitions once, reuse frames in reverse**

  Render at 30 fps with denoise. Encode forward H.264 clips at CRF 18, `yuv420p`, `+faststart`; return transitions use reverse playback of the same frame sequence, not a second Cycles render.

- [ ] **Step 7: Validate and commit the authored output contract**

  Run the validation mode and `node scripts/encode-master-shots.mjs --verify`. Commit scripts, manifest, endpoint stills, optimized visitor media, and proof captures in a small render-system commit.

### Task 3: Experience Reducer And Navigation Geometry

**Files:**
- Create: `three/animation/plateExperience.ts`
- Modify: `components/site/AttentionNavigation.tsx`
- Modify: `scripts/verify-physical-navigation.mjs`
- Create: `scripts/verify-camera-states.mjs`

**Interfaces:**
- Produces:

  ```ts
  export interface ExperienceState {
    endpoint: EndpointId;
    requested: DestinationId | null;
    transition: string | null;
    phase: "opening" | "transitioning" | "resting";
  }
  export type ExperienceEvent =
    | { type: "ARRIVAL_SETTLED" }
    | { type: "SELECT"; destination: DestinationId }
    | { type: "TRANSITION_ENDED" }
    | { type: "CLOSE" };
  export function plateExperienceReducer(state: ExperienceState, event: ExperienceEvent): ExperienceState;
  export function hitTestNavigation(localX: number, localY: number): DestinationId | null;
  ```

- [ ] **Step 1: Extend the browser gate and prove current overlap**

  Test both viewports, all four row centers, every inter-row gap, all margins, and a grid asserting each point maps to zero or one id. Run the current site and retain the expected failing output.

- [ ] **Step 2: Add the camera routing gate and prove current direct retargeting**

  Assert desk appears between destination switches, returns restore exact desk projection, JOURNAL reaches its endpoint, CONTACT never selects the old charger/right-turn pose, and ABOUT reaches left-history.

- [ ] **Step 3: Implement the pure reducer and plane-local hit testing**

  Intersect the pointer ray with the one authored sheet plane, convert to local sheet coordinates, then test the four rectangles. Remove all spherical centers/radii. Switching destinations queues current-to-desk then desk-to-requested unless a direct transition exists in the manifest.

- [ ] **Step 4: Run both gates green and commit**

  Run:

  ```bash
  node scripts/verify-physical-navigation.mjs http://localhost:3000/
  node scripts/verify-camera-states.mjs http://localhost:3000/
  ```

### Task 4: Once-Per-Visit Hero Lifecycle

**Files:**
- Create: `three/animation/heroLifecycle.ts`
- Create: `components/room/HeroFilm.tsx`
- Create: `scripts/verify-hero-lifecycle.mjs`
- Modify: `components/room/ReferenceWallDressing.tsx`

**Interfaces:**
- Produces:

  ```ts
  export type HeroPhase = "preloading" | "armed" | "playing" | "held" | "failed";
  export interface HeroState { phase: HeroPhase; playCount: number }
  export type HeroEvent =
    | { type: "READY" }
    | { type: "DESK_SETTLED" }
    | { type: "PLAYING" }
    | { type: "ENDED" }
    | { type: "FAILED" };
  export function heroLifecycleReducer(state: HeroState, event: HeroEvent): HeroState;
  ```

- [ ] **Step 1: Write and run the failing lifecycle gate**

  Assert time remains zero before settle, exactly one play attempt occurs afterward, `loop === false`, `currentTime` increases across a destination transition, `ended` changes phase to `held`, the final frame remains, and closing/switching never restarts playback.

- [ ] **Step 2: Implement the independent lifecycle**

  Preload during arrival. On the post-settle beat, seek to zero once and play muted/inline. Do not place hero state inside the experience reducer. On `ended`, pause without seeking and retain the video element. On failure, retain the authored first frame with no browser error UI.

- [ ] **Step 3: Project the living film from authored camera data**

  Use the current projection frame’s hero quad. Hide only when the quad is fully occluded/out of frame; keep the element mounted and advancing. Never remount it on destination changes.

- [ ] **Step 4: Run the lifecycle gate green and commit**

  Run: `node scripts/verify-hero-lifecycle.mjs http://localhost:3000/`

### Task 5: Photographic Runtime And Failure Behavior

**Files:**
- Create: `components/room/PlateRoom.tsx`
- Create: `lib/plateAssets.ts`
- Modify: `three/scene/Stage.tsx`
- Modify: `lib/deferredAssets.ts`
- Modify: `components/camera/Arrival.tsx`
- Create: `scripts/verify-plate-fallbacks.mjs`

**Interfaces:**
- `PlateRoom` consumes `variant`, `ExperienceState`, and the manifest; it reports `onDeskSettled` and `onTransitionEnded`.
- `plateAssets` exposes `preloadOpening()`, `preloadDesk()`, `preloadDestinations()` and retains the last ready photographic frame on error.

- [ ] **Step 1: Write and run the failing fallback gate**

  At desktop and phone, block desk/destination media requests and assert the last photo remains, no primitive room mounts, and no spinner/error chrome appears. Current phone geometry must fail.

- [ ] **Step 2: Replace `PanoRoom` and the geometry split**

  Load the profile-specific opening asset first, desk during arrival, and profile-specific destinations after settle. Render authored transitions and settle onto endpoint stills. Remove visitor-facing pano and primitive fallback branches while retaining dev-only diagnostics behind an explicit query flag.

- [ ] **Step 3: Synchronize camera projection with transition playback**

  Advance projection frames from the transition media clock so hero and hit planes use the exact authored camera sample. At endpoint, use the endpoint camera sample. Keep last coherent plate on load/decode failure.

- [ ] **Step 4: Run fallback, build, and both profile smoke gates green**

  Run:

  ```bash
  node scripts/verify-plate-fallbacks.mjs http://localhost:3000/
  npm run build
  ```

### Task 6: CONTACT Material Proof And Destination Captures

**Files:**
- Create: `components/room/ContactReveal.tsx`
- Create: `scripts/verify-contact-reveal.mjs`
- Modify: `scripts/capture.mjs`
- Modify: `scripts/film-review.mjs`
- Remove integration of: `three/interface/contact.ts`

**Interfaces:**
- CONTACT progression comes from authored transition metadata, not text-plane opacity.
- Capture accepts `--talk films|journal|contact|about` and waits for `window.__lazyAEndpoint`.

- [ ] **Step 1: Write and run the failing CONTACT gate**

  Assert there is no standalone CONTACT/email plane, paper opacity stays fixed, lamp/reveal progression rises, CONTACT holds, and close reverses it. Save before/after crops for pixel evidence.

- [ ] **Step 2: Remove the opacity text plane and wire authored reveal progression**

  Delete `ContactImpression`; use the rendered material response and transition metadata. Expose only diagnostic scalars required by tests. The visible result must come from indentation highlight/shadow.

- [ ] **Step 3: Add deterministic destination capture**

  Capture rest, FILMS, JOURNAL, CONTACT, ABOUT at `1280x720` and `375x812` under `docs/progress/0117-R-*`.

- [ ] **Step 4: Update the review film**

  Record arrival, settle, navigation while the hero is still playing, all four endpoints, desk returns, `ended`, and the final-frame hold. Remove the old 15-second pre-navigation wait.

- [ ] **Step 5: Run CONTACT gate and inspect all ten stills plus the film**

  Reject the pass if the logo intersects the hero, any primitive appears, any nav row is ambiguous, JOURNAL is not notebook-dominant, CONTACT reads as pasted text, ABOUT fails to reveal left history, or the lighting diverges from 0114.

### Task 7: Full Battery, Enumerated Audit, And Closeout

**Files:**
- Modify: `scripts/measure-clock.mjs`
- Modify: `scripts/perf-gate.mjs`
- Modify: `docs/PROJECT_STATUS.md`
- Replace: `docs/BUILD_REPORT.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `tasks/todo.md`
- Add: `docs/progress/0117-R-*`

**Interfaces:**
- Produces the final audit with each original rejection marked shipped+behavioral, structural/partial, or deferred.

- [ ] **Step 1: Run the complete local production battery**

  ```bash
  npm run build
  node scripts/verify-master-assets.mjs
  node scripts/verify-physical-navigation.mjs http://localhost:3000/
  node scripts/verify-camera-states.mjs http://localhost:3000/
  node scripts/verify-hero-lifecycle.mjs http://localhost:3000/
  node scripts/verify-plate-fallbacks.mjs http://localhost:3000/
  node scripts/verify-contact-reveal.mjs http://localhost:3000/
  node scripts/measure-clock.mjs http://localhost:3000/
  node scripts/perf-gate.mjs http://localhost:3000/ --fps 60 --budget-mb 3 --total-mb 20
  ```

- [ ] **Step 2: Perform the enumerated original-rejection audit**

  Audit exactly: logo card reuse/no intersection; photographic coherence at all states/viewports; material CONTACT reveal; JOURNAL lean/framing; disjoint legible navigation; no old right CONTACT/caption; 0114 lighting with current lamp; one-shot uninterrupted hero final-frame hold.

- [ ] **Step 3: Update the standard artifacts**

  `PROJECT_STATUS` states only verified current behavior. `BUILD_REPORT` uses the mandated Work Order structure and includes command evidence. `CHANGELOG` records the visitor-facing milestone. `tasks/todo.md` includes a review section and honest partial markers.

- [ ] **Step 4: Commit and push the verified correction**

  ```bash
  git add components three lib scripts public/room docs tasks package.json
  git commit -m "WO 0117-R: unify the photographic room experience"
  git push origin main
  ```

- [ ] **Step 5: Repeat the battery against the deployed URL**

  Do not close the Work Order until the served bundle contains the correction and the live clock, navigation, hero, fallback, CONTACT, and performance gates pass.
