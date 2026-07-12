"use client";

import { paper, wood } from "@/three/materials/procedural";
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
      {/* Heavier stock than everything around it (0066) — the thickness
          reads at the edge; the blankness stays untouched. */}
      <boxGeometry args={[width, height, thickness * 2.2]} />
      <meshStandardMaterial
        map={paper({ seed: 411, base: color, fiber: 0.3, handled: 0.15 })}
        roughness={0.68}
      />
    </mesh>
  );
}

/** Influences pinned one at a time over years, never curated. */
function PinnedCluster() {
  const { photoColor, paperColor, thickness, items } = PINNED_CLUSTER;
  return (
    <>
      {items.map((item, index) => {
        const curl = "curl" in item ? item.curl : 0;
        return (
          <group
            key={`${item.x},${item.y}`}
            /* Curling items pivot at their top edge, bottom lifting off
               the wall; flat items just hang. */
            position={[
              item.x,
              item.y + (curl ? item.h / 2 : 0),
              WALL_Z + WALL_GAP + thickness * (index + 1),
            ]}
            rotation={[curl ?? 0, 0, item.roll]}
          >
            <mesh
              position={[0, curl ? -item.h / 2 : 0, 0]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[item.w, item.h, thickness]} />
              {/* Physical history varies per item (0066): the oldest photo
                  is sun-faded, its neighbor's corner never flattened, the
                  slipped one is glossier stock — never the same blank
                  twice. */}
              <meshStandardMaterial
                map={paper(
                  item.kind === "photo"
                    ? {
                        seed: 421 + index,
                        base: photoColor,
                        fiber: 0.12,
                        handled: 0.3,
                        faded: index === 0 ? 0.8 : 0,
                        bentCorner: index === 1,
                      }
                    : {
                        seed: 431 + index,
                        base: index === 3 ? "#cbbd9d" : paperColor,
                        fiber: index === 3 ? 0.7 : 0.45,
                        handled: 0.35,
                      },
                )}
                roughness={
                  item.kind === "photo" ? (index === 4 ? 0.38 : 0.55) : 0.85
                }
              />
            </mesh>
            {"freshTape" in item && item.freshTape && (
              /* The re-taped corner: tape newer than the photo it holds. */
              <mesh
                position={[item.w / 2 - 0.012, item.h / 2 - 0.004, thickness]}
                rotation={[0, 0, 0.7]}
              >
                <boxGeometry args={[0.036, 0.014, 0.0004]} />
                <meshStandardMaterial
                  color="#efe9d8"
                  transparent
                  opacity={0.82}
                  roughness={0.4}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

/** The picture ledge and what currently leans on it. */
function PictureLedge() {
  const { center, length, depth, thickness, color, framed } = PICTURE_LEDGE;
  const surfaceY = center.y + thickness / 2;
  return (
    <>
      <mesh
        position={[center.x, center.y, WALL_Z + depth / 2]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[length, thickness, depth]} />
        <meshStandardMaterial
          map={wood({ seed: 441, base: color, grain: "#5b4a38", age: 0.5 })}
          roughness={0.75}
        />
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
        <meshStandardMaterial
          map={wood({ seed: 443, base: framed.frameColor, grain: "#332e29", age: 0.2 })}
          roughness={0.65}
        />
      </mesh>
      {/* The unframed print that overlapped the framed one was edited out
          at 0068 — it repeated the leaning board's truth. */}
    </>
  );
}

/** Tasks, not decor: sticky notes at the eye-line of someone at the bench. */
function StickyNotes() {
  const { size, thickness, color, items } = STICKY_NOTES;
  return (
    <>
      {items.map((item, index) => (
        <mesh
          key={`${item.x},${item.y}`}
          position={[item.x, item.y, WALL_Z + WALL_GAP + thickness / 2]}
          rotation={[0, 0, item.roll]}
          receiveShadow
        >
          <boxGeometry args={[size, size, thickness]} />
          {/* The older note has faded a season further (0066). */}
          <meshStandardMaterial
            map={paper({
              seed: 451 + index,
              base: color,
              fiber: 0.2,
              faded: index === 0 ? 0.6 : 0,
            })}
            roughness={0.9}
          />
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
