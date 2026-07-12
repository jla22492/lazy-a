/**
 * The set-dressing framework (WORK ORDER 0036) — the production-design
 * language of the room, established at the Creative Reset
 * (docs/ORIENTATION.md).
 *
 * The room is dressed the way a production designer dresses a set: every
 * object is authored into one of four storytelling zones, and every object
 * must earn its place twice — first by belonging in the room, second by
 * saying something about Lazy A. An object that satisfies only one of
 * those criteria does not belong.
 *
 * This file is the single authored record of what the room contains and
 * why. Dressing components implement manifest entries; they never invent
 * objects the manifest does not name. Implementation guide only — never
 * part of the visitor experience.
 */

/**
 * The four storytelling zones (docs/ORIENTATION.md). These are ROOM zones —
 * distinct from the workbench's own work zones (workspace.ts), which govern
 * where objects sit ON the bench. Zone 1 delegates to that finer language.
 */
export const ROOM_ZONES = {
  /** Zone 1 — today's work, current thinking, the active mind. */
  workbench: {
    tells: "what is happening today",
  },
  /** Zone 2 — identity, history, influences: who Lazy A is. */
  referenceWall: {
    tells: "who Lazy A is",
  },
  /**
   * Zone 3 — chair, plant, shelf, floor: everything that makes the room
   * feel inhabited without asking for attention.
   */
  peripheralRoom: {
    tells: "how Lazy A lives",
  },
  /**
   * Zone 4 — window, doorway, shadows, things barely entering frame: the
   * suggestion that the world continues beyond the browser.
   */
  edgeOfFrame: {
    tells: "that the world continues beyond what is seen",
  },
} as const;

export type RoomZoneName = keyof typeof ROOM_ZONES;

/**
 * One dressed object. The two mandatory justifications ARE the design
 * review: if either cannot be written honestly, the object is removed.
 */
export interface SetPiece {
  /** Stable identifier; matches the implementing component's name. */
  name: string;
  zone: RoomZoneName;
  /**
   * First earning: why this object belongs in THIS room — the human trace
   * that explains it. Written as an interrupted moment, not a decoration
   * ("capped before walking away", "half-finished", "turned away from the
   * desk"), because a creatively lived-in room is a room where someone was
   * just here.
   */
  story: string;
  /** Second earning: what the object says about Lazy A. */
  identity: string;
  /**
   * The Creative Director's required question (0036 review): why hasn't
   * this been put away? Rooms feel lived in because things are temporarily
   * unresolved — not because they're messy. Permanent residents answer
   * with why they LIVE here instead.
   */
  unresolved: string;
  /**
   * The second required question (first production design review): when
   * did this arrive? Rooms are written in layers of time, not layers of
   * objects — the answers across the manifest must span years, not hours.
   * This is also the material system's age input: what arrived years ago
   * wears; what arrived this morning doesn't.
   */
  arrived: string;
  /**
   * The Sprint 02 contract: everything visible implies something
   * invisible. What larger, unseen world does this object prove — the
   * person, the building, the years, the rooms beyond the frame? The
   * browser interrupts a larger world; it does not contain one.
   */
  implies: string;
}

/**
 * The dressing manifest — everything the room currently contains, by
 * authored decision. Sprint 01 work orders append to this list as the
 * zones are dressed; the Edit pass (reviewing "everything earns its place
 * twice") prunes it. Architecture (walls, window, doorway, baseboards,
 * ceiling) is the permanent shell, not dressing, and is not listed.
 */
