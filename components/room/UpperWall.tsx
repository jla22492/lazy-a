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

/**
 * The return-air grille (WORK ORDER 0058) — high on the rear wall, aged
 * metal a shade duller than the outlets, five slats, dust drifted onto
 * the paint above it. The building breathes through the room.
 */
const VENT = {
  at: { x: 1.75, y: 2.18 },
  width: 0.3,
  height: 0.16,
  depth: 0.014,
  slats: 5,
  color: "#cfc9ba",
} as const;

/**
 * The smoke detector (WORK ORDER 0058) — wall-mounted a hand below the
 * ceiling line, code-required, ignored for years. The building insures
 * itself; the room complies.
 */
const SMOKE_DETECTOR = {
  at: { x: -0.6, y: 2.3 },
  radius: 0.055,
  depth: 0.028,
  color: "#e8e4d8",
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
      {/* The grille the building breathes through. */}
      <group position={[VENT.at.x, VENT.at.y, wallZ + VENT.depth / 2]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[VENT.width, VENT.height, VENT.depth]} />
          <meshStandardMaterial
            color={VENT.color}
            roughness={0.55}
            metalness={0.25}
          />
        </mesh>
        {Array.from({ length: VENT.slats }, (_, index) => (
          <mesh
            key={index}
            position={[
              0,
              VENT.height / 2 -
                ((index + 1) * VENT.height) / (VENT.slats + 1),
              VENT.depth / 2 - 0.003,
            ]}
            rotation={[0.5, 0, 0]}
          >
            <boxGeometry args={[VENT.width - 0.03, 0.018, 0.002]} />
            <meshStandardMaterial
              color="#8f887a"
              roughness={0.6}
              metalness={0.2}
            />
          </mesh>
        ))}
      </group>
      {/* The detector the building requires. */}
      <group
        position={[
          SMOKE_DETECTOR.at.x,
          SMOKE_DETECTOR.at.y,
          wallZ + SMOKE_DETECTOR.depth / 2,
        ]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <mesh castShadow>
          <cylinderGeometry
            args={[
              SMOKE_DETECTOR.radius,
              SMOKE_DETECTOR.radius * 0.92,
              SMOKE_DETECTOR.depth,
              16,
            ]}
          />
          <meshStandardMaterial color={SMOKE_DETECTOR.color} roughness={0.6} />
        </mesh>
        <mesh position={[0, -SMOKE_DETECTOR.depth / 2 - 0.002, 0]}>
          <cylinderGeometry
            args={[SMOKE_DETECTOR.radius * 0.4, SMOKE_DETECTOR.radius * 0.4, 0.006, 12]}
          />
          <meshStandardMaterial color="#d5d0c2" roughness={0.65} />
        </mesh>
      </group>
    </group>
  );
}
