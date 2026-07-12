"use client";

import { useEffect, useMemo, useRef } from "react";

import { useThree } from "@react-three/fiber";

import { walkPose } from "@/three/animation/firstStep";
import type { RoomBehavior } from "@/three/animation/presence";
import { visitorState } from "@/three/animation/visitorState";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";

/** Sentinel: the step was triggered and anchors to room time on the next tick. */
const PENDING = -1;

/**
 * The visitor's first action (WORK ORDER 0020): one quiet step from
 * ARRIVAL to WORKING. It happens once.
 *
 * TRIGGER RETIRED (WORK ORDER 0090): the temporary click/Space trigger
 * is gone — clicking is the interface's gesture now (conversations,
 * 0076), and the seated arrival (0089) owns the camera's journey. The
 * walk survives as research, reachable only through the dev-only
 * ?autostep=<seconds> parameter for motion capture. Retiring the
 * trigger also parks the archived notebook pickup (its readiness
 * required this walk to set the visitor's position).
 */
export function FirstStep() {
  const camera = useThree((state) => state.camera);
  const walkStart = useRef<number | null>(null);
  const walked = useRef(false);

  const personStep = useMemo<RoomBehavior>(
    () => ({
      name: "person-step",
      kind: "camera",
      enabled: true,
      onRoomTick: (clock) => {
        if (walkStart.current === null) return;
        if (walkStart.current === PENDING) walkStart.current = clock.elapsed;
        const pose = walkPose(clock.elapsed - walkStart.current);
        camera.position.set(...pose.eye);
        camera.lookAt(...pose.gaze);
        if (pose.done) {
          walkStart.current = null;
          visitorState.position = "working";
          visitorState.moving = false;
        }
      },
    }),
    [camera],
  );
  useRoomBehavior(personStep);

  useEffect(() => {
    const takeStep = () => {
      if (walked.current) return;
      walked.current = true;
      walkStart.current = PENDING;
      visitorState.position = null;
      visitorState.moving = true;
    };

    let autoTimer: number | undefined;
    if (process.env.NODE_ENV !== "production") {
      const auto = new URLSearchParams(window.location.search).get("autostep");
      if (auto) autoTimer = window.setTimeout(takeStep, Number(auto) * 1000);
    }

    return () => {
      if (autoTimer) window.clearTimeout(autoTimer);
    };
  }, []);

  return null;
}
