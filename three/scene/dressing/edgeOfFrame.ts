/**
 * Edge-of-frame dressing (WORK ORDER 0040) — blockout fidelity.
 *
 * Zone 4: the suggestion that the world continues beyond the browser.
 * Nothing here is composed FOR the frame — pieces are cut by its edges or
 * stand entirely outside it and reach in only by shadow. The locked
 * composition (R-0007) sees the right wall only up to z ~0.6, and the
 * frame's right edge sits ~36 degrees right of the room's -Z axis; these
 * placements are chosen against that geometry.
 *
 * Positions are room-local (workbench origin). Flat placeholder colors.
 */

/**
 * Shipping tubes leaning in the right rear corner — prints arrive and
 * leave this room. Deliberately half-cut by the frame's right edge.
 */
export const SHIPPING_TUBES = {
  /** Against the right wall below the window — right where the frame cuts. */
  /** Restored with the right wall (0071 amendment): against it, where
      the frame cuts. */
  corner: { x: 2.07, z: 0.78 },
  color: "#a89680",
  /**
   * 0061 (review #1 ruling): one tube, not two — a single tube cut by
   * the frame is a stronger sentence.
   */
  tubes: [
    { length: 0.95, radius: 0.042, lean: 0.16, yaw: 2.6, offset: { x: 0, z: 0 } },
  ],
  /**
   * The Edit (0044): the fallen third tube was removed — the bottom-right
   * floor was the busiest patch in the room, and the corner tells the
   * same story with two tubes standing.
   */
} as const;

/**
 * Power reaching the bench: a strip on the floor by the right wall, its
 * cable running toward the bench's right leg and out of mind. The room
 * works for a living; electricity comes from somewhere.
 */
export const POWER_RUN = {
  strip: {
    /** Restored with the right wall (0071 amendment). */
    at: { x: 1.86, z: 0.82 },
    width: 0.26,
    height: 0.038,
    depth: 0.052,
    yaw: 1.35,
    color: "#3d3b38",
  },
  /**
   * Power I (0047): the diagonal floor run is gone — cables hug seams now
   * (see dressing/infrastructure.ts). What remains here is one short slack
   * of cable leaving the strip toward the bench before it disappears
   * behind the bench's right leg: the visible end of an invisible supply.
   */
  cable: {
    thickness: 0.009,
    color: "#31302e",
    segments: [
      { from: { x: 1.8, z: 0.84 }, to: { x: 1.32, z: 0.56 } },
      { from: { x: 1.32, z: 0.56 }, to: { x: 0.92, z: 0.33 } },
    ],
  },
} as const;
