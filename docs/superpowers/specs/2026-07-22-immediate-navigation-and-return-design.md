# Work Order 0119: Immediate Navigation And Physical Return

## Problem

Production selection state changes within one frame, but visible destination
motion currently begins 0.48-1.95 seconds after click or tap. The compositor
creates and decodes a new transition video even when an equivalent video was
already warmed. The wide forward clips are also encoded at 63-83 Mbps, making
that duplicate decode especially visible.

The CONTACT indentation is readable as pale typography in the resting desk
plate. Its authored idle groove fill overcompensates for the recess, while the
current gate permits low-gradient white text that a viewer can plainly see.

Destination views also lack a consistent, visible way back to the desk. Escape
and empty-space click work, but neither is sufficient for a mobile company
website.

## Approved Experience

### Immediate Selection Response

- FILMS, JOURNAL, and ABOUT begin visible camera movement within one presented
  frame of their click or tap.
- CONTACT turns the real desk lamp on within one presented frame. The camera
  remains stationary for the approved one-second comprehension beat, then uses
  the existing approved CONTACT move.
- The visitor never waits on a visually frozen room while a transition decodes.
- The destination endpoint, camera path, hero continuity, and room appearance
  remain unchanged.

### Physical Return

- Every destination view exposes one consistent `← DESK` control at the lower
  edge of the viewport.
- It reads as the edge of the same off-white production-note stock already on
  the desk: square paper edge, subtle fiber, graphite arrow and lettering,
  restrained room-consistent shadow, no rounded web-button treatment.
- Only enough paper is visible to read as a tab kept within reach. It does not
  become a new compositional subject.
- The visible tab remains in the same screen-edge location across destination
  views so a visitor never has to search for the way back.
- The hit target is at least 48 CSS pixels in both dimensions and respects the
  mobile safe area. The visible paper can remain smaller than the hit target.
- The control is a semantic button with the accessible name `Return to desk`.
- Clicking the tab, tapping empty room space, pressing Escape, or using browser
  Back all dispatch the same CLOSE event and use the existing authored reverse
  transition.
- The tab is absent at the desk, hidden during the opening arrival, and removed
  as soon as a return begins.

## Architecture

### Prepared Transition Ownership

`lib/plateAssets.ts` will cache a prepared video resource, not merely a promise
that resolves to an asset record. A prepared resource owns the decoded video
element and has explicit claim/release disposal semantics. `PlateCompositor`
will claim that exact element when a matching transition starts instead of
creating a duplicate element and waiting on `loadeddata` again.

Forward transition warming begins during the non-interactive arrival after the
opening transition has started successfully. The active responsive profile is
the only profile warmed. Candidate intent still raises the selected route's
priority. Reverse warming remains destination-bound as shipped in 0118.

Forward clips may be re-encoded from the immutable authored frame sequences at
a delivery bitrate chosen by side-by-side full-resolution inspection. Frame
rate, dimensions, frame count, duration, camera samples, and endpoint pixels
must remain unchanged.

If a prepared transition is not ready, the click still records intent
immediately and the runtime uses the smallest available prepared route. It must
never introduce a second decode of the same source. Media failure retains the
existing photographic endpoint and bounded fallback behavior.

### Return Control

A small client component observes the canonical plate experience state and
dispatches CLOSE through the same reducer used by Escape and empty-space click.
It does not own camera state. Browser history receives one destination entry;
`popstate` closes an active destination without reloading the page. Programmatic
close replaces that entry so history cannot strand the visitor in a destination
state.

The paper tab is HTML for accessibility and touch ergonomics, but its visual
surface is built from the room's existing paper and graphite tokens. It carries
no panel, tooltip, explanatory copy, or independent navigation model.

### CONTACT Resting Material

The Blender source remains authoritative. The groove floor and walls retain
the host paper color and normal network at lamp level zero without the current
white idle-fill overshoot. Lamp-bound fiber, bevel-normal, and physical
occlusion response remain zero at rest and rise only from the authored lamp
level.

Every delivery still and transition in which the paper is visible must be
regenerated from the corrected master or proven byte/pixel unaffected. No
screen-space patch, text-plane crossfade, or paint-over is permitted.

## Verification

- A behavioral latency gate measures click/tap to the first presented effect at
  desktop and phone viewports for all four routes.
- FILMS, JOURNAL, and ABOUT must show camera motion within 100 ms. CONTACT must
  show lamp rise within 100 ms, preserve a 1.0-second stationary camera, then
  begin the approved move.
- The latency gate must fail if the compositor creates a second transition
  element after a matching prepared element is ready.
- A physical-return gate verifies the visible `← DESK` tab, its minimum touch
  target, semantic name, CLOSE routing, browser Back behavior, exact desk
  restoration, Escape, and empty-space return at desktop and phone sizes.
- CONTACT resting-copy evidence is captured at delivery resolution. The address
  region must be statistically indistinguishable from adjacent host paper and
  must fail against the currently shipped white-copy plate. The lit hold must
  retain the approved readable indentation contrast.
- Full hero, camera, arrival, CONTACT, navigation, fallback, resilience,
  4s/5s/6s clock, performance, TypeScript, lint, build, and production-domain
  gates run before completion.
- Normal-speed desktop and phone journeys are visually inspected after deploy.

## Scope Boundaries

- No destination endpoint or approved camera path changes.
- No company-content replacement.
- No redesign of the production navigation note.
- No removal of Escape or empty-space click behavior.
- No completion claim until behavior is observed on the canonical HTTPS domain.
