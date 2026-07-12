# BUILD REPORT

## Work Order

WORK ORDER 0086 — Live Deploy (Creative Sprint 05A, item 1 of 6)

## Version

v0.1

## Summary

- The room is public. https://jla22492.github.io/lazy-a/ serves the actual
  experience — not just the Studio — on Jonathan's phone or anywhere else.
- No new deployment machinery was needed: the existing studio-pages CI has
  static-exported the whole app (room page included, dev-only API routes
  removed) since the Studio was published. What was missing was proof; this
  order is that proof.
- Verification ran against the DEPLOYED URL, not localhost, per the sprint
  brief: headless Chrome (SwiftShader, `--screenshot --timeout=12000`)
  captured the live site after the arrival settled. docs/progress/0086.png
  (1280x720) is visually identical to the local reference 0085.png — same
  composition, same dust, same wordmark. docs/progress/0086-phone.png
  (375x812) confirms the responsive stance holds on a phone viewport.
- Deploy freshness confirmed: the Pages build for the current head commit
  completed successfully (~1 min per push), so every subsequent 05A order
  becomes reviewable on the live URL about a minute after its push.
- Deployed-URL capture technique recorded for the sprint: the dev-only
  ?shot pipeline cannot run in production, so live captures use headless
  Chrome's own screenshot path (write file, then kill the process — the
  new headless mode does not always exit on WebGL pages). The Playwright
  pipeline (order 0091) will supersede this for films.

## Decisions Required

None.

## Ready for

WORK ORDER 0087 — the real logo into the wordmark.
