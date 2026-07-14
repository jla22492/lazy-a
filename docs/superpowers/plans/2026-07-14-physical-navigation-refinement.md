# Physical Navigation Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace website-like navigation with an explicit pencil-written production scratch sheet and refine the current room UX so the homepage reads as Lazy A on desktop and mobile.

**Architecture:** Keep the room as the interface. Add physical desk artifacts in `WorkbenchDressing`, make `AttentionNavigation` use those artifact positions, and preserve the existing measured camera/head-turn grammar. Verification uses project-standard Playwright/browser captures and live timing gates.

**Tech Stack:** Next.js App Router, React Three Fiber, Drei, Three.js, Playwright capture scripts, static GitHub Pages export.

## Global Constraints

- The UX must be immediately understandable as company navigation, not a puzzle.
- Every UX element must be both a believable mark/object/action made by the absent maker and immediately legible as website function.
- No floating website labels for FILMS/JOURNAL/CONTACT/ABOUT in the resting frame.
- The logo becomes a physical identity proof/card on the desk/wall line.
- JOURNAL uses a reading posture: a real forward/downward lean, not a zoom or overlay.
- CONTACT reveals latent desk evidence, preferably a raking-light/pressure-impression trace.
- ABOUT turns left to reveal more of the room.
- Preserve the 4/5/6 clock and live performance gates.

---

### Task 1: Work Order Planning And Behavioral Gate

**Files:**
- Create: `scripts/verify-physical-navigation.mjs`
- Modify: `tasks/todo.md`

**Interfaces:**
- Consumes: live URL or local URL.
- Produces: a behavioral script that fails while old floating labels remain and passes when the production scratch sheet is wired.

- [ ] Add a Playwright verification script that opens a URL, waits for arrival, clicks approximate physical nav targets, and asserts old standalone floating labels are absent.
- [ ] Run the script against the current live URL and confirm it fails before implementation.

### Task 2: Physical Desk Navigation And Logo Proof

**Files:**
- Modify: `three/scene/dressing/workbench.ts`
- Modify: `components/room/WorkbenchDressing.tsx`
- Modify: `three/scene/dressing/referenceWall.ts`
- Modify: `components/room/ReferenceWallDressing.tsx`

**Interfaces:**
- Produces: a visible scratch sheet texture with handwritten `films`, `journal`, `contact`, `about`.
- Produces: a desk/wall-line logo proof using the existing logo note texture.

- [ ] Add constants for the production scratch sheet and logo proof.
- [ ] Render the scratch sheet as paper on the desk with pencil handwriting on a CanvasTexture.
- [ ] Render the logo proof as a leaning desk card and remove the wall-pinned logo from the pinned cluster.
- [ ] Tune hero print material to reduce the bright flat poster read.

### Task 3: Navigation Grammar Rewire

**Files:**
- Modify: `components/site/AttentionNavigation.tsx`

**Interfaces:**
- Consumes: physical scratch sheet positions.
- Produces: click/rest targets for FILMS, JOURNAL, CONTACT, ABOUT.

- [ ] Move attention centers to the handwritten production note items.
- [ ] Remove old floating attention labels and wall captions.
- [ ] Keep click-to-conversation behavior and head-only turns.
- [ ] Add ABOUT as a leftward turn to the shelf/room history.

### Task 4: JOURNAL And CONTACT Payoffs

**Files:**
- Modify: `components/site/AttentionNavigation.tsx`
- Modify: `components/room/Notebook.tsx`
- Modify: `three/interface/journal.ts`
- Modify: `components/room/WorkbenchDressing.tsx`

**Interfaces:**
- Consumes: conversation id from `AttentionNavigation`.
- Produces: stronger reading posture and a physical contact impression reveal.

- [ ] Increase JOURNAL gaze/lean into a true reading posture.
- [ ] Increase notebook text legibility through type scale/position/emissive tuning.
- [ ] Add a desk/paper pressure-impression contact reveal that fades in only for CONTACT.

### Task 5: Verification, Documentation, And Closeout

**Files:**
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/BUILD_REPORT.md`
- Modify: `docs/CHANGELOG.md` if the visible UX milestone warrants it.
- Add: `docs/progress/0117*.png` / `docs/progress/0117*.mp4`

**Interfaces:**
- Consumes: build and live/browser verification scripts.
- Produces: audit trail for Work Order 0117.

- [ ] Run `npm run build`.
- [ ] Run the physical-navigation verifier.
- [ ] Run `scripts/measure-clock.mjs`, `scripts/perf-gate.mjs`, and destination behavior verification.
- [ ] Capture desktop and mobile review stills/film.
- [ ] Update standard artifacts and commit.
