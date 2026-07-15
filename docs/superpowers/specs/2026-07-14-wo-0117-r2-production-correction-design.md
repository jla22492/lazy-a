# Work Order 0117-R2 Production Correction Design

**Status:** Authorized by Jonathan's direction to continue execution until the
experience meets the quality standard of a successful production company.

**Goal:** Restore the approved pre-0117 arrival, resting camera, and hero-print
placement; integrate Jonathan's seven supplied props and final CONTACT details;
and rebuild the current destinations into one polished, believable company
website experience across real desktop and phone browser shapes.

## Authority And Reference State

- `docs/SPRINT_05.md` wins over older locks.
- Commit `1891221` (`WO 0116`) is the behavioral reference immediately before
  the rejected physical-navigation work.
- The wide resting camera is immutable: FOV `35`, position
  `(0.05, 1.60, 1.45)`, regard `(0.02, 1.04, -0.45)`.
- The arrival choreography comes from `Arrival.tsx` at `1891221`: a `0.2s`
  opening beat, `1.9s` cubic body approach, walking bob and lateral sway,
  `0.5s` overshoot/settle, and gaze lag that lands after the body.
- The responsive phone stance comes from the same implementation's restrained
  offset formula. The rejected portrait pose `(-0.50, 1.82, 1.72)` is removed.
- The hero print retains its approved physical dimensions, position, roll,
  border, and wall relationship from `1891221`.

## Root Causes Being Removed

1. Runtime profile selection uses aspect ratio alone. A tall `1316x1329`
   desktop therefore receives the phone camera.
2. The plate uses `object-fit: cover` while live layers use the current browser
   camera aspect. Their coordinate systems agree only at `1280x720` and
   `375x812`.
3. Arrival rendering approximates the old route with one smoothstep and omits
   its opening beat, body easing, gaze lag, overshoot, and damped settle.
4. On transition end, the browser removes the video and exposes a separate
   endpoint still. Any frame or crop mismatch becomes a visible jump.
5. Existing gates compare the hero center at canonical sizes instead of all
   four corners throughout motion and responsive cropping.

## Corrected Runtime Contract

### Camera And Plates

- Render the approach from the exact approved camera equations, not a visually
  similar interpolation.
- Desktop selection is based on actual layout width, not aspect ratio. Tall
  desktop windows remain on the approved desktop camera.
- Phone rendering uses the old responsive stance evaluated at the target phone
  shape. No new camera position is invented.
- A transition video remains the visible room surface on its final decoded
  frame. The endpoint still is loaded beneath it for recovery, not swapped into
  view during a successful path.
- The next transition starts only when its first frame is decoded, and that
  frame must pixel-match the currently held endpoint.
- Projection updates use `requestVideoFrameCallback` when available and the
  media time as the only frame clock.

### Shared Plate-Space Mapping

- One utility maps normalized authored plate coordinates through the exact
  runtime `object-fit: cover` transform into viewport coordinates.
- Hero corners, navigation row polygons, CONTACT diagnostics, and visual gates
  all consume this same utility.
- No live layer reconstructs a plate object's location from an independent
  Three.js perspective camera.

### Hero Surface

- Blender exports the four corners of the image inset, not merely the outer
  print bounds, for every transition frame and endpoint.
- The browser draws the hero as a screen-space textured quadrilateral whose
  four vertices are the transformed authored corners.
- The first hero frame is visible and physically registered during arrival.
- Playback remains at time zero until the post-settle beat, plays exactly once
  through navigation, and holds the final frame until reload.
- There is no remount, center snap, endpoint snap, or corner drift.

### Navigation

- FILMS, JOURNAL, CONTACT, and ABOUT remain one believable production note in
  graphite, as already approved.
- The sheet is rewritten for immediate reading at rest: consistent baseline,
  natural pencil pressure, one clear row per destination, and sufficient size
  and contrast without becoming website chrome.
- Hit regions are the exported row polygons after the shared plate crop. Empty
  paper margins and inter-row gaps select nothing.
- Attention feedback is restrained graphite emphasis on the named row; the
  room itself does not glow, pulse, or acknowledge hover.

## Destination Quality

### JOURNAL

- Retain the approved head-first, body-second lean, but remove all hero/frame
  clipping from the composition.
