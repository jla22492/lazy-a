# BUILD REPORT

WORK ORDER 0117-R5 LOCAL TECHNICAL REVIEW CANDIDATE — JONATHAN APPROVAL PENDING

Version:

v0.1 — local technical review candidate

Observed Result:

- The prior apparent living print was only the baked first frame: clockwise
  clip-space winding after screen-Y inversion let WebGL cull the live surface.
- Threshold-first pixel checks then mislabeled changing image content as poster
  motion at tall and landscape-tablet crops.
- Destination media was also warmed unconditionally after settle, streaming
  `40.10MB` before the visitor expressed any intent.

Delivered Result:

- The live print is rendered counter-clockwise in plate space, receives the
  authored Blender AgX room response, and passes behind delivery-resolution
  card, pencil, strap, and production-sheet coverage.
- Its still and first live frame are identical; it plays once after desk settle,
  continues through every route, ends once, and holds its natural final frame.
- JOURNAL is one coupled forward/down hip bend into a near-front readable POV.
- The supplied lamp remains in one supported desk pose. CONTACT turns it on,
  holds the exact desk camera for one second, reveals the three pressure-cut
  lines, then performs the approved move.
- Endpoint photographs warm after settle; only the transition under the
  visitor's physical navigation row warms on intent.

Behavioral Verification:

- Hero lifecycle: `450/450` across desktop, tall desktop, landscape tablet,
  portrait tablet, and phone. Poster-axis and foreground-band translation are
  `0px`; authored four-corner registration is `0px`.
- R5 delivered continuity: both JOURNAL profiles pass coupled-body and readable
  endpoint checks; the lamp pose is continuous across every desk handoff.
- CONTACT: exact three-line copy, fixed physical indentation, visible
  practical, stationary activation, soft pool, intermediate rise, readable
  held relief, and clean reverse all pass.
- Arrival: `79/79` decoded frames at all five viewports. Camera states,
  destination handoffs, dense physical navigation, dwell, compositor
  resilience, and photographic fallbacks pass.
- Clock: settle `3.30s`, magic `5.16s`, physical JOURNAL target `0.08s`.
- Performance: `59.9fps`, `1.63MB` pre-settle, `4.35MB` total streamed.
- TypeScript, targeted ESLint, production build, compositor source, contact
  self-tests, hero negative controls, and authored-source continuity pass.

Normal-Speed Review:

- `docs/progress/0117-r5-review-desktop.webm`
- `docs/progress/0117-r5-review-tall.webm`
- `docs/progress/0117-r5-review-tablet.webm`
- `docs/progress/0117-r5-review-phone.webm`

Enumerated Audit:

1. ✅ Hero fixed to its physical wall print with room-consistent lighting,
   card/pencil occlusion, and behavioral pixel proof.
2. ✅ Lamp fixed in one permanent desk pose; CONTACT changes light only.
3. ✅ JOURNAL replaced by one forward/down readable body movement.
4. ✅ CONTACT retains the approved one-second lamp-on comprehension beat.
5. ✅ Hero plays once after settle, survives navigation, and holds its last
   frame.
6. ✅ Responsive navigation, arrival, timing, fallback, and performance gates
   pass against the fresh production bundle.
7. ⚠️ Public deployment and public-URL replay follow the pushed candidate.
8. ⚠️ Jonathan's explicit full-motion visual approval remains open. This order
   is a review candidate, not creatively complete.

---

WORK ORDER 0117-R4 DEPLOYED TECHNICAL REVIEW CANDIDATE — JONATHAN APPROVAL PENDING

Version:

v0.1 — deployed technical review candidate

Observed Result:

- Jonathan accepted the R3 room rebuild as significant progress but rejected
  the remaining hero, JOURNAL, and CONTACT motion behavior.
- Normal-speed deployed review reproduces hero color discontinuity,
  poster-axis swimming, card overdraw, and pencil-edge mask distortion.
- JOURNAL visibly performs two mechanical stages and ends in a twisted
  side-angle view that compromises paragraph readability.
- CONTACT's indentation and desk pool read well, but the visible lamp does not
  switch on or credibly aim at the illuminated area.

Root-Cause Verification:

- `HeroFilm.tsx` renders above the DOM plate on an independent WebGL frame,
  applies a fixed color multiplier, and downsamples authored silhouettes into a
  compact mask texture.
- The authored hero mask is fixed at `512px`; its ten-object list omits the
  leaning logo card while thin pencil edges are blurred and resampled.
- `render-master-shots.py` fixes JOURNAL position for the first third of the
  transition, then moves toward a target nearly under the eye, causing the
  staged motion and late twist.
