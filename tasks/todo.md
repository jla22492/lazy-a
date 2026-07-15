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
