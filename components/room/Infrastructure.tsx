"use client";

import { useMemo } from "react";

import { CatmullRomCurve3, Vector3 } from "three";

import { ROOM, WORKBENCH } from "@/three/scene/constants";
import {
  CABLE,
  DESK_LAMP,
  OUTLET_PLATE,
  OUTLETS,
  PHONE_CHARGER,
  type Outlet,
} from "@/three/scene/dressing/infrastructure";
import { Vector2 } from "three";

import {
  REFLECTION_INTENSITY,
  useReflections,
} from "@/three/lighting/reflections";

import { fromWorkbench } from "@/three/scene/world";

const REAR_Z = ROOM.rearWall.z;
const RIGHT_X = ROOM.rightWall.x;

/** One duplex outlet plate with two recessed sockets. */
function OutletPlate({ outlet }: { outlet: Outlet }) {
  const { width, height, depth, color, socket } = OUTLET_PLATE;
  const onRear = outlet.wall === "rear";
  const position: [number, number, number] = onRear
    ? [outlet.along, outlet.height, REAR_Z + depth / 2]
    : [RIGHT_X - depth / 2, outlet.height, outlet.along];
  const rotationY = onRear ? 0 : -Math.PI / 2;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {[0.028, -0.028].map((y) => (
        <mesh key={y} position={[0, y, depth / 2 - socket.inset + 0.0005]}>
          <boxGeometry args={[socket.width, socket.height, socket.inset]} />
          <meshStandardMaterial color={socket.color} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The desk lamp: base on the bench, two enamel arms, a spun shade aimed at
 * the active zone from last night. Off — the daylight is doing its job.
 */
function DeskLamp() {
  const reflections = useReflections();
  const { at, base, arm1, arm2, head, enamel, joint } = DESK_LAMP;
  const surface = WORKBENCH.surfaceHeight;
  /* Arm 1 rises from the base at a lean; arm 2 folds forward and down.
     Positions are computed so the joints meet believably. */
  const a1TopX = Math.sin(arm1.yaw) * Math.sin(arm1.pitch) * arm1.length;
  const a1TopY = Math.cos(arm1.pitch) * arm1.length;
  const a1TopZ = Math.cos(arm1.yaw) * Math.sin(arm1.pitch) * arm1.length;
  return (
    <group position={[at.x, surface, at.z]}>
      {/* Weighted base. */}
      <mesh position={[0, base.height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[base.radius, base.radius, base.height, 20]} />
        <meshStandardMaterial color={enamel} roughness={0.45} />
      </mesh>
      {/* Lower arm. */}
      <mesh
        position={[a1TopX / 2, base.height + a1TopY / 2, a1TopZ / 2]}
        rotation={[arm1.pitch * Math.cos(arm1.yaw), 0, -arm1.pitch * Math.sin(arm1.yaw)]}
        castShadow
      >
        <cylinderGeometry args={[arm1.radius, arm1.radius, arm1.length, 10]} />
        <meshStandardMaterial color={enamel} roughness={0.45} />
      </mesh>
      {/* Elbow joint. */}
      <mesh
        position={[a1TopX, base.height + a1TopY, a1TopZ]}
        castShadow
      >
        <sphereGeometry args={[0.014, 10, 8]} />
        <meshStandardMaterial color={joint} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Upper arm, folding forward-down toward the bench center. */}
      <mesh
        position={[
          a1TopX + (Math.sin(arm2.pitch) * arm2.length) / 2,
          base.height + a1TopY + (Math.cos(arm2.pitch) * arm2.length) / 2,
          a1TopZ + 0.02,
        ]}
        rotation={[0, 0, -arm2.pitch]}
        castShadow
      >
        <cylinderGeometry args={[arm2.radius, arm2.radius, arm2.length, 10]} />
        <meshStandardMaterial color={enamel} roughness={0.45} />
      </mesh>
      {/* Head: spun shade with its neck, mouth toward the active zone,
          off. Double-sided so the shade's interior reads (0067). */}
      <group
        position={[
          a1TopX + Math.sin(arm2.pitch) * arm2.length,
          base.height + a1TopY + Math.cos(arm2.pitch) * arm2.length,
          a1TopZ + 0.02,
        ]}
        rotation={[0.3, 0, -2.75]}
      >
        {/* 0102: a spun-metal shade, not a cone — dome shoulder, flare,
            rolled lip, the profile a metal spinner actually leaves. */}
        <mesh castShadow>
          <latheGeometry
            args={[
              [
                new Vector2(head.neck.radius * 1.1, head.depth * 0.5),
                new Vector2(head.radius * 0.35, head.depth * 0.42),
                new Vector2(head.radius * 0.62, head.depth * 0.22),
                new Vector2(head.radius * 0.82, -head.depth * 0.05),
                new Vector2(head.radius * 0.96, -head.depth * 0.38),
                new Vector2(head.radius, -head.depth * 0.5),
                new Vector2(head.radius * 1.03, -head.depth * 0.52),
                new Vector2(head.radius * 1.02, -head.depth * 0.46),
              ],
              26,
            ]}
          />
          <meshStandardMaterial color={enamel} roughness={0.45} side={2} envMap={reflections ?? undefined} envMapIntensity={REFLECTION_INTENSITY.ceramic} />
        </mesh>
        {/* The bulb's dark socket up inside the shade. */}
        <mesh position={[0, -head.depth * 0.15, 0]}>
          <cylinderGeometry args={[0.014, 0.016, 0.03, 12]} />
          <meshStandardMaterial color="#26241f" roughness={0.6} />
        </mesh>
        <mesh position={[0, head.depth / 2 + head.neck.length / 2, 0]} castShadow>
          <cylinderGeometry
            args={[head.neck.radius, head.neck.radius, head.neck.length, 10]}
          />
          <meshStandardMaterial color={joint} roughness={0.4} metalness={0.3} />
        </mesh>
      </group>
      {/* The cord drops off the bench's rear edge into the gap. */}
      <mesh
        position={[0.02, -(surface / 2) + 0.01, -0.13]}
        rotation={[0.12, 0, 0]}
        castShadow={false}
      >
        <cylinderGeometry
          args={[DESK_LAMP.cord.thickness / 2, DESK_LAMP.cord.thickness / 2, surface, 6]}
        />
        <meshStandardMaterial color={DESK_LAMP.cord.color} />
      </mesh>
    </group>
  );
}

/** Cable runs hugging the floor-wall seams, plus wall stubs to the outlets. */
function CableRuns() {
  const { thickness, color, lampRuns, stripRuns } = CABLE;
  const runs = [...lampRuns, ...stripRuns];
  /* Real cable is never straight (0053): each run bows a few centimeters
     off its line, because nobody has ever laid a cable taut on purpose. */
  const curves = useMemo(
    () =>
      runs.map((run, index) => {
        const midX = (run.from.x + run.to.x) / 2;
        const midZ = (run.from.z + run.to.z) / 2;
        const dx = run.to.x - run.from.x;
        const dz = run.to.z - run.from.z;
        const length = Math.hypot(dx, dz) || 1;
        /* Perpendicular slack, alternating side per run. */
        const bow = 0.028 * (index % 2 === 0 ? 1 : -1);
        return new CatmullRomCurve3([
          new Vector3(run.from.x, thickness / 2, run.from.z),
          new Vector3(
            midX + (-dz / length) * bow,
            thickness / 2,
            midZ + (dx / length) * bow,
          ),
          new Vector3(run.to.x, thickness / 2, run.to.z),
        ]);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <>
      {curves.map((curve, index) => (
        <mesh key={index} receiveShadow castShadow>
          <tubeGeometry args={[curve, 16, thickness / 2, 6, false]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {/* Wall stubs: the last vertical inches up to each outlet. */}
      <mesh position={[-1.02, 0.13, REAR_Z + 0.008]} receiveShadow>
        <boxGeometry args={[thickness, 0.26, thickness]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[RIGHT_X - 0.008, 0.13, 0.87]} receiveShadow>
        <boxGeometry args={[thickness, 0.26, thickness]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </>
  );
}

/**
 * The phone charger: block in the strip, cable in a lazy S across the
 * bench's temporary zone, connector up — and no phone. It left with its
 * owner. (WORK ORDER 0048.)
 */
function PhoneCharger() {
  const { block, cable } = PHONE_CHARGER;
  const surface = WORKBENCH.surfaceHeight;
  const curve = useMemo(
    () =>
      new CatmullRomCurve3(
        cable.path.map(
          (p) => new Vector3(p.x, surface + cable.radius + p.y, p.z),
        ),
      ),
    [cable, surface],
  );
  const end = cable.path[cable.path.length - 1];
  const beforeEnd = cable.path[cable.path.length - 2];
  const heading = Math.atan2(end.x - beforeEnd.x, end.z - beforeEnd.z);
  return (
    <>
      <mesh
        position={[block.at.x, block.height / 2 + 0.038, block.at.z]}
        rotation={[0, block.yaw, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[block.width, block.height, block.depth]} />
        <meshStandardMaterial color={block.color} roughness={0.55} />
      </mesh>
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[curve, 32, cable.radius, 6, false]} />
        <meshStandardMaterial color={cable.color} roughness={0.6} />
      </mesh>
      {/* The connector, face up, waiting for a phone that left. */}
      <mesh
        position={[
          end.x,
          surface + cable.connector.height / 2,
          end.z + 0.012,
        ]}
        rotation={[0, heading, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            cable.connector.width,
            cable.connector.height,
            cable.connector.length,
          ]}
        />
        <meshStandardMaterial color={cable.color} roughness={0.5} />
      </mesh>
    </>
  );
}

/**
 * The room's power infrastructure (WORK ORDER 0047): outlets low on the
 * walls, cables hugging the seams, a lamp still aimed from last night.
 * A functioning room is more believable than a decorated room.
 */
export function Infrastructure() {
  return (
    <group position={fromWorkbench([0, 0, 0])}>
      {OUTLETS.map((outlet) => (
        <OutletPlate key={`${outlet.wall}-${outlet.along}`} outlet={outlet} />
      ))}
      <DeskLamp />
      <CableRuns />
      <PhoneCharger />
    </group>
  );
}