- CONTACT creates an emissive bulb but sets `hide_render = True`; its spot is
  aimed independently from the visible shade axis.
- Existing gates validate coordinates, metadata, generic desk intersection,
  and desk-pool activation. They do not validate cross-layer presented pixels,
  reading-angle quality, visible practical luminance, or optical-axis
  alignment.

Approved Result:

- Hero still and film retain identical room lighting and are drawn atomically
  with delivery-resolution foreground mattes.
- JOURNAL is one continuous hip hinge into a readable downward notebook POV.
- CONTACT holds the desk camera for `1.0s` while the visible lamp turns on and
  lights the desk, then performs the unchanged R3 move to its unchanged
  endpoint.

Authored-Source Checkpoint:

- `build/wo-0117-r/master.blend` is pinned through Git LFS with SHA-256
  `d81279bba63ebb928c3605f5118d5af6c2f449b40051a6a44e25f34ee9d292ac`.
- The supplied lamp remains a natural rigid object on the desk. Its visible
  bulb, shade direction, and soft reveal pool share one authored practical
  relationship; portrait derives the pool from the same lamp outside the
  immutable crop.
- The practical-light quality gate caps highlight blowout as well as requiring
  readable illumination. The reviewed wide proof reduced pool p99 rise from
  `121` to `92`; the portrait proof holds p95 rise at `50` with mean rise
  `13.53`.
- JOURNAL's exact wide and portrait paths are hashed and must remain monotone
  forward-and-down without the rejected head-first pause, lateral backtrack, or
  late twist.
- CONTACT's exact 31-sample one-second smoothstep drives visible bulb and lamp
  level together; linear or independently timed substitutions fail.
- The hero compositor GLB is parsed by the verifier: `HeroLiveSurface`, all
  twelve foreground occluders, `43,235` world-space triangles, the aggregate
  geometry relationship, room-treatment reconstruction, and the treated bake
  are pinned to their real authored artifacts.
- Independent Task 2 review approved the checkpoint through commit `59605a6`.
- Reviewed proofs:
  `docs/progress/0117-r4-task2-contact-wide-softened.jpg` and
  `docs/progress/0117-r4-task2-contact-portrait-softened.jpg`.

Verification Status:

- Design and acceptance criteria — APPROVED.
- Authored source and physical-continuity contracts — APPROVED and pushed.
- Atomic runtime integration and regenerated final media — PASS locally.
- Five-viewport catalog-backed hero lifecycle — PASS `465/465`.
- Arrival, camera, physical navigation, dwell, CONTACT, fallback, timing,
  performance, TypeScript, targeted lint, formatting, and production build —
  PASS locally.
- Normal-speed desktop, tall-desktop, landscape-tablet, and phone films were
  captured and visually inspected.
- GitHub Pages deployment and public behavioral verification — PASS at
  `11c38b3` through workflow `29646663699`.
- Jonathan's final visual approval — OPEN.
- No completion claim is made.

Local Behavioral Verification:

- Hero lifecycle — PASS `465/465` at 1280x720, 1316x1329, 1024x768, 768x1024,
  and 375x812. Still-to-first-live pixel delta is zero; poster translation is
  zero; foreground edges retain local correspondence; playback starts once,
  survives navigation, ends naturally once, and holds.
- Hero source/geometry — PASS: 13 authored depth meshes, 12 active occluders
  per profile, `43,247` triangles, canonical profile navigation planes, pinned
  relationship SHA-256
  `1339de879c4e9f7149e4169660270e7e5e525d46ae0df2694f01330fcd603d30`.
- Presented-pixel catalog — PASS: 130 schedule bindings and 390 generated
  source/composite/region images, all pinned to immutable authoring hashes.
- Arrival — PASS `79/79` at all five viewport classes with zero camera error,
  zero held-endpoint error, and zero endpoint-pixel delta.
- Camera states — PASS: JOURNAL remains one coupled readable downward motion;
  FILMS, CONTACT, and ABOUT preserve approved framing; direct switches visibly
  pass through the settled desk; all returns restore the exact desk camera.
- Physical navigation — PASS: dense 2,501-point scans on desktop and phone
  contain no overlap or false region; each row opens only its destination and
  every gap/margin opens none. Dwell flyby/rest/release passes for all four.
- CONTACT — PASS `16/16`: exact three-line copy, fixed physical indentation,
  visible practical activation, `1.0s` stationary comprehension beat, soft
  lamp-derived pool, approved camera move, clean reverse, and no DOM overlay.
- Timing — PASS: settle `3.09s`; magic `4.94s`; physical JOURNAL target
  `0.08s`.
