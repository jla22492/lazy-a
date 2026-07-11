"use client";

import { useEffect, useMemo, useRef } from "react";

import { useThree } from "@react-three/fiber";
import { Vector3, type Mesh } from "three";

import {
  requestInteraction,
  type AcceptancePolicy,
} from "@/three/animation/acceptance";
import type { AttentionTarget } from "@/three/animation/attention";
import { NEUTRAL_DIR } from "@/three/animation/firstLook";
import { WORKING_EYE } from "@/three/animation/firstStep";
import {
  beginCommit,
  hasIntent,
  releaseCommit,
} from "@/three/animation/intent";
import {
  carryPoint,
  gazeGoal,
  HELD_BELOW_EYE,
  HELD_FORWARD,
  HELD_REGARD_PITCH,
  HELD_TILT,
  pickupPose,
  pursueGaze,
} from "@/three/animation/pickup";
import type { RoomBehavior } from "@/three/animation/presence";
import { conditions, type ReadinessRule } from "@/three/animation/readiness";
import { visitorState } from "@/three/animation/visitorState";
import { useAcceptancePolicy } from "@/three/hooks/useAcceptancePolicy";
import { useAttentionTarget } from "@/three/hooks/useAttentionTarget";
import { useReadinessRule } from "@/three/hooks/useReadinessRule";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";
import { NOTEBOOK, WORKBENCH } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

const REST_POSITION = fromWorkbench([
  NOTEBOOK.offset[0],
  WORKBENCH.surfaceHeight + NOTEBOOK.thickness / 2,
  NOTEBOOK.offset[2],
]);

/** The first meaningful object the room can notice being observed. */
const ATTENTION_TARGET: AttentionTarget = {
  name: "notebook",
  position: REST_POSITION,
  /** Half-diagonal of the closed notebook. */
  radius: 0.13,
};

/**
 * When engaging the notebook would be appropriate (WORK ORDER 0024):
 * standing at the bench, no longer moving, genuinely observing it.
 */
const READINESS_RULE: ReadinessRule = {
  target: "notebook",
  conditions: [
    conditions.atPosition("working"),
    conditions.still(),
    conditions.observed("notebook"),
  ],
};

/**
 * The room's answer for the notebook (WORK ORDER 0026). It currently has
 * no reason to refuse; future context — an impossible moment in progress,
 * the room's own timing — joins here without touching the pipeline.
 */
const ACCEPTANCE_POLICY: AcceptancePolicy = {
  target: "notebook",
  accepts: () => true,
};

/** Where a standing person holds a closed notebook (WORK ORDER 0027). */
const HELD_POSITION: [number, number, number] = [
  WORKING_EYE[0] + Math.sin(NEUTRAL_DIR.yaw) * HELD_FORWARD,
  WORKING_EYE[1] - HELD_BELOW_EYE,
  WORKING_EYE[2] - Math.cos(NEUTRAL_DIR.yaw) * HELD_FORWARD,
];

/** Unit XZ direction from the working eyes toward the notebook at rest. */
const TOWARD_NOTEBOOK: [number, number] = (() => {
  const dx = REST_POSITION[0] - WORKING_EYE[0];
  const dz = REST_POSITION[2] - WORKING_EYE[2];
  const length = Math.hypot(dx, dz) || 1;
  return [dx / length, dz / length];
})();

/**
 * Where the eyes settle once the notebook is comfortably held: along
 * the body's facing, pitched gently down so the notebook rests low in
 * vision with the room beyond it.
 */
const HELD_REGARD: [number, number, number] = [
  WORKING_EYE[0] + Math.sin(NEUTRAL_DIR.yaw) * Math.cos(HELD_REGARD_PITCH) * 2,
  WORKING_EYE[1] + Math.sin(HELD_REGARD_PITCH) * 2,
  WORKING_EYE[2] - Math.cos(NEUTRAL_DIR.yaw) * Math.cos(HELD_REGARD_PITCH) * 2,
];

/**
 * Primitive blockout of the notebook — the first object with narrative
 * weight (WORK ORDER 0009); it rests in the ACTIVE zone at its
 * dominant-hand edge (WORK ORDER 0010).
 *
 * WORK ORDER 0027 — the first real interaction: once the room accepts
 * the visitor's offer, the body picks the notebook up. The TEMPORARY
 * commitment gesture is press-and-hold while ready (release early and
 * nothing happens); a dev-only ?autopickup=<seconds> runs the whole
 * sequence for motion capture. The order ends the instant the notebook
 * is comfortably held: nothing opens, nothing else changes.
 */
