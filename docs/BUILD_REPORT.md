# BUILD REPORT

## Work Order

WORK ORDER 0093 — The Clock, Instrumented (Sprint 05B, order 2)

## Version

v0.1

## Summary

- Jonathan's 4/5/6 acceptance criteria are now MEASURED, not designed-
  toward: scripts/measure-clock.mjs opens the live site the way a
  stranger does and detects each beat from the outside — the settle
  (a static wall region ceasing to change), the magic (the hero region
  beginning to move after the settle), and the answer (pointer rest to
  visible label).
- The live deploy passes every beat with no tuning required:
  settle 3.91s (≤4), the hero begins 4.41s (the ~5s window), a
  destination answers 0.68s after rest (≤1s of resting attention, well
  inside the 6s promise). No timing was changed — the measured clock
  says the room already keeps it, and tuning without a measured failure
  is decorating.
- The performance budget became a GATE: scripts/perf-gate.mjs fails on
  median fps under 55 or compressed transfer over 8MB. The live site
  measures 59.9fps and 1.17MB. Every remaining 05B order (normals, GI,
  models, IBL) must pass this gate before its push — fidelity spends
  inside the budget or doesn't ship.

## Decisions Required

None.

## Ready for

WORK ORDER 0094 — the phone composition.
