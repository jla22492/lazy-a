# WORK ORDER 0117 — Physical Navigation Refinement

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
