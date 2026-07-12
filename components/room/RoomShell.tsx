"use client";

import { frostedPaneTexture, plaster } from "@/three/materials/procedural";
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
  /* The rear wall alone carries the ghosts of habit (WORK ORDER 0050):
     lighter patches where prints used to hang — one beside the hero print
     (whose off-center position quietly answers to its predecessor's spot),
     one behind the pinned cluster — and the pin holes that outlived their
     pins. UVs derive from the wall's true span (x -2.2..2.2, y 0..2.4). */
  const rearPlaster = plaster({
    seed: 427,
    base: wall.color,
    age: 0.35,
    ghosts: [
      /* The hero print's predecessor: smaller, hung left of today's spot. */
      { u: 0.495, v: 0.65, w: 0.082, h: 0.208 },
      /* One that came down inside the cluster's territory. */
      { u: 0.323, v: 0.633, w: 0.034, h: 0.083 },
    ],
    /* The upward campaign (0057): a shelf's bracket holes from an
       arrangement nobody remembers, and a repair painted in slightly
       the wrong white. */
    screwHoles: [
      { u: 0.1136, v: 0.883 },
      { u: 0.1136, v: 0.85 },
      { u: 0.2727, v: 0.883 },
      { u: 0.2727, v: 0.85 },
    ],
    repairs: [{ u: 0.852, v: 0.8125, w: 0.068, h: 0.1 }],
    /* The vent's breath (0058): dust drifted onto the paint above it. */
    stains: [{ u: 0.898, v: 0.945, w: 0.1, h: 0.06 }],
    residue: [
      /* Above the test prints: the tape-and-prop habit, remembered. */
      { u: 0.478, v: 0.455 },
      { u: 0.503, v: 0.462 },
      { u: 0.537, v: 0.45 },
    ],
    pinHoles: [
      { u: 0.285, v: 0.7 },
      { u: 0.31, v: 0.64 },
      { u: 0.352, v: 0.72 },
      { u: 0.338, v: 0.61 },
      { u: 0.296, v: 0.585 },
      { u: 0.455, v: 0.755 },
      { u: 0.538, v: 0.755 },
    ],
  });
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <mesh
        position={[REAR_CENTER_X, wall.height / 2, rearWall.z]}
        receiveShadow
      >
        <planeGeometry args={[REAR_WIDTH, wall.height]} />
        <meshStandardMaterial map={rearPlaster} roughness={0.94} />
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
            <meshStandardMaterial map={wallPlaster} roughness={0.94} />
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
          <meshStandardMaterial map={wallPlaster} roughness={0.94} />
        </mesh>
      ))}
      {RIGHT_PANELS.filter(({ rect }) => rect[2] > 0 && rect[3] > 0).map(
        ({ key, rect: [centerZ, centerY, width, height] }) => (
          <mesh
            key={key}
            position={[rightWall.x, centerY, centerZ]}
            rotation-y={FACING_LEFT}
            receiveShadow
          >
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial map={wallPlaster} roughness={0.94} />
          </mesh>
        ),
      )}
      {/* Frosted pane at the reveal's outer plane. Unlit material: the
          wall is backlit, so a lit material would render the glass dark —
          the pane must read as the daylight itself. Since 0049 it carries
          one soft vertical band near its rear edge: something stands
          outside the window, unexplained — the world continues past the
          glass. */}
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
          <meshStandardMaterial map={wallPlaster} roughness={0.94} />
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
        <meshStandardMaterial map={wallPlaster} roughness={0.96} />
      </mesh>
    </group>
  );
}
