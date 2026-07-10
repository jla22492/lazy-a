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
    /** From the left-wall corner to well past the right frame edge. */
    spanX: [-2.2, 5.8] as const,
  },
  leftWall: {
    /** Comfortable working clearance from the bench's left end. */
    x: -2.2,
    /** From the rear-wall corner to well behind the camera. */
    spanZ: [-0.45, 6] as const,
  },
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
  camera: {
    fov: 50,
    near: 0.1,
    far: 200,
    /** Standing a few meters back from the workbench, at eye height. */
    position: fromWorkbench([0, EYE_HEIGHT, 3]),
    /** A person's gaze rests on the work surface, not the horizon. */
    lookAt: fromWorkbench([0, WORKBENCH.surfaceHeight, 0]),
  },
  lights: {
    ambient: {
      intensity: 0.6,
    },
    directional: {
      intensity: 1.2,
      position: [5, 10, 5] as [number, number, number],
    },
  },
} as const;
