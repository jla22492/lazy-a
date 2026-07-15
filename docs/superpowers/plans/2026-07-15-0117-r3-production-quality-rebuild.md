# Work Order 0117-R3 Production-Quality Rebuild Implementation Plan

> **Required execution mode:** Use subagent-driven development for bounded,
> independently reviewable tasks. Keep Blender art direction and final visual
> judgment in the primary session. Every task follows RED, GREEN, visual proof,
> then a small commit.

**Goal:** Rebuild the photographed room and live hero integration so every
object, light, camera move, and moving poster reads as one production-quality
physical environment at desktop, tall-desktop, tablet, and phone sizes.

**Architecture:** The saved Blender master remains the physical source of
truth. `scripts/build-master-scene.py` reproducibly assembles credited assets;
`scripts/render-master-shots.py` authors the treated plates, camera/projective
metadata, and manifest; the browser layers only the projectively registered,
room-treated hero over those plates. Automated gates reject unsupported props,
duplicates, camera-body violations, low-resolution media, and compositor
regressions. Normal-speed multi-viewport review remains the final gate.

**Stack:** Blender 4.x/Cycles/AgX, Python, Next.js 16, React 19, Three.js/R3F,
Node verification scripts, FFmpeg/FFprobe, Playwright with real Chrome.

## Global Constraints

- Preserve the approved wide and portrait desk camera position, rotation, and
  `35deg` focal field of view.
- Preserve the approved ABOUT pan; extend the room to support it.
- Opening-to-desk remains `2.6s` and all destination transitions remain
  `0.9s`, within the Sprint 05 `4s/5s/6s` acceptance clock.
- CONTACT copy is exactly `Jonathan Adelson`,
  `JonathanAdelson1@gmail.com`, and `1-310-709-9283`.
- Hero playback starts once after desk settle, continues through navigation,
  and holds the final frame until reload.
- Final wide media is `2560x1440`; final portrait media is `750x1624`.
- Basketball diameter is `0.239m`; the seating set is scaled from a `1.65m`
  floor lamp.
- Do not stage, rewrite, or delete unrelated untracked review captures,
  `page@*.webm`, or the user-owned root `AGENTS.md`.
- Jonathan's explicit visual approval is required before completion language.

## Task 1: Pin Durable Seating And Brand Sources

**Files:**
- Modify: `scripts/verify-master-assets.mjs`
- Modify: `assets/master/credits.json`
- Modify: `assets/master/README.md`
- Create: `assets/master/scans/leather-seating/source.zip`
- Create: extracted seating source files under
  `assets/master/scans/leather-seating/`
- Create: `assets/master/brand/lazy-a-logo-letterpress.png`

1. Add a `seating` required-asset record that requires one archive, its actual
   extracted GLTF/GLB entry point and dependencies, creator `YJ_`, source URL
   `https://sketchfab.com/3d-models/leather-armchair-coffee-table-floorlamp-fcce92a09de84456a071ea6117b57cbc`,
   and license `CC-BY-4.0`. Add the original `2000x1588` logo source as a
   required non-generative brand input with a pinned SHA-256.
2. Run `node scripts/verify-master-assets.mjs` and observe RED because the new
   durable sources and credit records do not yet exist.
3. Copy the user-supplied archives into the tracked asset roots, extract only
   the files needed by the builder, add the exact license/source record, and
   copy the original logo source unchanged.
4. Re-run `node scripts/verify-master-assets.mjs`; require GREEN and verify the
   builder contains no Downloads or temporary-path dependency.
5. Commit only the asset inventory and durable source changes as
   `assets: pin seating and master logo sources`.

## Task 2: Rebuild Physical Composition And Room Continuation

**Files:**
- Modify: `scripts/verify-master-blend.py`
- Modify: `scripts/build-master-scene.py`
- Regenerate: `build/wo-0117-r/master.blend`

