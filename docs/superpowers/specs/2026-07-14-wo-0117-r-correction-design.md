# Work Order 0117-R Correction Design

**Status:** Approved by Jonathan on 2026-07-14. Authorized for implementation.

## Goal

Correct the rejected physical-navigation pass so every resting and destination view reaches the same photographic quality, navigation is immediately legible, and each approved interaction is delivered through the room rather than pasted interface geometry.

## Governing Rulings

- The lighting target is `docs/progress/0114-master-settled.jpg`: soft, even, perspective-rendered light.
- The obsolete lamp in that reference does not return. The current inward-facing `lamp2` asset and the current approved object set remain.
- The logo appears on the existing propped card immediately left of the rejected 0117 logo position. No new logo card or replacement geometry is permitted.
- FILMS, JOURNAL, CONTACT, and ABOUT are explicit physical navigation, never a puzzle and never floating labels.
- JOURNAL is a human upper-body lean forward and down into a notebook-dominant reading composition.
- CONTACT does not use the old right-facing charger composition. The desk lamp reveals physically indented contact information through raking light on an existing paper surface in the standard desk composition.
- ABOUT turns left toward the room's history.
- The hero video begins only after the camera settles on the desk, plays from start to finish exactly once per page visit, continues uninterrupted through every navigation choice, and remains paused on its final frame.

## Rejected Architecture

The rejected build combines a wide-only equirectangular panorama, a primitive real-time mobile fallback, and new live meshes over a depthless background. This allows coordinate tests to pass while logo, navigation, notebook, and contact layers intersect or change fidelity. It is not repairable through position tuning alone.

## Chosen Architecture

Use the current Blender master scene as the sole visual source for every viewport and camera destination. Render purpose-framed perspective plates and short human-camera transitions for:

- wide opening and settled desk;
- portrait opening and settled desk;
- FILMS attention;
- JOURNAL lean and reading endpoint;
- CONTACT lamp/reveal endpoint;
- ABOUT left-room turn.

The 0114 lighting grade is reconstructed in the current master scene while retaining `lamp2`, the current chair, camera, mug, plant, blanket, hero frame, and other approved objects. Equirectangular projection is retired from visitor-facing settled and destination views because its appearance does not match the approved perspective render.

The opening plate and arrival transition are also generated from this master so visitors never watch placeholder geometry become photographic geometry. Static and transition assets use the same camera endpoints, grade, color management, and object state.

Live layers are limited to elements that must remain stateful: the hero video, contact reveal progression, and input hit mapping. Each live layer uses authored projection data from the same render camera so it cannot drift across the plate.

## Logo

Remove `LogoProof` and its added mesh entirely. Apply the letterpress logo texture to the existing rightmost propped test-print card, the card directly left of the rejected position. The card keeps its existing dimensions, lean, shadows, paper stock, and contact with the wall/desk. The master render and any real-time diagnostic fallback use that same existing object and material assignment.

## Physical Navigation

Use one believable working production sheet, angled and slightly inclined toward the visitor rather than lying visually flat. Its marks are graphite, not Sharpie or marker: quick uppercase block lettering by a working creative, with minor pressure and baseline variation but no novelty handwriting font.

The four destinations form one vertical production list in this exact order:

1. FILMS
2. JOURNAL
3. CONTACT
4. ABOUT

Each destination occupies a separate full-width row with generous vertical spacing. The visual sheet and its hit map share one authored coordinate system. Selection uses four disjoint rectangular row regions derived from the sheet plane, not overlapping world-space spheres. Empty margins select nothing. No hover animation, glow, floating label, or room response is added.

## Camera Choreography

Every move uses the existing human vocabulary and begins from the actual current pose.

- **FILMS:** a restrained attention adjustment toward the hero/work, with no unnecessary body travel.
- **JOURNAL:** the head drops first, then the upper body follows forward and down. The endpoint makes the notebook the subject, approximately half the frame, without changing focal length or behaving like a zoom.
- **CONTACT:** no right turn toward the charger. The visitor remains in the desk composition while attention lowers toward the existing paper surface within the lamp's reach.
- **ABOUT:** the head and upper body turn left toward the shelf and accumulated room history.

Return transitions reverse the physical path and restore the exact settled desk pose. Switching destinations proceeds through the settled pose unless a directly authored human transition exists; no camera teleports between endpoints.

## CONTACT Material Reveal

Contact information exists as pressure indentation in an existing paper surface on the desk. It is not visible text with zero opacity. The material includes authored height/normal information so the letters become legible only when the lamp's raking light reaches them.

On CONTACT selection:

1. the camera lowers attention within the standard desk composition;
2. the current lamp visibly turns on without changing physical position or orientation;
3. raking light travels across the paper;
4. the indented contact information emerges from highlight and shadow;
5. the light and indentation remain while CONTACT is active.

Closing CONTACT reverses the light contribution and camera posture. No standalone `CONTACT` caption or email plane is rendered anywhere.

## Hero Video Lifecycle

The hero video state is independent of camera and navigation state.

1. Preload during arrival without playing.
2. Wait for the final settled desk signal.
3. Start at `currentTime = 0` on the approved post-settle beat.
4. Play muted and inline with looping disabled.
5. Continue monotonically while FILMS, JOURNAL, CONTACT, ABOUT, return transitions, or idle desk view are active.
6. On `ended`, pause on the final decoded frame and retain it for the rest of the page visit.
7. Never restart because a destination opens, closes, or changes.
8. A full page reload defines a new visit and permits one new playback.

If playback is not ready at the intended beat, retain the authored first frame and begin once ready; never begin before settle and never expose browser error UI. If playback fails, the first frame remains as the quiet fallback.

## Loading And Failure Behavior

- Load the opening visual first so the first visitor-visible state is photographic.
- Preload the settled asset during arrival.
- Preload destination endpoints and transitions after the critical settle asset, during hero playback.
- Until a requested destination asset is ready, retain the current photographic state; never substitute primitive geometry.
- Asset failure leaves the last coherent photographic state in place and produces no loading card, spinner, or error chrome.
- Mobile receives its own authored portrait framing from the same scene, never the primitive fallback.

## Verification

Completion requires behavioral and visual evidence:

- A red/green navigation-boundary test proves every row center maps correctly, margins map to nothing, and no screen point maps to multiple destinations.
- A hero lifecycle test proves playback starts only after settle, advances continuously through a destination change, fires once, reaches `ended`, holds the final frame, and does not restart on return.
- Camera-state tests prove JOURNAL reaches its authored close-reading endpoint, CONTACT never uses the old right-facing charger pose, and ABOUT reaches the left-history endpoint.
- CONTACT visual evidence proves letter legibility changes with raking-light/material response rather than plane opacity.
- Desktop `1280x720` and phone `375x812` captures cover rest, FILMS, JOURNAL, CONTACT, and ABOUT.
- A review film shows arrival, settle, one-shot hero playback, navigation during playback, final-frame hold, every destination, and return to desk.
- Build, 4s/5s/6s clock, frame-rate, and transfer-budget gates remain green.
- The original rejection list receives an enumerated closing audit. Structural-only verification is marked partial, never complete.

## Out Of Scope

- Replacing placeholder company footage or copy.
- Final contact information authorship beyond the approved placeholder needed to prove the material reveal.
- Domain migration to `www.lazyaproductions.com`.
- Unrelated room dressing or content changes.
