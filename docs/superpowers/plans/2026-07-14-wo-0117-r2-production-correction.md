# Work Order 0117-R2 Production Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans` to
> implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Restore the approved continuous arrival, resting camera, and physical
hero registration; integrate Jonathan's seven supplied props and CONTACT
details; and deliver a polished, coherent room experience across real desktop
and mobile browser shapes.

**Architecture:** Blender remains the source for photographic room pixels and
physical props. The browser consumes exact plate-space projection metadata for
all interactive surfaces, rather than reconstructing their positions with an
independent camera. Successful transition videos remain visible on their held
final frame, eliminating endpoint swaps.

**Tech Stack:** Blender 5.1/Cycles, Python render authoring, Next.js 16, React
19, React Three Fiber/Three.js, TypeScript, Playwright, FFmpeg.

## Global Constraints

- Commit `1891221` is the immutable arrival/camera/hero behavioral reference.
- Wide rest: FOV `35`, position `(0.05, 1.60, 1.45)`, regard
  `(0.02, 1.04, -0.45)`.
- Arrival: `0.2s` opening, `1.9s` cubic walk, `0.5s` settle, existing bob,
  sway, overshoot, damping, and gaze lag.
- Tall desktop windows never select the phone camera.
- Hero registration error is at most one CSS pixel at every tested corner and
  frame.
- Hero starts once after settle, continues through navigation, and holds its
  final frame.
- CONTACT copy is exactly Jonathan's supplied name, email, and phone.
- No completion claim occurs before full-motion human review and Jonathan's
  explicit visual approval.

---

### Task 1: Pin The Approved Camera Contract

**Files:**
- Create: `assets/master/camera-contract.json`
- Create: `scripts/verify-reference-camera.mjs`
- Modify: `scripts/render-master-shots.py`
- Modify: `scripts/verify-camera-states.mjs`

**Interfaces:**
- `camera-contract.json` contains `desktop`, `phone`, `arrival`, and
  `selection` records.
- Blender reads every camera pose and arrival constant from this file.
- `selectPlateVariant(width)` selects desktop by layout width, never by aspect
  ratio alone.

- [ ] **Step 1: Write the failing reference gate**

  Assert that current manifest/camera behavior fails these exact conditions:
  wide rest equals the `1891221` pose; `1316x1329` selects desktop; phone rest
  equals the legacy responsive formula; arrival contains opening, walk, gaze
  lag, overshoot, and settle phases.

- [ ] **Step 2: Run the reference gate red**

  Run: `node scripts/verify-reference-camera.mjs`

  Expected: FAIL on the rejected aspect-only selector, invented portrait pose,
  and simplified arrival interpolation.

- [ ] **Step 3: Add the canonical JSON contract and consume it in Blender**

  The contract records:

  ```json
  {
    "desktop": {
      "fov": 35,
      "position": [0.05, 1.6, 1.45],
      "target": [0.02, 1.04, -0.45]
    },
    "arrival": {
      "openingSeconds": 0.2,
      "walkSeconds": 1.9,
      "settleSeconds": 0.5,
      "gazeLagSeconds": 0.3,
      "bobHz": 1.75,
      "bobAmplitude": 0.011,
      "swayAmplitude": 0.0055,
      "overshoot": 0.012,
      "settleHz": 1.4
    },
    "selection": { "phoneMaxWidth": 767 }
  }
  ```

  Compute the phone pose with the legacy formula at `375x812`; do not copy the
  rejected portrait constants.

- [ ] **Step 4: Implement the exact legacy arrival equations**

  Port `easeInOutCubic`, `cubicOut`, the walking envelope, step phase,
  overshoot decay, and final exact pose from `Arrival.tsx` at `1891221` into
  `transition_sample`.

- [ ] **Step 5: Run the camera gates green and commit**

  Run:

  ```bash
  node scripts/verify-reference-camera.mjs
  node scripts/verify-camera-states.mjs http://localhost:3003/
  ```

  Commit: `fix: restore the approved Lazy A camera contract`

### Task 2: Establish One Plate-Space Crop Transform

**Files:**
- Create: `lib/plateSpace.ts`
- Create: `scripts/verify-plate-space.mjs`
- Modify: `lib/plateAssets.ts`
- Modify: `components/site/AttentionNavigation.tsx`

