# BUILD REPORT

## Work Order

WORK ORDER 0026 — Acceptance Before Interaction

## Version

v0.1

## Summary

- The interaction grammar is complete: observe → ready → intend → offer → the room answers. The acceptance system (three/animation/acceptance.ts) provides the single semantic gateway every future interaction begins with: requestInteraction(target), which consumes the visitor's intent and returns the room's answer — accepted, declined-no-intent, or declined-by-room.
- An answered offer is spent, even when declined: an offer is a moment, not a standing request. To offer again, the visitor must recommit.
- Per-target acceptance policies carry the room's judgment; future context (an impossible moment in progress, the room's own timing) joins there without touching the pipeline. The notebook's policy currently always accepts — the room has no reason to refuse yet.
- Verified live: an offer without intent declines; an earned offer (observe → commit → hold) is accepted — the first accepted interaction offer in the project's history; an immediate second offer declines because the first was spent.
- Nothing is bound, rendered, or animated; the visitor experience is unchanged (0026.png).
- New Creative Locks recorded: the visitor offers; the room accepts.

## Decisions Required

None.

## Ready For

WORK ORDER 0027.
