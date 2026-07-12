"use client";

import { ROOM } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

/**
 * The abandoned hook (WORK ORDER 0057) — high on the rear wall, aged
 * brass, holding nothing. Something used to hang from it; nobody
 * remembers what. It has existed longer than the current arrangement,
 * and it is not meant to be read.
 */
const HOOK = {
  at: { x: -0.35, y: 2.08 },
  plate: { radius: 0.016, depth: 0.004 },
  arm: { radius: 0.0045, length: 0.05, upturn: 0.022 },
  color: "#6b5f48",
} as const;

export function UpperWall() {
  const wallZ = ROOM.rearWall.z;
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <group position={[HOOK.at.x, HOOK.at.y, wallZ]}>
        {/* Mounting plate. */}
        <mesh
          position={[0, 0, HOOK.plate.depth / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry
            args={[
              HOOK.plate.radius,
              HOOK.plate.radius,
              HOOK.plate.depth,
              12,
            ]}
          />
          <meshStandardMaterial
            color={HOOK.color}
            roughness={0.5}
            metalness={0.4}
          />
        </mesh>
        {/* Arm reaching out, then the little upturn that held something. */}
        <mesh
          position={[0, -0.004, HOOK.arm.length / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry
            args={[HOOK.arm.radius, HOOK.arm.radius, HOOK.arm.length, 8]}
          />
          <meshStandardMaterial
            color={HOOK.color}
            roughness={0.5}
            metalness={0.4}
          />
        </mesh>
        <mesh
          position={[0, HOOK.arm.upturn / 2 - 0.004, HOOK.arm.length]}
          castShadow
        >
          <cylinderGeometry
            args={[HOOK.arm.radius, HOOK.arm.radius, HOOK.arm.upturn, 8]}
          />
          <meshStandardMaterial
            color={HOOK.color}
            roughness={0.5}
            metalness={0.4}
          />
        </mesh>
      </group>
    </group>
  );
}
