# BUILD REPORT

## Work Order

WORK ORDER 0023 — Attention Before Interaction

## Version

v0.1

## Summary

- The room can now notice what the visitor is observing. The attention system (three/animation/attention.ts) models real attention: meaningful objects register with a position and physical radius; a gaze cone sized to each object's angular size accumulates dwell while held and decays when the gaze leaves (attention lingers rather than resetting); a target becomes OBSERVED only after 0.8 seconds of sustained gaze, and releases with hysteresis — glances never count, boundaries never flicker.
- The sensor is a Presence behavior that reads the camera after the movement behaviors have finished each frame, so perception always sees the final gaze. The notebook is the first registered target; any future meaningful object registers with one hook.
- Entirely invisible: no highlights, outlines, cursors, prompts, or UI. The visitor experience is visually identical (0023.png).
- Verified end-to-end in a live session: nothing observed at the settled gaze (observation requires intent — the notebook sits outside the neutral gaze cone); "notebook" observed after ~2.4s of steered sustained gaze; released cleanly after looking away.
- New Creative Lock recorded: observation always precedes interaction. Every future interaction begins with noticing.

## Decisions Required

None.

## Ready For

WORK ORDER 0024.