- Performance — PASS: median `59.9fps`; `2.37MB` pre-settle; `11.28MB` total;
  reverse arrival is not preloaded.
- Source/build — PASS: saved Blender master/provenance, six endpoints x two
  profiles, JOURNAL and CONTACT shot contracts, media/encode parity, atomic
  compositor source, TypeScript, targeted ESLint, Prettier, Python compile,
  diff check, and optimized Next.js build.

Local Review Evidence:

- `docs/progress/0117-r4-review-desktop.webm`
- `docs/progress/0117-r4-review-tall.webm`
- `docs/progress/0117-r4-review-tablet.webm`
- `docs/progress/0117-r4-review-phone.webm`
- `docs/progress/0117-r4-proof-wide-journal.jpg`
- `docs/progress/0117-r4-proof-portrait-journal.jpg`
- `docs/progress/0117-r4-proof-wide-contact.jpg`
- `docs/progress/0117-r4-proof-portrait-contact.jpg`

Deployed Behavioral Verification:

- Public candidate:
  `https://jla22492.github.io/lazy-a/`.
- Pages workflow `29646663699` deployed commit
  `11c38b3e9bf9e0b8a4493fa093b6f9e1507ed010` successfully.
- Hero lifecycle — PASS `465/465` across all five viewport classes. The public
  compositor begins at frame one, preserves exact still-to-live pixels and
  authored room treatment, keeps the poster and foreground crossings
  registered through every route, plays once, and holds its final frame.
- Arrival — PASS `79/79` at all five viewport classes with zero camera error,
  zero held-camera error, and zero retained-pixel delta.
- CONTACT — PASS `16/16`: exact copy, physical indentation, visible practical,
  stationary lamp-on beat, soft pool, approved move, hold, and clean reverse.
- Camera states — PASS on desktop and phone: readable JOURNAL lean, desk-held
  CONTACT, leftward ABOUT, visible settled-desk handoffs, and exact returns.
- Timing — PASS: settle `3.16s`; magic `5.00s`; physical JOURNAL target
  `0.08s`.
- Performance — PASS: median `59.9fps`; `2.36MB` pre-settle; `11.27MB` total;
  reverse arrival is not preloaded.

Enumerated 0117-R4 Audit:

1. ✅ Hero grade remains identical between still and playback + exact
   still-to-first-live pixel gate at five viewports.
2. ✅ Hero stays on its physical print through every camera move + whole-surface
   registration and local foreground-edge gates.
3. ✅ Leaning card and pencil silhouettes occlude correctly + profile-aware
   authored depth geometry and delivery-resolution presented references.
4. ✅ Hero plays once after settle, continues during navigation, ends once, and
   holds + lifecycle and delayed/faulted media behavioral tests.
5. ✅ JOURNAL is one human forward/downward bend into readable copy + generated
   camera contract, browser camera-state gate, and normal-speed films.
6. ✅ CONTACT visibly turns on the physical lamp, waits one second, illuminates
   the indentation, then moves + source, pixel, timing, reverse, and film proof.
7. ✅ Existing room, prop, logo-card, navigation, FILMS, ABOUT, arrival, and
   settled-camera locks remain intact + source, camera, dense-grid, fallback,
   five-viewport continuity, and visual-review gates.
8. ✅ Local and deployed clock and performance remain inside the sprint
   criteria + instrumented production-build and public measurements.
9. ✅ Deployed Pages proof passes at workflow `29646663699` + public
   five-viewport hero, arrival, CONTACT, camera, clock, and performance gates.
10. ⚠️ Jonathan's explicit full-motion visual approval remains open. This is a
    technical review candidate, not a creative-completion claim.

---

WORK ORDER 0117-R3 TECHNICAL REVIEW CANDIDATE — REJECTED BY JONATHAN

Version:

v0.1 — Work Order 0117-R3 technical review candidate

Observed Result:

- One reproducible Blender master now supplies every wide and portrait room
  state. The books are on the left shelf; the desk lamp, frame, headphones,
  mug, and single photographed camera sit on the desk; the trash can, blanket,
  plant, basketball, and peripheral seating are supported at measured scale.
- The exact existing logo card and tape remain part of the photograph. No new
  card, duplicate camera, ceiling pendant, primitive fallback, or floating
  website label survives.
- The hero is a treated print before playback, remains projectively fixed to
  that paper through arrival and every turn, passes behind ten evaluated
  foreground silhouettes, plays once after settle, continues during
  navigation, and holds its final decoded frame.
- FILMS is a seated head turn. JOURNAL is a forward/downward seated lean that
  keeps the point of regard on the desk throughout. ABOUT turns into an
  open-ended left continuation where only the back edge of the supplied
  seating area implies more room beyond frame.
