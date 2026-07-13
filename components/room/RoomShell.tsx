"use client";

import { useMemo } from "react";

import { SRGBColorSpace, TextureLoader } from "three";
import { useLoader } from "@react-three/fiber";

import { assetPath } from "@/lib/assetPath";
import { DoubleSide } from "three";

import { frostedPaneTexture, plaster, plasterNormal } from "@/three/materials/procedural";
import { ROOM } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

const {
  wall,
  rearWall,
  leftWall,
  rightWall,
  window: win,
  door,
  baseboard,
} = ROOM;

const REAR_WIDTH = rearWall.spanX[1] - rearWall.spanX[0];
const REAR_CENTER_X = (rearWall.spanX[0] + rearWall.spanX[1]) / 2;

const LEFT_LENGTH = leftWall.spanZ[1] - leftWall.spanZ[0];
const LEFT_CENTER_Z = (leftWall.spanZ[0] + leftWall.spanZ[1]) / 2;

const RIGHT_LENGTH = rightWall.spanZ[1] - rightWall.spanZ[0];

const FACING_RIGHT = Math.PI / 2;
const FACING_LEFT = -Math.PI / 2;
const FACING_DOWN = Math.PI / 2;

/**
 * The right wall is four plaster panels around the window opening, with a
 * frosted pane recessed slightly behind the inner face. Spans are derived
 * from the wall and window constants; nothing is hand-tuned.
 */
const WINDOW_WIDTH = win.spanZ[1] - win.spanZ[0];
const WINDOW_CENTER_Z = (win.spanZ[0] + win.spanZ[1]) / 2;
const RIGHT_PANELS: ReadonlyArray<{
  key: string;
  /** [centerZ, centerY, width, height] on the wall plane. */
  rect: [number, number, number, number];
}> = [
  {
    key: "rear-of-window",
    rect: [
      (rightWall.spanZ[0] + win.spanZ[0]) / 2,
      wall.height / 2,
      win.spanZ[0] - rightWall.spanZ[0],
      wall.height,
    ],
  },
  {
    key: "front-of-window",
    rect: [
      (win.spanZ[1] + rightWall.spanZ[1]) / 2,
      wall.height / 2,
      rightWall.spanZ[1] - win.spanZ[1],
      wall.height,
    ],
  },
  {
    key: "below-window",
    rect: [WINDOW_CENTER_Z, win.sill / 2, WINDOW_WIDTH, win.sill],
  },
  {
    key: "above-window",
    rect: [
      WINDOW_CENTER_Z,
      (win.head + wall.height) / 2,
      WINDOW_WIDTH,
      wall.height - win.head,
    ],
  },
];

/**
 * The left wall is three panels around the doorway opening — the room's
 * entrance, behind the camera (WORK ORDER 0014). No door, no hardware:
 * the opening alone.
 */
const DOOR_WIDTH = door.spanZ[1] - door.spanZ[0];
const DOOR_CENTER_Z = (door.spanZ[0] + door.spanZ[1]) / 2;
const LEFT_PANELS: ReadonlyArray<{
  key: string;
  /** [centerZ, centerY, width, height] on the wall plane. */
  rect: [number, number, number, number];
}> = [
  {
    key: "rear-of-door",
    rect: [
      (leftWall.spanZ[0] + door.spanZ[0]) / 2,
      wall.height / 2,
      door.spanZ[0] - leftWall.spanZ[0],
      wall.height,
    ],
  },
  {
    key: "front-of-door",
    rect: [
      (door.spanZ[1] + leftWall.spanZ[1]) / 2,
      wall.height / 2,
      leftWall.spanZ[1] - door.spanZ[1],
      wall.height,
    ],
  },
  {
    key: "above-door",
    rect: [
      DOOR_CENTER_Z,
      (door.head + wall.height) / 2,
      DOOR_WIDTH,
      wall.height - door.head,
    ],
  },
];

