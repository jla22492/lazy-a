# BUILD REPORT

## Work Order

WORK ORDER 0024 — Readiness Before Interaction

## Version

v0.1

## Summary

- The readiness system exists (three/animation/readiness.ts): each meaningful object registers a rule composed from a shared condition vocabulary — observed, standing-at-position, not-moving — with room for future contextual conditions. Every future interaction asks exactly one question: isReady(target). Introspection (readinessOf) reports which conditions hold a target back, for engineering only.
- The visitor's body is now modeled properly: visitorState carries a standing position (arrival/working/considering or null while in motion) and a moving flag, written by movement behaviors and read by perception and readiness.
- The notebook's rule: standing at WORKING, still, and genuinely observing it. Verified live through the whole journey: not ready at arrival, not ready mid-walk, not ready at the bench's neutral gaze — ready only during sustained observation, releasing on look-away.
- One honest finding from verification: from ARRIVAL, the notebook happens to sit near the opening composition's natural gaze line, so the attention system counts it as observed there — and readiness still correctly refuses because the body is in the wrong place. The layered philosophy is doing exactly the work it was designed for.
- Entirely invisible; the visitor experience is unchanged (0024.png).
- New Creative Lock recorded: observation enables readiness; readiness enables interaction; interaction never happens directly from gaze.

## Decisions Required

None.

## Ready For

WORK ORDER 0025.
