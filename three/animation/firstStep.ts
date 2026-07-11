/**
 * The first step (WORK ORDER 0020): a person walks from ARRIVAL to
 * WORKING. Not a camera move — a body: real walking pace, human
 * acceleration and deceleration, a faint step-rhythm in the eyes that
 * fades as the body settles, and a gaze that drops to the notebook on
 * arrival. All timing derives from the room clock.
 */

import { EYE_HEIGHT } from "@/three/scene/constants";
import { STANDING_POSITIONS } from "@/three/scene/workspace";
import { fromWorkbench } from "@/three/scene/world";

/** Casual indoor walking pace. */
export const WALK_SPEED = 1.15;

/** Eyes bob a couple of centimeters at natural step rhythm. */
export const BOB_AMPLITUDE = 0.018;
export const STEP_FREQUENCY = 1.75;

/** Where the gaze begins easing toward its destination (walk progress). */
const GAZE_SHIFT_START = 0.6;

export const ARRIVAL_EYE = fromWorkbench([
  STANDING_POSITIONS.arrival.at[0],
  EYE_HEIGHT,
  STANDING_POSITIONS.arrival.at[1],
]);
export const WORKING_EYE = fromWorkbench([
  STANDING_POSITIONS.working.at[0],
  EYE_HEIGHT,
  STANDING_POSITIONS.working.at[1],
]);

/** The gaze at arrival: the locked opening composition's target. */
const ARRIVAL_GAZE = fromWorkbench([0, 0.9, 0]);
/**
 * The gaze once settled: a natural head drop onto the work surface just
 * beyond the notebook — the notebook sits prominent in the lower frame
 * while the bench's rear edge and the wall's base keep the room present.
 */
export const WORKING_GAZE = fromWorkbench([0.2, 0.9, -0.1]);

const WALK_DISTANCE = Math.hypot(
  WORKING_EYE[0] - ARRIVAL_EYE[0],
  WORKING_EYE[2] - ARRIVAL_EYE[2],
);

export const WALK_DURATION = WALK_DISTANCE / WALK_SPEED;

/** Smootherstep: zero velocity and acceleration at both ends — bodies, not motors. */
function smootherstep(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface WalkPose {
  eye: [number, number, number];
  gaze: [number, number, number];
  done: boolean;
}

/**
 * Settling (WORK ORDER 0021): the body finishes arriving. Momentum
 * carries the center of mass a touch past the stop, then a damped sway
 * brings it to rest — once, never looping. Amplitudes are millimeters;
 * if it can be noticed, it is too large.
 */
const SETTLE_DURATION = 1.3;
/** Natural standing-sway frequency. */
const SETTLE_FREQUENCY = 1.4;
/** Decay: the sway is ~1% by the end of the settle. */
const SETTLE_DAMPING = 3.5;
/** Forward drift past the stop, along the walk direction. */
const SETTLE_FORWARD = 0.012;
/** The final knee-soften dip. */
const SETTLE_DIP = 0.006;
/** The head arrives a beat after the body. */
const SETTLE_GAZE_LAG = 0.6;

export const STEP_TOTAL_DURATION = WALK_DURATION + SETTLE_DURATION;

/** Unit direction of travel in XZ, for the settle's forward sway. */
const WALK_DIR = [
  (WORKING_EYE[0] - ARRIVAL_EYE[0]) / WALK_DISTANCE,
  (WORKING_EYE[2] - ARRIVAL_EYE[2]) / WALK_DISTANCE,
];

/** Pose of the walking body at `t` seconds after the step began. */
export function walkPose(t: number): WalkPose {
  const progress = smootherstep(t / WALK_DURATION);

  /** Step bob, enveloped by 4p(1-p): silent at both ends, fullest mid-stride. */
  const bobEnvelope = 4 * progress * (1 - progress);
  const bob =
    BOB_AMPLITUDE * bobEnvelope * Math.sin(2 * Math.PI * STEP_FREQUENCY * t);

  const gazeT = smootherstep(
    (progress - GAZE_SHIFT_START) / (1 - GAZE_SHIFT_START),
  );

  /** After the walk: one damped sway, starting from zero with momentum. */
  const ts = t - WALK_DURATION;
  let settleForward = 0;
  let settleY = 0;
  let settleGazeY = 0;
  if (ts > 0) {
    const decay = Math.exp(-SETTLE_DAMPING * ts);
    const phase = 2 * Math.PI * SETTLE_FREQUENCY * ts;
    settleForward = SETTLE_FORWARD * decay * Math.sin(phase);
    settleY = -SETTLE_DIP * decay * Math.sin(phase * 0.5);
    settleGazeY =
      SETTLE_DIP * decay * Math.sin(Math.max(phase - SETTLE_GAZE_LAG, 0));
  }

  return {
    eye: [
      lerp(ARRIVAL_EYE[0], WORKING_EYE[0], progress) +
        WALK_DIR[0] * settleForward,
      EYE_HEIGHT + bob + settleY,
      lerp(ARRIVAL_EYE[2], WORKING_EYE[2], progress) +
        WALK_DIR[1] * settleForward,
    ],
    gaze: [
      lerp(ARRIVAL_GAZE[0], WORKING_GAZE[0], gazeT),
      lerp(ARRIVAL_GAZE[1], WORKING_GAZE[1], gazeT) + settleGazeY,
      lerp(ARRIVAL_GAZE[2], WORKING_GAZE[2], gazeT),
    ],
    done: t >= STEP_TOTAL_DURATION,
  };
}
