/**
 * Stage constants — the empty film stage before the set is built.
 * All scene-level values live here so no component carries magic numbers.
 */

import { fromWorkbench } from "@/three/scene/world";

/** Human eye height in meters; the camera is a human body (docs/EXPERIENCE_BIBLE.md). */
export const EYE_HEIGHT = 1.6;

/**
 * Workbench blockout dimensions, in meters.
 * Proportions follow a standard full-size workbench; the blockout exists to
 * establish scale and spatial hierarchy, not detail.
 * Centered on the world origin in X/Z, standing on the floor (Y = 0).
 */
export const WORKBENCH = {
  /** Height of the work surface above the floor. */
  surfaceHeight: 0.9,
  top: {
    width: 1.8,
    depth: 0.75,
    thickness: 0.04,
  },
  leg: {
    /** Square cross-section side length. */
    size: 0.08,
    /** Distance from the tabletop edge to the outer face of each leg. */
    inset: 0.06,
  },
  color: "#9a9a9a",
} as const;

/**
 * Minimum believable room shell: floor, rear wall, left wall only.
 * The right wall and ceiling are intentionally absent — the viewer's brain
 * completes the room. Walls use standard residential ceiling height and
 * extend past the camera frame so their edges never read.
 */
export const ROOM = {
  wall: {
    /** Standard ceiling height. */
    height: 2.4,
    /** Matte painted plaster, off-white. */
    color: "#eae5da",
  },
  rearWall: {
    /** Just behind the workbench's back edge, as a real bench sits. */
    z: -0.45,
    /** Corner to corner between the side walls. */
    spanX: [-2.2, 2.2] as const,
  },
  leftWall: {
    /** Comfortable working clearance from the bench's left end. */
    x: -2.2,
    /** From the rear-wall corner to well behind the camera. */
    spanZ: [-0.45, 6] as const,
  },
  /**
   * Right wall (WORK ORDER 0012): closes the room on the side the daylight
   * enters from. Its inner face is backlit and reads darkest, as real
   * window walls do.
   */
  rightWall: {
    x: 2.2,
    spanZ: [-0.45, 6] as const,
  },
  /**
   * Window opening in the right wall — the architectural source of the
   * daylight (WORK ORDER 0013). Frosted: it admits light but shows no
   * exterior view. Standard sill and head heights; positioned so a quiet
   * sliver enters the locked frame's right edge and the light reads as
   * explained. The pane uses an unlit material so it stays daylight-bright
   * on the backlit wall — the glass is the light.
   */
  window: {
    sill: 0.9,
    head: 2.0,
    /**
     * R-0013: positioned so only a ~9cm sliver of glass enters the locked
     * frame's corner — the daylight reads as explained without the window
     * ever becoming a compositional element.
     */
    spanZ: [0.55, 1.45] as const,
    /** Wall thickness: the reveal depth of the opening. */
    reveal: 0.1,
    /** Frosted daylight glass; quiet warm white. */
    paneColor: "#f2ede0",
  },
  /** Simple painted baseboard grounding every wall-floor junction. */
  baseboard: {
    height: 0.09,
    depth: 0.012,
    color: "#e3ded2",
  },
  /**
   * One quiet plane at wall height covering the walls' footprint. It does
   * not cast shadows: the daylight source sits symbolically above it, and
   * its underside is lit by bounce, as real ceilings are.
   */
  ceiling: {
    color: "#eae5da",
  },
} as const;

/**
 * Notebook blockout (WORK ORDER 0009): a closed A5 notebook, measured
 * real-world proportions. Placement implies someone working at the open
 * side of the bench set it down and left: right of the bench's center,
 * within a seated reach of the front edge, casually askew — never aligned
 * to the bench edges, never centered.
 */
export const NOTEBOOK = {
  /** A5: 14.8cm wide, 21cm tall, ~2cm thick when closed. */
  width: 0.148,
  length: 0.21,
  thickness: 0.02,
  /** Dark neutral cover; a working object, not a display object. */
  color: "#414141",
  /** On the work surface, right of center, slightly toward the user's side. */
  offset: [0.35, 0, 0.12] as const,
  /** Casually askew, as if set down without thought. */
  rotationY: -0.21,
} as const;

export const STAGE = {
  /** Neutral gray void surrounding the stage. */
  backgroundColor: "#7d7d7d",
  floor: {
    /** Large enough that its edges never read from a standing viewpoint. */
    size: 200,
    /** Matte, warm neutral. */
    color: "#8f867a",
  },
  /**
   * The opening composition (WORK ORDER 0007, revised R-0007): someone who
   * entered, took two quiet steps in, and naturally stopped slightly LEFT
   * of the workbench. Study C's three-quarter naturalness with Study E's
   * longer lens. The leftward offset is the farthest the viewer can stand
   * left at this lens and distance without the frame's upper-right corner
   * rising above the rear wall (the room has no right wall); a mirrored
   * offset would reveal the void.
   */
  camera: {
    /** Normal lens (~50mm equivalent), not wide. */
    fov: 35,
    near: 0.1,
    far: 200,
    /** Left of the bench axis, at eye height; distance matches 0007 (4.47m to the gaze). */
    position: fromWorkbench([-0.55, EYE_HEIGHT, 4.377]),
    /** A person's gaze rests on the work surface, not the horizon. */
    lookAt: fromWorkbench([0, WORKBENCH.surfaceHeight, 0]),
  },
} as const;

/**
 * Daylight — the room's permanent lighting system (first version).
 * One primary source entering from outside the right edge of frame; the
 * source itself is never revealed. One subtle bounce fill so shadows never
 * go dead. Nothing about the light should be noticeable.
 */
export const DAYLIGHT = {
  sun: {
    /** Slightly warm white; unremarkable midday light. */
    color: "#fff2e2",
    intensity: 1.7,
    /** High and to the right, outside the frame, angled into the room. */
    position: [4, 5, 2.5] as [number, number, number],
    shadow: {
      mapSize: 2048,
      /** Half-extent of the shadow camera; covers the visible room. */
      coverage: 6,
      bias: -0.0005,
      normalBias: 0.04,
    },
  },
  bounce: {
    /** Barely-cool sky component of the fill. */
    skyColor: "#e7ebee",
    /** Light returned from the warm floor and plaster. */
    groundColor: "#a89e90",
    intensity: 0.5,
  },
} as const;