export function Notebook() {
  useAttentionTarget(ATTENTION_TARGET);
  useReadinessRule(READINESS_RULE);
  useAcceptancePolicy(ACCEPTANCE_POLICY);

  const camera = useThree((state) => state.camera);
  const meshRef = useRef<Mesh>(null);
  const pickupStart = useRef<number | null>(null);
  const pickedUp = useRef(false);
  const gaze = useRef<[number, number, number] | null>(null);

  const personPickup = useMemo<RoomBehavior>(
    () => ({
      name: "person-pickup",
      kind: "camera",
      enabled: true,
      onRoomTick: (clock) => {
        /* The moment intent matures, the visitor offers; if the room
           accepts, the body begins the pickup. */
        if (
          !pickedUp.current &&
          hasIntent("notebook") &&
          requestInteraction("notebook") === "accepted"
        ) {
          pickedUp.current = true;
          visitorState.holding = "notebook";
          pickupStart.current = -1;
          /* The eyes start the action wherever the visitor left them. */
          const forward = camera.getWorldDirection(new Vector3());
          gaze.current = [
            camera.position.x + forward.x,
            camera.position.y + forward.y,
            camera.position.z + forward.z,
          ];
        }
        if (pickupStart.current === null || gaze.current === null) return;
        if (pickupStart.current === -1) pickupStart.current = clock.elapsed;

        const t = clock.elapsed - pickupStart.current;
        const pose = pickupPose(t, TOWARD_NOTEBOOK);
        const mesh = meshRef.current;
        if (mesh) {
          const at = carryPoint(REST_POSITION, HELD_POSITION, pose.carry);
          mesh.position.set(...at);
          /* The notebook tilts toward the reader as it rises, and turns
             square to the body's facing. */
          mesh.rotation.set(
            HELD_TILT * pose.carry,
            NOTEBOOK.rotationY +
              (NEUTRAL_DIR.yaw - NOTEBOOK.rotationY) * pose.carry,
            0,
          );
          camera.position.set(...pose.eye);
          /* Eyes on the object through the reach and grasp, rising to
             the settled regard as it arrives in the hold. */
          pursueGaze(
            gaze.current,
            gazeGoal([at[0], at[1], at[2]], HELD_REGARD, pose.carry),
            clock.delta,
          );
          camera.lookAt(...gaze.current);
        }
        if (pose.done) pickupStart.current = null;
      },
    }),
    [camera],
  );
  useRoomBehavior(personPickup);

  useEffect(() => {
    /* TEMPORARY commitment gesture: press and hold while ready. */
    const onPointerDown = () => {
      if (!pickedUp.current) beginCommit("notebook");
    };
    const onPointerUp = () => {
      releaseCommit();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    let autoTimers: number[] = [];
    if (process.env.NODE_ENV !== "production") {
      const auto = new URLSearchParams(window.location.search).get(
        "autopickup",
      );
      if (auto) {
        const startAt = Number(auto) * 1000;
        const dev = window as Window & {
          __setLook?: (yaw: number, pitch: number) => void;
        };
        autoTimers = [
          /* Look at the notebook, let observation mature... */
          window.setTimeout(() => dev.__setLook?.(0.33, -0.1), startAt),
          /* ...then commit and hold; the pipeline does the rest.
             beginCommit refuses until the room says ready, so keep
             offering until the commitment takes. */
          window.setTimeout(() => {
            const retry = window.setInterval(() => {
              if (pickedUp.current || beginCommit("notebook"))
                window.clearInterval(retry);
            }, 120);
            autoTimers.push(retry);
          }, startAt + 2500),
        ];
      }
    }

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      autoTimers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <mesh
      ref={meshRef}
      position={REST_POSITION}
      rotation-y={NOTEBOOK.rotationY}
      castShadow
      receiveShadow
    >
      <boxGeometry
        args={[NOTEBOOK.width, NOTEBOOK.thickness, NOTEBOOK.length]}
      />
      <meshStandardMaterial color={NOTEBOOK.color} />
    </mesh>
  );
}