/** Baseboards along each wall's floor junction; the left run breaks at the doorway. */
const BASEBOARDS: ReadonlyArray<{
  key: string;
  position: [number, number, number];
  rotationY: number;
  length: number;
}> = [
  {
    key: "rear",
    position: [
      REAR_CENTER_X,
      baseboard.height / 2,
      rearWall.z + baseboard.depth / 2,
    ],
    rotationY: 0,
    length: REAR_WIDTH,
  },
  {
    key: "left-rear-of-door",
    position: [
      leftWall.x + baseboard.depth / 2,
      baseboard.height / 2,
      (leftWall.spanZ[0] + door.spanZ[0]) / 2,
    ],
    rotationY: FACING_RIGHT,
    length: door.spanZ[0] - leftWall.spanZ[0],
  },
  {
    key: "left-front-of-door",
    position: [
      leftWall.x + baseboard.depth / 2,
      baseboard.height / 2,
      (door.spanZ[1] + leftWall.spanZ[1]) / 2,
    ],
    rotationY: FACING_RIGHT,
    length: leftWall.spanZ[1] - door.spanZ[1],
  },
  {
    key: "right",
    position: [
      rightWall.x - baseboard.depth / 2,
      baseboard.height / 2,
      LEFT_CENTER_Z,
    ],
    rotationY: FACING_RIGHT,
    length: RIGHT_LENGTH,
  },
];

/**
 * The room's permanent architecture (WORK ORDERS 0004, 0008, 0012):
 * rear wall, left wall, right wall with a frosted window opening, ceiling,
 * and baseboards. Only what would exist if the room were empty — no
 * identity, no decoration.
 */
