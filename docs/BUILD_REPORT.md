# BUILD REPORT

## Work Order

WORK ORDER 0019 — Establish the Visitor Position

## Version

v0.1

## Summary

- The workspace language now includes STANDING_POSITIONS (three/scene/workspace.ts): where a human body naturally occupies this room. Implementation concepts only — nothing visitor-facing.
- Three positions, from real ergonomics: ARRIVAL — just inside the room, two steps from the doorway; this is exactly the locked opening composition's camera footprint, so the visitor's story and the camera system share one origin. WORKING — at the bench, centered on the active zone, hips a hand's width (~25cm) from the front edge, standard standing-work clearance. CONSIDERING — a step back, ~1.7m viewing distance from the rear wall's reference band.
- Each position carries a facing and a purpose; eyes sit at the established EYE_HEIGHT. The CameraRig's contract is updated: every future movement originates from a standing position — the camera never travels; a person moves.
- Your settling-not-breathing note is recorded as a Creative Lock; the current daylight sway stands unchanged as Version 1 of environmental presence.
- Validation: camera movements originating from these positions trace real human paths (enter → arrive → step to the bench → step back to consider), so they will read as physically natural.
- Visitor experience unchanged; 0019.png visually identical to 0018.

## Decisions Required

None.

## Ready For

WORK ORDER 0020.
