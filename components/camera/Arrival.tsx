"use client";

import { useMemo, useRef } from "react";

import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import type { RoomBehavior } from "@/three/animation/presence";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";
import { EYE_HEIGHT, STAGE } from "@/three/scene/constants";

/**
 * The arrival, SEATED (R-0089, Jonathan's amendment to the 0089 first
 * pass) — the opening begins ON the full composition the room was built
 * for, then becomes the POV of walking to the desk and sitting down:
 *
 * - The opening beat (~0.4s): the R-0071 standing composition, whole —
 *   the room as it has always introduced itself.
 * - The walk (~2.1s): the approach from that stance to the chair's
 *   place at the bench, standing height, the 0020 bob and sway.
 * - The sit (~1s, beginning as the last step lands): down to seated
 *   work height, in one motion.
 * - The settle: the seat takes the weight (a damped compression), and
 *   the gaze — which has been level on the room the whole way — comes
 *   to rest on the wall-and-desk regard. No downward stare: looking
 *   down is what choosing JOURNAL or CONTACT does, later.
 *
 * The whole figure completes inside Jonathan's 4-second criterion,
 * measured from recordings, not estimated. It happens once; then the
 * camera is exactly the seated composition and this behavior retires.
 * Capture runs (?shot / ?record) skip it; ?record with ?arrive films
 * it, the walk waiting for the recorder's true start.
 */
const OPENING_BEAT_SECONDS = 0.4;
const WALK_SECONDS = 2.1;
/** The sit begins as the last step lands, overlapping the walk's end. */
const SIT_START_SECONDS = OPENING_BEAT_SECONDS + WALK_SECONDS - 0.2;
const SIT_SECONDS = 1.0;
/** The seat takes the weight: compression decaying at body rates. */
const SETTLE_SECONDS = 0.6;
const GAZE_LAG_SECONDS = 0.3;

/** Where the body stops to sit: a step back from the seat itself. */
const PRE_SEAT_PULL_BACK = 0.3;
/** The opening stance: the locked standing composition (R-0071). */
const OPENING_POSITION = new Vector3(-0.45, EYE_HEIGHT, 4.0);
const OPENING_GAZE = new Vector3(0.05, 0.92, 0);
/** Step rhythm — a casual indoor pace. */
const BOB_HZ = 1.75;
const BOB_AMPLITUDE = 0.011;
const SWAY_AMPLITUDE = 0.0055;
/** Seat compression: the body sinks a hair past rest and recovers. */
const COMPRESSION = 0.009;
const COMPRESSION_HZ = 1.6;

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
    /* The body stops to sit a step behind the seat, standing. */
    const preSeat = new Vector3(
      seated.x,
      EYE_HEIGHT,
      seated.z + PRE_SEAT_PULL_BACK,
    );
    /* The walk begins on the full composition the room was built for. */
    const start = OPENING_POSITION.clone();
    const startGaze = OPENING_GAZE.clone();
    const forward = preSeat.clone().sub(start).setY(0).normalize();
    const lateral = new Vector3(-forward.z, 0, forward.x);
    return { start, preSeat, seated, startGaze, endGaze, lateral };
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

        /* The walk: one ease of mass to the pre-seat mark. */
        const walkT = Math.min((t - OPENING_BEAT_SECONDS) / WALK_SECONDS, 1);
        camera.position.lerpVectors(
          poses.start,
          poses.preSeat,
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

        /* The sit: down to seated height, forward to the working
           position, one motion — beginning as the last step lands. */
        if (t >= SIT_START_SECONDS) {
          const sitT = Math.min((t - SIT_START_SECONDS) / SIT_SECONDS, 1);
          const eased = easeInOutCubic(sitT);
          camera.position.lerp(poses.seated, eased);

          /* The seat takes the weight: a small damped compression. */
          if (sitT >= 1) {
            const settleT = Math.min(
              (t - SIT_START_SECONDS - SIT_SECONDS) / SETTLE_SECONDS,
              1,
            );
            const decay = Math.exp(-3.5 * settleT);
            camera.position.y -=
              COMPRESSION *
              Math.abs(Math.sin(settleT * COMPRESSION_HZ * Math.PI * 2)) *
              decay;
          }
        }

        /* The gaze: from the room down to the work, landing a beat
           after the body is seated. */
        const gazeT = cubicOut(
          t / (SIT_START_SECONDS + SIT_SECONDS + GAZE_LAG_SECONDS),
        );
        const gazePoint = poses.startGaze.clone().lerp(poses.endGaze, gazeT);
        camera.lookAt(gazePoint);

        if (t >= SIT_START_SECONDS + SIT_SECONDS + SETTLE_SECONDS) {
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
