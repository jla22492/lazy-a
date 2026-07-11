# BUILD REPORT

## Work Order

WORK ORDER 0049 — The Larger World: Off-Screen Light & Shadow (Creative Sprint 02, order 4 of 10)

## Version

v0.1

## Summary

- Three additions, all evidence of the world beyond the frame, all below the threshold of noticing (docs/progress/0049.png; verified against 0048 by amplified image diff, because at honest levels the eye alone can't audit them):
- The window's daylight patch: a soft warm quad on the floor whose four corners are the window opening's sill and head edges projected along the sun's real direction — computed, not composed. It lands as a diagonal warmth on the floor right of the chair, felt more than seen. The renderer cannot transport light through the opening itself (the walls deliberately do not cast), so the patch is authored; its geometry is not.
- Corner occlusion: four thin fades (~14cm reach) where the walls meet — the ambient occlusion real corners gather and our direct-plus-hemisphere lighting cannot compute. The rear corners stop reading as the clean edges of a set.
- Pane presence: the frosted pane's visible sliver now carries one soft vertical darker band — something stands outside the window, unexplained. The room never says what. (First authored at the wrong end of the pane's UV — the visible sliver is the first ~8% — and moved where it can actually be seen.)
- Honesty note for the next review: these are the room's first authored light planes. Each approximates real light transport rather than decorating, and each is parameterized against the true room geometry — but they are a stage convention, and I want the Creative Director's eyes on whether they stay on the right side of "chase truth."
- Verification: type-check and production build pass; amplified diff confirms all three effects exist exactly where computed; full-frame review confirms none of them announce themselves.

## Decisions Required

None (the honesty note above is flagged for internal review #1, not a blocking decision).

## Ready for

WORK ORDER 0050 — Habits I: ghosts on the walls, then internal review #1.
