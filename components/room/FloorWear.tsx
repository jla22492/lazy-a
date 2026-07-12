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
  /* Review #2 (0066): the walked-route overlay was removed — it felt
     authored ("I intentionally simulated walking") where the standing
     wear feels discovered. Trust the standing wear. */
  return (
    <group position={fromWorkbench([0, 0, 0])}>
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
