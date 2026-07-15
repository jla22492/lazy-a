# Work Order 0117-R3 Production-Quality Rebuild Design

## Status

Approved by Jonathan on 2026-07-15. This revision supersedes the 0117-R2
review-candidate claim. The implementation is not accepted until Jonathan has
reviewed the final desktop, tall-desktop, tablet, and phone journeys in motion.

## Objective

Restore the room's physical credibility. Every photographed object must belong
to one coherent master, every camera move must feel like a seated person, and
the hero must remain a shaded physical poster before, during, and after its
single playback. Automated coordinate checks support this objective; they do
not replace full-frame visual judgment.

## Confirmed Root Causes

1. The encyclopedia scan is explicitly placed on the desk instead of the left
   bookcase.
2. The lamp's authored bounds cross the desk's left edge. Its CONTACT spotlight
   is separately positioned near desk height instead of at the visible shade.
3. The photographic camera has no replacement contract, leaving the older
   rendered camera meshes visible beneath it.
4. The blanket cloth simulation fell through the chair to approximately
   `z=-2.23m`.
5. The plant and basketball are authored to separate left/front floor zones,
   not the requested right-corner vignette.
6. The frame occupies the crowded lamp/books area and is rotated almost
   side-on rather than toward the desk center.
7. The ceiling pendant meshes remain in the photographic master.
8. The hero is a raw, tone-mapping-disabled video on an affine screen quad. It
   appears after media readiness rather than at the magic beat, has no baked
   paper/light/shadow treatment, and uses a 256px RLE foreground mask.
9. The source plates are only `1280x720` and `375x812`; tall and high-density
   screens enlarge them enough to expose logo, paper, tape, pencil, and mask
   pixelation.
10. FILMS changes the portrait camera position. JOURNAL lowers the eye from
    `1.60m` to about `1.06m` and pushes it almost onto the desk.
11. The current master verification accepts nominal dimensions and contacts
    even when the final composition reads as a toy, a floating object, or a
    duplicate.

## Master-Scene Design

### Left Continuation

Preserve the approved ABOUT camera. Extend the rear wall, floor, ceiling, rear
baseboard, and wall history at least two metres leftward. Relocate the physical
left boundary and doorway beyond every ABOUT frustum so no left corner is
visible. The room must appear to continue outside the browser rather than end
at the pan.

Import Jonathan's supplied `leather_armchair_coffee_table_floorlamp.zip` as one
durable credited master asset. Scale the set from a `1.65m` floor lamp, which
keeps the armchair near `1.08m` high and the coffee table near ordinary table
height. Rotate the group so the chair and table open toward screen-left. In the
settled view only the back-right quarter of the leather chair may interrupt the
left frame edge. ABOUT may reveal part of the coffee table and floor lamp, but
must still withhold the room's left boundary.

### Existing Objects

- Move the twenty-book encyclopedia scan into the bookcase's middle bay with
  every book resting on the `0.44m` shelf. It must not intersect the shelf or
  remain on the desk.
- Put the gold frame in the books' former desk zone. Keep its base on the oak,
  turn its picture face toward the desk center, and retain a recognisable
  three-quarter presentation.
- Move the green desk lamp fully onto the left side of the desk. Its base,
  joints, shade, bulb, and cast-light origin must form one physical assembly.
- Hide the complete older rendered camera object when the photographic camera
  is present. One camera and one strap remain.
- Rebuild the chair blanket as an authored pinned drape with positive world
  height and visible folds over the chair back; do not rely on an unconstrained
  free-fall simulation.
- Move the peace lily to the rear-right floor corner. Put the basketball
  directly in front of it at a regulation `0.239m` diameter, with a readable
  plant/ball scale relationship.
- Remove the ceiling pendant's cord, socket, and bulb.
- Preserve the supplied headphones, mug, trash can, office chair, navigation
  sheet, notebook, charger, and existing logo card unless a collision correction
  is required by the approved composition.

### Raster Fidelity

Use the original `2000x1588` letterpress source to rebuild a high-resolution
logo-card texture without generative alteration. Preserve the exact logo and
paper tone. Render wide media at `2560x1440` and portrait media at `750x1624`.
Use high-quality texture filtering and enough encode bitrate that stationary
paper edges, tape, pencils, logo lines, and object silhouettes remain clean in
motion and on high-density displays.

