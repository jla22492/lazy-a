# BUILD REPORT

## Work Order

WORK ORDER 0017 — Establish Presence Without Motion

## Version

v0.1

## Summary

- The Presence system exists (three/animation/presence.ts): a registry the room owns, where future behaviors — ambient, camera, environment, impossible — register themselves instead of running isolated frame loops. The same driver that advances the room clock ticks every enabled behavior, in deterministic insertion order, immediately after the clock updates.
- Registration is decoupled from enablement: a behavior can exist quietly long before it acts. A React lifetime helper (useRoomBehavior) registers and unregisters behaviors with their components. A listBehaviors() snapshot exists for debugging and future Studio surfacing.
- Nothing is registered, nothing is enabled, nothing renders: 0017.png is byte-identical to 0016.png.
- Room clock philosophy clarified as directed: the clock represents room time; the render-loop coupling is a Version 1 implementation detail, and no future behavior may assume the room pauses when unobserved. The principle "the room exists whether or not it is being observed" is recorded as a Creative Lock.
- Validation: ten future behaviors would share one clock, one tick order, one registry — one living room.

## Decisions Required

None.

## Ready For

WORK ORDER 0018.
