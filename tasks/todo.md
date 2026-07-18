# WORK ORDER 0117-R4 — Physical Continuity Corrections

## Approved Design

- [x] Reproduce hero drift, foreground-mask distortion, split JOURNAL motion,
  and CONTACT light-without-source in the deployed normal-speed review.
- [x] Trace the failures to the non-atomic hero layers, fixed color multiplier,
  512px silhouette, missing leaning-card occluder, staged JOURNAL interpolation,
  hidden CONTACT bulb, and misaligned lamp/light axes.
- [x] Receive Jonathan's approval of the atomic hero, hip-pivot JOURNAL, and
  practical-light CONTACT design.
- [x] Lock the CONTACT timing: `1.0s` stationary lamp-on beat, then the approved
  R3 CONTACT camera move and endpoint.
- [x] Commit the approved design specification (`4c2108d`).
- [x] Commit the implementation plan (`979e220`).
- [x] Add failing physical-continuity gates (`f76c07f`..`f65366b`;
  independent review clean).
- [x] Task 2 correction: prove RED for a wide visible practical plus portrait
  `offscreen-practical-light-pool-v1` relationship at the exact desk camera.
- [x] Task 2 correction: restore the supplied lamp's natural rigid placement
  and remove stretch, forced portrait relocation, and inferred multi-joint rigging.
- [x] Task 2 correction: regenerate the master, practical evidence, manifest,
  hero hash dependents, and exact camera/provenance contracts.
- [x] Task 2 correction: inspect required original-resolution CONTACT/JOURNAL
  strips and run the full authored-source verification battery.
- [x] Task 2 correction: update the Task 2 report and commit only the focused
  corrective files, leaving unrelated untracked files untouched.
- [x] Replace the split JOURNAL motion with one readable hip-pivot path.
- [x] Re-author CONTACT's visible practical and one-second activation beat.
- [x] Replace the non-atomic hero overlay and low-resolution occlusion path.
- [ ] Regenerate and encode affected wide and portrait room media.
- [ ] Run full local source, browser, clock, performance, and visual batteries.
- [ ] Push and verify the deployed Pages candidate.
- [ ] Receive Jonathan's explicit visual approval before any completion claim.

## Task 3 — Atomic Plate And Living Print

- [x] Preserve the base-commit RED in real Chrome before production edits:
      atomic compositor timeout; lifecycle `30/45` with missing pixel catalog and
      unresolved authored-depth presentation at all five viewports.
- [x] Source contract rejects a second camera writer in `Stage` or
      `AttentionNavigation`, legacy screen-space hero geometry, fixed RGB
      treatment, RLE/canvas occlusion, and a visible DOM transition video.
- [x] `PlateCompositor.useFrame(..., -100)` selects one plate texture, media
      time, projection frame, and approved camera sample for the current render.
- [x] One positive-priority presenter calls `gl.render(scene, camera)` exactly
      once, then publishes `window.__lazyACompositor` and dispatches
      `lazy-a:compositor-frame-presented`.
- [x] The clip-space photographic plate preserves the authored
      `object-fit: cover` crop while the server-rendered opening photograph stays
      below Canvas through first successful presentation and after failures.
- [x] `HeroFilm` owns only one DOM-observable `data-lazy-a-hero` video and its
      one-play-after-settle, navigate-through, end-once, final-frame-hold lifecycle.
- [x] `HeroSurface` loads `HeroLiveSurface` and every `HeroOccluder_*` from the
      authored GLB, uses GPU depth for occlusion, and applies the calibrated linear
      additive room-transfer shader to the one hero video texture.
- [ ] The complete five-viewport desk plus FILMS/JOURNAL/CONTACT/ABOUT
      forward/reverse early/mid/late browser-presented reference catalog is
      generated and cryptographically pinned to immutable offline authoring assets;
      blocked on Task 4's final 58-frame CONTACT media.
