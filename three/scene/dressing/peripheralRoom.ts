/**
 * Peripheral room dressing (WORK ORDER 0039) — blockout fidelity.
 *
 * Zone 3: how Lazy A lives. Everything here makes the room feel inhabited
 * without asking for attention — the furniture and floor life a visitor
 * only consciously notices if it were missing.
 *
 * Positions are room-local (workbench origin), on the floor unless noted.
 * Flat placeholder colors; materials arrive in a later pass.
 */

/**
 * The chair — someone stood up quickly and it never got pushed back in.
 * A plain side chair at the bench's open side, pulled back and turned
 * ~17 degrees away from the desk: interrupted, not arranged.
 */
export const CHAIR = {
  /**
   * Sprint 03 (0060): the chair implies someone who JUST stood up — it
   * sits a body-width back from the bench, half-turned the way a sitter
   * turns when they rise and walk toward the door. Not abandoned across
   * the room; interrupted a moment ago. The work cloth still lives over
   * its back (its second job survives the move).
   */
  at: { x: 0.5, z: 0.98 },
  /** Half-turned toward the door behind the camera. */
  yaw: -0.45,
  seat: { width: 0.45, depth: 0.42, height: 0.45, thickness: 0.04 },
  /** A worn leather pad on a wooden chair — color split arrives later. */
  pad: { thickness: 0.018, inset: 0.03 },
  leg: { size: 0.035 },
  back: {
    /** Total height of the backrest above the floor. */
    height: 0.85,
    upright: { width: 0.04, depth: 0.025 },
    slat: { height: 0.09, thickness: 0.018, fromTop: 0.06 },
  },
  woodColor: "#6e5b48",
  padColor: "#5a4a3c",
  /** The work cloth draped over the top slat — the chair's second job. */
  cloth: {
    width: 0.27,
    drop: 0.19,
    thickness: 0.007,
    yaw: 0.1,
    /** Hangs unevenly: less of it fell on the near side. */
    frontDrop: 0.11,
    color: "#847966",
  },
} as const;

/**
 * The floor plant in the rear-left corner — the one living thing in a
 * room full of manufactured objects. That is why the person keeps it
 * (internal review #1 asked; this is the answer, and it is built, not
 * asserted): everything else in the room was made; this grows. Watered
 * irregularly, thriving anyway, reaching for a window it can barely see.
 *
 * 0051: real construction — a rubber plant. Stems curve toward the
 * light; broad oval leaves attach along them, older ones darker and
 * drooping, the newest bright and vertical, one gone yellow and not yet
 * fallen. No two leaves agree — nothing manufactured ever disagrees
 * with itself like this.
 */
export const PLANT = {
  /** Squeezed into the corner beside the bookcase. */
  at: { x: -1.95, z: 0.12 },
  pot: { radius: 0.13, height: 0.28, color: "#8a6a55" },
  /** The soil surface, sunken and dry at the edges. */
  soil: { inset: 0.02, depth: 0.03, color: "#4a3d30" },
  /**
   * Stems as curves (bench-local to the pot center): each bows toward
   * +X — the window — harder as it rises. Leaves sit along each stem:
   * `t` is the position along the curve, `yaw` the direction the leaf
   * faces (0 = toward the window), `droop` the tilt from vertical.
   */
  stems: {
    radius: 0.006,
    color: "#5a6349",
    curves: [
      {
        points: [
          { x: -0.02, y: 0.26, z: 0.01 },
          { x: 0.0, y: 0.6, z: 0.02 },
          { x: 0.09, y: 0.92, z: 0.03 },
        ],
        leaves: [
          { t: 0.45, yaw: -0.7, droop: 1.15, size: 0.085, tone: "old" },
          { t: 0.7, yaw: 0.4, droop: 0.85, size: 0.095, tone: "old" },
          { t: 0.92, yaw: -0.15, droop: 0.55, size: 0.09, tone: "mid" },
          { t: 1.0, yaw: 0.1, droop: 0.25, size: 0.075, tone: "new" },
        ],
      },
      {
        points: [
          { x: 0.03, y: 0.26, z: -0.03 },
          { x: 0.08, y: 0.52, z: -0.05 },
          { x: 0.19, y: 0.74, z: -0.04 },
        ],
        leaves: [
          { t: 0.5, yaw: 2.4, droop: 1.25, size: 0.08, tone: "old" },
          { t: 0.78, yaw: 1.6, droop: 0.8, size: 0.09, tone: "mid" },
          /* The one that went yellow and hasn't fallen yet. */
          { t: 0.6, yaw: 3.4, droop: 1.45, size: 0.07, tone: "yellow" },
          { t: 1.0, yaw: 0.3, droop: 0.35, size: 0.08, tone: "new" },
        ],
      },
      {
        points: [
          { x: -0.04, y: 0.26, z: 0.05 },
          { x: -0.06, y: 0.46, z: 0.08 },
          { x: 0.02, y: 0.6, z: 0.1 },
        ],
        leaves: [
          { t: 0.55, yaw: 4.2, droop: 1.1, size: 0.075, tone: "old" },
          { t: 0.85, yaw: 5.3, droop: 0.9, size: 0.08, tone: "mid" },
          { t: 1.0, yaw: 0.0, droop: 0.45, size: 0.07, tone: "new" },
        ],
      },
    ],
  },
  leafTones: {
    old: "#4f5a42",
    mid: "#5e6b4d",
    new: "#75835c",
    yellow: "#a89a55",
  },
  /** One leaf that let go — the floor's only biology. */
  droppedLeaf: {
    at: { x: -1.62, z: 0.38 },
    length: 0.07,
    width: 0.035,
    yaw: 1.9,
    color: "#77755a",
  },
} as const;

