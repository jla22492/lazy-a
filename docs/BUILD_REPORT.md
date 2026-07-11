# BUILD REPORT

## Work Order

WORK ORDER 0027 — The First Interaction: Picking Up the Notebook

## Version

v0.1

## Summary

- The entire pipeline culminates in one human action: the visitor arrives, walks, settles, looks, observes the notebook, becomes ready, holds a deliberate commitment, offers — the room accepts — and the body picks the notebook up (docs/progress/0027.mp4).
- The pickup is a physical model (three/animation/pickup.ts), not a tween: a slight bend forward and down to reach (0.55s), a beat while the hand closes (0.2s), then the lift (0.95s) as the body straightens. The notebook clears the surface vertically before arcing toward the body — the way a hand actually takes an object off a bench — and settles into a two-handed chest-height hold, tilted toward the reader.
- The eyes behave like eyes: they stay on the object through the reach and grasp, then rise to a settled regard as the notebook arrives in the hold, so the held notebook rests low in vision with the room beyond it. The camera never travels; the notebook never flies toward the camera.
- The order ends the instant the notebook is comfortably held: complete stillness. Nothing opens, no pages, no impossible moment, no sound, no UI. visitorState.holding = "notebook" freezes free-look until held-state looking is directed.
- The commitment gesture (press-and-hold) remains TEMPORARY input plumbing, exactly like the walk trigger; releasing before the hold matures does nothing, and every path still runs through the locked grammar — no readiness, no commitment; no intent, no offer; no acceptance, no action.
- Verified live end-to-end in a headless capture run: the sequence only fires after observation matures readiness, a twitch never lifts the notebook, and the second offer declines because the first was spent.

## Decisions Required

None.

## Ready for

The Creative Director's next order — the notebook is in hand.