- [ ] The final catalog-backed lifecycle gate passes. Build, TypeScript, targeted
      lint, source/geometry, real-Chrome occlusion, arrival continuity, and
      desktop/phone visual inspection pass; lifecycle is `40/45` at the expected
      catalog-only boundary.
- [x] Task 3 report records RED, implementation, verification, self-review,
      exact committed files, enumerated obligation audit, and any remaining
      concerns without claiming R4 creative completion.

---

# WORK ORDER 0117-R3 — Superseded Technical Review Candidate

## Approved Design

- [x] Reproduce and visually inspect opening, desk, FILMS, JOURNAL, CONTACT,
  ABOUT, desktop, tall-desktop, and phone failures.
- [x] Trace misplaced, duplicated, floating, missing, pixelated, and distorted
  objects to the saved master, source builder, render resolution, camera poses,
  and hero compositor.
- [x] Inspect and approve the supplied leather armchair, coffee-table, and
  floor-lamp set for the left continuation.
- [x] Receive Jonathan's approval of the unified master-first correction design.
- [x] Commit the implementation plan.
- [x] Commit the independently reviewed master-scene implementation checkpoint.
- [x] Commit the remaining CONTACT, camera, hero, and live-browser gates.
- [x] Rebuild the master scene and supplied-object composition.
- [x] Correct CONTACT indentation and lamp-origin light.
- [x] Correct FILMS, JOURNAL, and room-supported ABOUT choreography.
- [x] Replace the hero's affine/raw-video/low-resolution-mask pipeline.
- [x] Render and encode high-resolution wide and portrait media.
- [x] Run full automated, full-motion visual, and local-production
  verification.
- [x] Run the deployed Pages verification battery against the pushed candidate.
- [ ] Receive Jonathan's explicit visual approval before any completion claim.

## Master-Scene Checkpoint

- Rebuilt `build/wo-0117-r/master.blend` from the pinned 0108 GLB with current
  project-owned scans and an adjacent SHA-256 provenance sidecar.
- Master verification passes for support, scale, replacement, duplicate,
  room-shell, seating, and provenance contracts.
- Negative controls reject stale builder/source/camera-contract hashes, missing
  sidecars, renamed/rescaled duplicate geometry, detached blanket support,
  shortened room-shell depth, duplicate navigation paper, and toy-scale seating.
- The generated shot contract passes all six endpoints in both wide and portrait
  profiles before the proof render is accepted.
- Inspected proof frames:
  `docs/progress/0117-r3-master-opening.jpg`,
  `docs/progress/0117-r3-master-desk.jpg`, and
  `docs/progress/0117-r3-master-about.jpg`.

## Technical Review Candidate

- Rejected the first rendered JOURNAL transition after its normal-speed film
  exposed an under-desk sightline between the valid endpoints.
- Added a behavioral sightline gate, rebuilt the transition around a moving
  desk-to-notebook point of regard, rerendered the affected wide/portrait
  frames, and confirmed the corrected seated lean in all three review films.
- Local production battery passes: five-viewport arrival continuity; hero
  lifecycle `310/310`; dense-grid physical navigation; exact physical CONTACT
  reveal and reverse; all four dwell targets; responsive camera endpoints;
  plate fallbacks; settle `3.05s`; magic `4.83s`; JOURNAL target `0.08s`;
  median `59.9fps`; `2.93MB` pre-settle; `10.62MB` total.
- Source and media battery passes: Blender master/provenance; 14 durable assets
  and credits; 32 media files and 22 decoded source relationships; treated
  physical hero with reciprocal-depth projection and evaluated foreground
  occlusion; TypeScript, targeted ESLint, and production build.
- Normal-speed review films:
  `docs/progress/0117-r3-review-desktop.webm`,
  `docs/progress/0117-r3-review-tall.webm`, and
  `docs/progress/0117-r3-review-phone.webm`.
