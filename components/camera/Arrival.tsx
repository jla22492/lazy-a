"use client";

import { useMemo, useRef } from "react";

import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import type { RoomBehavior } from "@/three/animation/presence";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";
import { STAGE } from "@/three/scene/constants";

/**
 * The arrival (WORK ORDER 0072) — the constitution's opening beat: the
 * viewpoint quietly settles into its resting place at the workbench
 * within the first ~1.5 seconds. Not a guided camera move — the start
 * pose is a half-step shy of the composition (slightly back, a breath
 * higher, gaze a touch wide) and the settle is one cubic ease-out with
 * the gaze landing a beat after the body, the way eyes settle after
 * feet stop. It happens once; then the camera is exactly the locked
 * composition and this behavior retires.
 *
 * Capture runs (?shot / ?record) skip the settle so stills stay
 * deterministic — unless ?arrive=1 asks to film it.
 */
const SETTLE_SECONDS = 1.4;
/** The gaze finishes an extra beat after the body. */
const GAZE_LAG_SECONDS = 0.25;

/** Start pose offsets: felt as arriving, never read as traveling. */
const START_BACK = 0.28;
const START_UP = 0.03;
const START_LEFT = 0.06;
const START_GAZE_WIDE = 0.18;

function cubicOut(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

function shouldSkipSettle(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has("arrive")) return false;
  return params.has("shot") || params.has("record");
}

export function Arrival() {
  const camera = useThree((state) => state.camera);
  const elapsed = useRef(0);
  const done = useRef(false);

  const poses = useMemo(() => {
    const end = new Vector3(...STAGE.camera.position);
    const endGaze = new Vector3(...STAGE.camera.lookAt);
    const start = end
      .clone()
      .add(new Vector3(-START_LEFT, START_UP, START_BACK));
    const startGaze = endGaze
      .clone()
      .add(new Vector3(-START_GAZE_WIDE, 0.05, 0));
    return { start, end, startGaze, endGaze };
  }, []);

  const arrival = useMemo<RoomBehavior>(
    () => ({
      name: "arrival",
      kind: "camera",
      enabled: true,
      onRoomTick: (clock) => {
        if (done.current) return;
        if (shouldSkipSettle()) {
          done.current = true;
          camera.position.copy(poses.end);
          camera.lookAt(poses.endGaze);
          return;
        }
        elapsed.current += clock.delta;
        const body = cubicOut(elapsed.current / SETTLE_SECONDS);
        const gaze = cubicOut(
          elapsed.current / (SETTLE_SECONDS + GAZE_LAG_SECONDS),
        );
        camera.position.lerpVectors(poses.start, poses.end, body);
        const gazePoint = poses.startGaze
          .clone()
          .lerp(poses.endGaze, gaze);
        camera.lookAt(gazePoint);
        if (elapsed.current >= SETTLE_SECONDS + GAZE_LAG_SECONDS) {
          done.current = true;
          camera.position.copy(poses.end);
          camera.lookAt(poses.endGaze);
        }
      },
    }),
    [camera, poses],
  );
  useRoomBehavior(arrival);

  return null;
}
