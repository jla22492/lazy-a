"use client";

import { useMemo } from "react";

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
} from "three";

import {
  cornerFalloffTexture,
  featheredQuadTexture,
  windowPatchTexture,
} from "@/three/materials/procedural";
import { useLoader } from "@react-three/fiber";
import { SRGBColorSpace, TextureLoader } from "three";

import { assetPath } from "@/lib/assetPath";
import { DAYLIGHT, ROOM } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

/**
 * The window's daylight patch (WORK ORDER 0049) — computed, not composed.
 * The four corners are the window opening's sill and head edges projected
 * along the sun's real direction onto the floor. The renderer cannot
 * transport light through the opening itself (the walls do not cast), so
 * the patch is authored — but its shape, position, and skew are derived
 * entirely from the room's true geometry. Off-screen light, on-screen
 * evidence.
 */
/**
 * The floor's computed bounce (WORK ORDER 0097): the room's indirect
 * light, baked in the Blender twin with the bench and chair as true
 * occluders, laid additively over the concrete the way every
 * evidence-of-light plane has been since 0049 — except this one is
 * computed, not authored. Covers the visible patch (x -3.2..2.2,
 * z -0.45..4.5) at whisper opacity.
 */
function FloorBounce() {
  const bounce = useLoader(
    TextureLoader,
    assetPath("/textures/gi/gi-floor.png"),
  );
  useMemo(() => {
    bounce.colorSpace = SRGBColorSpace;
  }, [bounce]);
  return (
    <mesh
      position={[-0.5, 0.0015, 2.025]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[5.4, 4.95]} />
      <meshBasicMaterial
        map={bounce}
        blending={AdditiveBlending}
        transparent
        opacity={0.22}
        depthWrite={false}
      />
    </mesh>
  );
}

function WindowPatch() {
  const geometry = useMemo(() => {
    const { window: win, rightWall } = ROOM;
    const sun = DAYLIGHT.sun.position;
    /* Project a point on the window plane along the sun direction to y=0. */
    const project = (y: number, z: number): [number, number] => {
      const t = y / sun[1];
      return [rightWall.x - sun[0] * t, z - sun[2] * t];
    };
    const [x0, zA] = project(win.sill, win.spanZ[0]);
    const [, zB] = project(win.sill, win.spanZ[1]);
    const [x1, zC] = project(win.head, win.spanZ[0]);
    const [, zD] = project(win.head, win.spanZ[1]);
    const g = new BufferGeometry();
    /* Two triangles: sill edge (near wall) to head edge (into the room). */
    const vertices = new Float32Array([
      x0, 0.001, zA, x0, 0.001, zB, x1, 0.001, zC,
      x0, 0.001, zB, x1, 0.001, zD, x1, 0.001, zC,
    ]);
    const uvs = new Float32Array([0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 0]);
    g.setAttribute("position", new BufferAttribute(vertices, 3));
    g.setAttribute("uv", new BufferAttribute(uvs, 2));
    return g;
  }, []);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        /* The vertical presence outside the pane interrupts its own
           light (0063) — one story, two surfaces. */
        map={windowPatchTexture(0.35, 0.12)}
        color="#fff3df"
        transparent
        opacity={0.085}
        blending={AdditiveBlending}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

/**
 * Corner shading (WORK ORDER 0049): the soft occlusion that gathers where
 * walls meet — an approximation of light transport, not a mood. Two thin
 * fades per rear corner, one on each wall face, vanishing within ~14cm.
 */
function CornerShading() {
  const texture = cornerFalloffTexture();
  const { wall, rearWall, leftWall, rightWall } = ROOM;
  const reach = 0.14;
  const corners: Array<{
    key: string;
    position: [number, number, number];
    rotationY: number;
    flip: boolean;
  }> = [
    /* Rear-left corner: fade along the rear wall, and along the left wall. */
    {
      key: "rl-rear",
      position: [leftWall.x + reach / 2, wall.height / 2, rearWall.z + 0.002],
      rotationY: 0,
      flip: true,
    },
    {
      key: "rl-left",
      position: [leftWall.x + 0.002, wall.height / 2, rearWall.z + reach / 2],
      rotationY: Math.PI / 2,
      flip: false,
    },
    /* Rear-right corner. */
    {
      key: "rr-rear",
      position: [rightWall.x - reach / 2, wall.height / 2, rearWall.z + 0.002],
      rotationY: 0,
      flip: false,
    },
    {
      key: "rr-right",
      position: [rightWall.x - 0.002, wall.height / 2, rearWall.z + reach / 2],
      rotationY: -Math.PI / 2,
      flip: true,
    },
  ];
  return (
    <>
      {corners.map((corner) => (
        <mesh
          key={corner.key}
          position={corner.position}
          rotation={[0, corner.rotationY, 0]}
          scale={[corner.flip ? -1 : 1, 1, 1]}
        >
          <planeGeometry args={[reach, wall.height]} />
          <meshBasicMaterial
            map={texture}
            color="#1a1611"
            transparent
            opacity={0.085}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * Evidence of the world beyond the frame (WORK ORDER 0049): the window's
 * daylight patch on the floor, and the quiet occlusion of real corners.
 * The browser interrupts a larger world — it does not contain one.
 */
export function OffscreenWorld() {
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <FloorBounce />
      <WindowPatch />
      <CornerShading />
    </group>
  );
}
