# BUILD REPORT

## Work Order

WORK ORDER 0116 — Order 4: the pre-rendered room IS the room (Sprint 05E close; executed on Jonathan's "Once the above updates are made, proceed with order-4", after his R-0115 conditions were met)

## Version

v0.1

## Summary

- THE ROOM IS NOW A PHOTOGRAPH: the 8K Cycles equirectangular panorama
  (docs/progress/0109-master-pano.jpg, 8192x4096, rendered from the
  settled eye) mounts by default on a rotation-only sphere. A 2K spike
  (public/textures/pano-spike.jpg, ~133KB) rides the arrival; the 8K
  (public/textures/pano-8k.jpg, ~1.1MB) streams through the magic
  window via whenRoomIsSettled and swaps in place. After the arrival
  settles, the plate dissolves in over 0.6s and the geometric room
  unmounts. The living layers never blink: the hero's film, the logo
  note, the sticky notes, the notebook, its pencil, the dust, the
  interface all keep rendering over the baked world.
- ORIENTATION AND GRADE FIXED IN INTEGRATION: the sphere needed a
  horizontal texture flip plus a +90-degree yaw (Blender's equirect
  centre is three-space -Z; the sphere's UVs run the opposite hand from
  inside), and the plate ships display-ready (toneMapped false — the
  Cycles frame is already AgX; mapping it again muddied it half a stop).
- JONATHAN'S LAMP CONDITION MET, AND A REAL BUG UNDER IT: glTF scan
  roots import in QUATERNION rotation mode, so every pick's euler yaw
  had been silently ignored — all approved renders show intrinsic
  orientations. place_scan now spins via quaternion; approved picks
  carry yaw 0 to preserve their approved looks; the lamp carries pi and
  faces inward across the desk (docs/progress/0116-lamp-inward.jpg,
  verified before the 8K was committed to).
- THE LIVING LAYER IS OUT OF THE PLATE: the notebook stack and its
  pencil are hidden from the Cycles render (five meshes, position-
  banded above the loose papers), so engaging the journal can never
  reveal a baked twin beneath the live one. The pencil keeps rendering
  post-dissolve; the cover's albedo is graded to match the plate's own
  render of it (measured 65,54,42 against the 0114 master's 60,53,42);
  a soft authored contact pool grounds it (the sun's normalBias eats
  true grazing-angle shadows of objects this low — the pencil jar's
  un-sunned disc set the precedent) and fades as the journal lifts.
- NARROW VIEWPORTS KEEP THE GEOMETRIC ROOM: the plate exists only from
  the wide settle eye; the 0094 narrow-viewport seat is displaced, and
  from there the living layers would shear off the photograph. The
  dissolve declines below aspect 1.5 — phones get the room they had.
- MEASURED (local, full battery): settle 3.61s / magic 4.71s /
  answer 0.67s; fps median 59.9 (floor 55); pre-settle 2.59MB
  (budget 3MB); total streamed 4.20MB (ceiling 20MB); journal, contact
  and films all answer at rest (docs/progress/0116-pano-live.jpg).
  Live-deploy battery re-run after this push — results appended to
  PROJECT_STATUS if they differ.

## Files Changed

- three/scene/Stage.tsx — PanoRoom default-mounted: orientation fix,
  toneMapped false, 8K stream + swap, settle dissolve, narrow-viewport
  guard, __panoIn signal, pencil kept live, static room unmount
- components/room/Notebook.tsx — plate-matched cover albedo; authored
  contact pool (ContactShadow), fading with the journal's lift
- components/room/WorkbenchDressing.tsx — Pencil exported (living layer)
- scripts/build-master-scene.py — quaternion-aware pick yaw; living-
  layer plate hides; lamp yaw pi (inward)
- public/textures/pano-spike.jpg, pano-8k.jpg — regenerated from the
  new plate
- docs/progress/0109-master-pano.jpg — re-rendered (lamp inward, clean
  papers); 0116-pano-live.jpg, 0116-lamp-inward.jpg — verification

## Architecture Decisions

- The plate is a skybox, not a scene: zero parallax is guaranteed by
  the rotation-only settled camera, so live 3D objects stay aligned
  with their baked surroundings from exactly one eye — which is why
  the narrow-viewport guard exists rather than a second plate.
- Anything that animates or answers must live in the browser and be
  excluded from the plate; anything still may bake. The notebook set
  the pattern (exclusion + grade-match + authored grounding).

## Creative Decisions Implemented

- Jonathan's R-0115 lamp ruling (inward-facing, his lamp_gltf.zip
  model) — now true in the shipped plate.
- No new creative decisions: the plate reproduces the approved R-0113/
  0114 master look; the cover grade and contact pool are compositing
  fidelity against that approved frame, not redesign.

## Deferred

- Blanket drape centering on the chair back (open nit from R-0114).
- CC-BY colophon (mug, lamp, chair, blanket) — lands with the About
  surface, per Jonathan's approval.
- Order 5 (pre-rendered arrival clip spike) — NOT authorized; not begun.

## Decisions Required

None.

## Ready for

Jonathan's review of the pre-rendered room on the live site, and the
order-5 go if the look holds.