1. Extend the Blender verifier so it fails unless:
   - encyclopedia books have one root, rest on the `0.44m` middle shelf
     without intersecting it, and no book asset intersects the desk zone;
   - frame and lamp each rest fully on the `0.90m` desk, with the frame in the
     former books zone and its face turned toward desk center;
   - exactly one photographic camera and one strap render, and they replace and
     hide every legacy camera mesh;
   - exactly one desk lamp renders;
   - the blanket has positive world bounds and overlaps the chair-back region;
   - plant and `0.239m` basketball form the requested rear-right vignette, with
     the ball directly in front of the plant in the desk-camera coordinate
     system;
   - pendant cord, socket, and bulb are non-renderable;
   - the seating set has one inventory root, a `1.65m` floor lamp, faces left,
     occupies the authored left-continuation bounds, and projects only the
     chair's back-right quarter inside the settled default frame;
   - the left wall lies beyond every ABOUT camera frustum and the extended
     rear wall, floor, ceiling, and baseboard cover that frustum;
   - headphones, mug, trash can, office chair, navigation sheet, notebook,
     charger, and logo card remain present and singular.
2. Run Blender with `scripts/verify-master-blend.py` against the current master
   and observe RED for the newly encoded physical contracts.
3. Update the builder to extend the shell at least `2.0m` left with the right
   edge fixed; relocate the left boundary and doorway; hide the pendant and
   complete legacy camera; import and orient the seating group; move books,
   frame, lamp, plant, and basketball; replace free-fall blanket simulation
   with a pinned visible drape. Record actual source, support, replacement,
   dimensions, orientation, and world bounds in `master_asset_inventory`.
4. Build the master:
   `/Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/build-master-scene.py`.
   The builder must stamp its source SHA-256, asset-inventory SHA-256, build
   timestamp, and a unique invocation ID into the `.blend`.
5. Run `scripts/verify-master-blend.py`; require GREEN and require those
   provenance fields to match the current builder/assets and this invocation.
   Run the verifier once against a copied master with a deliberately stale
   builder hash and observe RED, proving stale output cannot satisfy the gate.
6. Render low-sample opening, desk, and ABOUT proofs. Inspect at full frame and
   cropped object scale. Iterate until there are no floating/intersecting props,
   duplicate cameras, missing blanket, pendant, exposed left corner, or toy
   scale relationships.
7. Save proof captures under `docs/progress/0117-r3-master-*` and commit as
   `scene: rebuild physical room composition`.

## Task 3: Rebuild CONTACT And Camera Choreography

**Files:**
- Modify: `scripts/render-master-shots.py`
- Modify: `scripts/verify-contact-reveal.mjs`
- Modify: `scripts/verify-camera-states.mjs`
- Modify: `scripts/encode-master-shots.mjs`
- Regenerate: `public/room/manifest.json`
- Regenerate: `three/scene/plateManifest.ts`

1. Add failing assertions that CONTACT uses exact geometry-only copy, has no
   colored reveal mix or standalone plane, and reports a lamp light origin
   inside the visible shade with a direction intersecting the contact paper.
2. Add failing camera assertions that FILMS position and FOV exactly equal the
   desk endpoint in both profiles; JOURNAL eye height is at least `1.32m`, moves
   forward toward the notebook, begins rotation before translation, and never
   descends toward desk-level framing; ABOUT's approved endpoint is unchanged.
3. Run the contact and camera gates and observe RED against the current
   manifest and renderer.
4. Remove `ContactRevealMix` and assign paper-consistent groove materials.
   Locate the bulb and shade from the imported lamp, place the CONTACT source
   inside that assembly, and aim its raking pool at the indented paper.
5. Restore FILMS to a head-only turn. Author JOURNAL as downward head rotation
   followed by a forward seated hinge while preserving the eye-height floor.
   Leave ABOUT unchanged.
6. Run Blender `--validate`, regenerate manifest/types, and require all contact,
   camera, navigation, and encode-manifest gates to pass.
7. Render low-sample FILMS, JOURNAL, CONTACT, and ABOUT stills plus contact and
   journal transition proofs. Visually require a readable lean, recessed text,
   and a connected shade-to-paper light pool.
