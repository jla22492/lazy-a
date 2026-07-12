"use client";

import { featheredQuadTexture } from "@/three/materials/procedural";
import { STANDING_POSITIONS } from "@/three/scene/workspace";
import { fromWorkbench } from "@/three/scene/world";

/**
 * The floor's routes (WORK ORDER 0062) — habit worn into the concrete.
 * The path from the doorway behind the camera to the bench's working
 * side, and the spot where the body always stands: trafficked concrete
 * carries a faint grime-polish the renderer can't grow on its own.
 * Evidence of years of the same walk — derived from the doorway's true
 * direction and STANDING_POSITIONS.working, not composed.
 */
const WEAR_COLOR = "#2a241d";

export function FloorWear() {
  const working = STANDING_POSITIONS.working;
  /* The walked line enters from the bottom-left of frame (the doorway is
     behind the camera in the left wall) and lands at the working spot. */
  const path = {
    from: { x: -1.5, z: 1.35 },
    to: { x: working.at[0], z: working.at[1] },
  };
  const dx = path.to.x - path.from.x;
  const dz = path.to.z - path.from.z;
  const length = Math.hypot(dx, dz) + 0.6;
  const heading = Math.atan2(dx, dz);
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      {/* The route. */}
      <mesh
        position={[
          (path.from.x + path.to.x) / 2,
          0.0008,
          (path.from.z + path.to.z) / 2,
        ]}
        rotation={[-Math.PI / 2, 0, heading]}
      >
        <planeGeometry args={[0.5, length]} />
        <meshBasicMaterial
          map={featheredQuadTexture(0.5)}
          color={WEAR_COLOR}
          transparent
          opacity={0.04}
          depthWrite={false}
        />
      </mesh>
      {/* Where the body always stands. */}
      <mesh
        position={[working.at[0], 0.0012, working.at[1]]}
        rotation={[-Math.PI / 2, 0, 0.2]}
      >
        <planeGeometry args={[0.75, 0.5]} />
        <meshBasicMaterial
          map={featheredQuadTexture(0.5)}
          color={WEAR_COLOR}
          transparent
          opacity={0.05}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
