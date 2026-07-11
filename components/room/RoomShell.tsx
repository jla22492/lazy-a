"use client";

import { ROOM } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

const { wall, rearWall, leftWall, rightWall, window: win, baseboard } = ROOM;

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

/** Baseboards along each wall's floor junction, inset to sit proud of the plaster. */
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
    key: "left",
    position: [
      leftWall.x + baseboard.depth / 2,
      baseboard.height / 2,
      LEFT_CENTER_Z,
    ],
    rotationY: FACING_RIGHT,
    length: LEFT_LENGTH,
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
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      <mesh
        position={[REAR_CENTER_X, wall.height / 2, rearWall.z]}
        receiveShadow
      >
        <planeGeometry args={[REAR_WIDTH, wall.height]} />
        <meshStandardMaterial color={wall.color} />
      </mesh>
      <mesh
        position={[leftWall.x, wall.height / 2, LEFT_CENTER_Z]}
        rotation-y={FACING_RIGHT}
        receiveShadow
      >
        <planeGeometry args={[LEFT_LENGTH, wall.height]} />
        <meshStandardMaterial color={wall.color} />
      </mesh>
      {RIGHT_PANELS.filter(({ rect }) => rect[2] > 0 && rect[3] > 0).map(
        ({ key, rect: [centerZ, centerY, width, height] }) => (
          <mesh
            key={key}
            position={[rightWall.x, centerY, centerZ]}
            rotation-y={FACING_LEFT}
            receiveShadow
          >
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial color={wall.color} />
          </mesh>
        ),
      )}
      {/* Frosted pane at the reveal's outer plane. Unlit material: the
          wall is backlit, so a lit material would render the glass dark —
          the pane must read as the daylight itself. */}
      <mesh
        position={[
          rightWall.x + win.reveal,
          (win.sill + win.head) / 2,
          WINDOW_CENTER_Z,
        ]}
        rotation-y={FACING_LEFT}
      >
        <planeGeometry args={[WINDOW_WIDTH, win.head - win.sill]} />
        <meshBasicMaterial color={win.paneColor} />
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
          <meshStandardMaterial color={wall.color} />
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
          <meshStandardMaterial color={baseboard.color} />
        </mesh>
      ))}
      <mesh
        position={[REAR_CENTER_X, wall.height, LEFT_CENTER_Z]}
        rotation-x={FACING_DOWN}
        receiveShadow
      >
        <planeGeometry args={[REAR_WIDTH, LEFT_LENGTH]} />
        <meshStandardMaterial color={ROOM.ceiling.color} />
      </mesh>
    </group>
  );
}