- CONTACT stays at the desk: the physical desk lamp rises, its shade-origin
  raking pool reveals a fixed 0.30mm same-paper indentation, holds, and reverses
  cleanly. The copy is exactly `Jonathan Adelson`,
  `JonathanAdelson1@gmail.com`, and `1-310-709-9283`.
- Normal-speed desktop, tall-desktop, and phone films were visually inspected.
  Their first JOURNAL render was rejected because the intermediate gaze dipped
  below the desk despite valid endpoints. A new desk-footprint sightline gate
  reproduced the defect; the path was rebuilt and the corrected films keep the
  gaze on the work surface through the full lean.
- `docs/progress/0117-r3-proof-provenance.json` binds all reviewed static proofs
  to the current master, renderer, camera contract, and output hashes.

Behavioral Verification:

- Saved Blender master/provenance — PASS: 13 tracked scene assets, physical
  supports, dimensions, replacements, practical sources, left-shell extension,
  and Cycles 192 / AgX 0.25 / denoising contracts.
- Asset inventory — PASS: 14 durable project-owned entries and 14 credit
  records.
- Media parity — PASS: 2 profiles, 12 endpoints, 10 forward/reverse paths, 32
  media files, 22 decoded source relationships, and 0 pending.
- Arrival continuity — PASS at 1280x720, 1316x1329, 1024x768, 768x1024, and
  375x812: 77/79 decoded arrival frames, exact camera samples, and pixel-stable
  retained endpoints.
- Hero lifecycle — PASS `310/310`: frozen before settle, one start, uninterrupted
  playback through all destinations, `0.000px` corner error, foreground
  occlusion, one end event, and final-frame hold.
- Hero geometry — PASS: 389 visible projective frames, 394 projections, ten
  named occluders per projection, 311 non-empty evaluated silhouettes, and 308
  masks preserving concave gaps.
- Camera states — PASS: JOURNAL reaches a `1.346m` desktop / `1.915m` phone
  lean; ABOUT reaches a leftward `-0.689rad` / `-0.679rad` turn; every routed
  return restores the exact desk camera.
- Physical navigation — PASS: no DOM labels; a 2,501-point grid per profile has
  no overlap or false selection; every row center opens only its destination;
  every margin and inter-row gap selects nothing.
- CONTACT — PASS: exact copy, fixed physical indentation, visually clean rest,
  lamp-pool luma lift `62.0`, readable hold, `3029ms` dwell, no standalone
  plane, fixed paper opacity, and clean reverse.
- Clock — PASS: settle `3.05s`; magic `4.83s`; physical JOURNAL target `0.08s`.
- Performance — PASS: median `59.9fps`; `2.93MB` pre-settle; `10.62MB` total;
  no reverse-arrival preload.
- Fallback behavior — PASS on desktop and phone: blocked endpoint/transition
  requests retain photographic markers with no primitive, loading, or error UI.
- TypeScript, targeted ESLint, and production build — PASS.
- Deployed Pages workflow `29573534853` — PASS at commit `f88194a`.
- Deployed arrival — PASS at all five viewport classes with exact camera
  samples and pixel-stable endpoint retention.
- Deployed hero lifecycle — PASS `310/310`.
- Deployed camera states, dense-grid physical navigation, dwell x4, and
  photographic fallbacks — PASS.
- Deployed CONTACT — PASS through the actual physical row: mid lamp-pool luma
  lift `67.2`, readable exact-copy indentation, `5939ms` observed hold, no
  standalone plane, and clean reverse.
- Deployed clock — PASS: settle `3.35s`; magic `5.15s`; JOURNAL target `0.08s`.
- Deployed performance — PASS: median `59.9fps`; `2.92MB` pre-settle;
  `10.61MB` total; no reverse-arrival preload.
- Deployed normal-speed film — PASS after visual inspection of arrival, desk,
  FILMS, corrected JOURNAL, CONTACT, ABOUT, all desk returns, hero end, and
  final hold.

Review Evidence:

- `docs/progress/0117-r3-review-desktop.webm`
- `docs/progress/0117-r3-review-tall.webm`
- `docs/progress/0117-r3-review-phone.webm`
- `docs/progress/0117-r3-review-deployed.webm`
- `docs/progress/0117-r3-contact-live/contact-rest.png`
- `docs/progress/0117-r3-contact-live/contact-reveal-mid.png`
- `docs/progress/0117-r3-contact-live/contact-hold.png`
- `docs/progress/0117-r3-contact-live/contact-reversed.png`
- `docs/progress/0117-r3-contact-live-deployed/contact-rest.png`
- `docs/progress/0117-r3-contact-live-deployed/contact-reveal-mid.png`
- `docs/progress/0117-r3-contact-live-deployed/contact-hold.png`
- `docs/progress/0117-r3-contact-live-deployed/contact-reversed.png`
- `docs/progress/0117-r3-master-opening.jpg`
- `docs/progress/0117-r3-master-desk.jpg`
- `docs/progress/0117-r3-master-about.jpg`

