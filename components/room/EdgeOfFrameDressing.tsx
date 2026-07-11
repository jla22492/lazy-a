"use client";

import { cardboard } from "@/three/materials/procedural";
import { POWER_RUN, SHIPPING_TUBES } from "@/three/scene/dressing/edgeOfFrame";
import { fromWorkbench } from "@/three/scene/world";

/** Print tubes leaning in the right rear corner, half-cut by the frame. */
function ShippingTubes() {
  const { corner, color, tubes } = SHIPPING_TUBES;
  return (
    <>
      {tubes.map((tube) => (
        <mesh
          key={tube.length}
          position={[
            corner.x + tube.offset.x,
            (tube.length / 2) * Math.cos(tube.lean),
            corner.z + tube.offset.z,
          ]}
          rotation={[
            Math.cos(tube.yaw) * tube.lean,
            0,
            Math.sin(tube.yaw) * tube.lean,
          ]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry
            args={[tube.radius, tube.radius, tube.length, 14]}
          />
          <meshStandardMaterial map={cardboard(481, color)} roughness={0.92} />
        </mesh>
      ))}
    </>
  );
}

/** The strip and its lazy cable run — power reaches the bench somehow. */
function PowerRun() {
  const { strip, cable } = POWER_RUN;
  return (
    <>
      <mesh
        position={[strip.at.x, strip.height / 2, strip.at.z]}
        rotation={[0, strip.yaw, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[strip.width, strip.height, strip.depth]} />
        <meshStandardMaterial color={strip.color} />
      </mesh>
      {cable.segments.map((segment) => {
        const dx = segment.to.x - segment.from.x;
        const dz = segment.to.z - segment.from.z;
        const length = Math.hypot(dx, dz);
        return (
          <mesh
            key={`${segment.from.x},${segment.from.z}`}
            position={[
              (segment.from.x + segment.to.x) / 2,
              cable.thickness / 2,
              (segment.from.z + segment.to.z) / 2,
            ]}
            rotation={[0, Math.atan2(dx, dz), 0]}
            receiveShadow
          >
            <boxGeometry args={[cable.thickness, cable.thickness, length]} />
            <meshStandardMaterial color={cable.color} />
          </mesh>
        );
      })}
    </>
  );
}

/**
 * The edge of frame's set dressing (WORK ORDER 0040) — Zone 4, blockout
 * pass. The world continues beyond the browser: tubes cut by the frame's
 * right edge and power arriving from somewhere. (The offstage tripod was
 * retired at the Sprint 02 orientation — it had become the storytelling
 * device instead of a piece of evidence.)
 */
export function EdgeOfFrameDressing() {
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <ShippingTubes />
      <PowerRun />
    </group>
  );
}
