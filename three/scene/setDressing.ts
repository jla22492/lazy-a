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
  },
  {
    name: "Notebook",
    zone: "workbench",
    story:
      "set down askew within reach of the working edge, closed, mid-life — " +
      "put down, not put away",
    identity:
      "thinking at Lazy A happens on paper before it happens on screen",
  },
];

/** The manifest for one zone, for dressing components and reviews. */
export function zonePieces(zone: RoomZoneName): SetPiece[] {
  return SET_MANIFEST.filter((piece) => piece.zone === zone);
}
