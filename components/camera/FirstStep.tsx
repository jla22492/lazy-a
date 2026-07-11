"use client";

import { useEffect, useMemo, useRef } from "react";

import { useThree } from "@react-three/fiber";

import { walkPose } from "@/three/animation/firstStep";
import type { RoomBehavior } from "@/three/animation/presence";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";

/** Sentinel: the step was triggered and anchors to room time on the next tick. */
const PENDING = -1;

/**
 * The visitor's first action (WORK ORDER 0020): one quiet step from
 * ARRIVAL to WORKING. It happens once.
 *
 * TEMPORARY TRIGGER — this is a behavior review, not an interaction
 * model: click/tap anywhere or press Space. A ?autostep=<seconds> URL
 * parameter fires the step automatically for headless motion capture
 * (development only).
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
        if (pose.done) walkStart.current = null;
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
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space") takeStep();
    };
    window.addEventListener("pointerdown", takeStep);
    window.addEventListener("keydown", onKey);

    let autoTimer: number | undefined;
    if (process.env.NODE_ENV !== "production") {
      const auto = new URLSearchParams(window.location.search).get("autostep");
      if (auto) autoTimer = window.setTimeout(takeStep, Number(auto) * 1000);
    }

    return () => {
      window.removeEventListener("pointerdown", takeStep);
      window.removeEventListener("keydown", onKey);
      if (autoTimer) window.clearTimeout(autoTimer);
    };
  }, []);

  return null;
}
