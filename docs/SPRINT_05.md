# CREATIVE SPRINT 05 — The Six-Second Homepage

Authorized directly by Jonathan after the Sprint 04 review. **The Creative
Director is out of the loop for this sprint** — Jonathan directs, Claude
executes and makes taste calls within the locks. Every change is logged in
the standard artifacts (PROJECT_STATUS, BUILD_REPORT per order, CHANGELOG
milestones, docs/progress/ captures, small commits) so the Creative
Director can review the full trail after the fact. Do not post to the
ChatGPT thread during this sprint.

This document extends the constitution (docs/ORIENTATION.md) and the
sprint briefs (docs/SPRINT_02.md, docs/SPRINT_03.md). Where it conflicts
with older locks, THIS document wins — it encodes Jonathan's direct
rulings.

---

## The end goal, in Jonathan's numbers (the acceptance criteria)

- **0–4s** — The room appears and the perspective arrives INTO the working
  position at the bench, seated. By the settle, a stranger knows: a working
  film studio's actual room, named Lazy A.
- **~5s** — One thing they've never seen a website do happens in front of
  them, unprompted. They stop fully trusting the room, in a way they enjoy.
- **By 6s** — It answers them: FILMS, JOURNAL, CONTACT. Choosing one turns
  the head marginally (a person shifting attention at their own desk), and
  the focused object IS the content — e.g. JOURNAL: the camera tilts down
  to the notebook and the notebook illuminates a written paragraph about
  Lazy A.

## Jonathan's destination rulings (supersede the 0075 placeholders)

- **JOURNAL** = the notebook on the desk (content illuminates ON the page).
- **CONTACT** = the phone charger (the phone left with its owner — contact).
- **FILMS** = the photographs taped/propped on the wall (the test-print
  photographs; reconcile with the actual wall objects sensibly).

## Constitution amendments (Jonathan-authorized; log them as revisions)

1. **The perspective sits.** The arrival ends seated at the workbench, in
   the maker's working position. This re-frames — does not break — the
   absence story: the person stepped out, and the room was vacated FOR the
   visitor. The chair-absence lock evolves accordingly; record the
   evolution in PROJECT_STATUS for the Creative Director's later review.
2. **The impossible is no longer deferred.** It happens at ~5 seconds,
   unprompted, in the seated view (the considered print lying on the notes
   is the natural stage; placeholder video content until authored).
3. **Timing outranks ceremony.** The current 3s standing arrival is too
   slow and too far; compress to Jonathan's clock.

## Sprint 05A scope (execute now, in roughly this order)

1. **Live deploy.** The actual site (not just the Studio) reviewable at a
   URL on Jonathan's phone. Prefer extending the existing GitHub Pages CI
   (the room page is client-rendered and can static-export; the dev-only
   API routes are not needed in production). Vercel is the fallback if
   Pages fights back — flag to Jonathan if auth is needed.
2. **The logo.** Jonathan is attaching the real Lazy A logo — it replaces
   the placeholder text wordmark (keep the restraint discipline from the
   0073 ruling: orientation, not branding; small, quiet, no animation).
3. **The video-texture spike.** Jonathan is attaching a placeholder video.
   Prove the offline→in-room pipeline: the video playing as a texture on
   the considered print (or a wall photograph) inside the real-time room —
   tone-mapping, lighting, and grain must feel like the same world. This
   is the project's riskiest unproven assumption; prove it before 05B
   builds the timed reveal.
4. **The seated arrival (first pass).** Compress the approach to ~2s and
   end at the bench's working position (STANDING_POSITIONS.working exists
   since 0019), at a seated-work eye height. Tune by feel against the 4s
   criterion on the live deploy.
5. **Destination remap + placeholder journal.** Move the attention targets
   to Jonathan's objects (notebook / charger / wall photographs), rename
   CONTACT, and put placeholder journal text ON the notebook page
   (diegetic — texture-level or projected HTML, whichever reads as
   belonging to the room). Placeholder words are acceptable and flagged
   for authorship.
6. **Screen-capture pipeline.** Canvas recordings cannot see the HTML
   layer; add a Playwright (or equivalent) capture path so review films
   show what visitors see.

05B (next, only after Jonathan reviews 05A): the full six-second sequence
tuned end to end — seated arrival, the ~5s unprompted reveal, head-turn
navigation with illuminated objects — then the stranger test against
4/5/6.

## What already exists (do not rebuild)

The working position (0019), the walk physics (0020), the neck/head-turn
physics (0022), attention/dwell (0075), the lean/conversation system
(0076), the quiet-consequence system (0081), type and motion token files
(0077/0083). The archived notebook-era research was built for exactly this
UX — reuse it.

## Process

- Small commits, push each work order (numbering continues: 0086+).
- Keep the Studio parseable: PROJECT_STATUS "Creative Locks" prefixes,
  BUILD_REPORT structure, docs/progress/NNNN captures via the established
  headless pipeline (see the auto-memory file lazy-a-workflow.md for every
  capture/verification technique).
- Verify on the live deploy, not just captures — the whole sprint is about
  seconds, and seconds only exist on a real device.
- Stop after 05A's scope is complete and verified: report to Jonathan and
  wait for 05B authorization.
