# BUILD REPORT

## Work Order

WORK ORDERS 0108–0110 — Curation Open, the Master Scene, Placement Ready (Sprint 05E, orders 1–3; order 4 — the 8K panorama — deliberately NOT run per Jonathan's instruction)

## Version

v0.1

## Summary

- 0108 CURATION IS OPEN: two candidate boards posted for Jonathan's
  picks (docs/progress/0108-board-A-seating-and-desk.png and
  0108-board-B-desk-objects.png) — CC0 scans presented against each
  manifest object's story requirements. Picks arrive as R-amendments;
  nothing blocks on them (unpicked objects bake at authored quality and
  fold into the next render).
- 0108 THE SCENE EXPORTS ITSELF: a dev-only ?exportscene mode
  serializes the LIVE room to GLB through the capture save path —
  187 meshes, 79 textures, every position and material exactly as it
  runs (video surfaces excluded; they stay live layers). The export
  waits for the deferred photo surfaces so the master scene carries
  the real oak and plaster. The Blender master scene is no longer a
  hand-synced twin: it IS the room.
- 0109 THE MASTER SCENE: scripts/build-master-scene.py imports the GLB,
  replaces the browser's light approximation with the calibrated Cycles
  afternoon (sun, emissive pane, cool world, AgX), and renders from the
  settled eye. The preview (docs/progress/0109-master-preview.jpg) shows
  the panorama's quality tier: true global illumination, soft grounded
  shadows, the photographed surfaces under real light transport. The
  hero's blank stock is by design — its film composites live.
  JONATHAN'S LIGHTING NOTES have a named landing place in this one file.
- 0110 PLACEMENT MACHINERY VERIFIED: approved scans drop into a PICKS
  list (path, three-space position, yaw, true height, replaces-hint) —
  converted, scaled from real bounds, floor-sat, and the authored
  object hidden. Proven by dry run with the declined lamp
  (docs/progress/0110-dryrun.jpg); the committed list is EMPTY.
  Status: waiting on Jonathan's picks — the sprint's only open input
  besides his lighting notes.

## Decisions Required

Jonathan's picks from boards A and B (or his own CC0 links), and his
lighting notes. Both slot in without rework; the 8K panorama render
(order 4) awaits his go.

## Ready for

Jonathan's picks, lighting notes, and the order-4 go.
