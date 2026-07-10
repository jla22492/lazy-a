# PROJECT STATUS

## Current Version

v0.1

---

## Current Sprint

Sprint 001

---

## Current Work Order

WORK ORDER 0001.5 — Establish the Implementation Operating Manual (complete)

---

## Completed

- Repository initialized and connected to GitHub
- Next.js (App Router) configured with strict TypeScript, Tailwind, ESLint, Prettier
- React Three Fiber, Drei, GSAP, and Leva installed
- Folder structure established (components/, three/, public/, WORK_ORDERS/)
- Base scene created: full-viewport canvas, perspective camera, ambient + directional light, neutral floor plane, neutral gray background
- CameraRig created, exposing sit() / lean() / stand() / turn()
- CLAUDE.md replaced with the permanent implementation operating manual

---

## In Progress

None

---

## Next Recommended Work Order

Build the first physical room.

---

## Known Issues

- Work orders reference source-of-truth docs under `docs/`, but they live at the repository root.
- CameraRig verbs are intentionally empty declarations; their movement behavior is not yet defined.
- GSAP and Leva are installed but unused until animation and debug work begins.

---

## Creative Decisions Locked

- Camera API uses human verbs only (sit, lean, stand, turn).
- Camera starts at human eye height.
- The scene is an empty film stage before any set is built.
- No interactions yet.
