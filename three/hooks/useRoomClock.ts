"use client";

import { getRoomClock, type RoomClock } from "@/three/animation/roomClock";

/**
 * The room's shared sense of time (WORK ORDER 0016).
 * Returns the live clock object — read its fields inside frame callbacks;
 * it never triggers React re-renders.
 */
export function useRoomClock(): Readonly<RoomClock> {
  return getRoomClock();
}
