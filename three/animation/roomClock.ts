/**
 * The room clock — the room's one quiet heartbeat (WORK ORDER 0016).
 *
 * Every future time-based behavior (camera breathing, light fluctuation,
 * ambient behaviors, impossible moments) derives its timing from this
 * single source, so the whole room moves in one tempo instead of a
 * collection of isolated timers.
 *
 * The clock is a mutable singleton advanced exactly once per rendered
 * frame by <RoomClockDriver /> inside the Canvas. Consumers read it inside
 * their own frame callbacks via getRoomClock()/useRoomClock() — no React
 * re-renders are involved.
 *
 * Philosophy (WORK ORDER 0017): this clock represents ROOM TIME. The room
 * exists whether or not it is being observed; the visitor arrives in the
 * middle of its life. Version 1 happens to advance with the render loop —
 * that is an implementation detail, not a design law, and no future
 * behavior should assume the room pauses when unobserved.
 */

export interface RoomClock {
  /** Seconds the room has existed during this visit. */
  elapsed: number;
  /** Seconds since the previous frame. */
  delta: number;
  /**
   * The heartbeat: a 0..1 phase cycling at a calm resting-human breath.
   * Future gentle behaviors (camera sway, light easing) phase-lock to it.
   */
  breath: number;
  /**
   * A much slower 0..1 ambient phase for near-imperceptible drift —
   * the tempo of clouds and afternoons rather than breaths.
   */
  drift: number;
}

/** A calm resting adult breathes ~12 times a minute: one breath every 5s. */
export const BREATH_PERIOD_SECONDS = 5;

/** Ambient drift moves at the tempo of weather, not bodies. */
export const DRIFT_PERIOD_SECONDS = 90;

const clock: RoomClock = { elapsed: 0, delta: 0, breath: 0, drift: 0 };

/** Advance the room's time. Called once per frame by RoomClockDriver only. */
export function advanceRoomClock(delta: number): void {
  clock.delta = delta;
  clock.elapsed += delta;
  clock.breath = (clock.elapsed / BREATH_PERIOD_SECONDS) % 1;
  clock.drift = (clock.elapsed / DRIFT_PERIOD_SECONDS) % 1;
}

/** The room's current time. Read fields inside frame callbacks. */
export function getRoomClock(): Readonly<RoomClock> {
  return clock;
}
