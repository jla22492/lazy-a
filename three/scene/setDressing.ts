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
  },
  {
    name: "BookStack",
    zone: "workbench",
    story: "pulled from a shelf for one specific page each, never reshelved",
    identity: "influences are working tools, not trophies",
    unresolved: "each is still holding a page someone means to return to",
    arrived: "pulled over the last few weeks; the bottom one has been there longest",
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
  },
  {
    name: "TapeRoll",
    zone: "workbench",
    story: "used to prop the test prints an hour ago and left where it landed",
    identity: "things here get pinned, propped, and taped — process is physical",
    unresolved: "a temporary solution that is quietly becoming permanent",
    arrived: "an hour ago, mid-errand",
  },
  {
    name: "Mug",
    zone: "workbench",
    story: "half-finished and gone cold; its owner got pulled into the work",
    identity: "sessions here run long enough for coffee to go cold",
    unresolved: "the conversation that interrupted it isn't over",
    arrived: "two hours ago, full and hot",
  },
  {
    name: "Headphones",
    zone: "workbench",
    story: "taken off and set down open, the way they land when someone " +
      "needs to hear the room",
    identity: "sound is half the film",
    unresolved: "the next listen is minutes away, not hours",
    arrived: "late yesterday, set down at the end of a listen",
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
  },
  {
    name: "FilmCanisters",
    zone: "workbench",
    story:
      "emptied from a jacket pocket mid-task; one fell over and nobody minded",
    identity: "Lazy A still shoots film — patience is a value",
    unresolved: "waiting to be developed — patience, not neglect",
    arrived: "last weekend, back from a shoot",
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
  },
  {
    name: "PinnedCluster",
    zone: "referenceWall",
    story:
      "photographs and notes pinned one at a time over years, overlapping " +
      "because no one ever takes the older ones down first",
    identity: "influences accumulate here; taste is visible history",
    unresolved:
      "each is still influencing; unpinning one is a decision no one has made",
    arrived: "one at a time across five years; nothing has ever been taken down",
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
  },
  {
    name: "StickyNotes",
    zone: "referenceWall",
    story:
      "slapped low on the wall at the eye-line of someone leaning over the " +
      "bench, each at its own angle",
    identity: "thinking overflows the desk; the wall catches it",
    unresolved: "each one is a task not yet done",
    arrived: "this week, one per interruption",
  },
  {
    name: "Chair",
    zone: "peripheralRoom",
    story:
      "pulled back from the bench and turned seventeen degrees away — " +
      "someone stood up quickly and it never got pushed back in",
    identity: "work here gets interrupted by better ideas",
    unresolved: "its sitter intends to come straight back",
    arrived: "years ago with the bench; moved a dozen times a day since",
  },
  {
    name: "Plant",
    zone: "peripheralRoom",
    story:
      "the one living thing in the room, in the corner the light reaches — " +
      "watered irregularly, thriving anyway",
    identity: "the studio keeps something alive that isn't a project",
    unresolved: "permanent resident: it belongs to the room, not the work",
    arrived: "three years ago, a gift; the room's oldest living resident",
  },
  {
    name: "DroppedSheet",
    zone: "peripheralRoom",
    story:
      "slid off the bench at some point and hasn't been picked up — " +
      "work happens faster than tidying",
    identity: "momentum matters more than order",
    unresolved: "picking it up hasn't been worth interrupting anything yet",
    arrived: "sometime today; nobody saw it fall",
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
  },
  {
    name: "ShippingTubes",
    zone: "edgeOfFrame",
    story:
      "print tubes leaning in the right rear corner where deliveries get " +
      "parked, one fallen and rolled a little way out — half-cut by the " +
      "frame's edge, never composed for it",
    identity: "work arrives and leaves this room; it has an outside",
    unresolved: "opening them is a task that keeps losing to the current work",
    arrived: "two weeks ago; the fallen one fell the day it arrived",
  },
  {
    name: "OffstageTripod",
    zone: "edgeOfFrame",
    story:
      "standing by the window entirely outside the locked frame; only its " +
      "shadow crosses the floor — the room never explains it",
    identity: "the studio's tools outnumber what any one view can hold",
    unresolved: "between setups, exactly where a tripod waits",
    arrived: "years ago as gear; last week to that spot by the window",
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
  },
];

/** The manifest for one zone, for dressing components and reviews. */
export function zonePieces(zone: RoomZoneName): SetPiece[] {
  return SET_MANIFEST.filter((piece) => piece.zone === zone);
}
