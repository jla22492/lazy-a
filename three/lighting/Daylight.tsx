"use client";

import { DAYLIGHT } from "@/three/scene/constants";

const { sun, bounce } = DAYLIGHT;

/**
 * Believable daylight (WORK ORDER 0005): a single sun entering from outside
 * the frame, plus one subtle bounce fill so shadows never go dead. Not mood,
 * not cinematography — light that behaves like it already existed.
 */
export function Daylight() {
  return (
    <>
      <directionalLight
        castShadow
        color={sun.color}
        intensity={sun.intensity}
        position={sun.position}
        shadow-mapSize={[sun.shadow.mapSize, sun.shadow.mapSize]}
        shadow-camera-left={-sun.shadow.coverage}
        shadow-camera-right={sun.shadow.coverage}
        shadow-camera-top={sun.shadow.coverage}
        shadow-camera-bottom={-sun.shadow.coverage}
        shadow-bias={sun.shadow.bias}
        shadow-normalBias={sun.shadow.normalBias}
      />
      <hemisphereLight
        color={bounce.skyColor}
        groundColor={bounce.groundColor}
        intensity={bounce.intensity}
      />
    </>
  );
}