Enumerated 0117-R3 Audit:

1. ✅ Books moved to the left bookshelf + saved-master bounds/support gate and
   opening/ABOUT proof.
2. ✅ CONTACT indentation restored + topology, exact-copy, rest/mid/hold/reverse
   pixel, and no-overlay gates.
3. ✅ Desk lamp supported on the desk and reveal light sourced inside its shade
   - saved-master support/source and browser lamp-pool gates.
4. ✅ Rendered camera removed; only the photographic replacement remains +
   replacement/duplicate gate and desk proof.
5. ✅ Pencil, card, tape, logo, and foreground edges rerendered at final
   resolution + proof provenance and normal-speed motion review.
6. ✅ Basketball placed at real `0.239m` diameter in front of the right-corner
   plant + exact-scale/support gate and opening proof.
7. ✅ Picture frame placed right of the lamp and angled toward desk center +
   position/support gate and desk proof.
8. ✅ Hero restored as a shaded physical poster before playback and held on its
   axis through motion + 310/310 lifecycle/registration and geometry gates.
9. ✅ Logo retained on the exact existing card with the tape artifact intact +
   ownership/duplicate/contrast gates.
10. ✅ Blanket restored to the chair + support gate and opening proof.
11. ✅ Plant moved to the right corner behind the basketball + bounds/support
    gate and opening proof.
12. ✅ Ceiling pendant removed + saved-master absence gate and opening proof.
13. ✅ Supplied armchair/table/floor-lamp set placed barely on the left edge,
    facing into an unseen continuation; ABOUT cannot expose a left corner +
    collision, practical-light, room-shell, and ABOUT framing gates.
14. ✅ FILMS uses a seated head-only turn + generated-camera and lifecycle gates.
15. ✅ JOURNAL uses a human forward/downward lean while looking at the notebook;
    the initially rendered floorward intermediate was rejected, behaviorally
    pinned, corrected, rerendered, and inspected at normal speed.
16. ✅ ABOUT preserves the approved left pan into an open room + endpoint,
    shell, framing, and normal-speed review.
17. ✅ Hero plays once only after settle, continues exactly as at the desk while
    navigating, and remains paused on its last frame + 310/310 browser gate.
18. ✅ FILMS/JOURNAL/CONTACT/ABOUT are immediately separable physical rows, not
    a puzzle or pasted website controls + dense-grid and dwell gates.
19. ✅ CONTACT copy matches Jonathan's final three-line ruling exactly +
    manifest, geometry, DOM-absence, and live-pixel gates.
20. ✅ Deployed Pages verification shipped + workflow, five-viewport, lifecycle,
    interaction, clock, performance, fallback, and normal-speed film evidence.
21. ⚠️ Jonathan's explicit visual approval is still open. This candidate cannot
    be called complete until that human acceptance is observed.

---

WORK ORDER 0117-R2 REVIEW CANDIDATE — REJECTED BY JONATHAN

The automated coordinate, lifecycle, timing, and nominal-scale gates passed,
but the live photographic composition did not meet the production-company
quality bar. Jonathan's 2026-07-15 review identified misplaced and unsupported
props, duplicate geometry, missing fabric, low-resolution foreground artifacts,
an ungraded and unstable hero layer, physically incorrect JOURNAL/FILMS motion,
and a left-room boundary exposed by ABOUT. The completion gate was never met.

Superseded by approved Work Order 0117-R3 design:
`docs/superpowers/specs/2026-07-15-0117-r3-production-quality-rebuild-design.md`.

---

WORK ORDER 0117-R2 REVIEW CANDIDATE — JONATHAN APPROVAL PENDING

Commit:

`b0cf10b` — runtime, authored media, camera/matte contracts, and behavioral gates

`1a32124` — post-render hero registration/occlusion sampling for networked review

`cc6e4a9` — hydration regression gate and initial profile correction

`a1733be` — responsive photographic bootstrap and client-only room boundary

`153f6e5` — deployed-base-path support in the arrival continuity gate

Version:

v0.1 — Work Order 0117-R2 review candidate

Files Changed:

- `assets/master/camera-contract.json`, `scripts/render-master-shots.py`,
  `public/room/**`, and `three/scene/plateManifest.ts`: one camera contract,
  current wide/portrait photographs and transitions, measured physical scene,
  per-frame camera/hero metadata, and compact evaluated-mesh hero silhouettes.
