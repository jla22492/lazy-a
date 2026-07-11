"use client";

import { concrete } from "@/three/materials/procedural";
import { STAGE } from "@/three/scene/constants";

const FLAT_ON_GROUND = -Math.PI / 2;

/**
 * The studio floor (materials: WORK ORDER 0042): warm troweled concrete.
 * The texture tiles across the large plane; its contrast is low enough
 * that the repeat never reads. One tile spans ~5m — room-scale variation
 * without visible rhythm.
 */
const TILE_REPEAT = STAGE.floor.size / 5;

export function Floor() {
  const texture = concrete(421, STAGE.floor.color);
  texture.repeat.set(TILE_REPEAT, TILE_REPEAT);
  return (
    <mesh rotation-x={FLAT_ON_GROUND} receiveShadow>
      <planeGeometry args={[STAGE.floor.size, STAGE.floor.size]} />
      <meshStandardMaterial map={texture} roughness={0.88} />
    </mesh>
  );
}
