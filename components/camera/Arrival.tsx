"use client";

import { useMemo, useRef } from "react";

import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import type { RoomBehavior } from "@/three/animation/presence";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";
import { EYE_HEIGHT, STAGE } from "@/three/scene/constants";

/**
 * The arrival, STANDING (R-0092, Jonathan's ruling) — the opening
 * begins deep in the room so the WHOLE render introduces itself, then
 * becomes the POV of walking to the desk and stopping over the work:
 *
 * - The opening beat (~0.3s): the full room from just inside the
 *   doorway's side of the space.
 * - The walk (~2.6s): the approach to the desk, standing height, the
 *   0020 bob and sway.
 * - The settle (~0.6s): the body stops OVER the work — momentum a
 *   centimeter past the mark, damped out (0021) — and the gaze drops
 *   onto the desk-and-wall regard. There is no sit-down push: the
 *   camera rests at the higher vantage, so choosing JOURNAL later is
 *   a real head-drop that opens the page.
 *
 * The whole figure completes inside Jonathan's 4-second criterion,
 * measured from recordings, not estimated. It happens once; then the
 * camera is exactly the standing composition and this behavior retires.
 * Capture runs (?shot / ?record) skip it; ?record with ?arrive films
 * it, the walk waiting for the recorder's true start.
 */
const OPENING_BEAT_SECONDS = 0.25;
const WALK_SECONDS = 2.15;
/** The stop: momentum past the mark, damped out at body rates. */
const SETTLE_SECONDS = 0.55;
const GAZE_LAG_SECONDS = 0.3;

/** The opening stance: deep in the room, the doorway's side. */
const OPENING_POSITION = new Vector3(-0.6, EYE_HEIGHT, 4.9);
const OPENING_GAZE = new Vector3(0.05, 0.92, 0);
/** Step rhythm — a casual indoor pace. */
const BOB_HZ = 1.75;
const BOB_AMPLITUDE = 0.011;
const SWAY_AMPLITUDE = 0.0055;
/** Momentum past the stop, then damped out (0021). */
const OVERSHOOT = 0.012;
const SETTLE_HZ = 1.4;

function easeInOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped < 0.5
    ? 4 * clamped ** 3
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
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
    const seated = new Vector3(...STAGE.camera.position);
    const endGaze = new Vector3(...STAGE.camera.lookAt);
    /* The frame survives the viewport (0079, recomposed for the seat at
       0094): at a narrow viewport the body settles further back AND the
       seat slides toward the hero's axis, so the portrait slice holds
       what matters — the playing print above, today's work below — with
       the notebook still in reach. The studio's note leaves the resting
       crop on a phone; it still reads during the walk. Chosen once at
       arrival; at 16:9 and wider, nothing changes. */
    if (typeof window !== "undefined") {
      const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
      const narrowness = Math.min(Math.max(1.5 - aspect, 0), 1.05);
      seated.z += Math.min(1.1 * narrowness, 0.9);
      seated.x += 0.24 * narrowness;
      endGaze.x += 0.38 * narrowness;
    }
    /* The walk begins deep in the room, the whole render visible. */
    const start = OPENING_POSITION.clone();
    const startGaze = OPENING_GAZE.clone();
    const forward = seated.clone().sub(start).setY(0).normalize();
    const lateral = new Vector3(-forward.z, 0, forward.x);
    return { start, seated, startGaze, endGaze, forward, lateral };
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
          camera.position.copy(poses.seated);
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

        /* The opening beat: the full composition, held. */
        if (t < OPENING_BEAT_SECONDS) {
          camera.position.copy(poses.start);
          camera.lookAt(poses.startGaze);
          return;
        }

        /* The walk: one ease of mass to the standing mark. */
        const walkT = Math.min((t - OPENING_BEAT_SECONDS) / WALK_SECONDS, 1);
        camera.position.lerpVectors(
          poses.start,
          poses.seated,
          easeInOutCubic(walkT),
        );

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
          const settleT = Math.min(
            (t - OPENING_BEAT_SECONDS - WALK_SECONDS) / SETTLE_SECONDS,
            1,
          );
          const decay = Math.exp(-3.2 * settleT);
          camera.position.addScaledVector(
            poses.forward,
            OVERSHOOT * Math.cos(settleT * SETTLE_HZ * Math.PI * 2) * decay,
          );
        }

        /* The gaze: from the room down onto the work, landing a beat
           after the feet stop. */
        const gazeT = cubicOut(
          t / (OPENING_BEAT_SECONDS + WALK_SECONDS + GAZE_LAG_SECONDS),
        );
        const gazePoint = poses.startGaze.clone().lerp(poses.endGaze, gazeT);
        camera.lookAt(gazePoint);

        if (t >= OPENING_BEAT_SECONDS + WALK_SECONDS + SETTLE_SECONDS) {
          done.current = true;
          camera.position.copy(poses.seated);
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
