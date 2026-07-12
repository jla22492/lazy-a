# BUILD REPORT

## Work Order

WORK ORDER 0088 — The Video-Texture Spike (Creative Sprint 05A, item 3 of 6)

## Version

v0.1

## Summary

- The project's riskiest unproven assumption is now proven: offline-rendered
  content plays inside the real-time room as a video texture, on the same
  lit, tone-mapped surface language as everything else. The considered
  print (0064) is the stage, exactly as the sprint brief named it.
- Jonathan's placeholder clip was conformed to the print's stock: center-
  cropped from 1080x1920 portrait to the print's 3:2 landscape, muted,
  compressed to 250KB (public/videos/considered-print-placeholder.mp4).
  The print's paper shows a 4mm border around the image the way a lab
  print holds one; the film surface uses a standard material at the
  stock's own gloss, so the daylight and AgX tone mapping shade the moving
  image exactly as they shade the paper it lies on. PLACEHOLDER content,
  flagged for authorship; the ~5s timed reveal belongs to 05B.
- Proof, three ways. (1) A dev canvas film (docs/progress/0088-motion.mp4;
  frames at docs/progress/0088-motion-frames.png): the print's pixels
  change up to 48 levels between extracted frames while an equal-size
  static wall patch never exceeds 3 — the frames differ over time.
  (2) The production static build in a real browser: max pixel change 84
  over 3 seconds at the print. (3) THE LIVE DEPLOYED URL in a real
  browser: max pixel change 95 over 3 seconds. It plays, in public.
- Infrastructure this took: lib/assetPath.ts (plain-URL public assets must
  prepend the GitHub Pages basePath themselves; the framework only
  rewrites imports), NEXT_PUBLIC_BASE_PATH exposed from next.config.
- Two capture-environment facts recorded for the sprint: GitHub Pages'
  CDN can serve the previous build for a minute or two after the workflow
  reports success (verify the new bundle is being served before capturing),
  and headless SwiftShader Chrome renders a video texture's frame but does
  not advance playback — moving-image proof needs a real browser or the
  dev canvas recorder, which is exactly the gap order 0091 exists to close.

## Decisions Required

None. (The video content itself remains unauthored by design.)

## Ready for

WORK ORDER 0089 — the seated arrival.
