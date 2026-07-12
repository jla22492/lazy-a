"use client";

import { useMemo, useRef } from "react";

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  Vector3,
} from "three";

import type { RoomBehavior } from "@/three/animation/presence";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";
import { DUST_SLOWING, getQuietLevel } from "@/three/interface/quiet";
import { seededRandom } from "@/three/materials/procedural";
import { DAYLIGHT, ROOM } from "@/three/scene/constants";
import { fromWorkbench } from "@/three/scene/world";

/**
 * Dust in the light (WORK ORDER 0074) — the room's first reward for
 * patience. A few dozen motes drift down the window's shaft of daylight,
 * visible only where the light crosses the darker wall and floor beyond.
 * Two seconds of visiting never shows them; thirty seconds does. They
 * demand nothing.
 *
 * Physically motivated: the motes live in the true light volume — the
 * prism from the window opening along the sun's real direction to the
 * floor patch computed in 0049. Speeds are dust speeds (centimeters per
 * second), driven by the room clock with a slow per-mote wander.
 * Deterministic (seeded) so captures repeat.
 */
const MOTE_COUNT = 42;
/** Dust settles slowly; the shaft's air barely moves. */
const FALL_SPEED = 0.028;
const WANDER_SPEED = 0.011;

export function DustMotes() {
  const pointsRef = useRef<Points>(null);

  const system = useMemo(() => {
    const random = seededRandom(740);
    const sun = new Vector3(...DAYLIGHT.sun.position).normalize().negate();
    const { window: win, rightWall } = ROOM;
    /* Spawn across the window opening; travel along the sun into the room. */
    /* Dust is only visible against darker air — motes begin a meter into
       the shaft so none ever sits in front of the bright pane (R-0072). */
    const spawn = () => {
      const z = win.spanZ[0] + random() * (win.spanZ[1] - win.spanZ[0]);
      const y = win.sill + random() * (win.head - win.sill);
      const origin = new Vector3(rightWall.x, y, z);
      return origin.addScaledVector(sun, 1.0 + random() * 0.4);
    };
    const positions = new Float32Array(MOTE_COUNT * 3);
    const motes = Array.from({ length: MOTE_COUNT }, (_, index) => {
      const origin = spawn();
      /* Scatter each mote partway down the shaft so the air starts lived-in. */
      const along = random() * 1.4;
      const p = origin.clone().addScaledVector(sun, along);
      positions.set([p.x, p.y, p.z], index * 3);
      return {
        position: p,
        phase: random() * Math.PI * 2,
        rate: 0.6 + random() * 0.8,
      };
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return { geometry, motes, sun, spawn };
  }, []);

  const drift = useMemo<RoomBehavior>(
    () => ({
      name: "dust-in-the-light",
      kind: "ambient",
      enabled: true,
      onRoomTick: (clock) => {
        const attribute = system.geometry.getAttribute(
          "position",
        ) as BufferAttribute;
        /* The dust slows while the work speaks (0081). */
        const pace = 1 - DUST_SLOWING * getQuietLevel();
        system.motes.forEach((mote, index) => {
          mote.position.addScaledVector(
            system.sun,
            FALL_SPEED * pace * clock.delta,
          );
          /* A slow personal wander — no two motes agree. */
          const wander = Math.sin(
            clock.elapsed * mote.rate + mote.phase,
          );
          mote.position.y -= 0.004 * clock.delta;
          mote.position.z += wander * WANDER_SPEED * clock.delta;
          if (mote.position.y < 0.04) {
            mote.position.copy(system.spawn());
          }
          attribute.setXYZ(
            index,
            mote.position.x,
            mote.position.y,
            mote.position.z,
          );
        });
        attribute.needsUpdate = true;
      },
    }),
    [system],
  );
  useRoomBehavior(drift);

  return (
    <points ref={pointsRef} geometry={system.geometry} position={fromWorkbench([0, 0, 0])}>
      <pointsMaterial
        size={1.8}
        sizeAttenuation={false}
        color="#fff4e0"
        transparent
        opacity={0.18}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
