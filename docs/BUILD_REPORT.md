# BUILD REPORT

WORK ORDER 0117-R3 TECHNICAL REVIEW CANDIDATE — JONATHAN APPROVAL PENDING

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

Review Evidence:

- `docs/progress/0117-r3-review-desktop.webm`
- `docs/progress/0117-r3-review-tall.webm`
- `docs/progress/0117-r3-review-phone.webm`
- `docs/progress/0117-r3-contact-live/contact-rest.png`
- `docs/progress/0117-r3-contact-live/contact-reveal-mid.png`
- `docs/progress/0117-r3-contact-live/contact-hold.png`
- `docs/progress/0117-r3-contact-live/contact-reversed.png`
- `docs/progress/0117-r3-master-opening.jpg`
- `docs/progress/0117-r3-master-desk.jpg`
- `docs/progress/0117-r3-master-about.jpg`

Enumerated 0117-R3 Audit:

1. ✅ Books moved to the left bookshelf + saved-master bounds/support gate and
   opening/ABOUT proof.
2. ✅ CONTACT indentation restored + topology, exact-copy, rest/mid/hold/reverse
   pixel, and no-overlay gates.
3. ✅ Desk lamp supported on the desk and reveal light sourced inside its shade
   + saved-master support/source and browser lamp-pool gates.
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
20. ⚠️ Deployed Pages verification and Jonathan's explicit visual approval are
    still open. This candidate cannot be called complete until both are
    observed.

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
