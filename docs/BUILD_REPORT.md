# BUILD REPORT

## Work Order

WORK ORDER 0072 — The Arrival (Creative Sprint 04, order 2 of 15)

## Version

v0.1

## Summary

- The constitution's opening beat exists (docs/progress/0072.mp4): on every visit, the viewpoint begins a half-step shy of the composition — slightly back, a breath higher, gaze a touch wide — and settles once over 1.4 seconds, the gaze landing a quarter-second after the body, the way eyes settle after feet stop. Cubic ease-out; no path, no tour; it reads as arriving, never traveling. Then the camera is exactly the locked R-0071 composition and the behavior retires.
- Visitor-visible within the first ten seconds: it IS the first second and a half.
- Registered as a camera behavior on the room clock ("arrival"), consistent with every motion system since 0016.
- Verified live, not just filmed: the camera was sampled in a real browser settling 4.28 → 4.00 over the settle window, holding the exact end pose after.
- Captures stay deterministic: ?shot skips the settle; ?record with ?arrive films it — the settle now waits for the recorder's true start (headless recording begins unpredictably late, which silently hid motion from review films; the recorder now raises a flag the settle listens for). This fix benefits every future motion review.
- Follows Jonathan's R-0071 amendment (committed separately): the left wall opened, the right side restored exactly as built.

## Decisions Required

None.

## Ready for

WORK ORDER 0073 — Recognition: the site says its name.
