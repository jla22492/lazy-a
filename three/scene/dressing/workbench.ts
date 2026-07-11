/**
 * Workbench dressing (WORK ORDER 0037) — blockout fidelity.
 *
 * Everything exists; nothing is beautiful yet. Each piece uses measured
 * real-world proportions and a flat placeholder color; materials arrive in
 * a later pass. Positions are bench-local offsets from the workbench
 * origin (see workspace.ts for the zone language), Y measured from the
 * work surface. Rotations are deliberately unaligned — the bench was
 * interrupted, not arranged.
 *
 * Every piece here has a manifest entry in setDressing.ts declaring its
 * story and identity ("everything earns its place twice").
 */

/**
 * The rear band: three test prints propped against the rear wall — mixed
 * sizes and angles so they read as prints put up one at a time, never as
 * one aligned panel. The smallest leans on its neighbor, not the wall.
 */
export const TEST_PRINTS = {
  thickness: 0.001,
  prints: [
    /* 5x7" portrait, leaning back to the wall. */
    {
      width: 0.127,
      height: 0.178,
      x: -0.09,
      z: -0.355,
      yaw: 0.12,
      lean: 0.56,
      color: "#e6dfd0",
    },
    /* Another 5x7" portrait, propped separately, a touch straighter. */
    {
      width: 0.127,
      height: 0.178,
      x: 0.08,
      z: -0.365,
      yaw: -0.08,
      lean: 0.45,
      color: "#ded6c5",
    },
    /* 6x4" landscape resting against the second print's corner. */
    {
      width: 0.152,
      height: 0.102,
      x: 0.17,
      z: -0.34,
      yaw: 0.24,
      lean: 0.34,
      color: "#e9e3d6",
    },
  ],
} as const;

/** Rear-left: reference books pulled and never reshelved. */
export const BOOK_STACK = {
  at: { x: -0.62, z: -0.24 },
  books: [
    { width: 0.17, length: 0.24, thickness: 0.03, yaw: 0.08, color: "#6b5d4f" },
    { width: 0.16, length: 0.235, thickness: 0.022, yaw: -0.12, color: "#55604f" },
    { width: 0.14, length: 0.21, thickness: 0.035, yaw: 0.22, color: "#474645" },
  ],
} as const;

/** Rear band, right of center: the pencil jar — the bench's one permanent resident. */
export const PENCIL_JAR = {
  at: { x: 0.42, z: -0.2 },
  radius: 0.045,
  height: 0.11,
  color: "#8a8578",
  /** Pencils and markers leaning inside at their own angles. */
  sticks: [
    { lean: 0.12, yaw: 0.4, length: 0.19, color: "#b09040" },
    { lean: 0.18, yaw: 2.1, length: 0.175, color: "#b09040" },
    { lean: 0.1, yaw: 3.9, length: 0.2, color: "#3a3a3a" },
    { lean: 0.22, yaw: 5.2, length: 0.165, color: "#7d3f36" },
  ],
  stickRadius: 0.0037,
} as const;

/** A roll of masking tape, flat where it was last put down. */
export const TAPE_ROLL = {
  at: { x: 0.6, z: -0.14 },
  outerRadius: 0.05,
  width: 0.024,
  yaw: 0.7,
  color: "#d8d2c0",
} as const;

/** Resting zone: the mug that went cold. */
export const MUG = {
  at: { x: -0.58, z: 0.16 },
  radius: 0.041,
  height: 0.095,
  /** Handle turned casually away from the bench's open side. */
  handleYaw: 2.4,
  color: "#b8b0a4",
} as const;

/** Resting zone, near the left edge: headphones taken off and set down open. */
export const HEADPHONES = {
  at: { x: -0.76, z: 0.24 },
  /** Headband arc lying flat on the surface. */
  bandRadius: 0.095,
  bandTube: 0.006,
  cupRadius: 0.038,
  cupHeight: 0.028,
  yaw: -0.5,
  color: "#3a3a3a",
} as const;

/**
 * Active zone: the pencil resting across the notebook's cover because
 * someone stopped writing halfway through a thought (0036 review: the
 * relationship tells the story, not the prop).
 */
export const PENCIL = {
  /** On the notebook itself, a little above its center. */
  at: { x: 0.345, z: 0.1 },
  /** The notebook's closed thickness — what the pencil rests on. */
  restsOn: 0.02,
  length: 0.175,
  radius: 0.0037,
  yaw: 1.25,
  color: "#b09040",
} as const;

/** Active zone: today's working papers, shuffled rather than stacked. */
export const LOOSE_SHEETS = {
  /** A4 paper. */
  width: 0.21,
  length: 0.297,
  thickness: 0.0004,
  sheets: [
    { x: 0.28, z: 0.1, yaw: -0.09 },
    { x: 0.31, z: 0.13, yaw: 0.07 },
    { x: 0.26, z: 0.16, yaw: 0.19 },
  ],
  color: "#e5e0d2",
} as const;

/** Temporary zone: 35mm film canisters emptied from a pocket. */
export const FILM_CANISTERS = {
  radius: 0.0155,
  height: 0.05,
  color: "#2f2f2f",
  standing: { x: 0.52, z: 0.26 },
  /** The second one fell over and nobody minded. */
  fallen: { x: 0.6, z: 0.31, yaw: 1.1 },
} as const;

/** Temporary zone: the camera set down after checking a frame. */
export const CAMERA = {
  at: { x: 0.78, z: 0.04 },
  body: { width: 0.14, height: 0.09, depth: 0.045 },
  lens: { radius: 0.03, length: 0.05 },
  prism: { width: 0.05, height: 0.025, depth: 0.04 },
  /** Lens angled back toward the wall — used, not displayed. */
  yaw: 2.7,
  bodyColor: "#333333",
  lensColor: "#222222",
} as const;
