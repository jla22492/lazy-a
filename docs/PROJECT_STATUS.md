# PROJECT STATUS

## Current Version

v0.1

---

## Current Sprint

Creative Sprint 01 — Dress the Room (begun at the Creative Reset, docs/ORIENTATION.md; exactly 10 implementation work orders 0036–0045, then a Creative Sprint Review and a full stop for Jonathan's review. Prior phases: Architecture locked at 0014, Presence closed at 0015, Behavior closed at the Creative Reset with the notebook pipeline archived as completed research.)

---

## Current Work Order

WORK ORDER 0039 — Dress the Peripheral Room (Sprint 01, order 4 of 10)

---

## Completed

- Repository initialized and connected to GitHub
- Next.js (App Router) configured with strict TypeScript, Tailwind, ESLint, Prettier
- React Three Fiber, Drei, GSAP, and Leva installed
- Folder structure established (components/, three/, public/, WORK_ORDERS/)
- Base scene created: full-viewport canvas, perspective camera, ambient + directional light, neutral floor plane, neutral gray background
- CameraRig created, exposing sit() / lean() / stand() / turn()
- CLAUDE.md replaced with the permanent implementation operating manual
- Source-of-truth documents moved into `docs/`
- World coordinate convention established: origin (0,0,0) is the exact center of the future workbench; camera position defined relative to it
- Workbench blockout built from primitives (tabletop + four legs), centered on the world origin, standing on the floor
- Camera reframed: standing eye height, a few meters back, gaze resting on the work surface
- Root CLAUDE.md restored as a pointer to docs/CLAUDE.md
- Operating manual updated: persistent context model, Decisions Required rule, changelog scope (experience milestones only), real-world measurement guidance
- Minimum believable room validated: rear wall + left wall (matte off-white plaster) and warm neutral floor; right wall and ceiling intentionally absent
- Daylight established: one sun entering from outside the right of frame (soft shadows), one subtle bounce fill; placeholder lighting removed
- Progress-screenshot convention started: docs/progress/NNNN.png per Work Order, saved via a dev-only API route (self-capture with ?shot=<filename>)
- Five camera studies produced (docs/progress/0006-A…E.png); any study previewable live with ?study=<id>
- Opening composition refined (docs/progress/0007.png): Study C's subtle three-quarter angle with Study E's longer lens; now the default camera
- Opening composition revised per Creative Director review (docs/progress/R-0007.png): viewer repositioned slightly left of the workbench; supersedes 0007 as the current candidate
- Ceiling plane added at wall height over the walls' footprint, completing the enclosure; invisible from the locked opening composition (docs/progress/0008.png is pixel-identical to R-0007.png by design)
- Notebook blockout placed (docs/progress/0009.png): closed A5 primitive, right of the bench's center, casually askew — the first object with narrative weight
- Studio built (/studio + /studio/state.json): internal production board derived live from PROJECT_STATUS.md, BUILD_REPORT.md, docs/progress/, and git; docs/BUILD_REPORT.md becomes the canonical home of each order's Build Report
- Studio published to GitHub Pages (https://jla22492.github.io/lazy-a/studio/), rebuilt by CI on every push — the Creative Director's canonical review surface per the confirmed hybrid workflow (public Studio for state, in-chat images for visual review)
- Workbench language established (three/scene/workspace.ts): four named zones — reference (rear band), resting (front-left), active (front-center), temporary (front-right) — assuming a right-handed worker at the open side; future bench objects are placed by naming a zone; dev-only overlay via ?zones=1; notebook placement confirmed by the language (active zone, dominant-hand edge) and unmoved
- Hero print experiment run and reversed (docs/progress/0011.png → R-0011.png): a leaning print on the bench became the compositional subject, violating "nothing should feel staged"; removed per Creative Director review. Conclusion: the hero print belongs to the room (permanent), not the workbench (today's work) — its future home is the wall architecture
- Permanent architecture completed (docs/progress/0012.png): right wall closing the room at x=+2.2 with a frosted window opening (sill 0.9m, head 2.0m — the implied daylight source, no exterior view), and 9cm baseboards on all three walls; the doorway was deliberately not built (implied entrance sits behind the locked camera — building it now would be overbuilding)
- Window established as the daylight's architectural source (docs/progress/0013.png): unlit frosted pane (the glass is the light — a lit material renders dark on the backlit wall), 10cm reveal with sill/head/jamb returns
- Window presence reduced per creative review (docs/progress/R-0013.png): the opening slid 30cm forward along the wall so only a ~9cm glass sliver enters the locked frame's corner — daylight explained, window subconscious; opening composition reaffirmed as locked against the corrected true-proportion frame
- Entrance established (docs/progress/0014.png + 0014-entrance-view.png): doorway opening in the left wall behind the camera (0.9m x 2.05m, 10cm reveal, baseboard breaking at the frame) — where the visitor who "stopped slightly left of the workbench" came in; entirely outside the locked frame (0014.png is byte-identical to R-0013.png)
- ARCHITECTURE PHASE COMPLETE (declared by the Creative Director at 0014 review); PRESENCE PHASE begins
- Stillness established (docs/progress/0015.png): AgX tone mapping (calmer, more photographic response than ACES) and a soft PCF shadow penumbra (VSM rejected — its receivers-also-cast rule made walls throw uncontrollable shadows); nothing moved, nothing added — the room simply settles
- Room clock established (three/animation/roomClock.ts + RoomClockDriver + useRoomClock): the room's single heartbeat — elapsed/delta plus a 5s breath phase (calm resting-human tempo) and a 90s ambient drift phase; advanced once per frame before all other callbacks; all future behaviors derive from it (0016.png byte-identical to 0015.png)
- Presence system established (three/animation/presence.ts + useRoomBehavior): the room's behavioral registry — future behaviors (ambient / camera / environment / impossible) register with the room and are ticked in deterministic order by the same driver that advances the clock; registration is decoupled from enablement; nothing is registered yet (0017.png byte-identical to 0016.png)
- Room clock philosophy clarified per Creative Director: the clock represents room time; advancing with the render loop is a Version 1 implementation detail, not a design law
- The first breath (docs/progress/0018.mp4): the room's first living behavior — daylight intensity sways imperceptibly (±2% on the 90s drift phase, ±0.6% on the 5s breath phase), registered with the Presence system as "daylight-breath"; the room no longer feels frozen, and nothing can be pointed at
- Motion-review pipeline established: ?record=NNNN.mp4&seconds=N records the canvas at normal speed; captures run in a dedicated headless Chrome (SwiftShader renders identically) because visible-browser capture throttles when occluded
- Daylight sway approved as Version 1 of environmental presence; per creative review, future behaviors read as SETTLING (a physical space) rather than breathing (an organism)
- Visitor positions established (three/scene/workspace.ts STANDING_POSITIONS): arrival (the locked opening composition's own footprint — camera and story share one origin), working (hips ~25cm from the bench edge, centered on the active zone), considering (~1.7m back from the reference wall); every future camera movement originates from these (0019.png visually identical to 0018)
- The first step implemented (docs/progress/0020.mp4): the visitor walks from ARRIVAL to WORKING — casual indoor pace (1.15 m/s over 3.8m ≈ 3.3s), smoothed human acceleration/deceleration, faint step-rhythm eye bob that fades at both ends, gaze easing from the room onto the work surface as the body settles; a Presence behavior ("person-step") driven by the room clock; TEMPORARY trigger (click or Space, plus dev-only ?autostep for capture) — no permanent interaction model yet
- Settling implemented (docs/progress/0021.mp4): the body finishes arriving — momentum carries the center of mass ~12mm past the stop, then a damped sway (1.4Hz, ~1% by 1.3s) brings it to rest, with a 6mm knee-soften dip and the head arriving a beat after the body; occurs exactly once, then complete stillness — no idle loop
- The first look implemented (docs/progress/0022.mp4): head movement while standing at WORKING — a neck, not a camera rig: comfortable human range (±55° yaw, +20/−35° pitch) with tanh soft limits, ~150ms critically-damped pursuit, no recentering (attention stays where the visitor leaves it); the settled gaze is the neck's neutral; body rooted, orientation only; TEMPORARY controls (drag or arrow keys, dev-only ?autolook for capture)
- Attention system established (three/animation/attention.ts + AttentionSensor + useAttentionTarget): the room can notice which meaningful object the visitor is observing — gaze-cone detection sized to each object's physical radius, dwell that accumulates and decays (attention lingers), sustained-gaze threshold (0.8s) with hysteresis so glances never count; entirely invisible, no responses; the notebook is the first registered target; verified end-to-end (observed after sustained gaze, released after looking away)
- Readiness system established (three/animation/readiness.ts + useReadinessRule): per-target rules built from a shared condition vocabulary (observed / standing-at-position / not-moving, extensible for future context); visitorState upgraded to a body model (position + moving); future interactions ask one question — isReady(target); the notebook's rule requires standing at WORKING + still + observing; verified live through the full journey (not ready at arrival or mid-walk or at neutral gaze; ready only while observing at the bench; releases on look-away)
- Intent system established (three/animation/intent.ts + IntentSensor): the final decision layer — commitment can only begin on a ready target, must be held 0.35s (a decision, not a twitch), cancels if readiness breaks mid-hold, and the resulting intent is consumed exactly once with a 0.5s expiry; no input bound yet; verified live (not-ready commits refused, twitches die, held commits mature, single consumption, mid-hold readiness break cancels) — accidental interaction is structurally impossible
- Acceptance system established (three/animation/acceptance.ts + useAcceptancePolicy): the room's half of the conversation — requestInteraction(target) consumes intent and the room answers (accepted / declined-no-intent / declined-by-room); an answered offer is spent even when declined; per-target acceptance policies carry the room's future context; the notebook's policy currently always accepts; verified live (offers without intent decline, earned offers accept, spent offers decline) — the interaction grammar is complete: observe → ready → intend → offer → the room answers
- Capture fidelity fixed: progress shots 0009–0012 were horizontally stretched ~1.4x by a viewport-aspect bug in the capture pipeline; captures now render in a pinned 1280x720 canvas and preserve aspect, so every future frame is true 16:9
- The Voice of the Notebook prepared (docs/THE_NOTEBOOK.md — documentation only, no visitor-facing changes): implementation paused at the CD's first true design summit; the document defines every authorship question that must be answered before the implementation of meaning begins — identity, time, audience and privacy, awareness, completeness, uniformity of hand, ownership, form of content, the first page, reading as interaction, impossibility, and memory — each mapped to the implementation domains it gates (typography, layout, page turns, acceptance policies, impossible moments, persistence); it deliberately answers none of them
- Seeing implemented (docs/progress/0034.mp4): vision arrives before meaning — a beat after the cover comes to rest (0.5s), the eyes make one small natural settling (0.9s, the same pursuit physics as every gaze) from where the opening action left them onto the center of the first visible page; not a decision and not comprehension — perception following the physical act; the body and the notebook do not move; the page stays visually quiet; then complete stillness — reading has not begun
- Opening implemented (docs/progress/0033.mp4): the first irreversible act — the notebook gained real construction (page block + back cover, a 3mm front cover hinged at the spine edge under the supporting hand, and a first page of quiet paper that exists physically without becoming the subject); on the visitor's third deliberate commitment the cover rotates around its real hinge to its natural open rest just past vertical (2.0 rad over 1.15s, no hesitation, no flourish), while the supporting hand answers — part of the grip roll releases and the book settles 4mm as the cover's weight leaves the block; the closed notebook's silhouette is unchanged from every prior order; contents remain emotionally unrevealed; then complete stillness — reading has not begun
- Finding the cover implemented (docs/progress/0032.mp4): the visitor's second deliberate decision, made through the full grammar — the notebook's attention center now travels with the notebook (the 0031 dormant note, fixed the moment it became meaningful), so observing what you hold matures readiness; a second held commitment offers, the room accepts, and the hands prepare: weight shifts to the supporting hand, the book settles into the palm, and the opening edge rolls up toward the dominant thumb (one 0.7s motion after a 0.15s onset); the cover never separates, the gaze never moves, then true stillness; preparation is reversible — opening is not
- Waiting audited and confirmed (no new media — the visitor experience is unchanged by design): the end state supports indefinite stillness — the pickup behavior parks itself after the look down, every input is inert by guard (nothing fires accidentally, nothing fires on a timer), and the only motion is the room's own sub-perceptual daylight breath; verified by a soak test (held-state frames at 20s and 85s are identical apart from the daylight sway); nothing begins because time passes — everything begins because the visitor chooses; the introduction is complete
- The first look down implemented (docs/progress/0030.mp4): the mind's relationship with the notebook begins — after the hands finish and stillness genuinely returns (1.4s), the eyes make one natural transition (1.1s, the same pursuit physics as every gaze) from the room down to the held notebook, landing a hair above its center; recognition, not curiosity — the body unchanged, the hands settled, the notebook now the considered subject in the frame; then complete stillness; nothing opens, nothing revealed
- Orienting implemented (docs/progress/0029.mp4): the physical relationship with the notebook completes — a beat after the weight settles (0.9s), the hands make one unconscious adjustment (0.9s): the notebook turns nearly square, tips a little further toward the reader, and the grip shifts subtly centered and up; habit, not animation — it occurs once, completes naturally, and true stillness returns; the eyes stay on the room throughout (hands understand before eyes read); the notebook remains closed, genuinely ready to be opened
- Holding refined as its own experience (docs/progress/0028.mp4): the held state rebalanced from "presented" to "held" — the notebook rests low in both hands near the waist (0.33m below the eyes, 0.48m ahead), biased 9cm toward the dominant hand and a few degrees askew, its tilt eased; the arms visibly accept the weight as the lift completes (one damped ~11mm dip, then true stillness); the settled regard drops to the work surface so the bench and wall hold the frame with the notebook in the lower third — the room remains present, neither dominates; capture pipeline gained deferred recording (?shotdelay now applies to ?record) so films can open mid-journey
- The first interaction implemented (docs/progress/0027.mp4): the notebook is picked up exactly as a person would — the full grammar culminates (observed → ready → held commitment → offer → the room accepts) and then the body performs the action: a slight bend forward and down to reach (0.55s), a beat while the hand closes (0.2s), then the lift (0.95s) as the body straightens and the notebook rises — clearing the surface vertically first, arcing to a two-handed chest-height hold, tilting toward the reader; the eyes stay on the object through the grasp and rise to a settled regard as it arrives; the head then holds still (visitorState.holding freezes free-look until held-state looking is directed); nothing opens, nothing else changes; TEMPORARY commitment gesture is press-and-hold (dev-only ?autopickup for capture)

- CREATIVE RESET (docs/ORIENTATION.md): the Creative Director's orientation update is now the project's creative constitution — Lazy A is a company website where the company is expressed through a living environment that quietly refuses to behave exactly how you expect; the notebook interaction pipeline (0027–0034) is archived as completed research into interaction language (preserved, valid, no longer the roadmap); the implementation role becomes Production Designer / Art Director / Experience Engineer; the room is dressed in four storytelling zones (workbench, reference wall, peripheral room, edge of frame); texture becomes a first-class design discipline; surprise is built perceptual → behavioral → narrative, in that order
- Set-dressing framework established (three/scene/setDressing.ts): the four room storytelling zones as code, the SetPiece contract (every object declares its zone, its story — the human trace that explains it — and what it says about Lazy A: "everything earns its place twice"), and the dressing manifest as the single authored record of what the room contains; the existing workbench and notebook are the manifest's first entries; no visitor-facing change (0036 renders identically to 0035)

- Workbench dressed, blockout pass (docs/progress/0037.png): Zone 1 now tells today's story in primitives and flat color — three test prints propped against the rear wall at their own angles (put up one at a time, never a panel), reference books pulled and not reshelved, the pencil jar with residents leaning at their own angles, a tape roll where it landed, the mug that went cold, headphones set down open, a pencil put down mid-thought beside the notebook, today's working papers shuffled under the notebook's edge, two film canisters (one fallen, unminded), and the camera set down lens-toward-the-wall; every piece placed by the bench's zone language with a manifest entry declaring its story and identity; nothing centered, nothing aligned, nothing beautiful yet

- 0037 amended per Creative Director review: the manifest gained a required question — "why hasn't this been put away?" (rooms feel lived in because things are temporarily unresolved, not because they're messy) — answered for every piece; and the pencil moved from beside the notebook to resting across its cover, because someone stopped writing halfway through a thought (the relationship tells the story, not the prop)
- Reference wall dressed, blockout pass (docs/progress/0038.png): Zone 2 now tells who Lazy A is — the hero print's future home (large, unframed, a hair off level, off-center right where it can be judged from the bench; its content deliberately unauthored), a cluster of photographs and notes pinned one at a time over years (overlapping because no one takes the older ones down first), a picture ledge where things lean while they matter (a framed still, an unframed print overlapping its corner, and a small award turned mostly away — recognition happened, it is not performed), and three sticky notes low on the wall where a hand actually reaches it; nothing centered, nothing level

- Peripheral room dressed, blockout pass (docs/progress/0039.png): Zone 3 now tells how Lazy A lives — the chair pulled back from the bench and turned seventeen degrees away (someone stood up quickly; it never got pushed back in), the working library against the rear wall below the picture ledge (leaning spines, a flat pile where returns get dropped, back open to the plaster, standing off the wall by the baseboard's depth as real furniture must), a mounted print leaning against the bookcase's front at floor level (finished work waiting its turn), the one living plant squeezed into the corner beside the library, and a single sheet on the floor that slid off the bench and hasn't been picked up; the bookcase was first authored on the left wall and moved to the rear wall when the locked frame proved the left wall lives entirely outside the composition

---

## In Progress

Creative Sprint 01 — Dress the Room (work orders 0036–0045).

---

## Next Recommended Work Order

WORK ORDER 0040 — Dress the Edge of Frame (the world continues beyond the browser), then the sprint's first production design review with the Creative Director.

docs/THE_NOTEBOOK.md (the authorship questions) remains open with the Creative Director and Jonathan; it gates future meaning work on the notebook, which is paused for this sprint.

---

## Known Issues

- CameraRig verbs are intentionally empty declarations; their movement behavior is not yet defined.
- Dev-server hot reload does not re-apply Canvas camera props; reload the page after editing camera constants.
- The right wall now closes the room where the frame's upper-right rays land, resolving the old void exposure; the leftward camera limit note (x ≈ −0.55) is retained for history but no longer binding.
- The ceiling underside is bounce-lit only (no direct sun, physically correct) and reads very dark if ever seen; acceptable while it stays out of frame, revisit when a lighting or camera-movement order exposes it.
- GSAP and Leva are installed but unused until animation and debug work begins.
- Dev mode occasionally logs a hydration-mismatch warning (`isolation: isolate` on body) and counts it as "1 issue" in the Next dev badge. It is injected by Next's own dev-tools overlay, is intermittent, and cannot occur in production builds; no app code is involved (we are on the latest Next).
- The archived notebook pickup interaction (0027, temporary press-and-hold gesture) still functions; since 0037 the pencil rests across the notebook's cover, so triggering the pickup leaves the pencil floating. Flagged for creative direction rather than silently changed — the pipeline is completed research and its gesture will be re-evaluated when interaction work resumes.

---

## Creative Locks

🔒 Camera API uses human verbs only (sit, lean, stand, turn).
🔒 Camera starts at human eye height.
🔒 The world origin (0,0,0) is the exact center of the workbench — permanent.
🔒 The workbench is the room's center of gravity; blockout uses primitive geometry and flat neutral color only.
🔒 The camera's gaze rests on the work surface, not the horizon.
🔒 The opening view is a person who took two quiet steps in and stopped slightly left of the workbench: subtle three-quarter angle, normal lens (fov 35), eye height. (R-0007 — approved by the Creative Director)
🟡 The notebook lives on the workbench, off-center and askew — used daily, never displayed. (Placement in review until additional objects exist.)
🔒 The room is a complete permanent shell: rear wall, left wall with the entrance doorway behind the camera, right wall with a frosted window (the implied light source, never a view), ceiling, baseboards. Identity enters in layers: architecture → permanent identity → active workspace → impossible moments.
🔒 The room's history is told by light before it is told by objects.
🔒 Architecture Phase — locked. The permanent shell does not change without a Revision Work Order.
🔒 The room has one heartbeat: every time-based behavior derives from the room clock, never from isolated timers.
🔒 The room exists whether or not it is being observed; the visitor arrives in the middle of its life. Implementation may approximate this, but the experience must never imply otherwise.
🔒 The room settles; it does not breathe. Behaviors read as a physical space relaxing with the day, never as an organism — the room is a place where life has accumulated, not a creature.
🔒 The camera inherits human behavior. It never becomes a human character. (Supersedes "The camera never travels; a person moves" at the Creative Reset — settling, leaning, turning, and re-aligning remain the camera's vocabulary; body ownership does not.)
🔒 Attention follows the visitor. The room never forces the visitor's gaze.
🔒 Observation always precedes interaction.
🔒 Observation enables readiness. Readiness enables interaction. Interaction never happens directly from gaze — there is always an intermediate state.
🔒 Readiness permits. Intent commits. Every meaningful interaction passes through deliberate commitment; the visitor never accidentally interacts with the room.
🔒 The visitor offers. The room accepts. Interactions never execute because intent exists — the room always makes the final decision.
🔒 Daylight is unremarkable by design: source outside the frame, never revealed; no mood, no drama.
🔒 The workbench tells what is happening today; the room tells who the person is. Identity objects belong to the room's architecture, not the desk.
🔒 The body performs the action. Objects never fly toward the camera; the camera never becomes an interface. (First upheld by the notebook pickup, 0027.)
🔒 Holding is its own experience. A pause is meaning, not latency — the held state is a destination, never a transition to the next animation.
🔒 Held things sit off-axis; presented things sit centered. Anything naturally held by a person inherits this. (Named at the 0028 review.)
🔒 Hands understand before eyes read. The body completes its relationship with an object before the mind begins asking what is inside it.
🔒 The eyes grant meaning. An object becomes significant the moment it is deliberately looked at — attention is the experience's unit of meaning.
🔒 The experience waits for the visitor. Never the other way around: nothing begins because time passes; everything begins because the visitor chooses.
🔒 The body prepares before it commits. Every irreversible act is preceded by a reversible, unconscious preparation.
🔒 Opening changes the relationship. Not because the notebook changes — because the visitor does. Crossing a boundary is quietly irreversible, never dramatic.
🔒 Seeing precedes understanding. The notebook becomes visible before it becomes meaningful — vision and comprehension are separate events, as body and mind are.
🔒 Meaning precedes mechanics. The notebook's voice is authored before its behaviors are engineered — creative answers gate implementation, never the reverse.
🔒 The constitution (docs/ORIENTATION.md): Lazy A is a company website where the company itself is expressed through a living environment that quietly refuses to behave exactly how you expect. Not a game, not a film, not an interactive experience. Every decision reinforces this.
🔒 The visitor inhabits a perspective, never a character. Human presence is implied, never depicted — no hands, no arms, no body, no avatar, ever.
🔒 Unexpectedness outranks realism. Realism exists only to make the unexpected believable; when the two conflict, protect the unexpected.
🔒 The website comes first. Recognition, then curiosity, then discovery — atmosphere never delays understanding, wonder never delays communication.
🔒 Everything earns its place twice. First by belonging in the room, second by saying something about Lazy A; failing either, it is removed.
🔒 Texture is emotion. Every material decision answers "what does this surface feel like," never merely "what color is it."
🔒 Surprise is built in order: perceptual, then behavioral, then narrative — never skipping ahead.
🔒 The notebook interaction pipeline (0027–0034) is completed research into interaction language: preserved and valid, never the roadmap. The workbench, not the notebook, is the center of the experience.
