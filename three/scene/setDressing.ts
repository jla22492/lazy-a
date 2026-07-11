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
  },
  {
    name: "TestPrints",
    zone: "workbench",
    story:
      "three small prints from the current work propped against the wall " +
      "this morning, to be glanced at while working — not straightened since",
    identity: "the work is judged by looking at it, again and again",
    unresolved: "still being judged; taking them down would end the question",
  },
  {
    name: "BookStack",
    zone: "workbench",
    story: "pulled from a shelf for one specific page each, never reshelved",
    identity: "influences are working tools, not trophies",
    unresolved: "each is still holding a page someone means to return to",
  },
  {
    name: "PencilJar",
    zone: "workbench",
    story:
      "the bench's one permanent resident; everything in it leans at its " +
      "own angle because it was dropped back in, not arranged",
    identity: "analog tools come first at Lazy A",
    unresolved: "permanent resident: the one thing on the bench that lives here",
  },
  {
    name: "TapeRoll",
    zone: "workbench",
    story: "used to prop the test prints an hour ago and left where it landed",
    identity: "things here get pinned, propped, and taped — process is physical",
    unresolved: "a temporary solution that is quietly becoming permanent",
  },
  {
    name: "Mug",
    zone: "workbench",
    story: "half-finished and gone cold; its owner got pulled into the work",
    identity: "sessions here run long enough for coffee to go cold",
    unresolved: "the conversation that interrupted it isn't over",
  },
  {
    name: "Headphones",
    zone: "workbench",
    story: "taken off and set down open, the way they land when someone " +
      "needs to hear the room",
    identity: "sound is half the film",
    unresolved: "the next listen is minutes away, not hours",
  },
  {
    name: "Pencil",
    zone: "workbench",
    story:
      "resting across the notebook's cover because someone stopped writing " +
      "halfway through a thought",
    identity: "the notebook is written in, daily — the pencil proves it",
    unresolved: "the thought it was writing stopped halfway",
  },
  {
    name: "LooseSheets",
    zone: "workbench",
    story:
      "today's working papers, shuffled rather than stacked; one edge sits " +
      "under the notebook because the notebook arrived later",
    identity: "planning at Lazy A happens by hand, in layers",
    unresolved: "today's plan is still being reshuffled",
  },
  {
    name: "FilmCanisters",
    zone: "workbench",
    story:
      "emptied from a jacket pocket mid-task; one fell over and nobody minded",
    identity: "Lazy A still shoots film — patience is a value",
    unresolved: "waiting to be developed — patience, not neglect",
  },
  {
    name: "Camera",
    zone: "workbench",
    story:
      "set down after checking a frame, lens angled back toward the wall — " +
      "a tool between uses, never a display piece",
    identity: "the instrument of the trade lives on the bench, not a shelf",
    unresolved: "the next frame check could come at any moment",
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
  },
  {
    name: "PictureLedge",
    zone: "referenceWall",
    story:
      "the wall's only furniture: things lean here while they matter — a " +
      "framed still, an unframed print overlapping its corner",
    identity: "work is lived with before it is hung; the wall auditions first",
    unresolved: "everything on it is between temporary and permanent",
  },
  {
    name: "Award",
    zone: "referenceWall",
    story:
      "at the ledge's end, turned mostly away — it lives here, but it " +
      "isn't allowed to look at everyone",
    identity: "recognition happened; it is not performed",
    unresolved: "never put away because putting it away would also be a statement",
  },
  {
    name: "StickyNotes",
    zone: "referenceWall",
    story:
      "slapped low on the wall at the eye-line of someone leaning over the " +
      "bench, each at its own angle",
    identity: "thinking overflows the desk; the wall catches it",
    unresolved: "each one is a task not yet done",
  },
];

/** The manifest for one zone, for dressing components and reviews. */
export function zonePieces(zone: RoomZoneName): SetPiece[] {
  return SET_MANIFEST.filter((piece) => piece.zone === zone);
}
