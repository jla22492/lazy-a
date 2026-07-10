# PROJECT STATUS

## Current Version

v0.1

---

## Current Sprint

Sprint 001

---

## Current Work Order

WORK ORDER 0006 — Camera Studies (complete)

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
- Five camera studies produced (docs/progress/0006-A…E.png); any study previewable live with ?study=<id>; default composition remains the baseline

---

## In Progress

Awaiting the Creative Director's choice of opening composition from camera studies A–E (WORK ORDER 0006).

---

## Next Recommended Work Order

Lock the opening composition from the camera studies.

---

## Known Issues

- CameraRig verbs are intentionally empty declarations; their movement behavior is not yet defined.
- Dev-server hot reload does not re-apply Canvas camera props; reload the page after editing camera constants.
- GSAP and Leva are installed but unused until animation and debug work begins.

---

## Creative Decisions Locked

- Camera API uses human verbs only (sit, lean, stand, turn).
- Camera starts at human eye height.
- The scene is an empty film stage before any set is built.
- The world origin (0,0,0) is the exact center of the workbench — permanent.
- The workbench is the room's center of gravity; blockout uses primitive geometry and flat neutral color only.
- The camera's gaze rests on the work surface, not the horizon.
- The room is inferred, not presented: rear + left wall only; right wall and ceiling stay absent until direction says otherwise.
- Daylight is unremarkable by design: source outside the frame, never revealed; no mood, no drama.
- No interactions yet.
