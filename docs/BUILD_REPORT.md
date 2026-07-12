# BUILD REPORT

## Work Order

WORK ORDER 0079 — Responsive Stance (Creative Sprint 04, order 9 of 15)

## Version

v0.1

## Summary

- A company website gets visited on phones, and the locked composition assumed a wide frame. The cinematographer's answer, not the renderer's: a narrow window doesn't amputate the bench — the body simply stands further back.
- The stance adapts once, at arrival (up to +0.9m of distance at phone portrait, easing in from aspect 1.5; at 16:9 and wider, nothing changes — every existing capture is untouched). Resizing mid-visit does not move a standing body; the next visit stands correctly for its window.
- Verified at 375x812: the working center, hero print, chair, and pendant all hold, the wordmark sits correctly, and — the quiet win — the crop-from-a-larger-place grammar makes portrait feel like a tighter crop of the same room rather than a broken layout. The recomposition keeps paying rent.
- Verification: type-check and production build pass; live camera sampled at z=4.9 on a phone viewport (rest: 4.0).

## Decisions Required

None.

## Ready for

WORK ORDER 0080 — the sprint's mid-review.
