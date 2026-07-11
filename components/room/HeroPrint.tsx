"use client";

import { HERO_PRINT, ROOM, WORKBENCH } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

/**
 * The lean is fully derived: the bottom edge stands on the work surface
 * inside the REFERENCE zone (three/scene/workspace.ts) and the top edge
 * rests against the rear wall.
 */
const LEAN_RUN = HERO_PRINT.bottomZ - ROOM.rearWall.z;
const LEAN_ANGLE = Math.asin(LEAN_RUN / HERO_PRINT.height);

const CENTER_Y =
  WORKBENCH.surfaceHeight + (HERO_PRINT.height / 2) * Math.cos(LEAN_ANGLE);
const CENTER_Z =
  HERO_PRINT.bottomZ - (HERO_PRINT.height / 2) * Math.sin(LEAN_ANGLE);

/**
 * Primitive blockout of the hero print (WORK ORDER 0011): size,
 * orientation, and placement only — no artwork, no frame, no texture.
 * It leans against the rear wall from the bench's reference band, where
 * the room's owner keeps the thing that inspires them.
 */
export function HeroPrint() {
  return (
    <mesh
      position={fromWorkbench([HERO_PRINT.offsetX, CENTER_Y, CENTER_Z])}
      rotation-x={-LEAN_ANGLE}
      rotation-y={HERO_PRINT.yaw}
      castShadow
      receiveShadow
    >
      <boxGeometry
        args={[HERO_PRINT.width, HERO_PRINT.height, HERO_PRINT.thickness]}
      />
      <meshStandardMaterial color={HERO_PRINT.color} />
    </mesh>
  );
}
