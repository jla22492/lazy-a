# BUILD REPORT

## Work Order

WORK ORDER 0015 — Establish Stillness

## Version

v0.1

## Summary

- Two foundational rendering changes, chosen for being felt rather than pointable:
- Tone mapping switched from ACES to AgX — a calmer, more photographic highlight and color response; the frame loses its last trace of CG contrast without any change to the lighting itself.
- The sun shadow gained a soft penumbra (PCF with blur radius 4). VSM was tried first and rejected: in VSM mode every shadow receiver also casts, which made the walls throw uncontrollable wrong-direction shadows across the floor. Documented for future lighting work.
- Nothing moved, nothing was added, no animation, no post-processing: material colors, composition, architecture, and props are untouched.
- Validation: the razor-cut shadow edge and plasticky contrast were the two clearest "this is a simulation" tells in the frame; with both gone, the room reads as quietly existing rather than rendered.
- Architecture Phase recorded as complete in PROJECT_STATUS; the project is now in the Presence Phase.
- CHANGELOG not updated: the change is deliberately below the threshold of pointability.

## Decisions Required

None.

## Ready For

Creative review of docs/progress/0015.png, then WORK ORDER 0016.