8. Save `docs/progress/0117-r3-contact-*` and
   `docs/progress/0117-r3-camera-*`; commit as
   `experience: correct contact light and seated camera motion`.

## Task 4: Replace Hero Overlay With A Physical Poster Contract

**Files:**
- Modify: `scripts/render-master-shots.py`
- Modify: `scripts/verify-hero-occlusion-contract.mjs`
- Modify: `scripts/verify-arrival-continuity.mjs`
- Modify: `scripts/encode-master-shots.mjs`
- Modify: `components/room/HeroFilm.tsx`
- Modify: `lib/plateAssets.ts`
- Modify: `three/scene/plateManifest.ts`
- Regenerate: `public/room/manifest.json`

1. Add failing tests that require:
   - a baked treated first-frame poster in every plate state;
   - live-layer invisibility until actual playback;
   - per-corner projective depth/reciprocal-w metadata rather than affine
     `w=1` mapping;
   - a room-treatment map derived from the baked poster that retains paper
     response, window pattern, cast shadow, saturation, and grain on sampled
     live frames, in addition to AgX-compatible output;
   - either a profile-resolution matte or an explicit no-crossing-foreground
     contract; a `256px` mask must fail;
   - poster-axis registration and first-frame pixel continuity across opening,
     desk, FILMS, and navigation transitions;
   - one playback, navigation continuity, and final-frame hold.
2. Run the hero, occlusion, and arrival gates and observe RED.
3. Extract the hero first frame and use it as the Blender poster image. Build
   the print's paper response, room saturation, window treatment, and cast
   shadow into every plate.
4. Export projective coefficients from each exact camera sample. Update the
   browser geometry/shader to preserve perspective and share the room's output
   treatment. Keep the live layer hidden through loading and reveal only on the
   first painted playback frame.
5. Eliminate foreground crossings where composition permits; otherwise emit a
   full-profile-resolution authored matte. Remove the compact 256px RLE path.
6. Regenerate low-sample endpoint/transition plates, manifest, generated types,
   treatment maps, and any mattes. Each generated artifact must carry current
   renderer/master source hashes and a unique invocation ID; stale or retained
   outputs must fail verification.
7. Re-run the hero, arrival, lifecycle, plate-space, and manifest gates; require
   GREEN, including stub-negative tests for projective coefficients, baked
   first-frame provenance, treatment maps, and matte resolution.
8. Run a normal-speed desktop proof from opening through hero playback and one
   navigation round trip. Inspect the first-frame handoff, paper/light treatment,
   foreground edges, and poster axis before committing.
9. Save `docs/progress/0117-r3-hero-proof.*` and commit as
   `hero: bind live playback to the physical poster`.

## Task 5: Render And Encode Final High-Resolution Media

**Files:**
- Modify: `scripts/render-master-shots.py`
- Modify: `scripts/encode-master-shots.mjs`
- Regenerate: `public/brand/logo-note.png`
- Regenerate: `public/room/wide/**`
- Regenerate: `public/room/portrait/**`
- Regenerate: `public/room/manifest.json`
- Regenerate: `three/scene/plateManifest.ts`

1. Add media validation for exact `2560x1440` wide and `750x1624` portrait
   dimensions, the high-resolution logo source, and per-profile representative
   encoded-frame quality against its lossless source: SSIM at least `0.985` and
   luminance-edge retention at least `0.85`. Observe RED against the R2 media.
2. Build `public/brand/logo-note.png` from the tracked `2000x1588` original at
   a size that stays sharp on the card; do not redraw or generatively alter it.
3. Render every endpoint and transition at 16 samples first. Create contact
   sheets and inspect opening continuity, prop support, hero axis, paper/tape,
   logo, pencils, blanket, right corner, and left continuation. Correct the
   master or renderer and repeat until the proof set passes.
4. Render final Cycles media at 192 samples with AgX and denoising. Encode to
   meet the SSIM/edge thresholds, then run `perf-gate` against a production
   build and tune delivery until it remains within `3MB` pre-settle and `20MB`
   total streamed while holding at least `55fps` median.
