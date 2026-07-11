"use client";

import { useEffect } from "react";

import {
  registerBehavior,
  type RoomBehavior,
} from "@/three/animation/presence";

/**
 * Register a behavior with the room for this component's lifetime
 * (WORK ORDER 0017). The behavior object should be stable across renders —
 * define it outside the component or memoize it.
 */
export function useRoomBehavior(behavior: RoomBehavior): void {
  useEffect(() => registerBehavior(behavior), [behavior]);
}
