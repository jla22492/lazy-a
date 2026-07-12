# BUILD REPORT

## Work Order

WORK ORDER 0095 — Relief (Sprint 05B, order 4)

## Version

v0.1

## Summary

- The single biggest "this is a rendering" tell — optical flatness — is
  addressed at the surfaces the seated camera actually lives on. The
  procedural material system grew a relief layer (heightToNormal +
  woodNormal / plasterNormal / paperNormal in three/materials/
  procedural.ts): height fields generated in the same seeded language as
  the color layers, converted to tangent-space normals, riding UNDER the
  history layer so the scars, rings, and halos survive.
- Wired where it counts: the bench top and tallied front edge (grain and
  plank seams now catch the window's raking light — docs/progress/
  0095-before-after.png), every plaster wall (undulation and trowel arcs
  at the threshold of noticing, awaiting raking light to speak), the
  chair's wood, the picture ledge.
- Bevels where geometry allowed: the chair's seat and the picture ledge
  became rounded boxes — edges that behave like wood handled for years.
  DEFERRED HONESTLY: the bench top keeps its six-face construction (each
  face carries different history — tallies on the edge, wear on top), so
  it cannot take a single rounded geometry without rebuilding that
  system; its edge softening waits for the GI pass to justify it.
- Gates on the live deploy: 59.9fps median, 1.17MB transfer. The 4/5/6
  clock re-measured: one cold-CDN outlier (4.41s settle on the first hit
  after deploy), then 3.71/3.81/3.61s across three runs — the clock
  holds; first-visit cold-cache latency noted as a possible 05B-later
  preload optimization.

## Decisions Required

None.

## Ready for

WORK ORDER 0096 — the baked-GI spike.
