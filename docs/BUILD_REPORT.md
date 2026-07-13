# BUILD REPORT

## Work Order

WORK ORDER 0099 — Micro-imperfection & the Sprint Close (Sprint 05B, order 8 of 8 — SPRINT 05B COMPLETE)

## Version

v0.1

## Summary

- Micro-imperfection landed where hands live: the bench top carries a
  roughness map (touchedRoughness in the procedural system) — the wear
  spots polish slightly closer to sheen, and fine noise keeps the finish
  from ever reading uniform. The hero print's playing surface tightened
  to gloss-stock roughness so it catches the window like printed light.
- IBL attempted, MEASURED, and reverted — the honest finding: a global
  generated environment (three's RoomEnvironment via scene.environment)
  relit the whole room (+28 wall luminance at 0.12 intensity; per-material
  envMapIntensity gating did not contain it in this three version, wash
  measured at +60%). The room's light is authored — the daylight rig and
  the baked bounce own it — so the environment was removed and the
  authored light verified restored to the decimal (deltas ≤0.2). True
  speculars await a per-material envMap system; deferred with findings.
- The clock guarded: the sprint's added startup work drifted the settle
  to the 4s boundary; normal-map generation halved to 256px (quarter
  Sobel cost, visually identical from the seat) and the live clock
  re-measured at 3.81 / 3.81 / 3.91s. Final live battery: 4/5/6 clock
  PASS, 59.9fps median, 1.28MB transfer, dwell flyby/rest/release PASS
  for all three destinations. The final review film — arrival, the 15s
  magic window, all three head-turn visits — was shot on the live site
  (docs/progress/0099-review.mp4, 40s; phone at 0099-phone.png).

## Decisions Required

None — the sprint review is Jonathan's to make. (Open from earlier
orders, restated for his review: the journal's authored words and their
page-size budget; specular IBL deferred pending per-material plumbing.)

## Ready for

Jonathan's review of Sprint 05B. Implementation stops completely.
