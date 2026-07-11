"use client";

import { useImperativeHandle, type Ref } from "react";

/**
 * The camera moves the way a person does. These four verbs are the entire
 * vocabulary of camera movement (docs/EXPERIENCE_BIBLE.md — "Camera Verbs").
 * Their behavior arrives in a later work order; the language exists now.
 *
 * All camera positions are defined as offsets from the workbench origin —
 * see three/scene/world.ts. The verbs will resolve their targets through
 * that convention, never through arbitrary world coordinates.
 *
 * Every movement originates from a STANDING_POSITION
 * (three/scene/workspace.ts) — the ergonomic places a body actually
 * occupies in this room. The camera never travels; a person moves
 * (WORK ORDER 0019).
 */
export interface CameraRigHandle {
  sit: () => void;
  lean: () => void;
  stand: () => void;
  turn: () => void;
}

interface CameraRigProps {
  ref?: Ref<CameraRigHandle>;
}

export function CameraRig({ ref }: CameraRigProps) {
  useImperativeHandle(
    ref,
    () => ({
      sit: () => {},
      lean: () => {},
      stand: () => {},
      turn: () => {},
    }),
    [],
  );

  return null;
}
