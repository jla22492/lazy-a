# PROJECT STATUS

## Current Version

v0.1

---

## Current Sprint

Sprint 001

---

## Current Work Order

WORK ORDER 0002 — Establish the World Coordinate System (complete)

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

---

## In Progress

None

---

## Next Recommended Work Order

Build the first physical room.

---

## Known Issues

- CLAUDE.md now lives in `docs/`, outside the location Claude Code loads automatically at session start; sessions must read `docs/CLAUDE.md` explicitly.
- CameraRig verbs are intentionally empty declarations; their movement behavior is not yet defined.
- GSAP and Leva are installed but unused until animation and debug work begins.

---

## Creative Decisions Locked

- Camera API uses human verbs only (sit, lean, stand, turn).
- Camera starts at human eye height.
- The scene is an empty film stage before any set is built.
- The world origin (0,0,0) is the exact center of the future workbench — permanent.
- No interactions yet.
