/**
 * Camera studies (WORK ORDER 0006): five plausible human viewpoints into
 * the room, differing only in height, distance, focal length, and subtle
 * yaw. The Creative Director chooses the final composition; none of these
 * is a recommendation. Preview any study with ?study=<id> in the URL.
 */

import { EYE_HEIGHT, STAGE, WORKBENCH } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

export interface CameraStudy {
  fov: number;
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
  /** The compositional question this study explores. */
  question: string;
}

/** Every study keeps its gaze on the work surface. */
const GAZE = fromWorkbench([0, WORKBENCH.surfaceHeight, 0]);

/**
 * The studies are a historical record from WORK ORDER 0006; their values
 * are frozen (the default camera has since moved on, WORK ORDER 0007).
 */
const STUDY_FOV = 50;

export const CAMERA_STUDIES = {
  /** Baseline as of WORK ORDER 0006. */
  A: {
    fov: STUDY_FOV,
    position: fromWorkbench([0, EYE_HEIGHT, 3]),
    lookAt: GAZE,
    question:
      "Baseline: the composition as of WORK ORDER 0006, for comparison.",
  },
  /** Slightly lower eye level; everything else conservative. */
  B: {
    fov: STUDY_FOV,
    position: fromWorkbench([0, 1.4, 3]),
    lookAt: GAZE,
    question:
      "Does lowering the viewer's eye level create more physical presence?",
  },
  /** Subtle three-quarter perspective; restrained rotation. */
  C: {
    fov: STUDY_FOV,
    position: fromWorkbench([0.9, EYE_HEIGHT, 2.85]),
    lookAt: GAZE,
    question:
      "Does a slight off-square angle make the space feel more lived-in?",
  },
  /** One or two natural steps toward the workbench. */
  D: {
    fov: STUDY_FOV,
    position: fromWorkbench([0, EYE_HEIGHT, 2.1]),
    lookAt: GAZE,
    question:
      "Does stepping closer increase intimacy while the room stays larger than the frame?",
  },
  /**
   * Implementation-driven alternative: a longer lens (normal ~50mm
   * equivalent instead of wide), stepped back so the workbench keeps the
   * same size in frame.
   */
  E: {
    fov: 35,
    position: fromWorkbench([0, EYE_HEIGHT, 4.4]),
    lookAt: GAZE,
    question:
      "Does a longer focal length, at matched framing, compress the space into something calmer and more photographic?",
  },
} as const satisfies Record<string, CameraStudy>;

export type StudyId = keyof typeof CAMERA_STUDIES;

/** Without ?study=, the visitor sees the opening composition. */
const OPENING_COMPOSITION: CameraStudy = {
  fov: STAGE.camera.fov,
  position: STAGE.camera.position,
  lookAt: STAGE.camera.lookAt,
  question:
    "The opening composition (WORK ORDER 0007): Study C's three-quarter naturalness with Study E's longer lens.",
};

/** Resolve the study from the URL (?study=B); defaults to the opening composition. */
export function activeStudy(): CameraStudy {
  if (typeof window === "undefined") {
    return OPENING_COMPOSITION;
  }
  const id = new URLSearchParams(window.location.search)
    .get("study")
    ?.toUpperCase();
  return id && id in CAMERA_STUDIES
    ? CAMERA_STUDIES[id as StudyId]
    : OPENING_COMPOSITION;
}
