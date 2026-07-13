"use client";

import { Suspense, useRef } from "react";

import { RoundedBox, useTexture, useVideoTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { SRGBColorSpace } from "three";

import logoNote from "@/public/brand/logo-note.png";
import { assetPath } from "@/lib/assetPath";
import { paper, wood, woodNormal } from "@/three/materials/procedural";
import {
  REFLECTION_INTENSITY,
  useReflections,
} from "@/three/lighting/reflections";
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

/**
 * The hero shot (R-0088, Jonathan's ruling — supersedes "the hero print
 * stays blank"): the studio's defining image lives on the big print,
 * and it MOVES. The film waits through the walk — a printed poster like
 * any other — and begins playing a beat after the perspective settles
 * into the chair: the ~5-second moment, unprompted, in plain sight.
 * PLACEHOLDER footage until the moment is authored.
 */
const HERO_FILM = {
  src: "/videos/hero-print-placeholder.mp4",
  /** The stock keeps a print's margin around the image. */
  border: 0.008,
  /** A breath between the settle and the first movement. */
  settleBeatSeconds: 1.8,
  /** 0099: printed light — the pane catches the window like gloss stock. */
  roughness: 0.38,
} as const;

function HeroFilm() {
  const { width, height, thickness } = HERO_PRINT;
  const reflections = useReflections();
  const texture = useVideoTexture(assetPath(HERO_FILM.src), {
    muted: true,
    loop: true,
    start: false,
  });
  const beat = useRef(0);
  const playing = useRef(false);
  useFrame((_, delta) => {
    if (playing.current) return;
    const arrived = (window as Window & { __arrivalDone?: boolean })
      .__arrivalDone;
    if (!arrived) return;
    beat.current += delta;
    if (beat.current < HERO_FILM.settleBeatSeconds) return;
    playing.current = true;
    void texture.image.play();
  });
  return (
    <mesh position={[0, 0, thickness * 1.1 + 0.0004]}>
      <planeGeometry
        args={[width - HERO_FILM.border * 2, height - HERO_FILM.border * 2]}
      />
      <meshStandardMaterial map={texture} roughness={HERO_FILM.roughness} envMap={reflections ?? undefined} envMapIntensity={REFLECTION_INTENSITY.gloss} />
    </mesh>
  );
}

/** The hero print — large, unframed, its image now a film (R-0088). */
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
          reads at the edge. */}
      <boxGeometry args={[width, height, thickness * 2.2]} />
      <meshStandardMaterial
        map={paper({ seed: 411, base: color, fiber: 0.3, handled: 0.15 })}
        roughness={0.68}
      />
      {/* Until the film is ready, the print is simply its stock. */}
      <Suspense fallback={null}>
        <HeroFilm />
      </Suspense>
    </mesh>
  );
}

/** The logo note's face: the letterpress artwork on its own paper. */
function LogoNoteFace({
  w,
  h,
  thickness,
  yOffset,
}: {
  w: number;
  h: number;
  thickness: number;
  yOffset: number;
}) {
  const texture = useTexture(logoNote.src, (loaded) => {
    loaded.colorSpace = SRGBColorSpace;
  });
  return (
    <mesh position={[0, yOffset, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, thickness]} />
      <meshStandardMaterial map={texture} roughness={0.85} />
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
            /* Negative pitch: the bottom edge lifts OFF the wall. (The
               positive sign had quietly tilted the curling note INTO the
               plaster since 0054 — two-thirds buried; the logo moving
               onto this note exposed it.) */
            rotation={[-(curl ?? 0), 0, item.roll]}
          >
            {"logo" in item && item.logo ? (
              /* The studio's letterpress note (R-0087): the logo is part
                 of the room — printed on this note's own paper, pinned
                 above the lamp, curling like everything pinned by hand.
                 Until the texture loads it is simply paper. */
              <Suspense
                fallback={
                  <mesh position={[0, curl ? -item.h / 2 : 0, 0]} castShadow>
                    <boxGeometry args={[item.w, item.h, thickness]} />
                    <meshStandardMaterial color={paperColor} roughness={0.85} />
                  </mesh>
                }
              >
                <LogoNoteFace
                  w={item.w}
                  h={item.h}
                  thickness={thickness}
                  yOffset={curl ? -item.h / 2 : 0}
                />
              </Suspense>
            ) : (
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
                          stock: "smooth",
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
            )}
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
      {/* Bevelled since 0095: a real board's edge, softened by hands. */}
      <RoundedBox
        args={[length, thickness, depth]}
        radius={0.004}
        smoothness={3}
        position={[center.x, center.y, WALL_Z + depth / 2]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          map={wood({ seed: 441, base: color, grain: "#5b4a38", age: 0.5 })}
          normalMap={woodNormal(441, 1.4)}
          roughness={0.75}
        />
      </RoundedBox>
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
