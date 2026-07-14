# BUILD REPORT

## Work Order

WORK ORDER 0117 — Physical Navigation Refinement (executed on Jonathan's "Proceed with execution" after approvals: desk-logo move, hero hierarchy, foreground photographic coherence, pencil-written desk navigation, stronger JOURNAL perspective, CONTACT pressure-impression reveal, ABOUT left-room reveal)

## Review Status

REJECTED BY JONATHAN — 2026-07-14. This report preserves the first-pass implementation record; its prior completion language is superseded by Work Order 0117-R. Rejected behaviors: wrong/new logo card intersecting the hero image, inconsistent photographed-versus-placeholder room states, no physical contact indentation, insufficient JOURNAL lean, ambiguous overlapping navigation targets, pasted CONTACT text, and incorrect lighting finish.

## Version

v0.1

## Summary

- NAVIGATION IS NOW IN THE ROOM: the HTML/Drei label layer is gone.
  `films`, `journal`, `contact`, and `about` live as pencil words on
  one production scratch note on the desk. The visitor clicks physical
  word targets; the room answers with head turns and material reveals.
- THE LOGO MOVED TO THE DESK: Jonathan's letterpress mark now sits on a
  leaning identity proof at the desk/wall line. The old live wall note
  is blanked so it covers the baked 0116 logo position until a pano
  re-render is authorized.
- JOURNAL, CONTACT, ABOUT NOW HAVE PAYOFFS: JOURNAL gets a stronger
  forward/downward reading posture and more legible page writing;
  CONTACT fades in a pressure-impression contact line on the production
  note itself; ABOUT turns left toward the room-history zone.
- VISUAL HIERARCHY TUNED: the hero print's border/material no longer
  reads as a flat white poster, and foreground objects were nudged
  toward the photographed desk composition.
- MEASURED (local production server): build green; physical nav green;
  dwell/candidate green; settle 3.41s / magic 4.72s / physical JOURNAL
  target 0.08s; fps median 59.9; pre-settle transfer 1.51MB; total
  streamed 3.04MB. Captures: docs/progress/0117-physical-nav-desktop.png,
  docs/progress/0117-physical-nav-phone.png,
  docs/progress/0117-contact-impression.png,
  docs/progress/0117-about-turn-left.png.

## Files Changed

- components/site/AttentionNavigation.tsx — physical ray targets,
  conversation state, no visible overlay labels, ABOUT destination,
  JOURNAL/CONTACT posture tuning, debug globals for behavioral gates
- components/room/WorkbenchDressing.tsx — production nav sheet, logo
  proof, contact pressure impression, living-desk artifact exports
- components/room/Notebook.tsx — larger/brighter JOURNAL placeholder
  text for the stronger reading posture
- components/room/ReferenceWallDressing.tsx and
  three/scene/dressing/referenceWall.ts — wall logo removed/blanked;
  hero print material softened
- three/scene/Stage.tsx — living desk artifacts remain over the pano
- three/scene/dressing/workbench.ts — authored constants for the
  physical nav sheet and logo proof; camera prop nudges
- three/interface/contact.ts, three/interface/journal.ts — contact
  reveal state and journal glow tuning
- scripts/verify-physical-navigation.mjs, verify-dwell.mjs,
  measure-clock.mjs, film-review.mjs, perf-gate.mjs — gates updated for
  physical navigation and clean browser close behavior
- docs/superpowers/plans/2026-07-14-physical-navigation-refinement.md,
  tasks/todo.md, docs/progress/0117-*.png — plan and evidence trail

## Architecture Decisions

- Physical navigation is a live 3D artifact, not DOM. The raycaster
  tests word centers on the production note, and clicks open the same
  conversation state previously driven by floating labels.
- The old dwell verifier became a candidate verifier. There is no
  hover label to time anymore; the gate now proves the physical word
  is hittable, clears on release, and click opens the correct response.
- The contact reveal shares the note artifact instead of living as a
  separate caption. This keeps the magic exactly where the visitor
  acted and avoids a puzzle-like search.

## Creative Decisions Implemented

- Navigation is one believable production note: pencil, lowercase,
  slightly hurried, explicit enough for a company site.
- Logo is a desk/wall identity proof, not a wall placard or chrome.
- JOURNAL reads through a human head dip and a more legible physical
  notebook surface.
- CONTACT appears as a latent pressure impression, not a pasted caption.
- ABOUT expands the room by turning left toward history.

## Deferred

- Actual Lazy A content: hero footage, journal copy, films, final
  contact information, and ABOUT content are still placeholder/content
  work.
- The 0116 8K pano still contains the former wall-logo composition
  underneath the live blanking note. Re-render only if Jonathan approves
  an image clean-up order.
- Domain migration to www.lazyaproductions.com is not executed here.

## Decisions Required

- Confirm final CONTACT copy before production domain launch. Current
  visible contact line is placeholder.
- Decide whether 0118 should be content migration first or pano
  clean-up first.

## Ready for

0117-R corrected-design approval and implementation. Not ready for the
next content/domain work order.
