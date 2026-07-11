# BUILD REPORT

## Work Order

WORK ORDER 0018 — The First Breath

## Version

v0.1

## Summary

- The room's first living behavior: daylight intensity sways imperceptibly with the room clock — ±2% on the 90-second drift phase (the tempo of atmosphere) with a ±0.6% whisper of the 5-second breath phase. Real light through glass never holds perfectly still; now neither does the room's.
- It is the Presence system's first registered behavior ("daylight-breath", kind: environment), driven entirely by the room clock — no isolated timers, exactly as the architecture intended.
- Magnitude validation: with the behavior disabled the room reads frozen again; watching the enabled room, nothing identifiable moves. The sway is felt as absence-of-deadness, not seen as motion.
- Motion review recorded: docs/progress/0018.mp4 — 11.8 seconds, normal speed, 1280x720.
- New capture infrastructure: ?record=NNNN.mp4&seconds=N records the canvas via MediaRecorder (native H.264); captures now run in a dedicated headless Chrome instance because visible-browser capture throttles when the window is occluded (producing time-compressed clips — discovered and fixed during this order). The Studio timeline now renders motion reviews as playable video.
- CHANGELOG updated: the room took its first breath.

## Decisions Required

None.

## Ready For

Creative review of docs/progress/0018.mp4, then WORK ORDER 0019.
