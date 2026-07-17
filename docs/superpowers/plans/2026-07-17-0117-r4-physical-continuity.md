# Work Order 0117-R4 Physical Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the living hero physically inseparable from the photographed room, turn JOURNAL into one readable human hip hinge, and give CONTACT a one-second visible practical-light beat before its unchanged camera move.

**Architecture:** Blender exports the exact hero inset and foreground occluder geometry as a project-owned GLB plus a calibrated room-treatment texture. React Three Fiber draws the photographic plate, physical hero plane, and delivery-resolution GPU-rasterized foreground depth in one render pass driven by one decoded plate frame. Camera authoring uses one continuous JOURNAL arc; CONTACT prepends a stationary one-second practical-light activation to the existing R3 camera samples.

**Tech Stack:** Blender 4.5/Cycles, Python authoring, glTF 2.0, FFmpeg, Next.js 16, React 19, React Three Fiber 9, Three.js 0.185, Playwright, Sharp.

## Global Constraints

- Preserve the approved opening, desk, FILMS, ABOUT, and CONTACT endpoint cameras.
- Preserve the approved R3 CONTACT camera motion after the new `1.0s` hold.
- Preserve the one-shot hero lifecycle: start after settle, continue through navigation, hold the final frame.
- Hero still and playback must share room lighting, exposure, saturation, warmth, paper response, and light falloff.
- JOURNAL must settle into a downward, readable notebook POV with at most `12deg` paragraph-baseline rotation.
- CONTACT must hold the exact desk camera for `1.0s` while the visible practical turns on.
- Do not modify or stage the unrelated untracked files listed by `git status`.
- Do not claim completion before full-motion visual inspection and Jonathan's explicit approval.

---

### Task 1: Add RED Physical-Continuity Contracts

**Files:**
- Modify: `scripts/verify-hero-occlusion-contract.mjs`
- Modify: `scripts/verify-hero-lifecycle.mjs`
- Modify: `scripts/verify-camera-states.mjs`
- Modify: `scripts/verify-contact-reveal.mjs`
- Modify: `scripts/encode-master-shots.mjs`

**Interfaces:**
- Consumes: `public/room/manifest.json`, browser diagnostics, encoded transition media.
- Produces: failing gates for `single-webgl-pass`, `authored-depth-geometry`, room-treatment parity, coupled JOURNAL motion, and the CONTACT activation hold.

- [ ] **Step 1: Add the failing hero source contract**

Require:

```js
assert.equal(manifest.hero?.compositor, "single-webgl-pass");
assert.equal(manifest.hero?.occlusion, "authored-depth-geometry");
assert.equal(manifest.hero?.treatment?.kind, "calibrated-room-transfer");
assert.ok(manifest.hero?.treatment?.source.endsWith("/hero-room-treatment.png"));
assert.ok(manifest.hero?.geometry?.source.endsWith("/hero-compositor.glb"));
assert.ok(manifest.hero?.geometry?.occluders.includes("Mesh_31"));
assert.equal(manifest.hero?.maskResolution, undefined);
```

Add a stub-negative self-test that replaces each value with a structural stub
and proves the contract fails.

- [ ] **Step 2: Add failing presented-pixel hero checks**

Sample resting poster, first painted live frame, and representative playing
frames. Require:

```js
firstFrame.meanLumaDelta <= 3;
firstFrame.meanChannelDelta <= 4;
playingFrames.maxRoomTreatmentDelta <= 6;
motionSamples.maxPosterAxisErrorPx <= 0.75;
motionSamples.maxForegroundEdgeErrorPx <= 1.0;
```

The probe must read `window.__lazyACompositor`, whose shape is:

```ts
{
  atomic: true;
  plateMediaTime: number;
  projectionFrame: number;
  heroFramePresented: number;
  treatment: "calibrated-room-transfer";
  occlusion: "authored-depth-geometry";
}
```

- [ ] **Step 3: Replace the JOURNAL phase-split assertions**

Delete the required `0.3s` head lead. Assert:

```js
journal.journalHeadLeadSeconds === 0;
journal.translationStartsAtSeconds <= 1 / journal.fps;
journal.motionModel === "coupled-hip-pivot";
journal.maxAngularStepDegrees <= 3;
journal.endpointBaselineRotationDegrees <= 12;
journal.endpointCoverage >= 0.4 && journal.endpointCoverage <= 0.6;
```

Recompute sightline intersection against `journal.notebookWorldQuad`, not the
generic desk footprint.

- [ ] **Step 4: Add the CONTACT practical-light contract**

Require:

