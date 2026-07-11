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

/**
 * Standing positions (WORK ORDER 0019) — where a human body naturally
 * occupies this workspace. Implementation concepts only; they never
 * appear in the visitor experience. Every future camera movement,
 * interaction, and placement decision originates from one of these,
 * so movement always has a physically believable origin.
 *
 * Positions are bench-local XZ offsets of the body's center (feet);
 * eyes sit at EYE_HEIGHT above them. `facing` is where the body
 * naturally orients.
 */
export interface StandingPosition {
  /** Bench-local XZ of the body's center. */
  at: readonly [number, number];
  /** Bench-local XZ point the body naturally faces. */
  facing: readonly [number, number];
  /** The human moment this position belongs to. */
  purpose: string;
}

export const STANDING_POSITIONS = {
  /**
   * Just inside the room, two quiet steps from the doorway. This is the
   * locked opening composition's camera position (STAGE.camera stands
   * here at eye height) — the visitor's story and the camera system
   * share one origin.
   */
  arrival: {
    at: [-0.55, 4.377],
    facing: [0, 0],
    purpose: "pausing after entering; taking the room in",
  },
  /**
   * At the bench, centered on the ACTIVE zone, hips a hand's width
   * (~25cm) from the front edge — standard standing-work clearance.
   */
  working: {
    at: [0.05, 0.625],
    facing: [0.05, -0.2],
    purpose: "hands on the work surface; the notebook within reach",
  },
  /**
   * A step back from the bench — a comfortable viewing distance
   * (~1.7m) from the rear wall's reference band, where propped
   * material is read rather than touched.
   */
  considering: {
    at: [-0.2, 1.3],
    facing: [-0.2, -0.375],
    purpose: "standing back to look at what leans against the wall",
  },
} as const satisfies Record<string, StandingPosition>;

export type StandingPositionName = keyof typeof STANDING_POSITIONS;
