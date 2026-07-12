"use client";

import { useMemo, useRef } from "react";

import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import type { RoomBehavior } from "@/three/animation/presence";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";
import { STAGE } from "@/three/scene/constants";

/**
 * The arrival, as an APPROACH (R-0072, Jonathan's direction) — the
 * opening is the POV of someone walking to the workbench, with the
 * heaviness of a body:
 *
 * - The walk: ~1.7m from behind-left (the door's side), one ease of
 *   mass — slow to start, decisive in the middle, settling at the end.
 * - The weight: a faint step-rhythm bob and lateral sway that fade in
 *   and out with the walk (the 0020 first-step research, reborn), then
 *   momentum carrying the body a centimeter past the stop and a damped
 *   sway bringing it to rest (the 0021 settling research).
 * - The gaze: starts on the room, slightly high and wide, and lands on
 *   the work a beat after the feet stop — eyes settle after the body.
 *
 * It happens once; then the camera is exactly the locked composition
 * and this behavior retires. Capture runs (?shot / ?record) skip it so
 * stills stay deterministic; ?record with ?arrive films it, the walk
 * waiting for the recorder's true start.
 */
const WALK_SECONDS = 1.9;
/** The settle after the feet stop: overshoot decaying at body rates. */
const SETTLE_SECONDS = 1.1;
const GAZE_LAG_SECONDS = 0.35;

/** The approach: from behind-left, the door's side of the room. */
const START_OFFSET = new Vector3(-0.38, 0.0, 1.72);
/** Step rhythm — a casual indoor pace. */
const BOB_HZ = 1.75;
const BOB_AMPLITUDE = 0.011;
const SWAY_AMPLITUDE = 0.0055;
/** Momentum past the stop, then damped out (0021). */
const OVERSHOOT = 0.013;
const SETTLE_HZ = 1.4;
/** The gaze starts on the room: higher and wider than the work. */
/* High enough to feel like taking the room in; low enough that the
   bounce-lit ceiling never enters the frame. */
const GAZE_START_OFFSET = new Vector3(-0.2, 0.02, 0);

function easeInOutQuint(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped < 0.5
    ? 16 * clamped ** 5
    : 1 - Math.pow(-2 * clamped + 2, 5) / 2;
}

function cubicOut(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

function shouldSkipApproach(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has("arrive")) return false;
  return params.has("shot") || params.has("record");
}

function waitingForRecorder(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("record") || !params.has("arrive")) return false;
  return !(window as Window & { __recordingStarted?: boolean })
    .__recordingStarted;
}

/** A beat of rest after the recorder starts, before the walk begins. */
const FILM_LEAD_SECONDS = 0.8;

export function Arrival() {
  const camera = useThree((state) => state.camera);
  const elapsed = useRef(0);
  const done = useRef(false);

  const poses = useMemo(() => {
    const end = new Vector3(...STAGE.camera.position);
    const endGaze = new Vector3(...STAGE.camera.lookAt);
    /* The frame survives the viewport (0079): a narrow window doesn't
       amputate the bench — the body simply stands further back. The
       stance is chosen once, at arrival, the way a person picks where
       to stand for the room they walked into; resizing mid-visit does
       not move a standing body. At 16:9 and wider, nothing changes. */
    if (typeof window !== "undefined") {
      const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
      const extraBack = Math.min(Math.max(1.1 * (1.5 - aspect), 0), 0.9);
      end.z += extraBack;
    }
    const start = end.clone().add(START_OFFSET);
    const startGaze = endGaze.clone().add(GAZE_START_OFFSET);
    /* The walk's forward direction, for overshoot and sway axes. */
    const forward = end.clone().sub(start).setY(0).normalize();
    const lateral = new Vector3(-forward.z, 0, forward.x);
    return { start, end, startGaze, endGaze, forward, lateral };
  }, []);

  const approach = useMemo<RoomBehavior>(
    () => ({
      name: "arrival-approach",
      kind: "camera",
      enabled: true,
      onRoomTick: (clock) => {
        if (done.current) return;
        if (shouldSkipApproach()) {
          done.current = true;
          camera.position.copy(poses.end);
          camera.lookAt(poses.endGaze);
          (window as Window & { __arrivalDone?: boolean }).__arrivalDone =
            true;
          return;
        }
        if (waitingForRecorder()) {
          elapsed.current = -FILM_LEAD_SECONDS;
          camera.position.copy(poses.start);
          camera.lookAt(poses.startGaze);
          return;
        }
        elapsed.current += clock.delta;
        const t = elapsed.current;
        if (t < 0) {
          camera.position.copy(poses.start);
          camera.lookAt(poses.startGaze);
          return;
        }

        /* The walk: one ease of mass along the approach line. */
        const walkT = Math.min(t / WALK_SECONDS, 1);
        const along = easeInOutQuint(walkT);
        camera.position.lerpVectors(poses.start, poses.end, along);

        /* The body: step bob and sway, fading in and out with the walk.
           The bob dips (heels strike); it never lifts above eye height. */
        const envelope = Math.sin(Math.PI * walkT);
        const stride = t * BOB_HZ * Math.PI * 2;
        camera.position.y -=
          BOB_AMPLITUDE * (0.5 + 0.5 * Math.sin(stride)) * envelope;
        camera.position.addScaledVector(
          poses.lateral,
          SWAY_AMPLITUDE * Math.sin(stride / 2) * envelope,
        );

        /* The stop: momentum past the mark, damped out at body rates. */
        if (walkT >= 1) {
          const settleT = Math.min((t - WALK_SECONDS) / SETTLE_SECONDS, 1);
          const decay = Math.exp(-3.2 * settleT);
          camera.position.addScaledVector(
            poses.forward,
            OVERSHOOT * Math.cos(settleT * SETTLE_HZ * Math.PI * 2) * decay,
          );
        }

        /* The gaze: from the room to the work, landing after the feet. */
        const gazeT = cubicOut(t / (WALK_SECONDS + GAZE_LAG_SECONDS));
        const gazePoint = poses.startGaze.clone().lerp(poses.endGaze, gazeT);
        camera.lookAt(gazePoint);

        if (t >= WALK_SECONDS + SETTLE_SECONDS) {
          done.current = true;
          camera.position.copy(poses.end);
          camera.lookAt(poses.endGaze);
          /* The interface waits for the body to arrive (0076). */
          (window as Window & { __arrivalDone?: boolean }).__arrivalDone =
            true;
        }
      },
    }),
    [camera, poses],
  );
  useRoomBehavior(approach);

  return null;
}
