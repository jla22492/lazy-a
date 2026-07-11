"use client";

import {
  OFFSTAGE_TRIPOD,
  POWER_RUN,
  SHIPPING_TUBES,
} from "@/three/scene/dressing/edgeOfFrame";
import { fromWorkbench } from "@/three/scene/world";

/** Print tubes leaning in the right rear corner, half-cut by the frame. */
function ShippingTubes() {
  const { corner, color, tubes, fallen } = SHIPPING_TUBES;
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
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh
        position={[fallen.at.x, fallen.radius, fallen.at.z]}
        rotation={[Math.PI / 2, 0, fallen.yaw]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[fallen.radius, fallen.radius, fallen.length, 14]}
        />
        <meshStandardMaterial color={SHIPPING_TUBES.color} />
      </mesh>
    </>
  );
}

/** The tripod the frame never sees — only its shadow crosses the floor. */
function OffstageTripod() {
  const { at, height, legSpread, legRadius, head, yaw, color } =
    OFFSTAGE_TRIPOD;
  const legLean = Math.atan(legSpread / 2 / height);
  const legLength = Math.sqrt(height * height + (legSpread / 2) ** 2);
  return (
    <group position={[at.x, 0, at.z]} rotation={[0, yaw, 0]}>
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle) => (
        <mesh
          key={angle}
          position={[
            (Math.cos(angle) * legSpread) / 4,
            legLength / 2 - 0.01,
            (Math.sin(angle) * legSpread) / 4,
          ]}
          rotation={[
            Math.sin(angle) * legLean,
            0,
            -Math.cos(angle) * legLean,
          ]}
          castShadow
        >
          <cylinderGeometry args={[legRadius, legRadius, legLength, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0, height + head.height / 2, 0]} castShadow>
        <boxGeometry args={[head.width, head.height, head.depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
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
 * right edge, a tripod that exists only as a shadow, and power arriving
 * from somewhere. Primitive geometry and flat color only.
 */
export function EdgeOfFrameDressing() {
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <ShippingTubes />
      <OffstageTripod />
      <PowerRun />
    </group>
  );
}
