"use client";

import type { AcceptancePolicy } from "@/three/animation/acceptance";
import type { AttentionTarget } from "@/three/animation/attention";
import { conditions, type ReadinessRule } from "@/three/animation/readiness";
import { useAcceptancePolicy } from "@/three/hooks/useAcceptancePolicy";
import { useAttentionTarget } from "@/three/hooks/useAttentionTarget";
import { useReadinessRule } from "@/three/hooks/useReadinessRule";
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

/**
 * Primitive blockout of the notebook — the first object with narrative
 * weight. It establishes position, scale, and orientation only; detail
 * arrives in later work orders (WORK ORDER 0009).
 *
 * In the workbench language (three/scene/workspace.ts) it rests inside
 * the ACTIVE zone at its dominant-hand edge — where the most recently
 * used object naturally sits. The language confirms the placement
 * (WORK ORDER 0010); it does not move.
 */
export function Notebook() {
  useAttentionTarget(ATTENTION_TARGET);
  useReadinessRule(READINESS_RULE);
  useAcceptancePolicy(ACCEPTANCE_POLICY);
  return (
    <mesh
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
