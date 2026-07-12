"use client";

import { RoundedBox } from "@react-three/drei";

import { ceramic, paper } from "@/three/materials/procedural";
import { WORKBENCH } from "@/three/scene/constants";
import {
  BOOK_STACK,
  CAMERA,
  CONSIDERED_PRINT,
  FILM_CANISTERS,
  HEADPHONES,
  LOOSE_SHEETS,
  MUG,
  PENCIL,
  PENCIL_JAR,
  TAPE_ROLL,
  TEST_PRINTS,
} from "@/three/scene/dressing/workbench";
import { fromWorkbench } from "@/three/scene/world";

const SURFACE = WORKBENCH.surfaceHeight;

/** Test prints leaning from the bench's rear band onto the wall. */
function TestPrints() {
  const { thickness, prints } = TEST_PRINTS;
  return (
    <>
      {prints.map((print, index) => (
        <group
          key={`${print.x},${print.z}`}
          position={[
            print.x,
            SURFACE + (print.height / 2) * Math.cos(print.lean),
            print.z - (print.height / 2) * Math.sin(print.lean),
          ]}
          rotation={[-print.lean, print.yaw, 0]}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[print.width, print.height, thickness]} />
            <meshStandardMaterial
              map={paper({
                seed: 371 + index,
                base: print.color,
                fiber: 0.35,
                handled: 0.25,
                bentCorner: index === 1,
              })}
              roughness={index === 0 ? 0.5 : 0.66}
            />
          </mesh>
          {index === 0 && (
            /* The binder clip that carried it here (0066). */
            <mesh position={[0.01, print.height / 2 - 0.008, 0.002]} castShadow>
              <boxGeometry args={[0.024, 0.016, 0.006]} />
              <meshStandardMaterial color="#2e2c2a" roughness={0.4} metalness={0.5} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

/** Reference books stacked where they were pulled, not reshelved. */
function BookStack() {
  const { at, books } = BOOK_STACK;
  let top = SURFACE;
  return (
    <>
      {books.map((book) => {
        const y = top + book.thickness / 2;
        top += book.thickness;
        return (
          <mesh
            key={book.color}
            position={[at.x, y, at.z]}
            rotation={[0, book.yaw, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[book.width, book.thickness, book.length]} />
            <meshStandardMaterial
              map={paper({ seed: 373, base: book.color, fiber: 0.55 })}
              roughness={0.85}
            />
          </mesh>
        );
      })}
    </>
  );
}

/** The pencil jar and its leaning residents. */
function PencilJar() {
  const { at, radius, height, color, sticks, stickRadius } = PENCIL_JAR;
  return (
    <group position={[at.x, SURFACE, at.z]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius * 0.92, height, 20]} />
        <meshStandardMaterial
          map={ceramic(435, color)}
          roughness={0.42}
        />
      </mesh>
      {sticks.map((stick) => (
        <mesh
          key={stick.yaw}
          /* Each stick stands in the jar, leaning until it rests on the rim. */
          position={[
            Math.cos(stick.yaw) * radius * 0.5,
            stick.length / 2 + 0.02,
            Math.sin(stick.yaw) * radius * 0.5,
          ]}
          rotation={[
            Math.sin(stick.yaw) * stick.lean,
            0,
            -Math.cos(stick.yaw) * stick.lean,
          ]}
          castShadow
        >
          <cylinderGeometry
            args={[stickRadius, stickRadius, stick.length, 6]}
          />
          <meshStandardMaterial color={stick.color} />
        </mesh>
      ))}
    </group>
  );
}

/** Masking tape lying flat, its torn tab still standing — used minutes ago. */
function TapeRoll() {
  const { at, outerRadius, width, yaw, color, tab } = TAPE_ROLL;
  return (
    <group
      position={[at.x, SURFACE + width / 2, at.z]}
      rotation={[0, yaw, 0]}
    >
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[outerRadius, outerRadius, width, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh
        position={[outerRadius - 0.004, width / 2 + tab.length / 2 - 0.004, 0]}
        rotation={[0, 0, -tab.lift]}
        castShadow
      >
        <boxGeometry args={[tab.width, tab.length, 0.0006]} />
        <meshStandardMaterial color={tab.color} side={2} />
      </mesh>
    </group>
  );
}

/**
 * The print taken down minutes ago, lying half onto today's papers.
 * (It briefly carried the 0088 video-texture spike; R-0088 moved the
 * moving image to the hero print on the wall, Jonathan's ruling, and
 * this print returned to being what it was.)
 */
function ConsideredPrint() {
  const { at, width, height, thickness, yaw, color } = CONSIDERED_PRINT;
  return (
    <mesh
      position={[at.x, SURFACE + 0.0028, at.z]}
      rotation={[0, yaw, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[width, thickness, height]} />
      {/* Glossier stock than the wall prints (0066): fresh from the lab. */}
      <meshStandardMaterial
        map={paper({ seed: 641, base: color, fiber: 0.2, handled: 0.15 })}
        roughness={0.42}
      />
    </mesh>
  );
}

/** The mug that went cold, handle turned away. */
function Mug() {
  const { at, radius, height, handleYaw, color } = MUG;
  return (
    <group position={[at.x, SURFACE, at.z]} rotation={[0, handleYaw, 0]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius * 0.94, height, 24]} />
        <meshStandardMaterial map={ceramic(437, color)} roughness={0.35} />
      </mesh>
      {/* 0098: a rolled rim and the dark of an interior — a mug, not a
          cylinder. The last coffee's level line lives just inside. */}
      <mesh position={[0, height, 0]}>
        <torusGeometry args={[radius - 0.0022, 0.0024, 10, 24]} />
        <meshStandardMaterial map={ceramic(437, color)} roughness={0.32} />
      </mesh>
      <mesh position={[0, height - 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius - 0.0045, 24]} />
        <meshStandardMaterial color="#2e2620" roughness={0.6} />
      </mesh>
      <mesh position={[radius + 0.012, height * 0.55, 0]} castShadow>
        <torusGeometry args={[0.02, 0.006, 8, 16]} />
        <meshStandardMaterial map={ceramic(437, color)} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** Headphones set down open, band flat on the surface. */
function Headphones() {
  const { at, bandRadius, bandTube, cupRadius, cupHeight, yaw, color } =
    HEADPHONES;
  return (
    <group position={[at.x, SURFACE, at.z]} rotation={[0, yaw, 0]}>
      {/* Half-arc headband lying flat. */}
      <mesh
        position={[0, bandTube, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
      >
        <torusGeometry args={[bandRadius, bandTube, 8, 24, Math.PI]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {[-bandRadius, bandRadius].map((x) => (
        <mesh key={x} position={[x, cupHeight / 2, 0.01]} castShadow>
          <cylinderGeometry args={[cupRadius, cupRadius, cupHeight, 18]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** The pencil resting across the notebook, stopped halfway through a thought. */
function Pencil() {
  const { at, restsOn, length, radius, yaw, color } = PENCIL;
  return (
    <mesh
      position={[at.x, SURFACE + restsOn + radius, at.z]}
      rotation={[Math.PI / 2, 0, yaw]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[radius, radius, length, 6]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/** Today's working papers, shuffled rather than stacked. */
function LooseSheets() {
  const { width, length, thickness, sheets, color } = LOOSE_SHEETS;
  return (
    <>
      {sheets.map((sheet, index) => (
        <mesh
          key={`${sheet.x},${sheet.z}`}
          /* Stacked a hair apart so overlapping sheets never z-fight. */
          position={[sheet.x, SURFACE + thickness * (index + 1.5), sheet.z]}
          rotation={[0, sheet.yaw, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width, thickness, length]} />
          <meshStandardMaterial
            map={paper({
              seed: 375 + index,
              base: color,
              fiber: 0.3,
              handled: 0.2,
            })}
            roughness={0.9}
          />
        </mesh>
      ))}
    </>
  );
}

/** One 35mm film canister, emptied from a pocket mid-task. */
function FilmCanisters() {
  const { radius, height, color, standing } = FILM_CANISTERS;
  return (
    <mesh
      position={[standing.x, SURFACE + height / 2, standing.z]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[radius, radius, height, 16]} />
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  );
}

/** The camera set down after checking a frame, lens toward the wall. */
function Camera() {
  const { at, body, lens, prism, yaw, bodyColor, lensColor } = CAMERA;
  return (
    /* Rebuilt at 0098 (the five tells): a camera body, not a black box —
       rounded housing, leatherette band, a lens with a hood ring and a
       recessed dark element, the prism hump softened, a shutter button.
       Still procedural, still the same object that was set down
       lens-toward-the-wall in 0037. */
    <group position={[at.x, SURFACE, at.z]} rotation={[0, yaw, 0]}>
      <RoundedBox
        args={[body.width, body.height, body.depth]}
        radius={0.006}
        smoothness={3}
        position={[0, body.height / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={bodyColor} roughness={0.42} metalness={0.35} />
      </RoundedBox>
      {/* Leatherette grip band around the middle. */}
      <RoundedBox
        args={[body.width + 0.002, body.height * 0.48, body.depth + 0.002]}
        radius={0.005}
        smoothness={2}
        position={[0, body.height * 0.42, 0]}
        castShadow
      >
        <meshStandardMaterial color="#2a2a2a" roughness={0.85} metalness={0.05} />
      </RoundedBox>
      {/* Lens barrel, hood ring, and the dark recessed element. */}
      <mesh
        position={[0, body.height / 2, body.depth / 2 + lens.length / 2]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry args={[lens.radius, lens.radius * 0.92, lens.length, 28]} />
        <meshStandardMaterial color={lensColor} roughness={0.38} metalness={0.45} />
      </mesh>
      <mesh
        position={[0, body.height / 2, body.depth / 2 + lens.length - 0.003]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[lens.radius * 0.94, 0.0035, 10, 28]} />
        <meshStandardMaterial color="#1b1b1b" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh
        position={[0, body.height / 2, body.depth / 2 + lens.length + 0.001]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[lens.radius * 0.62, lens.radius * 0.62, 0.004, 24]} />
        <meshStandardMaterial color="#0d0d10" roughness={0.15} metalness={0.6} />
      </mesh>
      {/* Prism hump, softened. */}
      <RoundedBox
        args={[prism.width, prism.height, prism.depth]}
        radius={0.005}
        smoothness={2}
        position={[0, body.height + prism.height / 2 - 0.002, 0]}
        castShadow
      >
        <meshStandardMaterial color={bodyColor} roughness={0.42} metalness={0.35} />
      </RoundedBox>
      {/* Shutter button, where a right thumb expects it. */}
      <mesh position={[body.width / 2 - 0.016, body.height + 0.0025, 0.008]}>
        <cylinderGeometry args={[0.004, 0.004, 0.005, 12]} />
        <meshStandardMaterial color="#8f8a80" roughness={0.35} metalness={0.6} />
      </mesh>
    </group>
  );
}

/**
 * The workbench's set dressing (WORK ORDER 0037) — Zone 1, blockout pass.
 * Today's work, interrupted: every piece is placed by the bench's zone
 * language and justified in the dressing manifest. Primitive geometry and
 * flat color only; materials are a later pass.
 */
export function WorkbenchDressing() {
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <TestPrints />
      <ConsideredPrint />
      <BookStack />
      <PencilJar />
      <TapeRoll />
      <Mug />
      <Headphones />
      <Pencil />
      <LooseSheets />
      <FilmCanisters />
      <Camera />
    </group>
  );
}
