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
  at: { x: 0.38, z: 1.05 },
  /** Turned away from square: the 17-degree story. */
  yaw: -0.3,
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
} as const;

/**
 * The floor plant in the rear-left corner — the one living thing in the
 * room. Watered irregularly, thriving anyway.
 */
export const PLANT = {
  /** Squeezed into the corner beside the bookcase. */
  at: { x: -1.95, z: 0.12 },
  pot: { radius: 0.13, height: 0.28, color: "#8a6a55" },
  /** Blockout foliage: overlapping rounded masses, not leaves yet. */
  foliage: {
    color: "#66705c",
    clumps: [
      { x: 0, y: 0.56, z: 0, r: 0.18 },
      { x: 0.09, y: 0.74, z: 0.05, r: 0.14 },
      { x: -0.1, y: 0.7, z: -0.04, r: 0.12 },
      { x: 0.02, y: 0.87, z: -0.02, r: 0.1 },
    ],
  },
} as const;

/**
 * A single sheet that slid off the bench and hasn't been picked up —
 * the room's quietest proof that work happens faster than tidying.
 */
export const DROPPED_SHEET = {
  at: { x: -0.52, z: 0.58 },
  width: 0.21,
  length: 0.297,
  thickness: 0.0004,
  yaw: 0.7,
  color: "#e5e0d2",
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
