/**
 * Stage constants — the empty film stage before the set is built.
 * All scene-level values live here so no component carries magic numbers.
 */

import { fromWorkbench } from "@/three/scene/world";

/** Human eye height in meters; the camera is a human body (docs/EXPERIENCE_BIBLE.md). */
export const EYE_HEIGHT = 1.6;

export const STAGE = {
  /** Neutral gray void surrounding the stage. */
  backgroundColor: "#7d7d7d",
  floor: {
    /** Large enough that its edges never read from a standing viewpoint. */
    size: 200,
    color: "#8c8c8c",
  },
  camera: {
    fov: 50,
    near: 0.1,
    far: 200,
    /** Standing a few meters back from the workbench origin, at eye height. */
    position: fromWorkbench([0, EYE_HEIGHT, 6]),
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
