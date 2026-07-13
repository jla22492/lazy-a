# BUILD REPORT

## Work Order

WORK ORDER 0107 — The Pre-Rendered Room Spike & the Sprint Close (Sprint 05D, order 4 of 4 — SPRINT 05D COMPLETE)

## Version

v0.1

## Summary

- The endgame pipeline is proven end to end: a Cycles equirectangular
  panorama rendered headlessly from the settled eye (scripts/
  render-pano-spike.py, the Blender twin grown a camera), streamed like
  every heavy asset, mapped onto a rotation-only sphere, with the LIVE
  layers — the playing hero, the logo note, the pinned wall, the
  notebook and its words, the interface — composited on top (?pano dev
  mode; docs/progress/0107-pano-composite.png + 0107-pano-equirect.jpg).
  The interaction grammar never noticed the swap: dwell targets are
  world coordinates, indifferent to whether the pixels behind them are
  live or baked. QUALITY IS EXPLICITLY DEFERRED — the spike's twin is
  boxes and its exposure crude; making the panorama beautiful is the
  next sprint's art pass, now a known-safe road.
- Sprint 05D delivered the "real objects" mandate as far as one sprint
  honestly can: the loading strategy (0104 — heavy things stream during
  the magic window; the perf gate now guards a pre-settle budget), REAL
  SURFACES (0105 — the desk is photographed oak with its wear intact,
  the walls photographic plaster, the floor real concrete), and the
  prop-streaming pipeline (0106 — proven with a genuine photogrammetry
  lamp that was then DECLINED on curation: wrong color, wrong mount,
  wrong aim for the manifest's lamp; a real object telling the wrong
  story loses to an authored one telling the truth).
- The measurement instrument was corrected during close-out: the magic
  detector was tripping on the poster image's one-frame pop-in;
  sustained motion is now required. Final live battery: settle
  3.10–3.51s, magic 4.21–4.51s, answer 0.68s, 59.9fps, pre-settle
  1.36MB, dwell PASS ×3. Review film re-shot on the live site
  (docs/progress/0107-review.mp4).

## Decisions Required

Curation of scanned props is a taste gate only Jonathan can hold: the
pipeline will stream any CC0 scan, but each object must match the
manifest's story (the lamp is dark-green, weighted, aimed at last
night's work). Candidates should be picked with eyes, not APIs.

## Ready for

Jonathan's review of Sprint 05D. Implementation stops completely.
