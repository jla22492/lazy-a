"use client";

import { useMemo } from "react";

import {
  beginCommit,
  consumeIntent,
  intentOf,
  releaseCommit,
  tickIntent,
} from "@/three/animation/intent";
import type { RoomBehavior } from "@/three/animation/presence";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";

/**
 * Advances the intent pipeline each frame, after perception has updated
 * (WORK ORDER 0025). Renders nothing; no input is bound yet — future
 * deliberate actions call beginCommit/releaseCommit through this layer.
 */
export function IntentSensor() {
  const sensor = useMemo<RoomBehavior>(
    () => ({
      name: "intent-sensor",
      kind: "ambient",
      enabled: true,
      onRoomTick: (clock) => {
        tickIntent(clock.delta);
      },
    }),
    [],
  );
  useRoomBehavior(sensor);

  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    /* Dev observability only — never surfaced in the experience. */
    const dev = window as Window & {
      __intent?: () => unknown;
      __beginCommit?: (target: string) => boolean;
      __releaseCommit?: () => void;
      __consumeIntent?: (target: string) => boolean;
    };
    dev.__intent = intentOf;
    dev.__beginCommit = beginCommit;
    dev.__releaseCommit = releaseCommit;
    dev.__consumeIntent = consumeIntent;
  }

  return null;
}
