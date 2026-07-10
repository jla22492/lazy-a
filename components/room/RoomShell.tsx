"use client";

import { ROOM } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

const { wall, rearWall, leftWall, ceiling } = ROOM;

const REAR_WIDTH = rearWall.spanX[1] - rearWall.spanX[0];
const REAR_CENTER_X = (rearWall.spanX[0] + rearWall.spanX[1]) / 2;

const LEFT_LENGTH = leftWall.spanZ[1] - leftWall.spanZ[0];
const LEFT_CENTER_Z = (leftWall.spanZ[0] + leftWall.spanZ[1]) / 2;

const FACING_RIGHT = Math.PI / 2;
const FACING_DOWN = Math.PI / 2;

/**
 * The minimum believable room: rear wall, left wall, and a quiet ceiling
 * plane completing the enclosure (WORK ORDERS 0004, 0008). The right wall
 * is intentionally absent — the room is inferred, not presented.
 */
export function RoomShell() {
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <mesh
        position={[REAR_CENTER_X, wall.height / 2, rearWall.z]}
        receiveShadow
      >
        <planeGeometry args={[REAR_WIDTH, wall.height]} />
        <meshStandardMaterial color={wall.color} />
      </mesh>
      <mesh
        position={[leftWall.x, wall.height / 2, LEFT_CENTER_Z]}
        rotation-y={FACING_RIGHT}
        receiveShadow
      >
        <planeGeometry args={[LEFT_LENGTH, wall.height]} />
        <meshStandardMaterial color={wall.color} />
      </mesh>
      <mesh
        position={[REAR_CENTER_X, wall.height, LEFT_CENTER_Z]}
        rotation-x={FACING_DOWN}
        receiveShadow
      >
        <planeGeometry args={[REAR_WIDTH, LEFT_LENGTH]} />
        <meshStandardMaterial color={ceiling.color} />
      </mesh>
    </group>
  );
}