- The object must read as a used notebook rather than a black rectangular box.
  Page/cover edge, paper block, material wear, pencil contact, and readable
  typography must survive both desktop and phone close views.
- Placeholder company copy remains until the separate content order; visual
  treatment must still be publication-ready.

### CONTACT

- The replacement lamp remains physically stationary. Its bulb and hidden
  raking light rise together to reveal actual indentation already present in
  the paper.
- The held reveal reads, exactly:

  ```text
  Jonathan Adelson
  JonathanAdelson1@gmail.com
  1-310-709-9283
  ```

- The final hold must be fully legible without looking like luminous, outlined,
  embossed, or pasted interface text.

### FILMS And ABOUT

- FILMS remains a restrained head turn toward the authored wall work.
- ABOUT remains a leftward turn that reveals shelf/history and more room.
- Neither destination translates the seated body to a new location.

## Supplied Production Props

Every source archive is preserved under `assets/master/scans`, checksummed,
credited in `assets/master/credits.json`, and imported only by repository-owned
paths.

| Prop | Integration |
| --- | --- |
| Sony MDR-7506 headphones | Replace the left desk headphones at measured real-world size; rest naturally with cable gravity and no intersection. |
| Peace lily | Replace the plant in its existing peripheral-room role; scale to a believable floor plant and preserve its reach toward the window. |
| Gold wooden picture frame | Place on the desk immediately right of the lamp, front facing the working position, subtly leaned and grounded. |
| Mesh trash can | Replace the existing floor wastebasket at its established location and story position. The archive contains no license file; provenance remains explicit rather than guessed. |
| Green articulated desk lamp | Replace the current lamp footprint, aim inward at the active work, and own the CONTACT raking-light reveal. |
| Red mug | Replace the white mug at the established four-centimeter off-ring position; preserve its handle logic and contact shadow. |
| Basketball | Import only the actual `Ball`-material mesh; discard the bundled floor/display geometry; rest it naturally in the bottom-right room corner. |

## Lighting And Material Bar

- Start from the approved `0114-master-settled.jpg` grade and retain the current
  room architecture.
- Replacement props must inherit the room's light, contact shadows, exposure,
  and depth of field. No prop may read as a separately lit asset.
- Remove plastic-white clipping, hard synthetic shadow wedges, floating contact
  points, raw sharp edges, texture-scale mismatches, and visible scan/display
  geometry.
- The still room must be worth looking at before anything moves.

## Verification And Creative Acceptance

### Behavioral Gates

- Exact camera position, regard, FOV, arrival phase durations, gaze lag, and
  final resting sample match the approved reference.
- The final arrival video frame and held desk surface have no visible handoff.
- Hero playback remains once-per-visit and navigation-independent.
- Every prop ID, source hash, placement contract, and replacement relationship
  is verified from the saved master.

### Responsive Visual Gates

Test at minimum:

- `1280x720` standard desktop
- `1316x1329` tall desktop reproduction
- `1024x768` desktop/tablet landscape
- `768x1024` portrait tablet
- `375x812` phone

At every size, compare all four hero corners after runtime crop on every
arrival frame, every destination frame, and every endpoint. Maximum allowed
corner error is one CSS pixel. Navigation polygons must remain disjoint and
legible.

### Human Review

- Record complete full-page journeys showing arrival, settle, hero start,
  navigation while the hero plays, all four destinations, final hero hold, and
  returns to desk at desktop, tall desktop, and phone sizes.
- Inspect the films at normal speed. Still captures and numerical gates are
  supporting evidence, not creative approval.
- Before any completion claim, audit the original rejection list and this
  design item by item, then obtain Jonathan's explicit visual approval.

## Rejected Alternatives

- **Return to the 0116 pano/live hybrid:** movement and projection recover
  quickly, but phone and destination fidelity split again.
- **Return to a fully real-time room:** camera behavior becomes straightforward,
  but the photographic finish and visitor performance regress.
- **Keep independent live-camera projection with more viewport tests:** this
  treats symptoms; plate crop and live projection remain structurally capable
  of disagreement.

The shared plate-space correction preserves photographic coherence while
restoring the previously approved human camera and physical hero placement.