**Interfaces:**

```ts
export interface Size { width: number; height: number }
export interface Point { x: number; y: number }
export function coverTransform(source: Size, viewport: Size): {
  scale: number; offsetX: number; offsetY: number;
};
export function mapPlatePoint(point: Point, source: Size, viewport: Size): Point;
export function mapPlateQuad(quad: readonly number[], source: Size, viewport: Size): readonly number[];
export function pointInConvexQuad(point: Point, quad: readonly number[]): boolean;
```

- [ ] **Step 1: Write a failing crop/property gate**

  Test `1280x720`, `1316x1329`, `1024x768`, `768x1024`, and `375x812`.
  Assert mapped corners reproduce CSS `object-fit: cover`, preserve polygon
  order, and map navigation gaps to no destination.

- [ ] **Step 2: Run the plate-space gate red**

  Run: `node --experimental-strip-types scripts/verify-plate-space.mjs`

  Expected: FAIL because no shared mapping module exists and the current
  navigation depends on an independent Three.js camera ray.

- [ ] **Step 3: Implement the pure mapping module**

  Use `scale = max(viewport.width/source.width,
  viewport.height/source.height)` and center offsets from the scaled source.
  Map every authored normalized coordinate through that same transform.

- [ ] **Step 4: Route navigation through exported row quads**

  Remove camera-ray plane reconstruction. Use the current plate frame's
  per-row screen polygons transformed by `mapPlateQuad`. Preserve dwell,
  release, empty margins, and disjoint rows.

- [ ] **Step 5: Run unit/navigation gates green and commit**

  Commit: `fix: unify Lazy A plate and interaction coordinates`

### Task 3: Prove Arrival And Hero Failures Before Runtime Repair

**Files:**
- Create: `scripts/verify-arrival-continuity.mjs`
- Modify: `scripts/verify-hero-lifecycle.mjs`
- Modify: `scripts/capture.mjs`

**Interfaces:**
- `verify-arrival-continuity` samples media time, camera metadata, and pixels
  from first paint through held desk.
- Hero gate compares all four live corners with all four transformed authored
  film-inset corners.

- [ ] **Step 1: Add the tall-desktop and intermediate-aspect reproductions**

  Include the five required viewports and collect at least one sample per
  decoded video frame via `requestVideoFrameCallback` instrumentation.

- [ ] **Step 2: Add endpoint handoff pixel checks**

  Compare the last transition frame against the first held endpoint frame in
  stable non-hero regions. Fail on a visible room jump or crop change.

- [ ] **Step 3: Add four-corner hero checks**

  Fail when any corresponding corner differs by more than one CSS pixel,
  when the hero appears outside the authored film inset, or when the corner
  order flips.

- [ ] **Step 4: Run both gates red and retain evidence**

  Run:

  ```bash
  node scripts/verify-arrival-continuity.mjs http://localhost:3003/
  node scripts/verify-hero-lifecycle.mjs http://localhost:3003/
  ```

  Expected: FAIL at `1316x1329` on camera selection and hero registration.

- [ ] **Step 5: Commit rejection gates**

  Commit: `test: capture Lazy A arrival and hero regressions`

### Task 4: Make The Seven Supplied Assets Durable

**Files:**
- Modify: `assets/master/README.md`
- Modify: `assets/master/credits.json`
- Create: `assets/master/scans/sony-mdr-7506/**`
- Create: `assets/master/scans/peace-lily/**`
- Create: `assets/master/scans/gold-picture-frame/**`
- Create: `assets/master/scans/trash-can/**`
- Replace: `assets/master/scans/desk-lamp/**`
- Replace: `assets/master/scans/coffee-cup/**`
- Create: `assets/master/scans/basketball/**`
- Modify: `scripts/verify-master-assets.mjs`

**Interfaces:**
- Required IDs become `vase`, `books`, `chair`, `camera`, `mug`, `lamp`,
  `plant`, `blanket`, `headphones`, `pictureFrame`, `trashCan`, and
  `basketball`.
- Every archive has `archiveSha256`, normalized entry point hash, creator,
  source, license, and repository path. Trash-can license is explicitly
  `Unresolved; user-supplied archive contains no license metadata`.

