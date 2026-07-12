# BUILD REPORT

## Work Order

WORK ORDER 0083 — The Motion Language (Creative Sprint 04, order 13 of 15)

## Version

v0.1

## Summary

- Every duration and ease the interface uses now lives in one file (components/site/motion.ts), named for meaning rather than mechanics: answer (90ms — "oh," never "look"), materialize (240ms), the sibling stagger (70ms), the lean (0.9s, one ease of mass), dwell (0.45s), release (0.22s).
- The room's motion stays on the room clock where it has always lived; this file is the website's motion. The two share one philosophy, now written down: nothing announces, nothing bounces, everything settles.
- Like the type system (0077), this makes the eventual authored motion pass a one-file edit, and makes the current rhythm auditable at a glance.
- Verification: type-check and production build pass; all interface consumers read from the tokens.

## Decisions Required

None.

## Ready for

WORK ORDER 0084 — the fourth edit.