5. Require renderer invocation/source hashes on every generated manifest and
   encoded-media index. Verify a deliberately stale copied manifest and a
   retained pre-invocation media file both fail before accepting fresh output.
6. Run `node scripts/encode-master-shots.mjs --verify`, `npm run lint`, and
   `npm run build`; require GREEN.
7. Save final endpoint/contact-sheet evidence under
   `docs/progress/0117-r3-final-*` and commit as
   `media: render 0117-R3 high-resolution room plates`.

## Task 6: Verify The Real Browser Journey

**Files:**
- Modify: `scripts/measure-clock.mjs`
- Modify if another real gap is found: browser verification scripts under
  `scripts/`
- Create: `docs/progress/0117-r3-review-desktop.webm`
- Create: `docs/progress/0117-r3-review-tall.webm`
- Create: `docs/progress/0117-r3-review-tablet.webm`
- Create: `docs/progress/0117-r3-review-phone.webm`
- Create: corresponding endpoint and transition JPG evidence

1. Start the production server on an unused port and verify the actual built
   route, not an older dev process.
2. Extend `measure-clock` before acceptance so it records each FILMS, JOURNAL,
   and CONTACT answer from page navigation commit, not merely pointer-rest
   latency. Require settle no later than `4.0s`, magic in the `4.0-6.0s` window,
   and each selected destination's visible focused-content state no later than
   `6.0s` in a fresh browser journey. Add a negative fixture/delay mode and
   observe the clock fail when any destination answers after six seconds.
3. Run `measure-clock`, `perf-gate`, `verify-dwell`, arrival continuity, camera,
   contact, hero lifecycle/occlusion, physical navigation, plate fallback,
   plate space, and reference-camera gates against that server.
4. Use Playwright with real Chrome for normal-speed journeys at `1280x720`,
   `1316x1329`, `768x1024`, and `375x812`. Record opening through desk, every
   destination, return to desk, hero start, continued playback, and final hold.
5. Visually inspect videos and stills at full frame and 1:1 pixel scale. Reject
   any poster pop/drift/shear, object instability, unreadable navigation,
   implausible body move, detached CONTACT light, corner reveal, overlap,
   unsupported prop, or texture artifact.
6. Rebuild and repeat after any defect. Do not move to audit while a visible
   defect remains.

## Task 7: Audit, Deploy, And Verify Live

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/BUILD_REPORT.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `tasks/todo.md`
- Modify: `tasks/lessons.md` when execution yields a new reusable rule

1. Walk every 0117-R3 requirement and mark exactly one of: shipped plus
   behavioral evidence, structurally shipped with named deferred verifier, or
   not attempted with named successor. Do not use completion language while
   any required item lacks behavioral and visual evidence.
2. Append the per-order Build Report with commit IDs, commands, measured clock,
   performance results, media dimensions, browser URLs, and progress evidence.
3. Update status and changelog milestone truthfully. Keep R3 `IN PROGRESS`
   through local verification and deployment.
4. Commit the local audit artifacts as `docs: record 0117-R3 local verification`
   and push the small commit sequence to deploy.
5. Verify the deployed GitHub Pages URL with the same all-destination 4/5/6
   clock, dwell, hero, and multi-viewport tests. Record deployed proof and any
   measured delta. Only after every live gate passes may status and Build Report
   say `REVIEW CANDIDATE — JONATHAN APPROVAL PENDING`.
6. Commit and push the deployed review-candidate audit as
   `docs: audit 0117-R3 review candidate`.
7. Present direct links to the local/deployed build and the four review films.
   Await Jonathan's explicit visual approval before marking the Work Order
   complete.
8. After approval, update `PROJECT_STATUS`, `BUILD_REPORT`, `CHANGELOG`, and
   `tasks/todo.md`; produce CLAUDE's exact `WORK ORDER COMPLETE` report fields,
   commit as `docs: complete 0117-R3`, and push. This is the only completion
   commit.