- `components/room/PlateRoom.tsx`, `components/room/HeroFilm.tsx`,
  `lib/plateAssets.ts`, and `lib/plateSpace.ts`: decoded-frame projection,
  stable endpoint retention, exact plate crop parity, one-shot hero playback,
  and physical foreground occlusion.
- `scripts/verify-*.mjs`, `scripts/film-review.mjs`, and
  `docs/progress/0117-r2-*`: source/media contracts, five-viewport browser
  verification, normal-speed review films, and final endpoint evidence.

Architecture Decisions:

- The saved Blender master remains the source of truth for room pixels, object
  dimensions, light, physical paper, camera choreography, and depth ordering.
- Desktop/tall/tablet select the approved wide camera by width; phone selects
  portrait. Both profiles derive pose, target, lens, and arrival endpoint from
  one JSON contract consumed by the exporter and runtime gate.
- Server output provides a responsive authored opening photograph; the
  interactive Stage is client-only and chooses wide/portrait from the measured
  viewport before motion begins. No profile-dependent room markup hydrates and
  no phone arrival can begin from wide. The five-viewport gate fails on any
  hydration error, wrong profile, camera drift, or unstable endpoint pixels.
- `PlateRoom` publishes projection from decoded `mediaTime * authored fps`, not
  container duration. The ended transition frame remains mounted so the desk
  still cannot introduce a second crop/camera handoff.
- The living hero uses the same four-corner cover transform as the plate. A
  256px per-frame RLE silhouette rasterized from evaluated foreground triangles
  supplies concave depth masks without multi-megabyte manifests or full-screen
  mask uploads.
- The hero gate counts decoded callbacks as media coverage, reports pre-texture
  arrival states separately, and verifies registration/occlusion only from the
  final authored/live state after browser render callbacks. Callback scheduling
  can no longer masquerade as either a visible mismatch or a passing frame.
- Browser arrival verification resolves authored media against the target URL's
  base path, so the same gate exercises local root hosting and deployed
  `/lazy-a` hosting without rewriting the manifest contract.
- Navigation, CONTACT, and JOURNAL remain physical scene artifacts. No floating
  website labels, CONTACT planes, or primitive/render fallbacks are mounted.

Creative Decisions Implemented:

- The Lazy A mark is printed on existing card `Mesh_33`; no new card exists and
  the former pinned wall note is retired.
- The supplied Sony headphones, peace lily, gold picture frame, trash can,
  green desk lamp, red mug, and basketball are placed at measured real-world
  proportions and authored contact surfaces in the reproducible master.
- FILMS, JOURNAL, CONTACT, and ABOUT are four separate graphite rows on one
  working production sheet, with visible gaps and empty selectable margins.
- JOURNAL turns the head first, then leans forward/down. The notebook occupies
  55.4% of desktop and 59.2% of phone framing with its pencil clear of the copy.
- CONTACT remains at the desk. The fixed lamp raises raking light over the
  existing paper and reveals an applied 0.08 mm pressure indentation containing
  exactly `Jonathan Adelson`, `JonathanAdelson1@gmail.com`, and
  `1-310-709-9283`.
- ABOUT turns left into the shelf, plant, frame, books, and room history.
- The hero begins once after final settle, continues through every destination,
  passes behind photographed foreground props, ends once, and holds its final
  decoded image until reload.

Deferred:

- Company-authored film, JOURNAL, and ABOUT material remains the next content
  phase by direction; the current placeholders are intentional review content.
- Migration to `www.lazyaproductions.com` remains a separate launch work order.

Decisions Required:

- Jonathan's explicit visual approval of this browser review candidate.

Ready for:

Jonathan's desktop/phone review, then company-content integration and domain
launch planning. This is not `WORK ORDER COMPLETE` until that approval is given.

## Enumerated 0117-R2 Audit

1. ✅ Approved arrival restored + decoded behavior gate: continuous 2.6-second
   opening spans the authored index range at five viewport shapes, with exact
   camera samples and a pixel-identical retained desk handoff.
2. ✅ Settled perspective restored + source-derived camera gate: desktop,
   tall-desktop, both tablet shapes, and phone select only the intended profile;
   every return restores the exact desk camera.
3. ✅ Logo correction shipped + render-contract proof: `Mesh_33` retains its
   transform and carries the explicit upright logo UV; no added card geometry.
4. ✅ Seven supplied props shipped + saved-master behavioral verifier: all have
   one tracked root, measured scale, exact desk/floor contact, intended position,
   replacement ownership, and no renderable duplicate.
