# BUILD REPORT

## Work Order

WORK ORDER 0090 — The Destination Remap & the Placeholder Journal (Creative Sprint 05A, item 5 of 6)

## Version

v0.1

## Summary

- Jonathan's destination rulings executed, superseding the 0075
  placeholders: JOURNAL is the notebook on the desk, CONTACT is the phone
  charger (the phone left with its owner — contact), FILMS is the
  photographs propped against the wall. All three live inside the seated
  composition. Two sensible reconciliations, per the brief's own
  instruction: FILMS anchors on the rear band's propped test prints (the
  wall photographs the seated frame actually holds — the pinned cluster
  sits above the resting view), and CONTACT's attention center rides the
  charger's cable where it rises over the bench's rear edge (the
  charger's most reachable stretch from the seated frame).
- THE JOURNAL'S WORDS ARE ON THE PAGE (docs/progress/0090.png, live at
  0090-live-journal.png): choosing JOURNAL turns the head down to the
  notebook — a real look, not a glance (per-destination gaze pull, new) —
  and a written paragraph about Lazy A illuminates on the notebook
  itself: texture-level (a canvas texture on the cover's own surface),
  lit and tone-mapped with the room, correctly occluded by the pencil
  lying across it, rising with the same ease as the lean (the 0081
  one-gesture pattern, via three/interface/journal.ts). A closed notebook
  quietly showing its words is the room refusing, once more, to behave.
  THE WORDS ARE PLACEHOLDER — plausible, not authored; flagged in code
  and here; docs/THE_NOTEBOOK.md still governs the notebook's voice.
- FILMS and CONTACT keep the editorial caption grammar (0076/0082/0084);
  their captions were re-placed on measured clear wall using a new
  projection probe (scripts/probe-projection.mjs) after the leaned
  viewpoints collided with the pencil jar (0078's lesson, made
  quantitative). FILMS keeps its three unwritten gallery frames.
- Behavioral verification, not just captures: a scripted real pointer
  (scripts/verify-dwell.mjs) exercises the visitor's actual code path —
  flyby never triggers, rest reveals the label, release fades it — PASS
  for all three destinations locally AND against the live deployed URL.
  One interaction defect found and fixed en route: the journal's dwell
  sphere shadowed the charger's line of sight at the seated angle and
  stole its dwell via the depth rule; the sphere now matches the page.
- The archived FirstStep click/Space trigger is retired (it walked the
  camera through the old standing research path on any click — clicking
  belongs to conversations now). The walk survives as research behind
  the dev-only ?autostep parameter; retiring it also parks the archived
  notebook pickup, whose readiness depended on that walk.
- Captures were produced with the Playwright compositor pipeline
  (scripts/capture.mjs) built ahead of order 0091, because Chrome's
  --screenshot races the canvas and cannot see scheduled HTML. 0091
  completes the pipeline with its review film.

## Decisions Required

None new. (The journal's words and the CONTACT caption's eventual
content remain unauthored by design; the maker's chair staging question
from 0089 stands.)

## Ready for

WORK ORDER 0091 — the screen-capture pipeline's review film.
