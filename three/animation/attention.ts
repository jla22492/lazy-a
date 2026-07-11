/**
 * The attention system (WORK ORDER 0023) — the room's ability to notice
 * what the visitor is observing. Entirely invisible: no highlights, no
 * UI, no responses. Perception only; every future interaction begins
 * here, because observation always precedes interaction.
 *
 * Model: meaningful objects register as targets with a position and a
 * physical radius. While the visitor's gaze cone holds a target, dwell
 * accumulates; when the gaze leaves, dwell decays rather than resetting —
 * attention lingers, like real attention. A target becomes OBSERVED only
 * after sustained gaze, and stops being observed with hysteresis, so
 * glances do not count and boundaries do not flicker.
 */

export interface AttentionTarget {
  /** Stable identity, e.g. "notebook". */
  name: string;
  /** World position of the object's attention center. */
  position: readonly [number, number, number];
  /** Physical radius (meters) used to compute its angular size. */
  radius: number;
}

/** Sustained gaze required before something counts as observed. */
const OBSERVE_AFTER_SECONDS = 0.8;
/** Observation ends when lingering attention decays below this. */
const RELEASE_BELOW_SECONDS = 0.3;
/** How quickly attention drains once the gaze moves away. */
const DECAY_RATE = 1.6;
/** Minimum gaze-cone half-angle; small or distant objects still get this. */
const MIN_CONE_RADIANS = 0.105;
/** Grace added around a target's angular size. */
const CONE_GRACE_RADIANS = 0.035;

const targets = new Map<string, AttentionTarget>();
const dwell = new Map<string, number>();

export interface AttentionState {
  /** The target currently observed, or null. */
  observed: string | null;
  /** Seconds of sustained attention on the observed target. */
  observedFor: number;
}

const state: AttentionState = { observed: null, observedFor: 0 };

/** Register a meaningful object. Returns its unregister function. */
export function registerAttentionTarget(target: AttentionTarget): () => void {
  targets.set(target.name, target);
  dwell.set(target.name, 0);
  return () => {
    targets.delete(target.name);
    dwell.delete(target.name);
    if (state.observed === target.name) {
      state.observed = null;
      state.observedFor = 0;
    }
  };
}

/** Advance perception. Called once per frame by the AttentionSensor. */
export function tickAttention(
  eye: readonly [number, number, number],
  forward: readonly [number, number, number],
  dt: number,
): void {
  for (const target of targets.values()) {
    const dx = target.position[0] - eye[0];
    const dy = target.position[1] - eye[1];
    const dz = target.position[2] - eye[2];
    const distance = Math.hypot(dx, dy, dz) || 1e-6;

    const dot =
      (dx * forward[0] + dy * forward[1] + dz * forward[2]) / distance;
    const angle = Math.acos(Math.min(Math.max(dot, -1), 1));

    const cone =
      Math.max(Math.atan(target.radius / distance), MIN_CONE_RADIANS) +
      CONE_GRACE_RADIANS;

    const current = dwell.get(target.name) ?? 0;
    dwell.set(
      target.name,
      angle <= cone ? current + dt : Math.max(0, current - DECAY_RATE * dt),
    );
  }

  /* Resolve the observed target with hysteresis. */
  if (state.observed !== null) {
    const held = dwell.get(state.observed) ?? 0;
    if (held < RELEASE_BELOW_SECONDS) {
      state.observed = null;
      state.observedFor = 0;
    } else {
      state.observedFor = held;
      return;
    }
  }
  let best: string | null = null;
  let bestDwell = 0;
  for (const [name, seconds] of dwell) {
    if (seconds >= OBSERVE_AFTER_SECONDS && seconds > bestDwell) {
      best = name;
      bestDwell = seconds;
    }
  }
  if (best !== null) {
    state.observed = best;
    state.observedFor = bestDwell;
  }
}

/** What the room currently knows about the visitor's attention. */
export function getAttention(): Readonly<AttentionState> {
  return state;
}
