# BUILD REPORT

## Work Order

WORK ORDER 0096 + 0097 — The Baked Light (Sprint 05B, orders 5–6: spike, then the full bake)

## Version

v0.1

## Summary

- The spike (0096) proved the riskiest pipeline of the realism plan
  end-to-end: a headless Blender twin of the room's static shell
  (scripts/bake-gi-spike.py — dimensions hand-synced from constants.ts,
  sun matched to the Daylight rig, the window as an emissive pane) bakes
  DIFFUSE INDIRECT light only, so the real-time sun keeps breathing and
  only its bounced light is frozen. Two receivers first: the rear wall
  and the bench top, composited as lightmaps over the surfaces' own UVs.
- The full bake (0097) extended it where the camera lives: the floor's
  visible patch joined as a third receiver — with the bench and the
  re-staged chair as true occluders — and enters the room as an ADDITIVE
  evidence-of-light plane, the 0049 grammar with the guesswork replaced
  by computed light. Orientation verified empirically (the bakes needed
  a mirror and a flip into three's UV space).
- Restraint held: measured region deltas are +1 to +2.6 luminance —
  warm floor-light rising into the plaster, the window-side brightening,
  contact darkening — all below the threshold of noticing, which is the
  room's register. The whole bake ships as three 256px PNGs, ~115KB.
- Gates: 59.9fps median, 2.40MB dev transfer (1.2MB live). Bounded
  scope, per Jonathan's own budget rule: the right/left walls and
  ceiling were NOT baked — they live outside the resting frame and the
  spend belongs where the camera does.

## Decisions Required

None.

## Ready for

WORK ORDER 0098 — the five tells.