## CONTACT Design

CONTACT remains three exact lines:

```text
Jonathan Adelson
JonathanAdelson1@gmail.com
1-310-709-9283
```

The letters are recessed into the existing paper. Groove faces use the paper's
own material response; no brown ink, opacity text, colored fill, or standalone
text plane is permitted. The indentation is latent at rest.

The visible bulb and photometric source originate inside the imported lamp
shade. On CONTACT, the bulb warms and the same source casts a soft raking pool
across the paper. The moving light reveals the recessed sidewalls and floor.
The pool must visibly connect to the shade direction and must not appear from
empty space.

## Hero Design

The first frame of the supplied hero media is part of the Blender poster
material in every opening, desk, destination, and transition plate. Before the
magic beat the visitor sees a shaded, slightly imperfect physical print with
the room's saturation, paper response, window pattern, and cast shadow.

The live hero layer stays invisible while loading and until playback actually
begins. Its first visible frame must be pixel-continuous with the baked first
frame. It starts once after desk settle, continues uninterrupted through all
destinations, ends once, and retains its last treated frame until reload.

Replace affine `w=1` interpolation with perspective-correct mapping. Export the
per-corner camera-space depth or equivalent projective coefficients from the
same Blender camera samples used by the plate. Apply the master-derived poster
light/shadow treatment under AgX rather than displaying raw sRGB video.

Retire the 256px foreground RLE mask. Use a full-resolution authored matte from
the same Blender frame, or compose the foreground so no object requires a
low-resolution silhouette. Pencil, pencil holder, camera, tape, and paper edges
must stay photographic and stable throughout arrival and navigation.

## Camera Design

- Arrival retains the approved opening and exact final desk camera, completing
  inside four seconds. The poster is present and physical from frame one.
- FILMS keeps the desk camera position and focal length for both profiles. Only
  the head turns toward the poster.
- JOURNAL begins with a downward head turn, then hinges the seated torso
  forward. The eye remains above approximately `1.32m`, advances toward the
  notebook, and rotates down around that forward movement. It must read as a
  person leaning over work, never as a camera descending to desk height.
- CONTACT may lean enough to read the paper but must retain a plausible seated
  eye and preserve the visual connection between lamp and light pool.
- ABOUT keeps its approved pan and receives no compensating camera change. The
  rebuilt left room must support that view.

## Verification And Acceptance

### Automated Gates

The implementation must fail verification when replaced with structural stubs.
Required behavioral evidence includes:

- one tracked asset root per supplied object, no duplicate camera or lamp;
- exact shelf, desk, floor, and chair support surfaces;
- positive blanket bounds and regulation basketball diameter;
- seating-set scale, orientation, and bounded default-frame visibility;
- pendant absence and left boundary outside every ABOUT frustum;
- geometry-only CONTACT copy and a light ray originating inside the lamp shade;
- FILMS position equality with desk and JOURNAL eye-height/forward-hinge bounds;
- first-frame hero continuity, perspective-correct mapping, stable poster-axis
  registration, full-resolution matte behavior, one-shot playback, and hold;
- source dimensions, media sharpness, build, timing, dwell, and performance.

### Visual Gates

Capture normal-speed desktop `1280x720`, tall desktop `1316x1329`, tablet
`768x1024`, and phone `375x812` journeys. Inspect the entire frame at opening,
desk, FILMS, JOURNAL, CONTACT, ABOUT, return-to-desk, hero start, and hero hold.

The reviewer must answer yes to all of the following before this order becomes
a review candidate:

1. Does the opening feel like a person's POV entering a real production room?
2. Does every object look supported, proportionate, singular, and naturally
   used rather than placed for the camera?
3. Does the room continue beyond the left frame in both desk and ABOUT views?
4. Does the poster remain one shaded physical object through all motion?
5. Does JOURNAL feel like a seated forward lean and downward look?
6. Does CONTACT look like lamp-revealed indentation rather than printed text?
7. Would a successful production company accept the full live experience as
   its public homepage?

Jonathan's explicit visual approval remains the final completion gate.
