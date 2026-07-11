"use client";

import { NOTEBOOK, WORKBENCH } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

const REST_POSITION = fromWorkbench([
  NOTEBOOK.offset[0],
  WORKBENCH.surfaceHeight + NOTEBOOK.thickness / 2,
  NOTEBOOK.offset[2],
]);

/**
 * Primitive blockout of the notebook — the first object with narrative
 * weight. It establishes position, scale, and orientation only; detail
 * arrives in later work orders (WORK ORDER 0009).
 *
 * In the workbench language (three/scene/workspace.ts) it rests inside
 * the ACTIVE zone at its dominant-hand edge — where the most recently
 * used object naturally sits. The language confirms the placement
 * (WORK ORDER 0010); it does not move.
 */
export function Notebook() {
  return (
    <mesh
      position={REST_POSITION}
      rotation-y={NOTEBOOK.rotationY}
      castShadow
      receiveShadow
    >
      <boxGeometry
        args={[NOTEBOOK.width, NOTEBOOK.thickness, NOTEBOOK.length]}
      />
      <meshStandardMaterial color={NOTEBOOK.color} />
    </mesh>
  );
}
