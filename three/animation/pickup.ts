/**
 * The pickup (WORK ORDER 0027): the first real interaction. A person
 * picks a notebook up off a workbench — the body performs the action:
 * a slight bend forward to reach, a beat while the hand closes, then
 * the lift as the body straightens and the notebook rises to a natural
 * two-handed hold below the gaze line. The camera never travels;
 * the notebook never flies.
 */

import { WORKING_EYE } from "@/three/animation/firstStep";

/** Reaching down to a bench-height object: a slight bend, not a stoop. */
export const REACH_DURATION = 0.55;
export const REACH_DIP = 0.1;
export const REACH_FORWARD = 0.13;

/** The hand closes; the world pauses for a breath. */
export const GRASP_PAUSE = 0.2;

/** The lift: body straightens, the notebook comes up to the hold. */
export const LIFT_DURATION = 0.95;

export const PICKUP_TOTAL = REACH_DURATION + GRASP_PAUSE + LIFT_DURATION;

/**
 * Where a standing person holds a closed notebook while deciding what
 * to do with it (WORK ORDER 0028): resting low in both hands near the
 * waist, biased toward the dominant hand, slightly askew. Held things
 * sit off-axis; presented things sit centered — this must read as held.
 */
export const HELD_FORWARD = 0.48;
export const HELD_BELOW_EYE = 0.33;
/** Toward the dominant hand (the workspace assumes a right-handed worker). */
export const HELD_ASIDE = 0.09;
/** Tilted toward the face, the way a notebook is held before opening. */
export const HELD_TILT = -0.85;
/** A casual few degrees off square — in hands, not on display. */
export const HELD_YAW_SKEW = 0.14;

/**
 * The arms accept the weight: as the lift completes, the notebook dips
 * a few millimetres and recovers — once, then true stillness.
 */
export const WEIGHT_SETTLE_DURATION = 1.1;
const WEIGHT_SETTLE_DIP = 0.011;
const WEIGHT_SETTLE_HZ = 1.3;
const WEIGHT_SETTLE_DAMPING = 3.2;

/**
 * Orienting (WORK ORDER 0029): after the hold settles there is a human
 * beat, then one small unconscious adjustment — the notebook turns
 * nearly square, tips a little further toward the reader, and the grip
 * shifts subtly centered. Habit, not animation: it happens once,
 * completes naturally, and stillness returns. The eyes stay on the
 * room — hands understand before eyes read.
 */
export const ORIENT_PAUSE = 0.9;
export const ORIENT_DURATION = 0.9;
/** The adjustment's targets, relative to the hold. */
export const ORIENT_YAW_SKEW = 0.03;
export const ORIENT_TILT = -0.98;
export const ORIENT_ASIDE = 0.05;
export const ORIENT_BELOW_EYE = 0.31;

/**
 * The first look down (WORK ORDER 0030): after the hands finish, a
 * quiet moment — then the eyes finally consider what is already being
 * held. Recognition, not curiosity: one natural transition from the
 * room to the notebook, then complete stillness. The body does not
 * move; the hands stay settled; nothing opens.
 */
export const LOOK_DOWN_PAUSE = 1.4;
export const LOOK_DOWN_DURATION = 1.1;
/** The gaze keeps being pursued briefly after the blend completes. */
export const LOOK_DOWN_ARRIVE = 0.8;

/**
 * Finding the cover (WORK ORDER 0032): the visitor has decided to
 * engage, and the hands prepare before anything commits — the dominant
 * thumb finds the cover edge, support redistributes to the other hand,
 * and the notebook rolls a few degrees so its opening edge offers
 * itself. One unconscious motion; the cover never separates; the gaze
 * never moves. Preparation is still reversible — opening is not.
 */
export const GRIP_ONSET = 0.15;
export const GRIP_DURATION = 0.7;
/** The opening edge lifts toward the thumb (radians of roll). */
export const GRIP_ROLL = 0.09;
/** Weight shifts toward the supporting hand; the book settles into it. */
export const GRIP_ASIDE_SHIFT = -0.025;
export const GRIP_DIP = 0.008;
/** The cover plane eases a touch flatter, comfortable to open. */
export const GRIP_TILT_EASE = 0.04;

/** Progress of the grip adjustment, `t` seconds after acceptance. */
export function gripProgress(t: number): number {
  return smootherstep((t - GRIP_ONSET) / GRIP_DURATION);
}

export const GRIP_TOTAL = GRIP_ONSET + GRIP_DURATION;

/**
 * Opening (WORK ORDER 0033): the first irreversible act. The cover
 * rotates around its real hinge — the spine edge under the supporting
 * hand — from the prepared grip, without hesitation or flourish,
 * stopping at its natural open rest just past vertical: open enough
 * that the first page could be seen, before anything becomes the
 * subject. The supporting hand answers the shifting weight: the grip
 * roll partly releases and the book settles a few millimetres.
 */
export const OPEN_ONSET = 0.12;
export const OPEN_DURATION = 1.15;
/** The cover's open resting angle (radians past closed). */
export const OPEN_ANGLE = 2.0;
/** How much of the grip roll the hand releases as the cover leaves. */
export const OPEN_COUNTER_ROLL = 0.35;
export const OPEN_SETTLE_DIP = 0.004;

