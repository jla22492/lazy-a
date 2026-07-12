# BUILD REPORT

## Work Order

WORK ORDER 0091 — The Screen-Capture Pipeline (Creative Sprint 05A, item 6 of 6 — SPRINT 05A COMPLETE)

## Version

v0.1

## Summary

- The gap Sprint 04 closed its review on is closed: review films can now
  see what visitors see. The canvas ?record pipeline films only the
  WebGL layer; the new pipeline drives a real installed Chrome through
  Playwright and records the COMPOSITED page — canvas and HTML together —
  so the wordmark, the attention labels, the editorial captions, and the
  illuminated journal all exist in motion for the first time.
- The pipeline is three small scripts. scripts/capture.mjs: stills and
  passive films of any URL (used to verify 0090). scripts/film-review.mjs:
  the review film — a scripted pointer performs the actual visit while
  recording. scripts/verify-dwell.mjs: behavioral verification of the
  attention grammar with a real pointer (flyby / rest / release).
  scripts/probe-projection.mjs: measures world-to-screen projection from
  leaned viewpoints so caption placement is quantitative.
- The deliverable film exists: docs/progress/0091.mp4 (26s, frames at
  0091-frames.png), recorded against THE LIVE DEPLOYED URL — the seated
  arrival with the wordmark riding the walk, the rest on the notebook,
  JOURNAL's paragraph illuminating on the page, the release, FILMS with
  its caption and three unwritten gallery frames, CONTACT at the
  charger's cable. Every HTML beat the 0085 product film could not show
  is in this one.
- Environment facts recorded: Playwright uses the installed Chrome
  (channel: "chrome") because the bundled Chromium lacks h264 for the
  video texture, and films must run in a real browser because headless
  SwiftShader does not advance video playback (0088's finding).

## Decisions Required

None.

## Ready for

Jonathan's review of Sprint 05A. Implementation stops completely per the
sprint termination rule — no Work Order 0092 and no 05B work until he
reviews.
