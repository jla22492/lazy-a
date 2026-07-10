"use client";

import { STAGE } from "@/three/scene/constants";

/** Base illumination for the empty stage: one ambient fill, one directional key. */
export function StageLights() {
  return (
    <>
      <ambientLight intensity={STAGE.lights.ambient.intensity} />
      <directionalLight
        intensity={STAGE.lights.directional.intensity}
        position={STAGE.lights.directional.position}
      />
    </>
  );
}
