# BUILD REPORT

## Work Order

WORK ORDER 0016 — Establish the Room Clock

## Version

v0.1

## Summary

- The room's heartbeat exists: a single mutable clock (three/animation/roomClock.ts) advanced exactly once per rendered frame by RoomClockDriver, running before every other frame callback.
- It exposes semantic time, not just seconds: elapsed and delta, plus a breath phase cycling at a calm resting-human tempo (one breath per 5 seconds — measured reality, 12 breaths/minute) and a drift phase at the tempo of weather (90 seconds) for near-imperceptible ambient behaviors.
- Consumers read it inside their own frame callbacks via getRoomClock()/useRoomClock() — no React re-renders, no isolated timers. Camera breathing, light fluctuation, ambient behaviors, and impossible moments all phase-lock to the same source.
- Because the clock advances with the frame loop, the room's time pauses when nobody is watching: the room only lives while observed.
- Visitor experience unchanged: 0016.png is byte-identical to 0015.png. Nothing animates yet — the heartbeat exists, unused.
- Creative Locks updated: Architecture Phase locked; the one-heartbeat rule recorded. Behavior Phase begins.
- Review cadence updated per your note: foundational engineering now flows through without visual review.

## Decisions Required

None.

## Ready For

WORK ORDER 0017.
