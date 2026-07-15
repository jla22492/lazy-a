# BUILD REPORT

WORK ORDER 0117-R REJECTED BY JONATHAN

The prior completion report is withdrawn. Exact-size automated gates passed,
but the live UX did not meet the creative definition of done.

Observed failures:

- Arrival no longer preserves the approved continuous human approach.
- Tall desktop windows select the phone camera and settle at a different pose.
- The hero plane and photographed print use different responsive projection
  systems, so the image separates from its surface and snaps visually.
- Navigation, JOURNAL, CONTACT, materials, lighting, and responsive composition
  remain below the expected production-company quality bar.

Current correction:

- Work Order 0117-R2 is active.
- The approved pre-0117 arrival, settled camera, and hero placement are locked
  regression references.
- Seven supplied production props and final CONTACT details are added to scope.

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