export const SET_MANIFEST: readonly SetPiece[] = [
  {
    name: "Workbench",
    zone: "workbench",
    story:
      "the room exists around this bench; every mark of use the room " +
      "will ever show accumulates here first",
    identity: "Lazy A works with its hands; the work happens in one place",
    unresolved: "permanent resident: the room grew around it",
    arrived: "years ago — the first thing in the room; everything else arrived around it",
    implies: "the years of work that scarred it, and the trade that demanded it",
  },
  {
    name: "Notebook",
    zone: "workbench",
    story:
      "set down askew within reach of the working edge, closed, mid-life — " +
      "put down, not put away",
    identity:
      "thinking at Lazy A happens on paper before it happens on screen",
    unresolved: "today's thinking isn't finished with it",
    arrived: "months ago as an object; this morning as today's thinking",
    implies: "the thoughts already inside it, and the person who is mid-thought",
  },
  {
    name: "TestPrints",
    zone: "workbench",
    story:
      "three small prints from the current work propped against the wall " +
      "this morning, to be glanced at while working — not straightened since",
    identity: "the work is judged by looking at it, again and again",
    unresolved: "still being judged; taking them down would end the question",
    arrived: "this morning, propped one at a time before the day's work began",
    implies: "the current project they belong to, and the judgment happening around them",
  },
  {
    name: "BookStack",
    zone: "workbench",
    story: "pulled from a shelf for one specific page each, never reshelved",
    identity: "influences are working tools, not trophies",
    unresolved: "each is still holding a page someone means to return to",
    arrived: "pulled over the last few weeks; the bottom one has been there longest",
    implies: "the shelf they came from, and the ideas being consulted",
  },
  {
    name: "PencilJar",
    zone: "workbench",
    story:
      "the bench's one permanent resident; everything in it leans at its " +
      "own angle because it was dropped back in, not arranged",
    identity: "analog tools come first at Lazy A",
    unresolved: "permanent resident: the one thing on the bench that lives here",
    arrived: "years ago; its residents rotate weekly, the jar never moves",
    implies: "a decade of writing tools that have rotated through it",
  },
  {
    name: "TapeRoll",
    zone: "workbench",
    story: "used to prop the test prints an hour ago and left where it landed",
    identity: "things here get pinned, propped, and taped — process is physical",
    unresolved: "a temporary solution that is quietly becoming permanent",
    arrived: "an hour ago, mid-errand",
    implies: "the errand it was carried in for, and the hand that set it down",
  },
  {
    name: "Mug",
    zone: "workbench",
    story: "half-finished and gone cold; its owner got pulled into the work",
    identity: "sessions here run long enough for coffee to go cold",
    unresolved: "the conversation that interrupted it isn't over",
    arrived: "two hours ago, full and hot",
    implies: "a kitchen somewhere beyond the doorway, and the interrupted conversation",
  },
  {
    name: "Headphones",
    zone: "workbench",
    story: "taken off and set down open, the way they land when someone " +
      "needs to hear the room",
    identity: "sound is half the film",
    unresolved: "the next listen is minutes away, not hours",
    arrived: "late yesterday, set down at the end of a listen",
    implies: "the sound work happening here, and the audio setup beyond the frame",
  },
  {
    name: "Pencil",
    zone: "workbench",
    story:
      "resting across the notebook's cover because someone stopped writing " +
      "halfway through a thought",
    identity: "the notebook is written in, daily — the pencil proves it",
    unresolved: "the thought it was writing stopped halfway",
    arrived: "twenty minutes ago, mid-sentence",
    implies: "the sentence that stopped halfway, and the person coming back to finish it",
  },
  {
    name: "LooseSheets",
    zone: "workbench",
    story:
      "today's working papers, shuffled rather than stacked; one edge sits " +
      "under the notebook because the notebook arrived later",
    identity: "planning at Lazy A happens by hand, in layers",
    unresolved: "today's plan is still being reshuffled",
    arrived: "today, page by page as the plan grew",
    implies: "the plan taking shape, and the hours already spent on it today",
  },
  {
    name: "FilmCanisters",
    zone: "workbench",
    story:
      "emptied from a jacket pocket mid-task; one fell over and nobody minded",
    identity: "Lazy A still shoots film — patience is a value",
    unresolved: "waiting to be developed — patience, not neglect",
    arrived: "last weekend, back from a shoot",
    implies: "the shoot last weekend, the lab that will develop them, the world outside",
  },
  {
    name: "Camera",
    zone: "workbench",
    story:
      "set down after checking a frame, lens angled back toward the wall — " +
      "a tool between uses, never a display piece",
    identity: "the instrument of the trade lives on the bench, not a shelf",
    unresolved: "the next frame check could come at any moment",
    arrived: "years ago as a tool; an hour ago on this spot",
    implies: "everything it has photographed, and the frame checked an hour ago",
  },
  {
    name: "HeroPrint",
    zone: "referenceWall",
    story:
      "the studio's current defining image, hung unframed and a hair off " +
      "level where it can be judged from the bench — not where a decorator " +
      "would center it",
    identity:
      "the work itself is the identity; its content is a creative decision " +
      "still to be authored",
    unresolved: "still deciding whether it is finished",
    arrived: "last month — the newest large thing in the room, and still on trial",
    implies: "the work Lazy A makes, and the decision still being made about this one",
  },
  {
    name: "PinnedCluster",
    zone: "referenceWall",
    story:
      "photographs and notes pinned one at a time over years, overlapping " +
      "because moving an older pin is never worth it; one photo hangs " +
      "slipped where its second pin gave — nobody minds; one note curls " +
      "off the wall at its bottom edge; the lone outlier's failed corner " +
      "was re-taped with tape newer than the photo",
    identity: "influences accumulate here; taste is visible history",
    unresolved:
      "each is still influencing; unpinning one is a decision no one has " +
      "made — and re-pinning the slipped one keeps not mattering enough",
    arrived: "one at a time across five years; nothing has ever been taken down",
    implies: "five years of influences, and every image that did NOT survive the pin",
  },
  {
    name: "PictureLedge",
    zone: "referenceWall",
    story:
      "the wall's only furniture: things lean here while they matter — a " +
      "framed still, an unframed print overlapping its corner",
    identity: "work is lived with before it is hung; the wall auditions first",
    unresolved: "everything on it is between temporary and permanent",
    arrived: "years ago; what leans on it changes seasonally",
    implies: "the rotation of work that auditions here season by season",
  },
  {
    name: "Award",
    zone: "referenceWall",
    story:
      "at the ledge's end, turned mostly away — it lives here, but it " +
      "isn't allowed to look at everyone",
    identity: "recognition happened; it is not performed",
    unresolved: "never put away because putting it away would also be a statement",
    arrived: "two years ago, placed once and deliberately never adjusted",
    implies: "a night someone dressed up, and the ambivalence about mentioning it",
  },
  {
    name: "StickyNotes",
    zone: "referenceWall",
    story:
      "slapped low on the wall at the eye-line of someone leaning over the " +
      "bench, each at its own angle; there were three this morning — one " +
      "task got done",
    identity: "thinking overflows the desk; the wall catches it",
    unresolved: "each one is a task not yet done",
    arrived: "this week, one per interruption",
    implies: "the tasks of a working week, and the person they nag",
  },
  {
    name: "Chair",
    zone: "peripheralRoom",
    story:
      "a body-width back from the bench, half-turned the way a sitter " +
      "turns when they rise and walk toward the door — interrupted a " +
      "moment ago, not abandoned; the work cloth still lives over its back",
    identity: "someone just stood up; the room is mid-breath",
    unresolved: "its sitter is coming straight back, and the cloth has " +
      "nowhere else to live",
    arrived: "years ago with the bench; pushed back minutes ago",
    implies: "the person who just stood up, and the standing work they prefer",
  },
  {
    name: "Plant",
    zone: "peripheralRoom",
    story:
      "the one living thing in the room, standing in its darkest corner — " +
      "every clump reaches toward the window, harder the higher it grows, " +
      "and one leaf has let go onto the floor; it drinks the light",
    identity:
      "the studio keeps something alive that isn't a project, and it " +
      "belongs to the window, not the composition",
    unresolved: "permanent resident: it belongs to the room, not the work",
    arrived: "three years ago, a gift; the room's oldest living resident",
    implies: "the window's light, the watering can somewhere, three years of mornings",
  },
  {
    name: "Bookcase",
    zone: "peripheralRoom",
    story:
      "the working library that feeds the bench's book stack: leaning " +
      "spines and a flat pile where returns get dropped, back open to the " +
      "plaster like cheap studio shelving",
    identity: "reference is a habit, not a display",
    unresolved: "permanent resident: the gaps in it are the unresolved part",
    arrived: "years ago, second into the room after the bench",
    implies: "a library larger than one case, and years of reading habits",
  },
  {
    name: "NotebookStack",
    zone: "peripheralRoom",
    story:
      "five filled notebooks piled on top of the case, identical to the one " +
      "on the bench — oldest at the bottom, most faded; they always buy " +
      "the same notebook",
    identity:
      "years of thinking, one A5 at a time — the room's quietest biography",
    unresolved: "the sixth is on the bench, half-finished",
    arrived: "one per season, for years",
    implies:
      "everything already written — a mind's archive, closed but kept in " +
      "reach",
  },
  {
    name: "LeaningBoard",
    zone: "peripheralRoom",
    story:
      "a mounted print leaning against the bookcase at floor level — " +
      "finished work that never made it up, or a candidate that never " +
      "made the cut",
    identity: "even finished work waits its turn here",
    unresolved: "hanging it would mean deciding it is done",
    arrived: "six months ago, and still waiting its turn",
    implies: "finished work, and a wall somewhere that hasn't been chosen yet",
  },
  {
    name: "Wastebasket",
    zone: "peripheralRoom",
    story:
      "beside the bench's left end, where a right hand can toss without " +
      "looking; one crumpled ball missed and stayed where it landed — " +
      "the person shoots from the working position and doesn't always score",
    identity: "work here produces rejects, and rejects have a destination",
    unresolved: "the miss will get picked up on the next trip past it, maybe",
    arrived: "years ago; emptied on Fridays, usually",
    implies: "a building with bins, a Friday routine, and every draft " +
      "that didn't survive",
  },
  {
    name: "RolledPencil",
    zone: "peripheralRoom",
    story:
      "it fell, rolled, and stopped where the frame happens to cut it — " +
      "the camera interrupted a room; the room did not arrange itself " +
      "for the camera",
    identity: "the room does not perform; it is caught mid-life",
    unresolved: "nobody knows it's there yet",
    arrived: "sometime today; nobody heard it fall",
    implies: "the floor beyond the frame, where things keep rolling",
  },
  {
    name: "AbandonedHook",
    zone: "edgeOfFrame",
    story:
      "aged brass, high on the rear wall, holding nothing — something " +
      "used to hang from it and nobody remembers what",
    identity: "the room predates its current arrangement",
    unresolved: "taking an empty hook down is a job that will never rank",
    arrived: "before the studio did",
    implies:
      "previous tenants, previous lives of this room, and the thing that " +
      "once hung here",
  },
  {
    name: "Pendant",
    zone: "edgeOfFrame",
    story:
      "a bare bulb on a fabric cord over the bench, off — the cord rises " +
      "past the top of the frame to a ceiling the visitor never sees",
    identity: "the room has nights, and a ceiling, and a landlord's wiring",
    unresolved: "off because the daylight is doing its job; its turn comes",
    arrived: "with the room; the bulb itself, whenever the last one died",
    implies: "the ceiling above the frame, the switch by the door behind " +
      "the camera, and the evenings this room works through",
  },
  {
    name: "Vent",
    zone: "edgeOfFrame",
    story:
      "a return-air grille high on the rear wall, metal a shade duller " +
      "than the outlets, dust drifted onto the paint above it year after " +
      "year",
    identity: "the building breathes through the room; Lazy A is a tenant",
    unresolved: "permanent resident: it belongs to the building, not the studio",
    arrived: "with the building, decades ago",
    implies: "ducts behind the walls, other rooms on the same air, a whole " +
      "building exhaling",
  },
  {
    name: "SmokeDetector",
    zone: "edgeOfFrame",
    story:
      "wall-mounted a hand below the ceiling line, code-required, " +
      "ignored for years",
    identity: "the building insures itself; the room complies",
    unresolved: "its battery will chirp one day, and not today",
    arrived: "at the last inspection, whenever that was",
    implies: "inspectors, regulations, a landlord's clipboard — the " +
      "bureaucracy a creative room lives inside",
  },
  {
    name: "ShippingTubes",
    zone: "edgeOfFrame",
    story:
      "print tubes leaning against the right wall where deliveries get " +
      "parked — half-cut by the frame's edge, never composed for it",
    identity: "work arrives and leaves this room; it has an outside",
    unresolved: "opening them is a task that keeps losing to the current work",
    arrived: "two weeks ago; the fallen one fell the day it arrived",
    implies: "clients, deliveries, a front door, a world that sends and receives",
  },
  {
    name: "WorkCloth",
    zone: "peripheralRoom",
    story:
      "draped over the chair's back mid-errand and never folded — the " +
      "chair became its home, which is half of why the chair never gets " +
      "pushed back in",
    identity: "hands get dirty here; the cloth is used, not displayed",
    unresolved: "it will be needed again long before it is ever folded",
    arrived: "last week, and it keeps not leaving",
    implies: "dirty hands, real work, and a person who wipes and keeps moving",
  },
  {
    name: "Outlets",
    zone: "edgeOfFrame",
    story:
      "two duplex plates low on the walls, one half-hidden by the bookcase " +
      "the way outlets always are — installed when the building was, " +
      "yellowed a shade past the paint",
    identity: "the room is part of a building; Lazy A rents from reality",
    unresolved: "permanent residents: they were here before the studio was",
    arrived: "with the building, decades ago",
    implies: "the wiring in the walls, the meter, the grid, the landlord",
  },
  {
    name: "DeskLamp",
    zone: "workbench",
    story:
      "dark green enamel, two joints, standing at the bench's rear corner — " +
      "off, because the daylight is doing its job, but its head is still " +
      "aimed at the active zone from last night's session",
    identity: "work here continues after dark; the lamp remembers the hour",
    unresolved: "still aimed where last night's work happened",
    arrived: "years ago, secondhand; the enamel was already chipped",
    implies: "the nights this room works through, and a person who adjusts " +
      "it without looking",
  },
  {
    name: "PhoneCharger",
    zone: "workbench",
    story:
      "the block lives in the strip and the cable lies across the bench " +
      "in a lazy S, connector up — and no phone; it left with its owner " +
      "minutes ago",
    identity: "the person is reachable, busy, and nearby",
    unresolved: "waiting for the phone to come back, as it does every hour",
    arrived: "the cable, a year ago; the phone, gone since the person stood up",
    implies:
      "the phone in someone's pocket, the person carrying it, and their " +
      "intention to return",
  },
  {
    name: "PowerRun",
    zone: "edgeOfFrame",
    story:
      "a strip by the right wall and a lazy slack cable running toward the " +
      "bench leg and out of mind",
    identity: "the room works for a living; electricity comes from somewhere",
    unresolved: "cable management is nobody's favorite job",
    arrived: "years ago, the week the bench arrived, and never touched since",
    implies: "the building's wiring, the meter, the grid — the room is real estate",
  },
];

/** The manifest for one zone, for dressing components and reviews. */
export function zonePieces(zone: RoomZoneName): SetPiece[] {
  return SET_MANIFEST.filter((piece) => piece.zone === zone);
}
