"use client";

import { useMemo, useRef } from "react";

import type { DirectionalLight } from "three";

import type { RoomBehavior } from "@/three/animation/presence";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";
import { BREATH_SOFTENING, getQuietLevel } from "@/three/interface/quiet";
import { DAYLIGHT } from "@/three/scene/constants";

const { sun, bounce, breath } = DAYLIGHT;

const FULL_CYCLE = Math.PI * 2;

/**
 * Believable daylight (WORK ORDER 0005): a single sun entering from outside
 * the frame, plus one subtle bounce fill so shadows never go dead. Not mood,
 * not cinematography — light that behaves like it already existed.
 *
 * The first breath (WORK ORDER 0018): the sun's intensity sways
 * imperceptibly with the room clock — mostly on the slow drift phase, with
 * a whisper of the breath phase — registered with the Presence system as
 * the room's first living behavior.
 */
export function Daylight() {
  const sunRef = useRef<DirectionalLight>(null);

  const daylightBreath = useMemo<RoomBehavior>(
    () => ({
      name: "daylight-breath",
      kind: "environment",
      enabled: true,
      onRoomTick: (clock) => {
        if (!sunRef.current) return;
        /* The room quiets for the work (0081): during a conversation the
           breath softens — the host lowering the music. */
        const soften = 1 - BREATH_SOFTENING * getQuietLevel();
        const sway =
          1 +
          soften *
            (breath.driftAmplitude * Math.sin(clock.drift * FULL_CYCLE) +
              breath.breathAmplitude * Math.sin(clock.breath * FULL_CYCLE));
        sunRef.current.intensity = sun.intensity * sway;
      },
    }),
    [],
  );
  useRoomBehavior(daylightBreath);

  return (
    <>
      {/* R-0109 (Jonathan's notes): a warm room light is on somewhere
          in the off-screen depth of the room — the shadowed side never
          goes cold or unreadable. No shadows: it is felt, not seen. */}
      <pointLight
        color="#ffd9b0"
        intensity={9}
        distance={14}
        decay={2}
        position={[-2.2, 2.1, 5.6]}
      />
      <directionalLight
        ref={sunRef}
        castShadow
        color={sun.color}
        intensity={sun.intensity}
        position={sun.position}
        shadow-mapSize={[sun.shadow.mapSize, sun.shadow.mapSize]}
        shadow-camera-left={-sun.shadow.coverage}
        shadow-camera-right={sun.shadow.coverage}
        shadow-camera-top={sun.shadow.coverage}
        shadow-camera-bottom={-sun.shadow.coverage}
        shadow-bias={sun.shadow.bias}
        shadow-normalBias={sun.shadow.normalBias}
        shadow-radius={sun.shadow.radius}
        shadow-blurSamples={sun.shadow.blurSamples}
      />
      <hemisphereLight
        color={bounce.skyColor}
        groundColor={bounce.groundColor}
        intensity={bounce.intensity}
      />
    </>
  );
}
