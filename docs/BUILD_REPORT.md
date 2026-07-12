# BUILD REPORT

## Work Order

WORK ORDER 0087 — The Real Logo (Creative Sprint 05A, item 2 of 6)

## Version

v0.1

## Summary

- Jonathan's letterpress logo replaced the placeholder LAZY A text in the
  wordmark position. The 0073 restraint ruling still governs everything
  about HOW it sits there: top-left, small (84px), no animation, no
  entrance, orientation not branding.
- The attached artwork (cream letterpress print) was processed into an
  interface asset: background removed, the mark re-inked in the type
  system's primary (#5d574d — one cloth, 0077) with the letterpress
  texture preserved in the alpha channel, trimmed, and downsampled to
  480px for crisp high-DPI rendering. The source of truth is
  public/brand/wordmark.png; the component static-imports it so the
  GitHub Pages basePath is handled by the framework.
- The full lockup is used as authored (mark + LAZY A + PRODUCTIONS) —
  cropping Jonathan's logo would have been a creative decision this order
  was not asked to make. At 84px the mark and LAZY A read at a glance;
  PRODUCTIONS sits at the threshold, which suits the register.
- Verified on the LIVE site per the sprint rule: docs/progress/0087.png is
  a headless capture of https://jla22492.github.io/lazy-a/ after the
  deploy, and a pixel-zoom of its corner confirmed the mark renders crisp,
  boxless, and quiet over the plaster.
- Static-export build verified locally using CI's exact recipe (dev-only
  routes removed, STATIC_EXPORT=1) before pushing.

## Decisions Required

None.

## Ready for

WORK ORDER 0088 — the video-texture spike.