5. ✅ Photographic coherence shipped + source/media/failure gates: two profiles,
   twelve endpoints, ten forward/reverse paths, 32 media files, 22 decoded source
   relationships, and no primitive/loading/error replacement state.
6. ✅ Hero placement and lifecycle shipped + 310/310 browser matrix: zero-pixel
   four-corner error through all transitions, one play start, uninterrupted
   navigation playback, exact foreground-mask parity, and final-frame hold.
7. ✅ Navigation legibility shipped + dense geometry/interaction gate: 2,501
   points per profile show no overlap or false selection; every center opens only
   its named destination and every margin/gap selects nothing.
8. ✅ JOURNAL perspective shipped + camera-state gate: head-first/body-second
   lean reaches 1.253 m desktop and 1.981 m phone travel with readable framing.
9. ✅ CONTACT composition shipped + material/pixel gate: exact three-line copy,
   applied pressure topology, latent clean rest, intermediate lamp rise, readable
   hold, 3.334-second dwell, fixed paper opacity, zero standalone planes, and
   clean reverse.
10. ✅ Former right-side/pasted CONTACT removed + camera/DOM gate: CONTACT frames
    the paper at the desk, not the charger, and no CONTACT/email overlay exists.
11. ✅ Smoothed lighting/current prop set shipped + master verification: Cycles
    192, AgX 0.25, world 0.24, denoising, and approved 5.5/23/60 light energies.
12. ✅ Full responsive review captured + normal-speed evidence: desktop,
    tall-desktop, and phone films include arrival, settle, all four destinations,
    desk returns, hero end, and the retained final image.
13. ⚠️ Jonathan visual approval pending: implementation and behavioral evidence
    are ready; this human acceptance gate cannot be self-certified.

## 0117-R2 Verification

- Production build and targeted ESLint — PASS.
- Blender saved-master and shot-contract validation — PASS.
- Media parity — PASS: 2 profiles, 12 endpoints, 10 forward/reverse paths, 32
  media files, 22 decoded source relationships, 0 pending.
- Arrival continuity — PASS at 1280x720, 1316x1329, 1024x768, 768x1024, and
  375x812; zero hydration errors, zero camera mismatch, and zero endpoint pixel
  delta.
- Hero lifecycle/registration — PASS, 310/310 checks; foreground mask pixel gate
  reports masked p90 `0` and changing unmasked p90 `35`.
- Physical navigation, camera states, CONTACT reveal, media failure behavior,
  clock, and dwell — PASS.
- Clock — settle `3.00s`; magic `4.80s`; physical JOURNAL target `0.08s`.
- Performance — median `59.9fps`; `2.26MB` pre-settle; `4.56MB` total; no
  reverse-arrival preload.
- Optimized-production bootstrap verification — PASS: responsive portrait/wide
  opening sources exist in server HTML; five viewport arrivals pass without
  hydration errors; hero `310/310`; clock `3.12s` / `4.91s` / `0.08s`; dwell
  PASS x4; performance `59.9fps` / `2.26MB` / `4.56MB`.
- Deployed GitHub Pages battery at final experience commit `3459bb8` — PASS:
  workflow `29413979374`; phone portrait arrival selects the correct profile,
  follows all 71 camera samples with zero camera error, retains a pixel-stable
  endpoint, and reports no hydration errors; hero lifecycle/registration
  `310/310` with `0.000px` rendered corner error; settle `3.30s`; magic `5.10s`;
  JOURNAL `0.08s`; all four dwell targets; median `59.9fps`; `2.25MB`
  pre-settle; `4.55MB` total.
- Review films — `docs/progress/0117-r2-review-desktop.mp4`,
  `docs/progress/0117-r2-review-tall.mp4`, and
  `docs/progress/0117-r2-review-phone.mp4`.

---

## Withdrawn 0117-R Report

FORMER COMPLETION CLAIM (WITHDRAWN)

Commit:

`59de58e` (photographic runtime and authored media)

`f078ca9` (behavioral gates and visual evidence)

Version:

v0.1 — Work Order 0117-R

Files Changed:

- `scripts/render-master-shots.py`, `scripts/encode-master-shots.mjs`,
  `public/room/**`, and `three/scene/plateManifest.ts`: reproducible wide and
  portrait endpoint plates, camera transitions, physical artifacts, projection
  metadata, and encoded visitor media.
- `components/room/PlateRoom.tsx`, `components/room/HeroFilm.tsx`,
  `components/site/AttentionNavigation.tsx`, `three/scene/Stage.tsx`,
  `three/animation/plateExperience.ts`, and `lib/plateAssets.ts`: photographic
  runtime, desk-routed navigation, exact authored hit mapping, and independent
  hero lifecycle.
