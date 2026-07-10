# PROJECT STATUS

## Current Version

v0.1

---

## Current Sprint

Sprint 001

---

## Current Work Order

WORK ORDER 0003 — Block Out the Workbench (complete)

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

---

## In Progress

None

---

## Next Recommended Work Order

Build the room around the workbench.

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
- No interactions yet.
