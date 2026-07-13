"use client";

import { useEffect, useState } from "react";

import type { Texture } from "three";

/**
 * Surgical reflections (WORK ORDER 0103, Jonathan-approved after the
 * 0099 finding): a generated environment handed DIRECTLY to the few
 * materials whose response wants it — ceramic glaze, camera metal, the
 * hero's gloss, the lamp's enamel. The scene's environment is never
 * set, so the room's authored light cannot be washed: matte surfaces
 * never see this texture at all.
 */

let reflections: Texture | null = null;
const listeners = new Set<() => void>();

export function provideReflections(texture: Texture): void {
  reflections = texture;
  for (const listener of listeners) listener();
}

/** Subscribe a component to the reflection map (null until generated). */
export function useReflections(): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(reflections);
  useEffect(() => {
    const listener = () => setTexture(reflections);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return texture;
}

/** The glaze/metal/gloss intensities, one place. */
export const REFLECTION_INTENSITY = {
  ceramic: 0.35,
  metal: 0.55,
  gloss: 0.3,
} as const;
