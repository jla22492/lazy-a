/**
 * Stage constants — the empty film stage before the set is built.
 * All scene-level values live here so no component carries magic numbers.
 */

import { fromWorkbench } from "@/three/scene/world";

/** Human eye height in meters; the camera is a human body (docs/EXPERIENCE_BIBLE.md). */
export const EYE_HEIGHT = 1.6;

/**
 * Seated working eye height in meters (SPRINT_05 amendment: the
 * perspective sits; raised at WO 0092 under Jonathan's ruling — the
 * eyes must sit clearly ABOVE the desk, 35cm over the 0.9m work
 * surface, an upright adult on a standard chair rather than a slouch).
 */
export const SEATED_EYE_HEIGHT = 1.25;

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
  /**
   * Stained wood, worked for years (WORK ORDER 0041). Age drives the wear
   * the surface carries; the wear locations come from the workspace zone
   * language in Workbench.tsx.
   */
  wood: {
    seed: 41,
    base: "#7d6248",
    legBase: "#6e563f",
    grain: "#5b4634",
    age: 0.85,
  },
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
    /**
     * RECOMPOSITION (WORK ORDER 0071, amended by Jonathan mid-checkpoint):
     * only the LEFT side opens — the left corner falls outside the frame
     * and the wall continues past the browser's left edge, while the
     * right side keeps its original architecture: the wall, the corner,
     * and the window's sliver of daylight exactly as they were.
     */
    spanX: [-3.2, 2.2] as const,
  },
  leftWall: {
    /** Beyond the frame's left edge since 0071. */
    x: -3.2,
    /** From the rear-wall corner to well behind the camera. */
    spanZ: [-0.45, 6] as const,
  },
  /**
   * Right wall (WORK ORDER 0012): closes the room on the side the daylight
   * enters from. Kept exactly as built, per Jonathan's 0071 amendment —
   * the right corner and the window's sliver stay in frame.
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
     * frame's corner — restored by Jonathan's 0071 amendment (the right
     * side keeps its original architecture).
     */
    spanZ: [0.55, 1.45] as const,
    /** Wall thickness: the reveal depth of the opening. */
    reveal: 0.1,
    /** Frosted daylight glass; quiet warm white. */
    paneColor: "#f2ede0",
  },
  /**
   * Doorway in the left wall, behind the camera (WORK ORDER 0014): the
   * room's architectural entrance. The visitor who "entered and stopped
   * slightly left of the workbench" came through here. Standard interior
   * opening; no door, no hardware — the opening alone. Never visible from
   * the locked opening composition.
   */
  door: {
    head: 2.05,
    spanZ: [4.7, 5.6] as const,
    /** Same wall thickness as the window reveal. */
    reveal: 0.1,
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
   * The settled composition, STANDING AT THE DESK (R-0092, Jonathan's
   * ruling with his reference frame): the arrival no longer pushes down
   * into the low seat — it settles at the higher vantage the walk
   * reaches at ~2s, a person standing over their work. The desktop
   * reads as a broad surface below (prints readable at an angle, the
   * reference composition), the wall holds the hero and the notes
   * above, and choosing JOURNAL is now a REAL head-drop that opens the
   * page to the eye.
   */
  camera: {
    /** Normal lens (~50mm equivalent), not wide. */
    fov: 35,
    near: 0.1,
    far: 200,
    /** Standing at the bench, a step back from its edge. */
    position: fromWorkbench([0.05, EYE_HEIGHT, 1.45]),
    /** The regard drops toward the work: desk-as-surface below, the
        hero print exactly filling the frame's top. */
    lookAt: fromWorkbench([0.02, 1.04, -0.45]),
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
      /**
       * Truthful shadows for a furnished room (WORK ORDER 0043): the set
       * dressing added pencil-scale casters, and 2048 texels across a 12m
       * shadow span rendered their shadows chunky. Doubled resolution and
       * a tighter span put ~2.4mm per texel on the floor — small objects
       * ground believably and the light itself stays unchanged.
       */
      mapSize: 4096,
      /** Half-extent of the shadow camera; covers the furnished room. */
      coverage: 5,
      bias: -0.0005,
      normalBias: 0.04,
      /**
       * Stillness (WORK ORDER 0015): a soft penumbra. PCF with a blur
       * radius — VSM was rejected because its receivers-also-cast rule
       * made the walls throw uncontrollable shadows.
       */
      radius: 4,
      blurSamples: 12,
    },
  },
  bounce: {
    /** Barely-cool sky component of the fill. */
    skyColor: "#e7ebee",
    /**
     * Light returned from the warm floor and plaster — since the floor
     * became concrete and the bench wood (WORK ORDER 0043), the return
     * warms a step and drops slightly, so the sun models the new
     * materials instead of the fill flattening them.
     */
    groundColor: "#a89882",
    intensity: 0.44,
  },
  /**
   * The first breath (WORK ORDER 0018): daylight sways imperceptibly, the
   * way real light through glass never holds perfectly still. Amplitudes
   * are fractions of the sun's intensity; the movement lives mostly in the
   * slow drift phase with a whisper of the breath phase on top. Below the
   * threshold of watching — its absence, not its presence, is felt.
   */
  breath: {
    driftAmplitude: 0.02,
    breathAmplitude: 0.006,
  },
} as const;
