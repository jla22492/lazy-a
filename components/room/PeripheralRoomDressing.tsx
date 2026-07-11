"use client";

import { useMemo } from "react";

import { CatmullRomCurve3, DoubleSide, Vector3 } from "three";

import { leather, paper, plaster, wood } from "@/three/materials/procedural";
import {
  BOOKCASE,
  CHAIR,
  LEANING_BOARD,
  PLANT,
  ROLLED_PENCIL,
  WASTEBASKET,
} from "@/three/scene/dressing/peripheralRoom";
import { fromWorkbench } from "@/three/scene/world";

/** The chair someone stood up from quickly. */
function Chair() {
  const { at, yaw, seat, pad, leg, back, woodColor, padColor, cloth } = CHAIR;
  const chairWood = wood({
    seed: 461,
    base: woodColor,
    grain: "#4f4033",
    age: 0.8,
  });
  const legHeight = seat.height - seat.thickness;
  const legX = seat.width / 2 - leg.size / 2 - 0.02;
  const legZ = seat.depth / 2 - leg.size / 2 - 0.02;
  const backHeight = back.height - seat.height;
  return (
    <group position={[at.x, 0, at.z]} rotation={[0, yaw, 0]}>
      {/* Seat. */}
      <mesh
        position={[0, seat.height - seat.thickness / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[seat.width, seat.thickness, seat.depth]} />
        <meshStandardMaterial map={chairWood} roughness={0.7} />
      </mesh>
      {/* Worn leather pad. */}
      <mesh
        position={[0, seat.height + pad.thickness / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            seat.width - pad.inset * 2,
            pad.thickness,
            seat.depth - pad.inset * 2,
          ]}
        />
        <meshStandardMaterial
          map={leather({ seed: 429, base: padColor, worn: 0.7 })}
          roughness={0.6}
        />
      </mesh>
      {/* Legs. */}
      {[
        [legX, legZ],
        [legX, -legZ],
        [-legX, legZ],
        [-legX, -legZ],
      ].map(([x, z]) => (
        <mesh
          key={`${x},${z}`}
          position={[x, legHeight / 2, z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[leg.size, legHeight, leg.size]} />
          <meshStandardMaterial map={chairWood} roughness={0.7} />
        </mesh>
      ))}
      {/* Backrest uprights, rising from the rear legs. */}
      {[legX, -legX].map((x) => (
        <mesh
          key={x}
          position={[x, seat.height + backHeight / 2, -legZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[back.upright.width, backHeight, back.upright.depth]} />
          <meshStandardMaterial map={chairWood} roughness={0.7} />
        </mesh>
      ))}
      {/* Top slat. */}
      <mesh
        position={[
          0,
          back.height - back.slat.fromTop - back.slat.height / 2,
          -legZ,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[seat.width - 0.04, back.slat.height, back.slat.thickness]}
        />
        <meshStandardMaterial map={chairWood} roughness={0.7} />
      </mesh>
      {/* The work cloth over the slat: a thin drape, not an object — a
          narrow saddle across the slat's top and two thin uneven falls. */}
      <group
        position={[
          0.03,
          back.height - back.slat.fromTop + cloth.thickness,
          -legZ,
        ]}
        rotation={[0, cloth.yaw, 0]}
      >
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry
            args={[cloth.width, cloth.thickness, back.slat.thickness + 0.016]}
          />
          <meshStandardMaterial
            map={paper({ seed: 471, base: cloth.color, fiber: 0.65 })}
            roughness={0.95}
          />
        </mesh>
        <mesh
          position={[
            0,
            -cloth.drop / 2,
            -(back.slat.thickness / 2 + 0.008 + cloth.thickness / 2),
          ]}
          rotation={[0.04, 0, 0.03]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[cloth.width, cloth.drop, cloth.thickness]} />
          <meshStandardMaterial
            map={paper({ seed: 471, base: cloth.color, fiber: 0.65 })}
            roughness={0.95}
          />
        </mesh>
        <mesh
          position={[
            0.008,
            -cloth.frontDrop / 2,
            back.slat.thickness / 2 + 0.008 + cloth.thickness / 2,
          ]}
          rotation={[-0.04, 0, -0.05]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[cloth.width * 0.94, cloth.frontDrop, cloth.thickness]}
          />
          <meshStandardMaterial
            map={paper({ seed: 472, base: cloth.color, fiber: 0.65 })}
            roughness={0.95}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The one living thing in a room full of manufactured objects — that is
 * why the person keeps it, and the build says so: stems bow toward the
 * window, no two leaves agree, one has gone yellow and not yet fallen.
 */
function Plant() {
  const { at, pot, soil, stems, leafTones, droppedLeaf } = PLANT;
  const curves = useMemo(
    () =>
      stems.curves.map(
        (stem) =>
          new CatmullRomCurve3(
            stem.points.map((p) => new Vector3(p.x, p.y, p.z)),
          ),
      ),
    [stems],
  );
  return (
    <group position={[at.x, 0, at.z]}>
      <mesh position={[0, pot.height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry
          args={[pot.radius, pot.radius * 0.82, pot.height, 20]}
        />
        <meshStandardMaterial
          map={plaster({ seed: 433, base: pot.color, age: 0.5 })}
          roughness={0.85}
        />
      </mesh>
      {/* Soil, sunken below the rim. */}
      <mesh position={[0, pot.height - soil.depth, 0]} receiveShadow>
        <cylinderGeometry
          args={[
            pot.radius - soil.inset,
            pot.radius - soil.inset,
            0.005,
            18,
          ]}
        />
        <meshStandardMaterial color={soil.color} roughness={1} />
      </mesh>
      {/* Stems bowing toward the window. */}
      {curves.map((curve, stemIndex) => (
        <mesh key={stemIndex} castShadow>
          <tubeGeometry args={[curve, 12, stems.radius, 6, false]} />
          <meshStandardMaterial color={stems.color} roughness={0.8} />
        </mesh>
      ))}
      {/* Leaves: broad ovals, each at its own age and angle. */}
      {stems.curves.map((stem, stemIndex) =>
        stem.leaves.map((leaf, leafIndex) => {
          const anchor = curves[stemIndex].getPoint(leaf.t);
          return (
            <group
              key={`${stemIndex}-${leafIndex}`}
              position={[anchor.x, anchor.y, anchor.z]}
              rotation={[0, leaf.yaw, 0]}
            >
              {/* The oval hangs off its stem point, drooping by age. */}
              <mesh
                position={[leaf.size * 0.75, 0, 0]}
                rotation={[0, 0, -leaf.droop]}
                /* Broad oval, not a disc: elongated along its own axis. */
                scale={[1.5, 1, 1]}
                castShadow
              >
                <circleGeometry args={[leaf.size, 12]} />
                <meshStandardMaterial
                  color={leafTones[leaf.tone as keyof typeof leafTones]}
                  roughness={0.75}
                  side={DoubleSide}
                />
              </mesh>
            </group>
          );
        }),
      )}
      {/* The leaf that let go, flat on the floor in world space. */}
      <mesh
        position={[
          droppedLeaf.at.x - at.x,
          0.002,
          droppedLeaf.at.z - at.z,
        ]}
        rotation={[-Math.PI / 2, 0, droppedLeaf.yaw]}
        receiveShadow
      >
        <circleGeometry args={[droppedLeaf.length / 2, 10]} />
        <meshStandardMaterial color={droppedLeaf.color} />
      </mesh>
    </group>
  );
}

/** The working library that feeds the bench's book stack. */
function Bookcase() {
  const { at, width, height, depth, panelThickness, shelfHeights, color, books, notebookStack } =
    BOOKCASE;
  const caseWood = wood({
    seed: 463,
    base: color,
    grain: "#57493a",
    age: 0.6,
  });
  const innerBottom = panelThickness;
  /* Books stand against the wall side; the case opens into the room. */
  const rowsAt: Array<{ y: number; row: readonly { w: number; h: number; lean: number }[] }> = [
    { y: innerBottom, row: books.lower },
    { y: shelfHeights[0] + panelThickness / 2, row: books.upper },
  ];
  return (
    /* Authored in wall-local axes (depth along X); rotated so the books
       face into the room from the rear wall. */
    <group position={[at.x, 0, at.z]} rotation={[0, Math.PI / 2, 0]}>
      {/* Carcass: two sides, top, bottom, one shelf. Back stays open — the
          wall shows through, as cheap studio shelving does. */}
      {[
        { key: "bottom", pos: [0, panelThickness / 2, 0], size: [depth, panelThickness, width] },
        { key: "top", pos: [0, height - panelThickness / 2, 0], size: [depth, panelThickness, width] },
        { key: "shelf", pos: [0, shelfHeights[0], 0], size: [depth, panelThickness, width - panelThickness * 2] },
        { key: "left", pos: [0, height / 2, width / 2 - panelThickness / 2], size: [depth, height, panelThickness] },
        { key: "right", pos: [0, height / 2, -(width / 2 - panelThickness / 2)], size: [depth, height, panelThickness] },
      ].map(({ key, pos, size }) => (
        <mesh
          key={key}
          position={[pos[0], pos[1], pos[2]]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[size[0], size[1], size[2]]} />
          <meshStandardMaterial map={caseWood} roughness={0.78} />
        </mesh>
      ))}
      {rowsAt.map(({ y, row }) => {
        let along = -width / 2 + panelThickness + 0.03;
        return row.map((book, index) => {
          const bookColor = books.colors[index % books.colors.length];
          const z = along + book.w / 2;
          along += book.w + (book.lean !== 0 ? 0.02 : 0.004);
          return (
            <mesh
              key={`${y}-${index}`}
              position={[0, y + book.h / 2, z]}
              rotation={[book.lean, 0, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.19, book.h, book.w]} />
              <meshStandardMaterial color={bookColor} />
            </mesh>
          );
        });
      })}
      {/* The filled notebooks (0052): identical to the bench's, oldest
          at the bottom and most faded — they always buy the same one. */}
      {notebookStack.fades.map((fade: string, index: number) => (
        <mesh
          key={`nb-${index}`}
          /* On top of the case — where filled notebooks actually pile,
             and the one surface the leaning board can't hide. */
          position={[
            0.02,
            height + notebookStack.thickness * (index + 0.5),
            -0.25,
          ]}
          rotation={[0, notebookStack.yaws[index], 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[
              notebookStack.length,
              notebookStack.thickness,
              notebookStack.width,
            ]}
          />
          <meshStandardMaterial
            map={paper({ seed: 521 + index, base: fade, fiber: 0.4, handled: 0.5 })}
            roughness={0.8}
          />
        </mesh>
      ))}
      {/* Flat stack at the upper shelf's right end. */}
      {Array.from({ length: books.flatStack.count }, (_, index) => (
        <mesh
          key={`flat-${index}`}
          position={[
            0,
            shelfHeights[0] +
              panelThickness / 2 +
              books.flatStack.each * (index + 0.5),
            width / 2 - panelThickness - books.flatStack.w / 2 - 0.02,
          ]}
          rotation={[0, index * 0.06 - 0.06, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[books.flatStack.d, books.flatStack.each, books.flatStack.w]}
          />
          <meshStandardMaterial
            color={books.colors[(index + 3) % books.colors.length]}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Finished work that never made it up — leaning at floor level. */
function LeaningBoard() {
  const { at, width, height, thickness, lean, yaw, color } = LEANING_BOARD;
  return (
    <mesh
      position={[
        at.x,
        (height / 2) * Math.cos(lean),
        at.z - (height / 2) * Math.sin(lean),
      ]}
      rotation={[-lean, yaw, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[width, height, thickness]} />
      <meshStandardMaterial
        map={paper({ seed: 467, base: color, fiber: 0.25, handled: 0.3 })}
        roughness={0.68}
      />
    </mesh>
  );
}

/**
 * The peripheral room's set dressing (WORK ORDER 0039) — Zone 3, blockout
 * pass. How Lazy A lives: the interrupted chair, the one living thing,
 * a dropped sheet, the working library, and finished work leaning at
 * floor level. Primitive geometry and flat color only.
 */
/** Somewhere for paper to go — and the shot that missed. */
function Wastebasket() {
  const { at, radius, height, thickness, color, crumple } = WASTEBASKET;
  return (
    <>
      <group position={[at.x, 0, at.z]}>
        {/* Open cylinder plus a bottom: a bin, not a column. */}
        <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry
            args={[radius, radius * 0.88, height, 18, 1, true]}
          />
          <meshStandardMaterial color={color} roughness={0.6} side={2} />
        </mesh>
        <mesh position={[0, thickness / 2, 0]} receiveShadow>
          <cylinderGeometry
            args={[radius * 0.88, radius * 0.88, thickness, 18]}
          />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      </group>
      {/* The miss: a crumpled ball where it landed. */}
      <mesh
        position={[crumple.at.x, crumple.radius * 0.8, crumple.at.z]}
        scale={[1, 0.8, 1]}
        castShadow
        receiveShadow
      >
        <icosahedronGeometry args={[crumple.radius, 0]} />
        <meshStandardMaterial
          map={paper({ seed: 531, base: crumple.color, fiber: 0.4, handled: 0.6 })}
          roughness={0.95}
          flatShading
        />
      </mesh>
    </>
  );
}

/** The pencil that rolled until the frame happened to cut it. */
function RolledPencil() {
  const { at, length, radius, yaw, color } = ROLLED_PENCIL;
  return (
    <mesh
      position={[at.x, radius, at.z]}
      rotation={[Math.PI / 2, 0, yaw]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[radius, radius, length, 6]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function PeripheralRoomDressing() {
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <Chair />
      <Plant />
      <Bookcase />
      <LeaningBoard />
      <Wastebasket />
      <RolledPencil />
    </group>
  );
}
