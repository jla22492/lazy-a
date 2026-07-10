# PROJECT STATUS

## Current Version

v0.1

---

## Current Sprint

Sprint 001

---

## Current Work Order

INFRASTRUCTURE WORK ORDER 0002 — Build the Lazy A Studio (complete)

---

## Completed

- Repository initialized and connected to GitHub
- Next.js (App Router) configured with strict TypeScript, Tailwind, ESLint, Prettier
- React Three Fiber, Drei, GSAP, and Leva installed
- Folder structure established (components/, three/, public/, WORK_ORDERS/)
- Base scene created: full-viewport canvas, perspective camera, ambient + directional light, neutral floor plane, neutral gray background
- CameraRig created, exposing sit() / lean() / stand() / turn()
- CLAUDE.md replaced with the permanent implementation operating manual
- Source-of-truth documents moved into `docs/`
- World coordinate convention established: origin (0,0,0) is the exact center of the future workbench; camera position defined relative to it
- Workbench blockout built from primitives (tabletop + four legs), centered on the world origin, standing on the floor
- Camera reframed: standing eye height, a few meters back, gaze resting on the work surface
- Root CLAUDE.md restored as a pointer to docs/CLAUDE.md
- Operating manual updated: persistent context model, Decisions Required rule, changelog scope (experience milestones only), real-world measurement guidance
- Minimum believable room validated: rear wall + left wall (matte off-white plaster) and warm neutral floor; right wall and ceiling intentionally absent
- Daylight established: one sun entering from outside the right of frame (soft shadows), one subtle bounce fill; placeholder lighting removed
- Progress-screenshot convention started: docs/progress/NNNN.png per Work Order, saved via a dev-only API route (self-capture with ?shot=<filename>)
- Five camera studies produced (docs/progress/0006-A…E.png); any study previewable live with ?study=<id>
- Opening composition refined (docs/progress/0007.png): Study C's subtle three-quarter angle with Study E's longer lens; now the default camera
- Opening composition revised per Creative Director review (docs/progress/R-0007.png): viewer repositioned slightly left of the workbench; supersedes 0007 as the current candidate
- Ceiling plane added at wall height over the walls' footprint, completing the enclosure; invisible from the locked opening composition (docs/progress/0008.png is pixel-identical to R-0007.png by design)
- Notebook blockout placed (docs/progress/0009.png): closed A5 primitive, right of the bench's center, casually askew — the first object with narrative weight
- Studio built (/studio + /studio/state.json): internal production board derived live from PROJECT_STATUS.md, BUILD_REPORT.md, docs/progress/, and git; docs/BUILD_REPORT.md becomes the canonical home of each order's Build Report

---

## In Progress

None — the revised opening composition (R-0007) stands as the current candidate pending the Creative Director's final approval.

---

## Next Recommended Work Order

Continue placing the objects of the creative space around the notebook.

---

## Known Issues

- CameraRig verbs are intentionally empty declarations; their movement behavior is not yet defined.
- Dev-server hot reload does not re-apply Canvas camera props; reload the page after editing camera constants.
- The viewer cannot stand farther left than x ≈ −0.55 at the current lens and distance without the frame's upper-right corner rising above the 2.4 m rear wall; the ceiling now covers that region on wider viewports, but the wall-top seam becomes visible there.
- The ceiling underside is bounce-lit only (no direct sun, physically correct) and reads very dark if ever seen; acceptable while it stays out of frame, revisit when a lighting or camera-movement order exposes it.
- GSAP and Leva are installed but unused until animation and debug work begins.

---

## Creative Locks

🔒 Camera API uses human verbs only (sit, lean, stand, turn).
🔒 Camera starts at human eye height.
🔒 The world origin (0,0,0) is the exact center of the workbench — permanent.
🔒 The workbench is the room's center of gravity; blockout uses primitive geometry and flat neutral color only.
🔒 The camera's gaze rests on the work surface, not the horizon.
🟡 The opening view is a person who took two quiet steps in and stopped slightly left of the workbench: subtle three-quarter angle, normal lens (fov 35), eye height. (R-0007 — pending Creative Director final approval)
🔒 The notebook lives on the workbench, off-center and askew — used daily, never displayed.
🔒 The room is inferred, not presented: rear wall, left wall, and ceiling; the right wall stays absent until direction says otherwise.
🔒 Daylight is unremarkable by design: source outside the frame, never revealed; no mood, no drama.
🔒 No interactions yet.
