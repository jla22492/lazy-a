/**
 * Infrastructure dressing (WORK ORDER 0047) — the room is on the grid.
 *
 * A functioning room is more believable than a decorated room. Power
 * arrives the way power actually arrives: outlets low on the walls, cables
 * hugging the seams where floor meets baseboard, a lamp whose cord drops
 * out of sight behind the bench. Everything visible implies something
 * invisible — the building's wiring, the meter, the grid.
 *
 * Positions are room-local (workbench origin). Cables are blockout: thin
 * dark runs; believability comes from the routing, not the geometry.
 */

/** A standard duplex outlet plate. */
export interface Outlet {
  /** Which wall the plate sits on. */
  wall: "rear" | "right";
  /** Along-wall coordinate (x on the rear wall, z on the right wall). */
  along: number;
  /** Plate center height — standard low-outlet mounting. */
  height: number;
}

export const OUTLET_PLATE = {
  width: 0.08,
  height: 0.125,
  depth: 0.009,
  /** Slightly yellowed electrical plastic, never as fresh as the paint. */
  color: "#e6e0d0",
  /** Two sockets read as darker recesses. */
  socket: { width: 0.03, height: 0.036, inset: 0.002, color: "#c9c2b0" },
} as const;

export const OUTLETS: readonly Outlet[] = [
  /**
   * Rear wall, just clear of the bookcase's flank — the outlet furniture
   * always half-hides. The lamp lives off this one.
   */
  { wall: "rear", along: -1.02, height: 0.3 },
  /** Right wall below the window — the strip lives off this one. */
  { wall: "right", along: 0.88, height: 0.3 },
];

/**
 * The desk lamp — dark green enamel, two joints, standing at the bench's
 * rear-left corner. OFF: the daylight is doing its job. Its head is still
 * aimed at the active zone from last night's session, and its cord drops
 * off the bench's rear edge into the gap nobody looks at.
 */
export const DESK_LAMP = {
  at: { x: -0.8, z: -0.24 },
  base: { radius: 0.075, height: 0.02 },
  /** Lower arm: up and slightly back. */
  arm1: { length: 0.34, radius: 0.008, pitch: -0.35, yaw: 0.5 },
  /** Upper arm: forward and down toward the active zone. */
  arm2: { length: 0.3, radius: 0.007, pitch: 1.85 },
  head: {
    /** Classic spun-metal shade — widened at 0067 so it reads as a
        shade, not a horn. */
    radius: 0.07,
    depth: 0.072,
    neck: { radius: 0.011, length: 0.02 },
  },
  enamel: "#3d4a3e",
  joint: "#8a7a52",
  /** The cord: off the bench rear edge, down, along the seam, to the outlet. */
  cord: {
    thickness: 0.007,
    color: "#31302e",
  },
} as const;

/** Cable runs hugging the floor-wall seam — power moves along edges. */
export interface CableRun {
  from: { x: number; z: number };
  to: { x: number; z: number };
}

/**
 * The phone charger (WORK ORDER 0048) — the block lives in the strip; its
 * cable rises from behind the bench and lies across the temporary zone in
 * a lazy S, connector up, PHONE ABSENT. The phone left with its owner:
 * the strongest evidence in the room that someone just stood up.
 */
export const PHONE_CHARGER = {
  /** The wall-wart block plugged into the strip's far socket. */
  block: {
    /** 0071: with the strip beyond the frame's right edge. */
    at: { x: 2.66, z: 0.9 },
    width: 0.035,
    height: 0.028,
    depth: 0.035,
    yaw: 1.35,
    color: "#dedad0",
  },
  /** Bench-local path of the visible cable, over the rear edge to rest. */
  cable: {
    radius: 0.0032,
    color: "#cfccc4",
    /** A lazy S across the temporary zone; the last point is the connector. */
    path: [
      { x: 0.63, y: -0.004, z: -0.383 },
      { x: 0.67, y: 0, z: -0.2 },
      { x: 0.56, y: 0, z: -0.02 },
      { x: 0.63, y: 0, z: 0.09 },
      { x: 0.57, y: 0, z: 0.15 },
    ],
    connector: { width: 0.009, height: 0.005, length: 0.02 },
  },
} as const;

export const CABLE = {
  thickness: 0.009,
  color: "#31302e",
  /** The lamp's floor run: behind the bench, along the rear seam. */
  lampRuns: [
    /* Drop point behind the bench edge to the seam. */
    { from: { x: -0.8, z: -0.41 }, to: { x: -1.02, z: -0.42 } },
  ] as readonly CableRun[],
  /** The strip's run to the right-wall outlet, hugging the seam. */
  stripRuns: [
    { from: { x: 2.74, z: 0.88 }, to: { x: 2.95, z: 0.89 } },
  ] as readonly CableRun[],
} as const;
