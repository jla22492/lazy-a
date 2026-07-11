"use client";

import { useFrame } from "@react-three/fiber";

import { tickPresence } from "@/three/animation/presence";
import { advanceRoomClock, getRoomClock } from "@/three/animation/roomClock";

/** Runs before every other frame callback so the clock is always current. */
const BEFORE_EVERYTHING = -100;

/**
 * The room's single frame entry point (WORK ORDERS 0016, 0017): advances
 * the clock, then ticks every enabled behavior in the Presence registry.
 * Renders nothing; the room's heartbeat is not a visible thing.
 */
export function RoomClockDriver() {
  useFrame((_, delta) => {
    advanceRoomClock(delta);
    tickPresence(getRoomClock());
  }, BEFORE_EVERYTHING);

  return null;
}