/**
 * A low open bookcase against the left wall — the library that feeds the
 * bench's book stack. Books lean and lie because they are used.
 */
export const BOOKCASE = {
  /**
   * Against the rear wall below the picture ledge (the left wall sits
   * outside the locked frame — the library belongs where it can be seen
   * living). Faces into the room (+Z) via the component's rotation.
   */
  /** Standing off the wall by the baseboard's depth, as real furniture must. */
  at: { x: -1.45, z: -0.296 },
  width: 0.8,
  height: 0.92,
  depth: 0.28,
  panelThickness: 0.018,
  /** One middle shelf: two openings. */
  shelfHeights: [0.44],
  color: "#75634f",
  /**
   * Book blocks per shelf: varied heights and depths, a lean here and
   * there, one flat stack — a working library, not a styled one.
   */
  books: {
    lower: [
      { w: 0.035, h: 0.28, lean: 0 },
      { w: 0.028, h: 0.31, lean: 0 },
      { w: 0.042, h: 0.26, lean: 0.12 },
      { w: 0.03, h: 0.3, lean: 0 },
      { w: 0.05, h: 0.24, lean: 0 },
      { w: 0.033, h: 0.29, lean: -0.18 },
    ],
    upper: [
      { w: 0.03, h: 0.26, lean: 0 },
      { w: 0.045, h: 0.3, lean: 0 },
      { w: 0.028, h: 0.27, lean: 0.3 },
    ],
    /** A short stack lying flat at the upper shelf's right end. */
    flatStack: { count: 3, w: 0.24, d: 0.17, each: 0.028 },
    colors: ["#6b5d4f", "#55604f", "#474645", "#7a6a55", "#5c5348", "#665e51"],
  },
  /**
   * Habits II (0052): the filled notebooks — identical to the one on the
   * bench, stacked flat at the lower shelf's right end, oldest at the
   * bottom and most faded. They always buy the same notebook. Years of
   * thinking, one A5 at a time — the room's quietest biography.
   */
  notebookStack: {
    width: 0.148,
    length: 0.21,
    thickness: 0.02,
    /** Bottom to top: oldest first, each less faded than the one below. */
    fades: ["#5a5a58", "#525251", "#4b4b4a", "#454545", "#414141"],
    yaws: [0.06, -0.04, 0.1, 0.02, -0.07],
  },
} as const;

/**
 * A mounted print leaning against the rear wall at floor level — finished
 * work that never made it up, or a candidate that never made the cut.
 */
export const LEANING_BOARD = {
  /** Leans against the bookcase's front — waiting its turn by the library. */
  at: { x: -1.35, z: -0.02 },
  width: 0.5,
  height: 0.7,
  thickness: 0.005,
  lean: 0.2,
  yaw: 0.04,
  color: "#ada79a",
} as const;

/**
 * The wastebasket (WORK ORDER 0053) — every functioning desk has
 * somewhere for paper to go; the desk stops being an island the moment
 * its output has a destination. One crumpled ball missed and stayed
 * where it landed: the person shoots from the chair and doesn't always
 * score.
 */
export const WASTEBASKET = {
  at: { x: -1.06, z: 0.52 },
  radius: 0.105,
  height: 0.27,
  thickness: 0.006,
  color: "#4a4c48",
  /** The miss, a hand's span away. */
  crumple: { at: { x: -0.82, z: 0.72 }, radius: 0.028, color: "#ddd8c8" },
} as const;

/**
 * The rolled pencil (WORK ORDER 0053) — it fell, rolled, and stopped
 * where the frame happens to cut it. The camera interrupted a room;
 * the room did not arrange itself for the camera.
 */
export const ROLLED_PENCIL = {
  at: { x: -0.95, z: 1.12 },
  length: 0.175,
  radius: 0.0037,
  yaw: 1.35,
  color: "#7d3f36",
} as const;