```js
contact.activationHoldSeconds === 1;
contact.visibleBulb === true;
contact.visibleShadeInterior === true;
contact.shadeAxisErrorDegrees <= 12;
contact.lightIntersectsPaper === true;
transition.duration === 1.9;
```

For the first `31` authored samples, require the exact desk camera while
`visibleBulbLevel` and `lampLevel` rise monotonically. Require camera movement
to begin at sample `31` and the remaining normalized camera samples to equal
the approved R3 path.

- [ ] **Step 5: Run the gates and observe RED**

Run:

```bash
node scripts/verify-hero-occlusion-contract.mjs --geometry-only
node scripts/verify-camera-states.mjs --manifest-only
node scripts/verify-contact-reveal.mjs --manifest-only
node scripts/encode-master-shots.mjs --verify-only
```

Expected: failures naming the missing atomic compositor, room transfer,
authored depth geometry, coupled JOURNAL path, visible practical, and `1.0s`
activation hold.

- [ ] **Step 6: Commit the RED contracts**

```bash
git add scripts/verify-hero-occlusion-contract.mjs scripts/verify-hero-lifecycle.mjs scripts/verify-camera-states.mjs scripts/verify-contact-reveal.mjs scripts/encode-master-shots.mjs
git commit -m "test: require R4 physical continuity"
```

---

### Task 2: Author Hero Geometry, JOURNAL Motion, And CONTACT Practical

**Files:**
- Modify: `scripts/build-master-scene.py`
- Modify: `scripts/render-master-shots.py`
- Modify: `scripts/verify-master-blend.py`
- Create: `scripts/build-hero-room-treatment.mjs`
- Regenerate: `build/wo-0117-r/master.blend`
- Create: `public/room/hero/hero-compositor.glb`
- Create: `public/room/hero/hero-room-treatment.png`
- Regenerate: `public/room/manifest.json`
- Regenerate: `three/scene/plateManifest.ts`

**Interfaces:**
- Produces: `HeroLiveSurface`, `HeroOccluder_*` meshes, calibrated treatment texture, revised transition metadata.
- Consumes: `Mesh_170`, the exact foreground objects, `hero-print-first-frame.png`, approved R3 camera samples.

- [ ] **Step 1: Correct the saved lamp orientation**

Rotate `scan_lamp` around its planted desk base until the measured shade-opening
axis points at the contact-paper center. Keep the base bounds and support height
unchanged. Record:

```python
anchor["lazy_a_contact_aim_target"] = json.dumps(rounded_vector(target))
anchor["lazy_a_contact_shade_axis_error_degrees"] = shade_axis_error
```

Require `shade_axis_error <= 12.0`.

- [ ] **Step 2: Build a visible practical source**

Set `ContactEmissiveBulb.hide_render = False`. Add a visible inner-shade emitter
with the same `ContactLampLevel` driver. `reveal_level(value)` must set:

```python
light.data.energy = CONTACT_LIGHT_ENERGY * value
bulb_bsdf.inputs["Emission Strength"].default_value = 18.0 * value
shade_bsdf.inputs["Emission Strength"].default_value = 4.0 * value
```

Derive the spot direction from the measured shade-opening axis rather than an
independently aimed world-space ray.

- [ ] **Step 3: Author the CONTACT timing**

Define:

```python
CONTACT_ACTIVATION_SECONDS = 1.0
CONTACT_MOVE_SECONDS = 0.9
CONTACT_SECONDS = CONTACT_ACTIVATION_SECONDS + CONTACT_MOVE_SECONDS
```

For `elapsed <= 1.0`, return the exact desk pose and
`smoothstep(elapsed / 1.0)`. For later samples, evaluate the unchanged R3
CONTACT interpolation at `(elapsed - 1.0) / 0.9` and keep lamp level `1.0`.

- [ ] **Step 4: Author the coupled JOURNAL hip pivot**

Replace the staged branch with:

```python
eased = smootherstep(raw_t)
position = quadratic_bezier(start_position, hip_control, end_position, eased)
target = start_target.lerp(notebook_reading_anchor, smootherstep(raw_t))
quaternion = upright_track_quaternion(position, target)
```

Begin translation by frame 1. Tune wide and portrait endpoints from actual
rendered copy so coverage is `40-60%`, baseline rotation is `<=12deg`, and the
downward regard remains readable without a late yaw singularity.

- [ ] **Step 5: Export exact compositor geometry**

Create one world-space `HeroLiveSurface` from the inset face of `Mesh_170`.
Export evaluated, triangulated foreground geometry for:

```python
(
    "Mesh_31",
    "Mesh_33",
    "ceramic_vase_02",
    "Mesh_38",
    "Mesh_39",
    "Mesh_40",
    "Mesh_41",
    "Mesh_42",
    "Mesh_43",
    "ProductionNavigationSheet",
    "Camera_01",
    "Camera_01_strap",
)
```

Name each proxy `HeroOccluder_<source>`, preserve its exact world transform,
strip render materials, and export selected geometry to
`public/room/hero/hero-compositor.glb`.

- [ ] **Step 6: Generate the room-treatment transfer**

Render the hero inset orthographically in UV orientation with the current
material, room lights, and shadow casters. Run:

```bash
node scripts/build-hero-room-treatment.mjs \
  assets/master/hero/hero-print-first-frame.png \
  build/wo-0117-r/hero-treated-first-frame.png \
  public/room/hero/hero-room-treatment.png
```

Encode a calibrated signed RGB transfer centered at `0.5`; verify applying it
to the source first frame reproduces the treated render with mean channel error
`<=2`.

- [ ] **Step 7: Regenerate and validate authored contracts**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b build/wo-0117-r/master.blend --python scripts/render-master-shots.py -- --validate
node scripts/verify-hero-occlusion-contract.mjs --geometry-only
node scripts/verify-camera-states.mjs --manifest-only
node scripts/verify-contact-reveal.mjs --manifest-only
```

Expected: authored/source contracts pass before browser runtime exists.

- [ ] **Step 8: Commit authored behavior**

```bash
git add scripts/build-master-scene.py scripts/render-master-shots.py scripts/verify-master-blend.py scripts/build-hero-room-treatment.mjs public/room/hero public/room/manifest.json three/scene/plateManifest.ts build/wo-0117-r/master.blend build/wo-0117-r/master.blend.provenance.json
git commit -m "experience: author R4 physical motion and light"
```

---

### Task 3: Render Plate And Hero Atomically

**Files:**
- Create: `components/room/PlateCompositor.tsx`
- Create: `components/room/HeroSurface.tsx`
- Modify: `components/room/PlateRoom.tsx`
- Modify: `components/room/HeroFilm.tsx`
- Modify: `three/scene/Stage.tsx`
- Modify: `lib/plateAssets.ts`

**Interfaces:**
- Consumes: `PlateAsset`, `PlateProjectionFrame`, hero GLB, room-treatment map.
- Produces: `PlateCompositor` and `window.__lazyACompositor`.

- [ ] **Step 1: Create one decoded-frame source**

`PlateCompositor` owns endpoint/transition image and video textures. Its
`useFrame(..., -100)` callback selects one decoded transition sample, publishes
that sample's camera, and binds the same `VideoTexture` to the full-screen plate
material before the frame renders.

Expose:

```ts
export interface CompositorFrame {
  plateTexture: Texture;
  projection: PlateProjectionFrame;
  mediaTime: number;
  frameIndex: number;
}
```

- [ ] **Step 2: Render the photographic plate in Canvas**

Draw a clip-space full-screen quad with `depthWrite={false}`,
`depthTest={false}`, and `renderOrder={-1000}`. Preserve the exact
`object-fit: cover` crop in the plate shader. Keep the server-rendered opening
photograph below the Canvas until the first texture is ready and as the failure
fallback.

- [ ] **Step 3: Render authored foreground depth**

Load `/room/hero/hero-compositor.glb`. Render every `HeroOccluder_*` mesh with:

```ts
new MeshBasicMaterial({
  colorWrite: false,
  depthWrite: true,
  depthTest: true,
})
```

The actual drawing buffer rasterizes these meshes at delivery resolution. No
RLE mask, Canvas resampling, shadow blur, or screen-space polygon expansion
remains.

- [ ] **Step 4: Render the physical hero surface**

Apply the one-shot `VideoTexture` to `HeroLiveSurface`. Decode
`hero-room-treatment.png` as linear data and apply:

```glsl
vec3 transfer = (texture2D(roomTreatment, vUv).rgb - 0.5) * 2.0;
vec3 treated = clamp(hero.rgb + transfer, 0.0, 1.0);
gl_FragColor = vec4(treated, 1.0);
```

Use the authored Three camera and normal depth testing. The hero is invisible
before playback, visible while playing/held, and cannot move independently of
the plate camera.

- [ ] **Step 5: Remove the independent overlay path**

`Stage` mounts `PlateCompositor`, authored depth, `HeroSurface`, and interaction
layers inside one `Canvas`. Retain `PlateRoom` only as the experience-state and
preload controller, with no visible DOM transition video. Remove RLE decoding,
screen-space hero geometry, fixed RGB treatment, and separate projection
sampling from `HeroFilm`.

- [ ] **Step 6: Run runtime checks**

Run:

```bash
npm run build
node scripts/verify-hero-occlusion-contract.mjs http://localhost:3000/
node scripts/verify-hero-lifecycle.mjs http://localhost:3000/
```

Expected: atomic diagnostics, first-frame parity, poster-axis stability,
foreground edge quality, one playthrough, and final hold pass.

- [ ] **Step 7: Commit the atomic compositor**

```bash
git add components/room/PlateCompositor.tsx components/room/HeroSurface.tsx components/room/PlateRoom.tsx components/room/HeroFilm.tsx three/scene/Stage.tsx lib/plateAssets.ts
git commit -m "hero: render the living print with the room"
```

---

### Task 4: Render And Encode Corrected Motion

**Files:**
- Regenerate: `public/room/wide/stills/**`
- Regenerate: `public/room/portrait/stills/**`
- Regenerate: `public/room/wide/transitions/**`
- Regenerate: `public/room/portrait/transitions/**`
- Regenerate: `public/room/proof/**`
- Regenerate: `docs/progress/0117-r4-proof-provenance.json`

**Interfaces:**
- Consumes: current master, renderer, camera paths, practical-light levels.
- Produces: final wide/portrait stills, forward/reverse media, provenance.

- [ ] **Step 1: Render low-sample JOURNAL and CONTACT proofs**

Render wide and portrait transition frames at proof quality. Build frame strips
showing every authored frame. Reject and retune until JOURNAL is one readable
hip hinge and CONTACT visibly establishes the lamp during the stationary beat.

- [ ] **Step 2: Render affected delivery media**

Render all endpoints affected by lamp orientation and the wide/portrait
`desk-journal` and `desk-contact` transitions. Render any other transition
whose first or final plate changed so every handoff remains pixel-identical.

- [ ] **Step 3: Encode forward and reverse clips**

Run:

```bash
node scripts/encode-master-shots.mjs
node scripts/encode-master-shots.mjs --verify-only
```

Expected: every still/transition relationship, frame count, duration, and
source hash passes. CONTACT is `1.9s`; JOURNAL has no staged lead.

- [ ] **Step 4: Commit media and provenance**

```bash
git add public/room docs/progress/0117-r4-proof-provenance.json
git commit -m "media: publish R4 physical continuity masters"
```

---

### Task 5: Run Full Local And Deployed Acceptance

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/BUILD_REPORT.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `tasks/todo.md`
- Add: `docs/progress/0117-r4-*`

**Interfaces:**
- Consumes: production build and deployed Pages URL.
- Produces: auditable local/deployed evidence and an honest approval-pending state.

- [ ] **Step 1: Run the local source and browser battery**

Run saved-master, asset-credit, media, TypeScript, targeted ESLint, production
build, arrival, hero, camera, navigation, CONTACT, dwell, fallback, clock, and
performance checks.

- [ ] **Step 2: Capture complete normal-speed journeys**

Capture desktop `1280x720`, tall desktop `1316x1329`, tablet `1024x768`, and
phone `375x812`. Save review films and high-frequency frame strips for hero,
JOURNAL, and CONTACT under `docs/progress/0117-r4-*`.

- [ ] **Step 3: Inspect actual pixels**

Watch every review at normal speed. Inspect first-frame hero continuity,
poster-axis stability, card/pencil edges, JOURNAL body feel and paragraph
reading angle, visible lamp ignition, one-second comprehension beat, desk pool,
reverse, and exact desk restoration.

- [ ] **Step 4: Update the audit trail**

Record exact commands, measurements, captures, hashes, and any remaining open
gate in PROJECT_STATUS, BUILD_REPORT, CHANGELOG, and tasks/todo.md. Keep
Jonathan's visual approval unchecked.

- [ ] **Step 5: Commit, push, and verify Pages**

```bash
git add docs/PROJECT_STATUS.md docs/BUILD_REPORT.md docs/CHANGELOG.md tasks/todo.md tasks/lessons.md docs/progress/0117-r4-*
git commit -m "docs: publish R4 technical review evidence"
git push origin main
```

Wait for the Pages workflow, then repeat the complete browser battery and one
normal-speed review against the deployed URL.

- [ ] **Step 6: Present review links without a completion claim**

Return the deployed URL plus desktop, tall, tablet, and phone review artifacts.
State that technical verification passed only if every command and visual
inspection actually passed. Keep the work order open until Jonathan explicitly
approves the result.