/** Progress of the opening, `t` seconds after acceptance. */
export function openProgress(t: number): number {
  return smootherstep((t - OPEN_ONSET) / OPEN_DURATION);
}

export const OPEN_TOTAL = OPEN_ONSET + OPEN_DURATION;

/**
 * Once the notebook settles into the hold, the head rises to a
 * comfortable regard: the notebook sits low in vision, the room beyond
 * it — not pressed against the eyes. Radians below horizontal.
 */
export const HELD_REGARD_PITCH = -0.45;
/** The eyes begin rising off the object this far into the carry. */
export const REGARD_ONSET = 0.35;
/** How quickly the gaze pursues its target (seconds to ~63%). */
export const GAZE_TAU = 0.25;

function smootherstep(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface PickupPose {
  /** Where the eyes are. */
  eye: [number, number, number];
  /** 0..1 progress of the notebook along rest → held. */
  carry: number;
  /** Vertical weight-settle offset once the hold is reached. */
  settleY: number;
  /** 0..1 progress of the orienting adjustment (WORK ORDER 0029). */
  orient: number;
  /** 0..1 progress of the first look down (WORK ORDER 0030). */
  lookDown: number;
  done: boolean;
}

/**
 * The body's pose `t` seconds into the pickup. `towardNotebook` is the
 * unit XZ direction from the eyes to the notebook at rest.
 */
export function pickupPose(
  t: number,
  towardNotebook: readonly [number, number],
): PickupPose {
  /** Reach: bend slightly forward and down. */
  const reach = smootherstep(t / REACH_DURATION);
  /** Recover: straighten during the lift. */
  const recover = smootherstep(
    (t - REACH_DURATION - GRASP_PAUSE) / LIFT_DURATION,
  );
  /** Net bend: fully reached at the grasp, back upright by the hold. */
  const bend = reach * (1 - recover);

  /** The notebook travels only during the lift. */
  const carry = smootherstep(
    (t - REACH_DURATION - GRASP_PAUSE) / LIFT_DURATION,
  );

  /** After the lift, the arms take the load: one damped dip, then rest. */
  const ts = t - PICKUP_TOTAL;
  const settleY =
    ts > 0 && ts < WEIGHT_SETTLE_DURATION
      ? -WEIGHT_SETTLE_DIP *
        Math.exp(-WEIGHT_SETTLE_DAMPING * ts) *
        Math.sin(2 * Math.PI * WEIGHT_SETTLE_HZ * ts)
      : 0;

  /** A beat after the settle, the hands make their one adjustment. */
  const orient = smootherstep(
    (ts - WEIGHT_SETTLE_DURATION - ORIENT_PAUSE) / ORIENT_DURATION,
  );

  /** Another quiet moment — then the eyes finally look down. */
  const afterOrient =
    ts - WEIGHT_SETTLE_DURATION - ORIENT_PAUSE - ORIENT_DURATION;
  const lookDown = smootherstep(
    (afterOrient - LOOK_DOWN_PAUSE) / LOOK_DOWN_DURATION,
  );

  return {
    eye: [
      WORKING_EYE[0] + towardNotebook[0] * REACH_FORWARD * bend,
      WORKING_EYE[1] - REACH_DIP * bend,
      WORKING_EYE[2] + towardNotebook[1] * REACH_FORWARD * bend,
    ],
    carry,
    settleY,
    orient,
    lookDown,
    done:
      afterOrient >= LOOK_DOWN_PAUSE + LOOK_DOWN_DURATION + LOOK_DOWN_ARRIVE,
  };
}

/**
 * The notebook's path from rest to held: it lifts off the surface first,
 * then arcs toward the body — the vertical component leads, the way a
 * hand actually clears an object off a surface.
 */
/**
 * Where the eyes want to rest `carry` of the way through the lift:
 * on the object until it clears the bench, then rising toward the
 * settled regard as the notebook arrives in the hold.
 */
export function gazeGoal(
  notebook: readonly [number, number, number],
  regard: readonly [number, number, number],
  carry: number,
): [number, number, number] {
  const rise = smootherstep((carry - REGARD_ONSET) / (1 - REGARD_ONSET));
  return [
    lerp(notebook[0], regard[0], rise),
    lerp(notebook[1], regard[1], rise),
    lerp(notebook[2], regard[2], rise),
  ];
}

/** Frame-rate-independent pursuit of the gaze toward its goal. */
export function pursueGaze(
  gaze: [number, number, number],
  goal: readonly [number, number, number],
  dt: number,
): void {
  const k = 1 - Math.exp(-dt / GAZE_TAU);
  gaze[0] += (goal[0] - gaze[0]) * k;
  gaze[1] += (goal[1] - gaze[1]) * k;
  gaze[2] += (goal[2] - gaze[2]) * k;
}

export function carryPoint(
  rest: readonly [number, number, number],
  held: readonly [number, number, number],
  carry: number,
): [number, number, number] {
  /** Vertical leads the horizontal by easing faster early. */
  const liftBias = Math.min(1, carry * 1.35);
  return [
    lerp(rest[0], held[0], carry * carry * (3 - 2 * carry)),
    lerp(rest[1], held[1], liftBias),
    lerp(rest[2], held[2], carry * carry * (3 - 2 * carry)),
  ];
}
