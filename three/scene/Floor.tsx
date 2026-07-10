"use client";

import { STAGE } from "@/three/scene/constants";

const FLAT_ON_GROUND = -Math.PI / 2;

/** The stage floor: a large neutral plane lying flat at ground level. */
export function Floor() {
  return (
    <mesh rotation-x={FLAT_ON_GROUND}>
      <planeGeometry args={[STAGE.floor.size, STAGE.floor.size]} />
      <meshStandardMaterial color={STAGE.floor.color} />
    </mesh>
  );
}
