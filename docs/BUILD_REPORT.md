# BUILD REPORT

## Work Order

WORK ORDER 0020 — The First Step

## Version

v0.1

## Summary

- The first human action exists: the visitor walks from ARRIVAL to WORKING using the standing positions from 0019. One trigger, one step, nothing else responds.
- The movement is a body, not a camera: casual indoor pace (1.15 m/s across the 3.8m path, ~3.3 seconds), a smootherstep velocity profile (zero velocity and acceleration at both ends — bodies, not motors), a faint 1.75Hz step-rhythm in the eyes that is silent at both ends and fullest mid-stride, and a gaze that stays on the room until late in the walk, then eases down onto the work surface as the body settles. The settled frame holds the notebook at hand with the bench's rear edge and the wall keeping the room present — tuned through three iterations (straight-down felt like staring; too-shallow read as empty planes).
- Implemented as the Presence system's second behavior ("person-step", kind: camera), time-anchored to the room clock. The CameraRig verb vocabulary was not extended — walking is not one of the four locked verbs, so the transition lives as an internal behavior pending your direction on whether "step" enters the vocabulary.
- TEMPORARY trigger, per the order: click/tap anywhere or Space. A dev-only ?autostep parameter exists for headless capture. No permanent interaction model was built.
- New Creative Lock recorded: the camera never travels; a person moves.
- Motion review: docs/progress/0020.mp4 — 12.5 seconds: arrival stillness, trigger at ~3s, the walk, and the settled working position.

## Decisions Required

None.

## Ready For

Creative review of docs/progress/0020.mp4, then WORK ORDER 0021.
