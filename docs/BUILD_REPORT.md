# BUILD REPORT

## Work Order

WORK ORDER 0022 — The First Look

## Version

v0.1

## Summary

- The visitor can turn their head while standing at WORKING. Orientation only; the body stays rooted; the settled gaze is the neck's neutral.
- Built as a neck, not a camera rig: comfortable sustained range (±55° yaw; +20° up / −35° down — people look down at benches more than up), tanh soft limits so the neck resists at its extremes instead of hitting walls, and ~150ms critically-damped pursuit so the head has mass. Releasing input leaves attention exactly where the visitor put it — no recentering, per the new lock.
- Coordination with the step: a small shared visitor-state marks the body's location; the look behavior only acts after the walk and settle complete, so the two camera behaviors never fight.
- TEMPORARY controls (drag, or held arrow keys) — an interaction model comes later by direction. A dev-only ?autolook parameter scripts a look sequence for headless capture.
- Motion review: docs/progress/0022.mp4 — 14.7 seconds: arrival, the walk and settle, a quiet look left, a longer look right, then attention resting where it was left.
- New Creative Lock recorded: attention follows the visitor; the room never forces the gaze. CHANGELOG updated: the observer became a participant.

## Decisions Required

None.

## Ready For

Creative review of docs/progress/0022.mp4, then WORK ORDER 0023.
