/**
 * The first look (WORK ORDER 0022): a standing person turning their head.
 * Orientation only — the body stays rooted at WORKING. The look is
 * expressed as yaw/pitch offsets from the settled gaze direction, with
 * soft human limits (necks resist at their extremes, they do not clamp)
 * and critically-damped pursuit (necks have mass). Attention is never
 * recentered: where the visitor leaves their gaze is where it stays.
 */

/** Comfortable sustained head-turn range, radians (~55°). */
export const YAW_LIMIT = 0.96;
/** People look down at a bench more than they look up. */
export const PITCH_UP_LIMIT = 0.35;
export const PITCH_DOWN_LIMIT = 0.61;

/** Pursuit time constant: the head reaches ~63% of a turn in this time. */
export const NECK_TAU = 0.15;

/** Temporary input mappings (radians per pixel / per second). */
export const DRAG_SENSITIVITY = 0.0045;
export const KEY_RATE = 1.05;

/** Soft saturation: approach the limit asymptotically, never hit a wall. */
export function softLimit(value: number, limit: number): number {
  return limit * Math.tanh(value / limit);
}

/** Exponential approach toward the target — frame-rate independent. */
export function pursue(current: number, target: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / NECK_TAU));
}

export interface LookState {
  /** Where the head is, offsets from the neutral (settled) direction. */
  yaw: number;
  pitch: number;
  /** Where the visitor is steering it. */
  targetYaw: number;
  targetPitch: number;
}

export function createLookState(): LookState {
  return { yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 };
}

/** Advance the head toward its target with soft-limited angles. */
export function tickLook(look: LookState, dt: number): void {
  const yawGoal = softLimit(look.targetYaw, YAW_LIMIT);
  const pitchGoal =
    look.targetPitch >= 0
      ? softLimit(look.targetPitch, PITCH_UP_LIMIT)
      : -softLimit(-look.targetPitch, PITCH_DOWN_LIMIT);
  look.yaw = pursue(look.yaw, yawGoal, dt);
  look.pitch = pursue(look.pitch, pitchGoal, dt);
}