- [ ] **Step 1: Extend the inventory gate and run it red**

  Expected: FAIL listing the seven absent/replacement asset contracts.

- [ ] **Step 2: Hash and preserve each unmodified source archive**

  Run `shasum -a 256` against every exact Downloads archive, copy it as
  `source.zip`, and extract referenced buffers/textures without renaming them.

- [ ] **Step 3: Normalize entry points and credits**

  Preserve every supplied `license.txt`. Record the six known licenses from
  their archives; do not invent trash-can attribution.

- [ ] **Step 4: Isolate the basketball asset contract**

  Keep the original archive but mark only the mesh using material `Ball` as
  renderable. Exclude `Floor` and `Khayt` display geometry in the master
  builder.

- [ ] **Step 5: Run the durable asset gate green and commit**

  Commit: `assets: preserve Jonathan's approved room props`

### Task 5: Integrate And Art-Direct The Replacement Props

**Files:**
- Modify: `scripts/build-master-scene.py`
- Modify: `scripts/verify-master-blend.py`
- Modify: `scripts/render-master-shots.py`
- Add: `docs/progress/0117-r2-prop-board.jpg`
- Add: `docs/progress/0117-r2-prop-wide.jpg`
- Add: `docs/progress/0117-r2-prop-phone.jpg`

**Interfaces:**
- `place_scan` records stable `lazy_a_asset_id`, world bounds, target height,
  replacement relationship, and source entry point.
- Saved master verifier proves every old placeholder/replaced scan is hidden
  and every requested prop is present exactly once.

- [ ] **Step 1: Extend the saved-master verifier and run it red**

  Assert real-world bounds, floor/desk contact, unique IDs, no basketball
  display geometry, and no old mug/lamp/plant/headphone/trash placeholders.

- [ ] **Step 2: Add measured placements**

  Use these physical targets as starting constraints, then verify in render:
  headphones approximately `0.19m` across; mug approximately `0.095m` tall;
  basketball regulation diameter `0.24m`; wastebasket approximately `0.27m`
  tall; lamp approximately `0.48m` tall; floor plant approximately `0.75m`
  tall; desk frame approximately `0.20m` tall.

- [ ] **Step 3: Preserve room stories while replacing geometry**

  Keep the mug off its ring, headphones in the left resting zone, plant toward
  window light, trash can at the established toss location, lamp aimed inward,
  frame immediately right of lamp, and basketball settled in the bottom-right
  corner.

- [ ] **Step 4: Render the prop board and endpoint proofs**

  Reject intersections, floating contacts, wrong-facing frame, stretched
  textures, separate lighting, sharp scan bases, or basketball display pieces.

- [ ] **Step 5: Run master verification green and commit**

  Commit: `feat: replace Lazy A room props with approved scans`

### Task 6: Re-author Navigation, JOURNAL, And CONTACT

**Files:**
- Modify: `scripts/render-master-shots.py`
- Modify: `scripts/verify-physical-navigation.mjs`
- Modify: `scripts/verify-contact-reveal.mjs`
- Modify: `scripts/verify-camera-states.mjs`

**Interfaces:**
- Navigation metadata exports four visible glyph quads and four row hit quads.
- CONTACT metadata exports `lampLevel`, `revealLevel`, indentation object ID,
  and exact three-line copy checksum.

- [ ] **Step 1: Tighten the visual/behavioral gates and run them red**

  Require readable row height/contrast, a notebook silhouette and page block,
  no hero clipping in JOURNAL, exact CONTACT copy, fixed paper opacity, fixed
  lamp transform, and a final readable indentation hold.

- [ ] **Step 2: Rebuild the production note typography**

  Use a believable graphite material and natural but readable production-hand
  spacing. Keep one sheet and four explicit rows; do not add floating labels.

- [ ] **Step 3: Refine the JOURNAL physical read**

  Improve cover edge, paper block, wear, pencil grounding, text scale, light,
  and endpoint framing. Preserve the head-first/body-second choreography.

- [ ] **Step 4: Author the final CONTACT indentation**

  Cut exactly three lines into `Mesh_56`; tune depth and grazing light so the
  reveal becomes legible through shadow/highlight rather than emissive text.

- [ ] **Step 5: Render desktop/phone proofs, run gates, and commit**

  Commit: `feat: finish Lazy A physical navigation destinations`

