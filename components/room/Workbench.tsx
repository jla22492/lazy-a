"use client";

import { WORKBENCH } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

const { top, leg, surfaceHeight, color } = WORKBENCH;

const LEG_HEIGHT = surfaceHeight - top.thickness;
const LEG_CENTER_X = top.width / 2 - leg.inset - leg.size / 2;
const LEG_CENTER_Z = top.depth / 2 - leg.inset - leg.size / 2;

const LEG_POSITIONS: ReadonlyArray<[number, number, number]> = [
  [LEG_CENTER_X, LEG_HEIGHT / 2, LEG_CENTER_Z],
  [LEG_CENTER_X, LEG_HEIGHT / 2, -LEG_CENTER_Z],
  [-LEG_CENTER_X, LEG_HEIGHT / 2, LEG_CENTER_Z],
  [-LEG_CENTER_X, LEG_HEIGHT / 2, -LEG_CENTER_Z],
];

/**
 * Primitive blockout of the workbench — the room's center of gravity.
 * Establishes scale, proportion, and spatial hierarchy only; detail and
 * materials arrive in later work orders. Centered on the world origin
 * in X/Z, standing on the floor.
 */
export function Workbench() {
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <mesh position={[0, surfaceHeight - top.thickness / 2, 0]}>
        <boxGeometry args={[top.width, top.thickness, top.depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {LEG_POSITIONS.map((position) => (
        <mesh key={position.join(",")} position={position}>
          <boxGeometry args={[leg.size, LEG_HEIGHT, leg.size]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}