export function RoomShell() {
  /* One quiet plaster for every painted surface (WORK ORDER 0042): broad
     tonal clouds at the threshold of noticing — the walls never perform. */
  const wallPlaster = plaster({ seed: 427, base: wall.color, age: 0.35 });
  /* Baked indirect light for the rear wall (0096 spike); reuses the
     wall's own UVs. */
  const rearBounce = useLoader(
    TextureLoader,
    assetPath("/textures/gi/gi-rearwall.png"),
  );
  useMemo(() => {
    rearBounce.channel = 0;
    rearBounce.colorSpace = SRGBColorSpace;
  }, [rearBounce]);
  /* The rear wall alone carries the ghosts of habit (WORK ORDER 0050):
     lighter patches where prints used to hang — one beside the hero print
     (whose off-center position quietly answers to its predecessor's spot),
     one behind the pinned cluster — and the pin holes that outlived their
     pins. UVs derive from the wall's true span (x -2.2..2.2, y 0..2.4). */
  /* UVs derive from the wall's asymmetric span (0071 amendment):
     u = (x+3.2)/5.4. Every mark keeps its physical position. */
  const rearPlaster = plaster({
    seed: 427,
    base: wall.color,
    age: 0.35,
    ghosts: [
      /* The hero print's predecessor: smaller, hung left of today's spot. */
      { u: 0.5889, v: 0.65, w: 0.0667, h: 0.208 },
      /* One that came down inside the cluster's territory. */
      { u: 0.4481, v: 0.633, w: 0.0278, h: 0.083 },
    ],
    /* The upward campaign (0057): a shelf's bracket holes from an
       arrangement nobody remembers, and a repair painted in slightly
       the wrong white. */
    screwHoles: [
      /* A lone screw hole (0062), unrelated to the shelf's pairs. */
      { u: 0.9633, v: 0.625 },
      { u: 0.2778, v: 0.883 },
      { u: 0.2778, v: 0.85 },
      { u: 0.4074, v: 0.883 },
      { u: 0.4074, v: 0.85 },
    ],
    repairs: [{ u: 0.8794, v: 0.8125, w: 0.0556, h: 0.1 }],
    /* The vent's breath (0058): dust drifted onto the paint above it. */
    stains: [
      { u: 0.9556, v: 0.945, w: 0.0815, h: 0.06 },
      /* The polish (0062): hip-height, where someone has brushed past
         the bench's end toward the bookcase for years. */
      { u: 0.4074, v: 0.44, w: 0.057, h: 0.13 },
    ],
    /* The wall as a record (0062): accidents from different decades,
       different causes, different people — nothing connected. */
    touchUps: [{ u: 0.2406, v: 0.458, r: 0.0114 }],
    cracks: [{ u: 0.824, v: 0.94, length: 0.12 }],
    residue: [
      /* Above the test prints: the tape-and-prop habit, remembered. */
      { u: 0.5747, v: 0.455 },
      { u: 0.595, v: 0.462 },
      { u: 0.6227, v: 0.45 },
    ],
    pinHoles: [
      /* The lone nail hole (0062): one decision, one decade, unexplained. */
      { u: 0.7686, v: 0.717 },
      { u: 0.4174, v: 0.7 },
      { u: 0.4378, v: 0.64 },
      { u: 0.472, v: 0.72 },
      { u: 0.4606, v: 0.61 },
      { u: 0.4264, v: 0.585 },
      { u: 0.5559, v: 0.755 },
      { u: 0.6235, v: 0.755 },
    ],
  });
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <mesh
        position={[REAR_CENTER_X, wall.height / 2, rearWall.z]}
        receiveShadow
      >
        <planeGeometry args={[REAR_WIDTH, wall.height]} />
        {/* Baked indirect light (0096 spike): the bounce the live
            renderer cannot transport — floor-warm rising into the
            plaster, the bench's shadowed band — frozen from a Blender
            twin of the shell; the SUN stays live, so the breath
            survives. */}
        <meshStandardMaterial
          map={rearPlaster}
          normalMap={plasterNormal(427)}
          lightMap={rearBounce}
          lightMapIntensity={0.55}
          roughness={0.94}
        />
      </mesh>
      {LEFT_PANELS.filter(({ rect }) => rect[2] > 0 && rect[3] > 0).map(
        ({ key, rect: [centerZ, centerY, width, height] }) => (
          <mesh
            key={key}
            position={[leftWall.x, centerY, centerZ]}
            rotation-y={FACING_RIGHT}
            receiveShadow
          >
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial map={wallPlaster} normalMap={plasterNormal(427)} roughness={0.94} />
          </mesh>
        ),
      )}
      {/* Doorway reveal: head and jamb returns spanning the wall's
          thickness. No sill — the floor runs through the opening. */}
      {(
        [
          {
            key: "door-head",
            args: [door.reveal, 0.01, DOOR_WIDTH],
            position: [
              leftWall.x - door.reveal / 2,
              door.head + 0.005,
              DOOR_CENTER_Z,
            ],
          },
          {
            key: "door-jamb-rear",
            args: [door.reveal, door.head, 0.01],
            position: [
              leftWall.x - door.reveal / 2,
              door.head / 2,
              door.spanZ[0] - 0.005,
            ],
          },
          {
            key: "door-jamb-front",
            args: [door.reveal, door.head, 0.01],
            position: [
              leftWall.x - door.reveal / 2,
              door.head / 2,
              door.spanZ[1] + 0.005,
            ],
          },
        ] as const
      ).map(({ key, args, position }) => (
        <mesh key={key} position={[...position]} receiveShadow>
          <boxGeometry args={[...args]} />
          <meshStandardMaterial map={wallPlaster} normalMap={plasterNormal(427)} roughness={0.94} />
        </mesh>
      ))}
      {RIGHT_PANELS.filter(({ rect }) => rect[2] > 0 && rect[3] > 0).map(
        ({ key, rect: [centerZ, centerY, width, height] }) => (
          /* Since 0100 the right wall OCCLUDES the low sun: only the
             window opening admits it, so the wall's light is a true
             window-shaped patch, muntin grid and all. */
          <mesh
            key={key}
            position={[rightWall.x, centerY, centerZ]}
            rotation-y={FACING_LEFT}
            castShadow
            receiveShadow
          >
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial
              map={wallPlaster}
              normalMap={plasterNormal(427)}
              roughness={0.94}
              shadowSide={DoubleSide}
            />
          </mesh>
        ),
      )}
      {/* Frosted pane at the reveal's outer plane. Unlit material: the
          wall is backlit, so a lit material would render the glass dark —
          the pane must read as the daylight itself. Since 0049 it carries
          one soft vertical band near its rear edge: something stands
          outside the window, unexplained — the world continues past the
          glass. */}
      {/* Glazing bars (WORK ORDER 0100, the late-afternoon ruling): the
          window gained its muntins so the low sun casts a TRUE grid —
          the raking lattice on the wall is real shadow, never a decal.
          Painted the trim's white; a hand's width of bar. */}
      {[1 / 3, 2 / 3].map((f) => (
        <mesh
          key={`muntin-h-${f}`}
          position={[
            rightWall.x + win.reveal / 2,
            win.sill + (win.head - win.sill) * f,
            WINDOW_CENTER_Z,
          ]}
          castShadow
        >
          <boxGeometry args={[0.02, 0.028, WINDOW_WIDTH]} />
          <meshStandardMaterial color={baseboard.color} roughness={0.55} />
        </mesh>
      ))}
      {[1 / 3, 2 / 3].map((f) => (
        <mesh
          key={`muntin-v-${f}`}
          position={[
            rightWall.x + win.reveal / 2,
            (win.sill + win.head) / 2,
            win.spanZ[0] + WINDOW_WIDTH * f,
          ]}
          castShadow
        >
          <boxGeometry args={[0.02, win.head - win.sill, 0.028]} />
          <meshStandardMaterial color={baseboard.color} roughness={0.55} />
        </mesh>
      ))}
      <mesh
        position={[
          rightWall.x + win.reveal,
          (win.sill + win.head) / 2,
          WINDOW_CENTER_Z,
        ]}
        rotation-y={FACING_LEFT}
      >
        <planeGeometry args={[WINDOW_WIDTH, win.head - win.sill]} />
        {/* Band near U=0.07: the frame's visible sliver is the pane's
            first ~8% (z 0.55-0.62), so the presence must live there. */}
        <meshBasicMaterial map={frostedPaneTexture(win.paneColor, 0.07, 0.09)} />
      </mesh>
      {/* Window reveal: sill, head, and jamb returns spanning the wall's
          thickness — the minimum trim for believable construction. */}
      {(
        [
          {
            key: "sill",
            args: [win.reveal, 0.01, WINDOW_WIDTH],
            position: [
              rightWall.x + win.reveal / 2,
              win.sill - 0.005,
              WINDOW_CENTER_Z,
            ],
          },
          {
            key: "head",
            args: [win.reveal, 0.01, WINDOW_WIDTH],
            position: [
              rightWall.x + win.reveal / 2,
              win.head + 0.005,
              WINDOW_CENTER_Z,
            ],
          },
          {
            key: "jamb-rear",
            args: [win.reveal, win.head - win.sill, 0.01],
            position: [
              rightWall.x + win.reveal / 2,
              (win.sill + win.head) / 2,
              win.spanZ[0] - 0.005,
            ],
          },
          {
            key: "jamb-front",
            args: [win.reveal, win.head - win.sill, 0.01],
            position: [
              rightWall.x + win.reveal / 2,
              (win.sill + win.head) / 2,
              win.spanZ[1] + 0.005,
            ],
          },
        ] as const
      ).map(({ key, args, position }) => (
        <mesh key={key} position={[...position]} receiveShadow>
          <boxGeometry args={[...args]} />
          <meshStandardMaterial map={wallPlaster} normalMap={plasterNormal(427)} roughness={0.94} />
        </mesh>
      ))}
      {BASEBOARDS.map(({ key, position, rotationY, length }) => (
        <mesh
          key={key}
          position={position}
          rotation-y={rotationY}
          receiveShadow
        >
          <boxGeometry args={[length, baseboard.height, baseboard.depth]} />
          <meshStandardMaterial color={baseboard.color} roughness={0.55} />
        </mesh>
      ))}
      <mesh
        position={[REAR_CENTER_X, wall.height, LEFT_CENTER_Z]}
        rotation-x={FACING_DOWN}
        receiveShadow
      >
        <planeGeometry args={[REAR_WIDTH, LEFT_LENGTH]} />
        <meshStandardMaterial map={wallPlaster} normalMap={plasterNormal(427)} roughness={0.96} />
      </mesh>
    </group>
  );
}
