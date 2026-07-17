# Work Order 0117-R4 Physical Continuity Design

**Status:** Approved by Jonathan on 2026-07-17

## Objective

Correct the three remaining full-motion failures in the deployed R3 review
candidate without changing the approved room composition, desk camera, FILMS
move, ABOUT move, CONTACT destination move, navigation, or one-shot hero
lifecycle.

The result must preserve the governing illusion: the room is real, the camera
is a person, and the hero is a physical print whose image happens to move.

## Approved Rulings

### Hero

- The hero still and every frame of the playing film must retain the same room
  lighting, exposure, saturation, warmth, paper response, and light falloff.
- Playback must appear to begin inside the existing physical print. It must not
  read as a bright screen or a graphic layer switching on.
- The hero must remain on one fixed physical plane through every forward and
  reverse camera move.
- The card leaning against the print and every crossing pencil must remain
  cleanly in front of the hero with stable, photographic edges.
- The hero continues to play uninterrupted during navigation and holds its last
  frame after its single playthrough.

### JOURNAL

- JOURNAL is one continuous human hip hinge, not a head move followed by a body
  move.
- Forward and downward movement begin together and follow one smooth motion.
- The camera settles into the POV of a person looking downward at the notebook
  to read the paragraph.
- The endpoint remains forward-facing or only slightly angled. It must not twist
  into a side view of the writing.
- The paragraph must be comfortably readable at the endpoint.

### CONTACT

- Selecting CONTACT first holds the approved desk camera for exactly `1.0s`.
- During that hold, the visible lamp turns on and illuminates the desk so the
  viewer can understand the source and event.
- After the `1.0s` hold, the camera performs the same CONTACT camera move and
  reaches the same CONTACT endpoint as the approved R3 candidate.
- The lamp head must visually aim toward the illuminated contact area.
- The visible bulb and shade interior, the desk light pool, and the indentation
  response are one authored physical-light ramp.

## Architecture

### Atomic Hero Compositor

Replace the independent DOM plate plus separately timed WebGL hero relationship
with one render-frame compositor for the photographic room and living hero.
The current plate frame, projective hero surface, room-treatment inputs, and
authored foreground matte are sampled and drawn atomically.

The hero treatment is derived from the baked physical poster rather than a
fixed RGB multiplier. The first live frame must pixel-match the resting poster
within a measured tolerance, and subsequent frames retain that same treatment.

Foreground occlusion uses authored delivery-resolution mattes for each profile
and camera frame. The occluder set includes the existing leaning card and all
crossing foreground geometry. No low-resolution mask expansion or blurred edge
growth is permitted.

### JOURNAL Hip-Pivot Camera

Drive camera position and point of regard from one eased parameter over the
entire transition. Position follows a smooth forward/downward arc around an
implied seated hip. Regard converges continuously on an inset anchor of the
actual notebook page while preserving world-up and bounded yaw.

The endpoint is tuned from rendered text readability, not notebook bounding-box
coverage alone.

### CONTACT Practical-Light Beat

Keep the R3 CONTACT destination camera pose and move unchanged after the new
hold. Re-author the lamp head and source in Blender so the shade opening defines
the light axis. Render a visible bulb and warm shade interior. The bulb,
practical spill, desk pool, and recessed-fiber response share one level.

The CONTACT transition becomes a `1.0s` stationary activation beat followed by
the existing `0.9s` move. Its reverse returns with the approved camera path and
turns the practical off coherently as the desk view is restored.

## Behavioral Gates

### Hero

- Resting poster and first painted live frame pass color and luminance parity.
- Stable room treatment is measured across representative live frames.
- Plate and hero are drawn from the same decoded transition sample.
- Poster-axis pixel tracking remains stable through every forward and reverse
  transition at desktop, tall-desktop, tablet, and phone shapes.
- Delivery-resolution mattes include the leaning card and crossing pencils.
- Foreground edge error is measured against authored render frames.
- Playback begins once after settle, survives navigation, and holds the end.

### JOURNAL

- Translation begins no later than authored frame 2.
- There is no orientation-only plateau longer than two frames.
- Position and orientation are continuously differentiable through the move.
- No late angular spike exceeds `3 degrees` per frame at `30fps`.
- Regard intersects the actual notebook inset throughout the reading half of
  the move.
- Endpoint paragraph baseline rotation is at most `12 degrees`.
- Endpoint notebook coverage remains between `40%` and `60%`.
- Normal-speed wide and portrait frame strips must read as one hip hinge.

### CONTACT

- Camera position and orientation remain exactly at desk for the first `1.0s`.
- Visible bulb and shade-interior luminance rise during that hold.
- The desk pool begins from the measured shade axis and reaches the contact
  paper.
- Camera movement begins only after the activation hold.
- The post-hold camera samples and endpoint match the approved R3 CONTACT move.
- Rest, activation, move, hold, reverse, and restored-desk frames are inspected
  at delivery resolution in wide and portrait.

## Verification And Completion

1. Add RED-first behavioral and rendered-pixel gates for every requirement.
2. Re-author and regenerate the affected master data and media.
3. Run source, generated-artifact, TypeScript, lint, build, clock, performance,
   lifecycle, navigation, camera, CONTACT, and fallback batteries.
4. Capture complete normal-speed desktop, tall-desktop, tablet, and phone
   journeys.
5. Inspect the actual encoded frames, not only metadata or coordinates.
6. Push small auditable commits and verify the deployed Pages build.
7. Record the reopened order and every milestone in `PROJECT_STATUS`,
   per-order `BUILD_REPORT`, `CHANGELOG`, `tasks/todo.md`, `tasks/lessons.md`,
   and `docs/progress/`.
8. Do not claim completion before Jonathan's explicit visual approval.

