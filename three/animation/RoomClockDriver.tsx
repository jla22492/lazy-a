"use client";

import { useFrame } from "@react-three/fiber";

import { advanceRoomClock } from "@/three/animation/roomClock";

/** Runs before every other frame callback so the clock is always current. */
const BEFORE_EVERYTHING = -100;

/**
 * Advances the room clock exactly once per rendered frame (WORK ORDER 0016).
 * Renders nothing; the room's heartbeat is not a visible thing.
 */
export function RoomClockDriver() {
  useFrame((_, delta) => {
    advanceRoomClock(delta);
  }, BEFORE_EVERYTHING);

  return null;
}
