"use client";

import { useMemo } from "react";

import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import { getAttention, tickAttention } from "@/three/animation/attention";
import type { RoomBehavior } from "@/three/animation/presence";
import { readinessOf } from "@/three/animation/readiness";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";

/**
 * The room's perception (WORK ORDER 0023): reads the visitor's gaze each
 * frame — after the camera behaviors have moved it — and updates the
 * attention system. Renders nothing; noticing is not a visible act.
 */
export function AttentionSensor() {
  const camera = useThree((state) => state.camera);

  const sensor = useMemo<RoomBehavior>(() => {
    const forward = new Vector3();
    return {
      name: "attention-sensor",
      kind: "ambient",
      enabled: true,
      onRoomTick: (clock) => {
        camera.getWorldDirection(forward);
        tickAttention(
          [camera.position.x, camera.position.y, camera.position.z],
          [forward.x, forward.y, forward.z],
          clock.delta,
        );
      },
    };
  }, [camera]);
  useRoomBehavior(sensor);

  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    /* Dev observability only — never surfaced in the experience. */
    const dev = window as Window & {
      __attention?: () => unknown;
      __ready?: (target: string) => unknown;
    };
    dev.__attention = getAttention;
    dev.__ready = readinessOf;
  }

  return null;
}
