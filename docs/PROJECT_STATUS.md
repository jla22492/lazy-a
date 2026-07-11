# PROJECT STATUS

## Current Version

v0.1

---

## Current Sprint

Sprint 001

---

## Current Work Order

WORK ORDER 0013 — Establish the Window (complete)

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
- Studio published to GitHub Pages (https://jla22492.github.io/lazy-a/studio/), rebuilt by CI on every push — the Creative Director's canonical review surface per the confirmed hybrid workflow (public Studio for state, in-chat images for visual review)
- Workbench language established (three/scene/workspace.ts): four named zones — reference (rear band), resting (front-left), active (front-center), temporary (front-right) — assuming a right-handed worker at the open side; future bench objects are placed by naming a zone; dev-only overlay via ?zones=1; notebook placement confirmed by the language (active zone, dominant-hand edge) and unmoved
- Hero print experiment run and reversed (docs/progress/0011.png → R-0011.png): a leaning print on the bench became the compositional subject, violating "nothing should feel staged"; removed per Creative Director review. Conclusion: the hero print belongs to the room (permanent), not the workbench (today's work) — its future home is the wall architecture
- Permanent architecture completed (docs/progress/0012.png): right wall closing the room at x=+2.2 with a frosted window opening (sill 0.9m, head 2.0m — the implied daylight source, no exterior view), and 9cm baseboards on all three walls; the doorway was deliberately not built (implied entrance sits behind the locked camera — building it now would be overbuilding)
- Window established as the daylight's architectural source (docs/progress/0013.png): unlit frosted pane (the glass is the light — a lit material renders dark on the backlit wall), 10cm reveal with sill/head/jamb returns, repositioned so a quiet sliver enters the locked frame's right edge
- Capture fidelity fixed: progress shots 0009–0012 were horizontally stretched ~1.4x by a viewport-aspect bug in the capture pipeline; captures now render in a pinned 1280x720 canvas and preserve aspect, so every future frame is true 16:9

---

## In Progress

None.

---

## Next Recommended Work Order

Place the hero print where the completed architecture says it belongs (Layer 2 — permanent identity).

---

## Known Issues

- CameraRig verbs are intentionally empty declarations; their movement behavior is not yet defined.
- Dev-server hot reload does not re-apply Canvas camera props; reload the page after editing camera constants.
- The right wall now closes the room where the frame's upper-right rays land, resolving the old void exposure; the leftward camera limit note (x ≈ −0.55) is retained for history but no longer binding.
- The ceiling underside is bounce-lit only (no direct sun, physically correct) and reads very dark if ever seen; acceptable while it stays out of frame, revisit when a lighting or camera-movement order exposes it.
- GSAP and Leva are installed but unused until animation and debug work begins.
- Dev mode occasionally logs a hydration-mismatch warning (`isolation: isolate` on body) and counts it as "1 issue" in the Next dev badge. It is injected by Next's own dev-tools overlay, is intermittent, and cannot occur in production builds; no app code is involved (we are on the latest Next).

---

## Creative Locks

🔒 Camera API uses human verbs only (sit, lean, stand, turn).
🔒 Camera starts at human eye height.
🔒 The world origin (0,0,0) is the exact center of the workbench — permanent.
🔒 The workbench is the room's center of gravity; blockout uses primitive geometry and flat neutral color only.
🔒 The camera's gaze rests on the work surface, not the horizon.
🔒 The opening view is a person who took two quiet steps in and stopped slightly left of the workbench: subtle three-quarter angle, normal lens (fov 35), eye height. (R-0007 — approved by the Creative Director)
🟡 The notebook lives on the workbench, off-center and askew — used daily, never displayed. (Placement in review until additional objects exist.)
🔒 The room is a complete permanent shell: rear wall, left wall, right wall with a frosted window (the implied light source, never a view), ceiling, baseboards. Identity enters in layers: architecture → permanent identity → active workspace → impossible moments.
🔒 Daylight is unremarkable by design: source outside the frame, never revealed; no mood, no drama.
🔒 The workbench tells what is happening today; the room tells who the person is. Identity objects belong to the room's architecture, not the desk.
🔒 No interactions yet.
