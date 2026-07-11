# BUILD REPORT

## Work Order

WORK ORDER 0021 — Settle Into Position

## Version

v0.1

## Summary

- The body now finishes arriving. In the first ~1.3 seconds after the walk ends: momentum carries the center of mass about 12mm past the stop along the walk direction, a damped sway at natural standing frequency (1.4Hz, decayed to ~1% by the end) brings it back to rest, a 6mm knee-soften dip resolves, and the head settles a beat behind the body (the gaze eases the last fraction into place).
- The oscillation starts at zero displacement with forward momentum — physically, the plant of the final step — so the walk flows into the settle without a seam.
- It happens exactly once. There is no idle cycle; after settling, the visitor is simply standing, and the only life in the frame is the daylight's Version-1 sway.
- Implemented inside the existing person-step behavior and room-clock timing — no new systems, no new triggers.
- Motion review: docs/progress/0021.mp4 — 12.6 seconds: arrival, transition, settling, complete stillness.
- CHANGELOG not updated: the settle is deliberately below the threshold of noticing; it belongs to the first-step milestone already recorded.

## Decisions Required

None.

## Ready For

Creative review of docs/progress/0021.mp4, then WORK ORDER 0022.