- Deployed Pages workflow `29573534853` passed. Public verification passes:
  five-viewport arrival; hero `310/310`; camera states; dense-grid navigation;
  physical-click CONTACT; dwell x4; fallbacks; clock `3.35s` / `5.15s` /
  `0.08s`; performance `59.9fps` / `2.92MB` / `10.61MB`.
- Deployed normal-speed review:
  `docs/progress/0117-r3-review-deployed.webm`; public CONTACT captures:
  `docs/progress/0117-r3-contact-live-deployed/`.
- Human acceptance remains open. This is a technical review candidate, not a
  completion claim.

---

# WORK ORDER 0117-R2 — Second Failed Review Correction

## Reopened Review

- [x] Reproduce the changed tall-desktop camera and identify the aspect-only profile switch.
- [x] Reproduce hero separation and trace it to independent plate-crop and live-camera projections.
- [x] Inventory the seven supplied prop archives and their licenses.
- [x] Approve the revised camera/hero/plate execution design.
- [x] Add failing regression gates for the original arrival, settled camera, endpoint handoff, and four-corner hero registration across representative aspect ratios.
- [x] Integrate the supplied headphones, peace lily, picture frame, trash can, desk lamp, red mug, and basketball into the master scene.
- [x] Author the supplied CONTACT name, email, and phone as an exact applied pressure indentation in `Mesh_56`.
- [x] Correct navigation, JOURNAL, CONTACT, lighting, materials, and responsive composition to the production-company quality bar.
- [x] Capture and review complete desktop, tall-desktop, and phone journeys in motion.
- [ ] Receive Jonathan's explicit visual approval before any completion claim.

## 0117-R2 Review Candidate

- Master asset and saved-blend verification pass for all 12 durable room assets, including the seven supplied replacements at measured size, position, and contact surface.
- Five-viewport arrival continuity, camera selection, four-corner hero registration, exact foreground silhouettes, final-frame retention, and 310/310 hero lifecycle checks pass.
- Desktop through phone load without hydration mismatches; phone mounts and completes the exact portrait arrival from its first interactive frame.
- Optimized server HTML provides the correct responsive opening photograph; the client-only interactive room selects its profile before motion, so phone never begins a wide transition.
- The same 310/310 hero matrix passes on deployed GitHub Pages using post-render registration samples; decoded callbacks remain media-coverage evidence and pre-texture arrival states are reported separately.
- CONTACT exact-copy, physical-indentation, lamp-rise, hold, reverse, and desktop/phone framing gates pass.
- Normal-speed desktop, tall-desktop, and phone review films were captured and inspected; Jonathan's explicit visual approval remains open.

## Review

- Runtime/media commit: `b0cf10b`.
- Review evidence commit: `4fed800`; post-render verifier commit: `1a32124`;
  hydration gate: `cc6e4a9`; final responsive bootstrap: `a1733be`; deployed
  base-path arrival gate: `153f6e5`.
- Build: PASS.
- Clock: settle `3.00s`; magic `4.80s`; physical JOURNAL target `0.08s`.
- Performance: median `59.9fps`; `2.26MB` pre-settle; `4.56MB` total.
- Deployed Pages final experience workflow `29413979374`: PASS; phone portrait
  arrival follows all 71 camera samples with zero camera or endpoint-pixel
  error and no hydration errors; live clock `3.30s` / `5.10s` / `0.08s`, dwell
  PASS x4, hero `310/310`, and performance `59.9fps` / `2.25MB` / `4.55MB`.
- Review films: `docs/progress/0117-r2-review-desktop.mp4`, `docs/progress/0117-r2-review-tall.mp4`, and `docs/progress/0117-r2-review-phone.mp4`.
- Approval audit: every implementation item has behavioral and visual evidence; the unchecked Jonathan-approval item prevents a completion claim.

---

# WORK ORDER 0117-R — Failed Review Correction

