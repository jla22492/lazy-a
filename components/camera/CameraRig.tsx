"use client";

import { useImperativeHandle, type Ref } from "react";

/**
 * The camera moves the way a person does. These four verbs are the entire
 * vocabulary of camera movement (EXPERIENCE_BIBLE.md — "Camera Verbs").
 * Their behavior arrives in a later work order; the language exists now.
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
