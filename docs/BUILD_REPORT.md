# BUILD REPORT

## Work Order

WORK ORDER 0043 — Lighting Refinement (Creative Sprint 01, order 8 of 10)

## Version

v0.1

## Summary

- Truth, not beauty. Two changes, both in service of the materials, neither visible as "lighting" (docs/progress/0043.png):
- Shadow fidelity: the set dressing added pencil-scale casters, and 2048 shadow texels stretched across a 12m span rendered their shadows chunky or absent — the pencil jar, tape roll, film canisters, and camera floated. The shadow map doubled to 4096 across a tighter 10m span (~2.4mm per texel); an A/B crop against 0042 confirms every small object now casts a fine contact shadow and visibly sits ON the bench. Objects grounding is the light revealing material truth.
- Bounce rebalance: the fill's ground return warmed a step and dropped from 0.5 to 0.44 — the floor is concrete and the bench is wood now, and the light bouncing off them should say so. The sun models the new surfaces slightly more; nothing announces itself.
- The sun's color, position, intensity, and the daylight-breath behavior are untouched. The daylight remains unremarkable by design.
- Verification: type-check and production build pass; 0043.png captured and A/B-compared against 0042.png in the small-object shadow region.

## Decisions Required

None.

## Ready for

WORK ORDER 0044 — The Edit.