## Review Result
- [x] Reproduce Jonathan's rejected resting, CONTACT, and JOURNAL views.
- [x] Trace logo intersection to new live geometry over the depthless pano.
- [x] Trace desktop/mobile asset inconsistency to the wide-only pano guard and primitive live fallback.
- [x] Trace CONTACT to a flat text plane rather than an indented material reveal.
- [x] Trace JOURNAL to an insufficient posture delta without a close reading composition.
- [x] Trace navigation ambiguity to overlapping spherical hit regions on a compressed diagonal list.
- [x] Confirm the intended smoothed lighting master with Jonathan: 0114 lighting with current 0116 `lamp2` and object set.
- [x] Present and receive incremental approval for the corrected render/interaction architecture, including one-shot hero playback independent of navigation.
- [x] Receive Jonathan's review approval of the written 0117-R design specification.
- [x] Restore every approved scan source to a durable project-owned path and prove the master is reproducible.
- [x] Write failing behavioral and visual gates for every rejected behavior.
- [x] Implement the approved correction without new unapproved geometry.
- [x] Verify desktop, mobile, all four destinations, lighting continuity, clock, and performance.
- [ ] Receive Jonathan's visual approval of the corrected browser experience.
- [x] Replace the failed implementation record with an enumerated implementation audit and review links.

## Rejected First-Pass Record

## Plan
- [x] Behavioral gate: add a Playwright verifier proving navigation comes from physical desk targets and old floating labels are gone.
- [x] Desk truth: move the Lazy A logo to a leaning identity proof at the desk/wall line and remove it from the pinned wall cluster.
- [x] Navigation truth: add one pencil-written production scratch sheet with `films`, `journal`, `contact`, `about` as explicit physical navigation.
- [x] Interaction truth: rewire attention/click centers to the scratch sheet words; keep head-only turns and remove the floating label/caption layer.
- [x] Journal payoff: make JOURNAL a forward/downward reading posture and improve notebook text legibility without making it a UI overlay.
- [x] Contact payoff: reveal contact info as a latent desk/paper pressure impression, not a pasted caption.
- [x] Room reveal: add ABOUT as a leftward turn toward the shelf/room-history zone.
- [x] Visual hierarchy: soften the hero print's white-poster dominance and improve foreground prop grounding enough for the new composition.
- [x] Verification: build, behavioral scripts, live clock/perf/dwell gates, desktop and mobile captures.

## Review
- `npm run build` PASS.
- `node scripts/verify-physical-navigation.mjs http://localhost:3000/` PASS: no floating labels; films/journal/contact/about physical clicks open the correct conversation.
- `node scripts/verify-dwell.mjs http://localhost:3000/` PASS: physical candidates engage on rest and clear on release for journal/contact/films/about.
- `node scripts/measure-clock.mjs http://localhost:3000/` PASS: settle 3.41s; magic 4.72s; physical JOURNAL target 0.08s.
- `node scripts/perf-gate.mjs http://localhost:3000/` PASS: 59.9fps; pre-settle 1.51MB; total streamed 3.04MB.
- Captures: `docs/progress/0117-physical-nav-desktop.png`, `docs/progress/0117-physical-nav-phone.png`, `docs/progress/0117-contact-impression.png`, `docs/progress/0117-about-turn-left.png`.

These automated checks passed but did not establish the approved visual result. Jonathan rejected the implementation for logo intersection/wrong-card placement, mixed pano/live fidelity, missing physical CONTACT indentation, insufficient JOURNAL lean, ambiguous navigation targets, pasted CONTACT text, and incorrect lighting finish.

## 0117-R Review

- Enumerated audit: 8/8 items shipped with behavioral/source-render gates; see
  `docs/BUILD_REPORT.md`.
- Final browser evidence: `docs/progress/0117-r-live-wide-*.png` and
  `docs/progress/0117-r-live-portrait-*.png`.
- Clock: settle 2.89s; hero 4.68s; JOURNAL target 0.08s.
- Performance: nominal 59.9fps; 2.35MB through settle; 4.64MB total.
- Known repository baseline: full ESLint includes 15 legacy geometry-component
  immutability errors; the changed runtime/verifier lint set passes.
