/**
 * Reference wall dressing (WORK ORDER 0038) — blockout fidelity.
 *
 * Zone 2: who Lazy A is. The rear wall carries the studio's identity the
 * way real studio walls do — pinned over years, propped on a ledge,
 * layered rather than curated. Nothing is centered; nothing lines up.
 *
 * All positions are room-local (workbench origin), on the rear wall plane
 * at z = ROOM.rearWall.z, offset forward a few millimeters so nothing
 * z-fights the plaster. Flat placeholder colors; image content and
 * materials arrive in later passes.
 */

/** How far pinned paper floats off the plaster. */
export const WALL_GAP = 0.003;

/**
 * The hero print — the future home of the studio's defining image
 * (R-0011 concluded it belongs to the room's architecture; the Creative
 * Reset made it the identity anchor). Large, unframed, off-center right —
 * placed where someone at the bench can judge it, not where a decorator
 * would hang it. Its content stays unauthored: a quiet mid-tone until the
 * image itself is a creative decision.
 */
export const HERO_PRINT = {
  width: 0.5,
  height: 0.7,
  thickness: 0.002,
  center: { x: 0.55, y: 1.52 },
  /** Hung by hand: a hair off level. */
  roll: 0.012,
  color: "#9c9284",
} as const;

/**
 * The pinned cluster — influences and moments accumulated one at a time,
 * upper-left of the bench. Mixed photographs (placeholder image tone) and
 * paper notes; angles disagree because they were pinned months apart.
 */
export const PINNED_CLUSTER = {
  /**
   * The Edit (0044): evolved over years, not assembled in an afternoon.
   * One fewer item (the square photo didn't survive), angles that disagree
   * harder, two decisive overlaps, one photo whose second pin gave — it
   * hangs slipped and nobody has fixed it — and one outlier pinned alone,
   * far from the conversation.
   */
  photoColor: "#8d857a",
  paperColor: "#ded5bc",
  thickness: 0.0008,
  /**
   * The second aging pass (0054): age creates disagreement, chaos does
   * not. One note curls off the wall at its bottom edge; one photo's
   * failed corner was re-taped with tape newer than the photo; one photo
   * overlaps its neighbor because moving the older pin was never worth
   * it. Each item is less synchronized, not more random.
   */
  items: [
    /* 4x6" photo, landscape. */
    { w: 0.152, h: 0.102, x: -1.05, y: 1.66, roll: 0.13, kind: "photo" },
    /* 5x7" photo, portrait, overlapping the landscape's corner because
       nobody wanted to move the older pin. */
    { w: 0.127, h: 0.178, x: -0.97, y: 1.61, roll: -0.06, kind: "photo" },
    /* A5 note, curling off the wall at its bottom edge. */
    { w: 0.148, h: 0.21, x: -0.68, y: 1.68, roll: 0.16, kind: "paper", curl: 0.14 },
    /* A torn strip of paper — a phrase someone keeps. */
    { w: 0.19, h: 0.05, x: -0.72, y: 1.47, roll: 0.03, kind: "paper" },
    /* The slipped one: its second pin gave months ago. Nobody minds. */
    { w: 0.102, h: 0.152, x: -0.55, y: 1.35, roll: -0.38, kind: "photo" },
    /* The outlier: pinned alone, far from the conversation — its failed
       corner re-taped with tape newer than the photo. */
    { w: 0.148, h: 0.105, x: -1.62, y: 1.78, roll: 0.07, kind: "paper", freshTape: true },
  ],
} as const;

/**
 * A narrow picture ledge left of the bench — the wall's only furniture.
 * Things lean here while they matter; the wall keeps what stays.
 */
export const PICTURE_LEDGE = {
  center: { x: -1.55, y: 1.3 },
  length: 0.85,
  depth: 0.075,
  thickness: 0.018,
  color: "#7a6a55",
  /** A framed still, leaning. */
  framed: {
    width: 0.24,
    height: 0.3,
    depth: 0.015,
    frameColor: "#46413c",
    x: -1.72,
    lean: 0.12,
    yaw: 0.04,
  },
  /** An unframed print leaning against and overlapping the framed one. */
  unframed: {
    width: 0.18,
    height: 0.24,
    thickness: 0.0015,
    color: "#ddd6c6",
    x: -1.52,
    lean: 0.18,
    yaw: -0.06,
  },
  /**
   * A small award at the ledge's right end, turned mostly away — it lives
   * here, but it isn't allowed to look at everyone.
   */
  award: {
    width: 0.06,
    height: 0.14,
    depth: 0.06,
    color: "#6d675c",
    x: -1.24,
    yaw: 1.2,
  },
} as const;

/**
 * Sticky notes low on the wall, at the eye-line of someone leaning over
 * the bench — tasks, not decor. Muted paper yellow; each at its own angle.
 */
export const STICKY_NOTES = {
  size: 0.076,
  thickness: 0.0006,
  color: "#d3c27e",
  /**
   * Right of the hero print, low, over the bench's temporary zone — where
   * a hand actually reaches the wall. The Edit (0044): two, not three —
   * one task got done.
   */
  items: [
    { x: 0.88, y: 1.12, roll: 0.09 },
    { x: 0.97, y: 1.05, roll: -0.14 },
  ],
} as const;