- `scripts/verify-*.mjs`, `scripts/measure-clock.mjs`, and
  `scripts/perf-gate.mjs`: behavioral gates for camera states, physical
  navigation, hero alignment/lifecycle, CONTACT, fallbacks, timing, dwell, and
  performance.
- `docs/progress/0117-r-*`: twelve final endpoint plates and ten integrated
  desktop/phone browser captures.

Architecture Decisions:

- Blender is the source of truth for room pixels, camera paths, physical paper,
  lighting, and projection metadata. The browser keeps only the living hero
  film and interaction state live.
- Every viewport and destination uses a photographic plate. Media failure keeps
  the last coherent photograph; no primitive room, loading chrome, or error UI
  can replace it.
- Navigation is one generated sheet contract: rendered graphite rows, exported
  screen quads, and browser hit regions all derive from the same local
  rectangles.
- Destination switches route through the settled desk. Reverse clips are real
  encoded media because dependable negative browser playback is unavailable.
- The hero lifecycle is independent of room navigation. Its live world depth
  and projected center are verified against the authored print surface.

Creative Decisions Implemented:

- The Lazy A mark uses existing card `Mesh_33`; no new logo card exists.
- FILMS, JOURNAL, CONTACT, and ABOUT are legible graphite production notes with
  disjoint full-row choices and selectable-empty margins.
- JOURNAL is a head-first, upper-body-second downward lean with the notebook at
  55.4% of desktop and 41.2% of phone framing.
- CONTACT stays at the desk: the current lamp turns on and raking light reveals
  true Geometry Nodes indentation in `Mesh_56`.
- ABOUT turns left into the shelf and room history.
- Portrait uses a constant 45-degree lens and a left-seated diagonal regard so
  the logo, navigation, notebook, and live hero all coexist in the settled
  phone frame.
- The room uses the smoothed 0114 lighting character with the current inward
  lamp and current photographed prop set across every state.

Deferred:

- Company-authored films, JOURNAL copy, ABOUT copy, and final CONTACT copy remain
  placeholder content by direction.
- Migration to `www.lazyaproductions.com` remains a separate production/domain
  work order.
- Repository-wide ESLint still reports 15 pre-existing React immutability
  findings in legacy geometry components that the photographic runtime does not
  mount. All changed runtime and verifier files lint clean.

Decisions Required:

- Approve the 0117-R visual result before company-content replacement begins.
- Confirm the final public CONTACT address before domain launch.

Ready for:

Company-content integration and `www.lazyaproductions.com` deployment planning.

## Enumerated Completion Audit

1. ✅ Logo placement shipped + render-contract validation: `Mesh_33` carries
   the explicit upright logo UV; no replacement geometry is created.
2. ✅ Photographic coherence shipped + desktop/phone fallback gate: all twelve
   states remain photographic even when destination media is blocked.
3. ✅ CONTACT indentation shipped + behavioral reveal gate: fixed paper opacity,
   zero standalone text planes, rising lamp/reveal levels, hold, and reverse.
4. ✅ JOURNAL lean shipped + camera-state gate: measurable forward/downward body
   travel and readable notebook coverage on both profiles.
5. ✅ Navigation legibility shipped + 2,501-point/profile geometry scan, empty
   margins/gaps, four row round trips, dwell release, and live captures.
6. ✅ Old CONTACT view removed + DOM/scene gate: no pasted CONTACT/email plane;
   CONTACT remains desk-oriented rather than the former right/charger pose.
7. ✅ Lighting and current props shipped + one-master render contract and twelve
   final endpoint captures reviewed against the 0114 target.
8. ✅ Hero lifecycle shipped + 16-check behavioral gate: begins once after
   settle, advances through navigation, aligns to the authored print within
   `0.0014` normalized center error, ends once, and holds its final frame.

## Verification

- `npm run build` — PASS.
- Targeted ESLint across every changed runtime/verifier file — PASS.
- Master media verification — PASS: 2 profiles, 12 endpoints, 10 forward/reverse
  paths, 32 media files.
- Physical navigation — PASS on `1280x720` and `375x812`.
- Camera routing — PASS on all destinations and both profiles.
- CONTACT reveal — PASS.
- Hero lifecycle/alignment — PASS, 16/16.
- Photographic failure behavior — PASS on both profiles.
- Clock — PASS: settle `2.89s`, hero `4.68s`, JOURNAL recognition `0.08s`.
- Performance — PASS: nominal `59.9fps`, `2.35MB` through settle, `4.64MB`
  total; no unreachable reverse-arrival preload.
