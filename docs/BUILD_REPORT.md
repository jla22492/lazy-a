# BUILD REPORT

## Work Order

WORK ORDER 0025 — Intent Before Interaction

## Version

v0.1

## Summary

- The decision pipeline is complete: observation → readiness → intent. The intent system (three/animation/intent.ts) models deliberate commitment: it can only BEGIN toward a target that is ready, must be HELD for 0.35 seconds (long enough to be a decision, short enough to feel immediate), CANCELS instantly if readiness breaks mid-hold, and the resulting intent is CONSUMED exactly once — with a 0.5-second expiry, because commitment is a moment, not a state.
- No input is bound yet, per the order: future deliberate actions speak through beginCommit/releaseCommit, and future interactions pass through one gate — consumeIntent(target).
- Verified live, all five semantics: a commit attempted while not ready is refused; a 120ms twitch produces nothing; a held commit matures into intent; intent consumes once and only once; looking away mid-hold cancels the commitment. Accidental interaction is structurally impossible.
- Visitor experience unchanged (0025.png); nothing rendered, nothing bound, nothing visible.
- New Creative Locks recorded: readiness permits; intent commits.

## Decisions Required

None.

## Ready For

WORK ORDER 0026.
