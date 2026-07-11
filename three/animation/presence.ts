import type { RoomClock } from "@/three/animation/roomClock";

/**
 * The Presence system (WORK ORDER 0017) — the room's behavioral ecosystem.
 *
 * Future behaviors do not own their own frame loops. They register here and
 * the room ticks them — every behavior hears the same heartbeat, in a
 * deterministic order, from one place. Registration is not enablement:
 * a behavior can exist quietly long before it ever acts.
 *
 * Nothing is registered yet. This is the vocabulary before the sentence.
 */

export type BehaviorKind =
  /** Small continuous life: dust-level, below conscious notice. */
  | "ambient"
  /** The human body holding the view. */
  | "camera"
  /** Light, air, weather — the room's environment. */
  | "environment"
  /** The rare moments where reality leaks. */
  | "impossible";

export interface RoomBehavior {
  /** Stable identity, e.g. "camera-breath". One registration per name. */
  name: string;
  kind: BehaviorKind;
  /** Whether the behavior currently acts. Registered does not mean enabled. */
  enabled: boolean;
  /**
   * Called once per frame with the room's time while enabled. A behavior
   * expresses itself only through what it owns (camera, lights, materials).
   */
  onRoomTick: (clock: Readonly<RoomClock>) => void;
}

/** Insertion-ordered so ticking is deterministic across frames and sessions. */
const registry = new Map<string, RoomBehavior>();

/** Register a behavior with the room. Returns its unregister function. */
export function registerBehavior(behavior: RoomBehavior): () => void {
  if (registry.has(behavior.name)) {
    throw new Error(`Room behavior "${behavior.name}" is already registered.`);
  }
  registry.set(behavior.name, behavior);
  return () => {
    registry.delete(behavior.name);
  };
}

/** Tick every enabled behavior. Called by RoomClockDriver, after the clock advances. */
export function tickPresence(clock: Readonly<RoomClock>): void {
  for (const behavior of registry.values()) {
    if (behavior.enabled) behavior.onRoomTick(clock);
  }
}

/** A snapshot for debugging and the Studio; never used by behaviors themselves. */
export function listBehaviors(): ReadonlyArray<{
  name: string;
  kind: BehaviorKind;
  enabled: boolean;
}> {
  return Array.from(registry.values(), ({ name, kind, enabled }) => ({
    name,
    kind,
    enabled,
  }));
}
