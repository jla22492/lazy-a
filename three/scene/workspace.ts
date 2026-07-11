/**
 * The workbench language (WORK ORDER 0010) — the invisible logic of the
 * work surface. Every future object placed on the bench is positioned by
 * naming a zone, not by inventing coordinates, so placements accumulate
 * the way real work does.
 *
 * The system assumes the person works standing at the open (+Z) side of
 * the bench, right-handed. All ranges are bench-local offsets from the
 * workbench origin, in meters, within the tabletop's extents
 * (±0.9 in X, ±0.375 in Z).
 *
 * Implementation guide only — never part of the visitor experience.
 */

export interface WorkZone {
  /** Offset range across the bench (left−/right+ as the visitor faces it). */
  xRange: readonly [number, number];
  /** Offset range across the depth (rear− toward the wall, front+ toward the user). */
  zRange: readonly [number, number];
  /** What kind of object naturally lives here. */
  purpose: string;
}

const REAR_EDGE = -0.375;
const FRONT_EDGE = 0.375;
/** The rear band is beyond comfortable reach; work happens in the front band. */
const REACH_BOUNDARY = -0.1;

export const WORKSPACE = {
  /**
   * Rear band, against the future wall: things consulted, propped, or
   * leaned — reference material, notes, eventually the hero print's
   * neighborhood. Looked at more than touched.
   */
  reference: {
    xRange: [-0.9, 0.9],
    zRange: [REAR_EDGE, REACH_BOUNDARY],
    purpose: "propped and consulted; looked at more than touched",
  },
  /**
   * Front-left: the non-dominant side. Finished or parked things — a mug
   * between sips, tools not currently in hand. Slow-moving.
   */
  resting: {
    xRange: [-0.9, -0.35],
    zRange: [REACH_BOUNDARY, FRONT_EDGE],
    purpose: "finished or parked; slow-moving",
  },
  /**
   * Front-center, biased slightly right of the bench's center line toward
   * the dominant hand: where hands actually work. The most recently used
   * object rests at this zone's edge.
   */
  active: {
    xRange: [-0.35, 0.45],
    zRange: [REACH_BOUNDARY, FRONT_EDGE],
    purpose: "where hands work; the center of attention",
  },
  /**
   * Front-right: the dominant hand's set-down arc. Temporary clutter
   * collects here mid-task and gets cleared in bursts.
   */
  temporary: {
    xRange: [0.45, 0.9],
    zRange: [REACH_BOUNDARY, FRONT_EDGE],
    purpose: "set down mid-task; collects and clears",
  },
} as const satisfies Record<string, WorkZone>;

export type WorkZoneName = keyof typeof WORKSPACE;

/** Center of a zone in bench-local XZ, for placing or debugging. */
export function zoneCenter(name: WorkZoneName): [number, number] {
  const zone = WORKSPACE[name];
  return [
    (zone.xRange[0] + zone.xRange[1]) / 2,
    (zone.zRange[0] + zone.zRange[1]) / 2,
  ];
}
