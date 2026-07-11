"use client";

import { wood } from "@/three/materials/procedural";
import { WORKBENCH } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

const { top, leg, surfaceHeight, wood: benchWood } = WORKBENCH;

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
 * The workbench — the room's center of gravity, and since WORK ORDER 0041
 * a surface someone has worked on for years: stained wood with long grain,
 * wear concentrated where the hands actually work (the active zone), ghost
 * rings where mugs have stood, scratches along the grain. The wear map is
 * derived from the workspace zone language, not painted arbitrarily.
 */
export function Workbench() {
  /* Wear in UV space: u spans the top's width (x), v its depth (z).
     The active zone wears most; the mug's resting spot keeps its rings. */
  const topTexture = wood({
    seed: benchWood.seed,
    base: benchWood.base,
    grain: benchWood.grain,
    age: benchWood.age,
    wearSpots: [
      /* Active zone, front-center — where the hands work. */
      { u: 0.55, v: 0.72, r: 0.2 },
      /* Temporary zone — set-down scuffing, lighter. */
      { u: 0.82, v: 0.7, r: 0.12 },
    ],
    rings: [
      /* Where the mug lives (resting zone) — and where it used to live. */
      { u: 0.18, v: 0.72, r: 0.024 },
      { u: 0.21, v: 0.66, r: 0.023 },
      { u: 0.15, v: 0.78, r: 0.024 },
    ],
    halos: [
      /* The pencil jar never moves (WORK ORDER 0050): the un-sunned disc
         of a permanent resident. UV from its bench-local (0.42, -0.2). */
      { u: 0.733, v: 0.233, r: 0.032 },
    ],
  });
  const legTexture = wood({
    seed: benchWood.seed + 1,
    base: benchWood.legBase,
    grain: benchWood.grain,
    age: 0.3,
  });
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <mesh
        position={[0, surfaceHeight - top.thickness / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[top.width, top.thickness, top.depth]} />
        <meshStandardMaterial map={topTexture} roughness={0.72} />
      </mesh>
      {LEG_POSITIONS.map((position) => (
        <mesh
          key={position.join(",")}
          position={position}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[leg.size, LEG_HEIGHT, leg.size]} />
          <meshStandardMaterial map={legTexture} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
