"use client";

import { ROOM } from "@/three/scene/constants";
import {
  HERO_PRINT,
  PICTURE_LEDGE,
  PINNED_CLUSTER,
  STICKY_NOTES,
  WALL_GAP,
} from "@/three/scene/dressing/referenceWall";
import { fromWorkbench } from "@/three/scene/world";

/** The rear wall's plaster plane. */
const WALL_Z = ROOM.rearWall.z;

/** The hero print — large, unframed, off-center, content not yet authored. */
function HeroPrint() {
  const { width, height, thickness, center, roll, color } = HERO_PRINT;
  return (
    <mesh
      position={[center.x, center.y, WALL_Z + WALL_GAP + thickness / 2]}
      rotation={[0, 0, roll]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[width, height, thickness]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/** Influences pinned one at a time over years, never curated. */
function PinnedCluster() {
  const { photoColor, paperColor, thickness, items } = PINNED_CLUSTER;
  return (
    <>
      {items.map((item, index) => (
        <mesh
          key={`${item.x},${item.y}`}
          /* Later pins sit a paper's width prouder, so overlaps read. */
          position={[
            item.x,
            item.y,
            WALL_Z + WALL_GAP + thickness * (index + 1),
          ]}
          rotation={[0, 0, item.roll]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[item.w, item.h, thickness]} />
          <meshStandardMaterial
            color={item.kind === "photo" ? photoColor : paperColor}
          />
        </mesh>
      ))}
    </>
  );
}

/** The picture ledge and what currently leans on it. */
function PictureLedge() {
  const { center, length, depth, thickness, color, framed, unframed, award } =
    PICTURE_LEDGE;
  const surfaceY = center.y + thickness / 2;
  return (
    <>
      <mesh
        position={[center.x, center.y, WALL_Z + depth / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[length, thickness, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Framed still, leaning back to the wall. */}
      <mesh
        position={[
          framed.x,
          surfaceY + (framed.height / 2) * Math.cos(framed.lean),
          WALL_Z +
            depth -
            0.01 -
            (framed.height / 2) * Math.sin(framed.lean) +
            0.01 * Math.sin(framed.lean),
        ]}
        rotation={[-framed.lean, framed.yaw, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[framed.width, framed.height, framed.depth]} />
        <meshStandardMaterial color={framed.frameColor} />
      </mesh>
      {/* Unframed print leaning over the framed one's corner. */}
      <mesh
        position={[
          unframed.x,
          surfaceY + (unframed.height / 2) * Math.cos(unframed.lean),
          WALL_Z +
            depth -
            0.005 -
            (unframed.height / 2) * Math.sin(unframed.lean),
        ]}
        rotation={[-unframed.lean, unframed.yaw, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[unframed.width, unframed.height, unframed.thickness]}
        />
        <meshStandardMaterial color={unframed.color} />
      </mesh>
      {/* The award, turned mostly away. */}
      <mesh
        position={[award.x, surfaceY + award.height / 2, WALL_Z + depth / 2]}
        rotation={[0, award.yaw, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[award.width, award.height, award.depth]} />
        <meshStandardMaterial color={award.color} />
      </mesh>
    </>
  );
}

/** Tasks, not decor: sticky notes at the eye-line of someone at the bench. */
function StickyNotes() {
  const { size, thickness, color, items } = STICKY_NOTES;
  return (
    <>
      {items.map((item) => (
        <mesh
          key={`${item.x},${item.y}`}
          position={[item.x, item.y, WALL_Z + WALL_GAP + thickness / 2]}
          rotation={[0, 0, item.roll]}
          receiveShadow
        >
          <boxGeometry args={[size, size, thickness]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </>
  );
}

/**
 * The reference wall's set dressing (WORK ORDER 0038) — Zone 2, blockout
 * pass. Who Lazy A is: the hero print's future home, influences pinned
 * over years, a ledge where things lean while they matter, and tasks at
 * working eye-line. Primitive geometry and flat color only.
 */
export function ReferenceWallDressing() {
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <HeroPrint />
      <PinnedCluster />
      <PictureLedge />
      <StickyNotes />
    </group>
  );
}