### Task 7: Repair Runtime Hero And Transition Surfaces

**Files:**
- Modify: `components/room/PlateRoom.tsx`
- Modify: `components/room/HeroFilm.tsx`
- Modify: `three/scene/Stage.tsx`
- Modify: `lib/plateAssets.ts`
- Modify: `three/scene/plateManifest.ts` (generated)

**Interfaces:**
- `PlateRoom` publishes current asset source size, authored projection frame,
  held media time, and transition phase.
- `HeroFilm` consumes transformed film-inset corners and renders a screen-space
  quadrilateral; it does not consume a perspective camera.

- [ ] **Step 1: Keep the transition element on its final decoded frame**

  Decode endpoint still beneath it, announce state completion, and leave the
  ended video visible. Replace it only when the next clip has decoded frame
  zero and pixel-matches the held surface.

- [ ] **Step 2: Synchronize metadata to decoded frames**

  Use `requestVideoFrameCallback`; clamp endpoint metadata to the last frame.
  Use a rAF media-time fallback only when the callback is unavailable.

- [ ] **Step 3: Render hero in plate space**

  Update four screen-space vertices from `mapPlateQuad`; retain one video
  element for the visit; show its first frame before playback; apply the
  authored print grade without changing its geometry.

- [ ] **Step 4: Remove obsolete projection camera coupling**

  `PlateProjectionCamera` may remain diagnostic but cannot position hero or
  navigation. Delete stale world-space hero mounting from `Stage`.

- [ ] **Step 5: Run arrival, hero, build, and lint gates green and commit**

  Commit: `fix: lock live surfaces to the photographic room`

### Task 8: Render Production Media And Perform Full-Motion Review

**Files:**
- Generate: `public/room/**`
- Generate: `three/scene/plateManifest.ts`
- Add: `docs/progress/0117-r2-*.jpg`
- Add: `docs/progress/0117-r2-review-desktop.mp4`
- Add: `docs/progress/0117-r2-review-tall-desktop.mp4`
- Add: `docs/progress/0117-r2-review-phone.mp4`
- Modify: `scripts/film-review.mjs`

- [ ] **Step 1: Validate the authored contract before rendering**

  Run Blender `--validate`; reject any camera, prop, copy, projection, or
  replacement mismatch.

- [ ] **Step 2: Render proof endpoints before transitions**

  Inspect opening, desk, FILMS, JOURNAL, CONTACT, and ABOUT on desktop and
  phone. Iterate the master until all still compositions meet the design bar.

- [ ] **Step 3: Render and encode transitions**

  Render once per direction/profile from the approved master, encode H.264
  `yuv420p +faststart`, and verify frame count/source dimensions.

- [ ] **Step 4: Record complete journeys at three representative shapes**

  Films include arrival, settle, hero start, all destinations during hero
  playback, exact desk returns, hero end, and final hold.

- [ ] **Step 5: Perform the production-company self-review**

  Watch at normal speed and reject any camera jump, hero drift, pasted text,
  illegible navigation, CG placeholder, clipping, weak composition, material
  mismatch, or non-human movement. Iterate until none remain.

### Task 9: Production Battery And Honest Closeout

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Replace: `docs/BUILD_REPORT.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `tasks/todo.md`
- Modify: `tasks/lessons.md`

- [ ] **Step 1: Run the complete local battery**

  Run build, targeted lint, master assets, saved master, camera reference,
  plate-space, arrival continuity, physical navigation, camera states, hero,
  CONTACT, fallback, clock, dwell, and performance gates.

- [ ] **Step 2: Audit every explicit requirement**

  Mark camera, arrival, hero, seven props, CONTACT copy, navigation, JOURNAL,
  lighting, desktop, tall desktop, tablet, phone, and review films individually
  with direct evidence.

- [ ] **Step 3: Update standard artifacts without claiming creative approval**

  Report implementation as ready for Jonathan review. Keep the Work Order open
  until he explicitly approves the live result.

- [ ] **Step 4: Commit and push the review candidate**

  Commit: `feat: deliver WO 0117-R2 production review candidate`

- [ ] **Step 5: Obtain Jonathan's explicit visual approval**

  Only after approval, repeat the live/deployed battery, write the exact
  `WORK ORDER COMPLETE` report, and close the goal.
