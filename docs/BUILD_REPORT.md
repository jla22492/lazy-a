# BUILD REPORT

## Work Order

WORK ORDER 0092 — Eyes Above the Desk & the Magic Window (Sprint 05B, order 1)

## Version

v0.1

## Summary

- Jonathan's ruling executed: the seated eyes now sit clearly above the
  desk (1.25m — 35cm over the work surface, an upright adult) and the
  resting regard tips a few degrees down, so the desktop reads as a
  SURFACE below the visitor instead of an edge-on sliver. The hero print
  was re-hung a hair lower (center 1.27) to keep the whole image inside
  the higher frame. The turned-head read of the journal improved exactly
  as Jonathan predicted — the page fills more of the regard and the
  placeholder paragraph reads comfortably (docs/progress/0092-journal.png
  + 0092-journal-zoom.png).
- The magic window: after the settle, the frame rests untouched for 15
  seconds while the hero plays. Verified ON THE LIVE DEPLOY with a
  15-second two-sample canvas diff: static wall and desk regions changed
  by at most 1 level (the sub-perceptual breath) while the hero region
  changed by 137 — the camera is motionless and the only motion is the
  magic. The review film now holds this window before any visiting.
- Arrival re-measured after the eye change: settled ~3.4s on the visitor
  clock (docs/progress/0092-arrival.mp4). Dwell verification passes for
  all three destinations on the live deploy at the new coordinates.

## Decisions Required

None.

## Ready for

WORK ORDER 0093 — timing instrumentation and the 4/5/6 tune.
