"use client";

import { useEffect, useMemo, useRef } from "react";

import { useThree } from "@react-three/fiber";

import {
  createLookState,
  DRAG_SENSITIVITY,
  KEY_RATE,
  tickLook,
} from "@/three/animation/firstLook";
import { WORKING_EYE, WORKING_GAZE } from "@/three/animation/firstStep";
import type { RoomBehavior } from "@/three/animation/presence";
import { visitorState } from "@/three/animation/visitorState";
import { useRoomBehavior } from "@/three/hooks/useRoomBehavior";

/** The settled gaze direction is the neck's neutral. */
const NEUTRAL_DIR = (() => {
  const dx = WORKING_GAZE[0] - WORKING_EYE[0];
  const dy = WORKING_GAZE[1] - WORKING_EYE[1];
  const dz = WORKING_GAZE[2] - WORKING_EYE[2];
  const horizontal = Math.hypot(dx, dz);
  return {
    yaw: Math.atan2(dx, -dz),
    pitch: Math.atan2(dy, horizontal),
  };
})();

/** How far ahead of the eyes the gaze point sits. */
const GAZE_REACH = 2;

/**
 * The first look (WORK ORDER 0022): once the visitor is standing at
 * WORKING, they can turn their head. Orientation only; the body stays
 * rooted; releasing input leaves attention where the visitor put it.
 *
 * TEMPORARY CONTROLS — not an interaction model: drag to look, or hold
 * the arrow keys. A dev-only ?autolook parameter plays a scripted look
 * for headless motion capture.
 */
export function FirstLook() {
  const camera = useThree((state) => state.camera);
  const look = useRef(createLookState());
  const engaged = useRef(false);

  const personLook = useMemo<RoomBehavior>(
    () => ({
      name: "person-look",
      kind: "camera",
      enabled: true,
      onRoomTick: (clock) => {
        if (!visitorState.atWorking || !engaged.current) return;
        const state = look.current;
        tickLook(state, clock.delta);
        const yaw = NEUTRAL_DIR.yaw + state.yaw;
        const pitch = NEUTRAL_DIR.pitch + state.pitch;
        camera.position.set(...WORKING_EYE);
        camera.lookAt(
          WORKING_EYE[0] + Math.sin(yaw) * Math.cos(pitch) * GAZE_REACH,
          WORKING_EYE[1] + Math.sin(pitch) * GAZE_REACH,
          WORKING_EYE[2] - Math.cos(yaw) * Math.cos(pitch) * GAZE_REACH,
        );
      },
    }),
    [camera],
  );
  useRoomBehavior(personLook);

  useEffect(() => {
    const keysDown = new Set<string>();
    let dragging = false;
    let keyTimer: number | undefined;

    const onPointerDown = () => {
      if (visitorState.atWorking) dragging = true;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || !visitorState.atWorking) return;
      engaged.current = true;
      look.current.targetYaw -= event.movementX * DRAG_SENSITIVITY;
      look.current.targetPitch -= event.movementY * DRAG_SENSITIVITY;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.code.startsWith("Arrow")) return;
      keysDown.add(event.code);
      engaged.current = visitorState.atWorking;
      if (keyTimer === undefined) {
        let last = performance.now();
        const step = () => {
          const now = performance.now();
          const dt = (now - last) / 1000;
          last = now;
          if (keysDown.has("ArrowLeft"))
            look.current.targetYaw -= KEY_RATE * dt;
          if (keysDown.has("ArrowRight"))
            look.current.targetYaw += KEY_RATE * dt;
          if (keysDown.has("ArrowUp"))
            look.current.targetPitch += KEY_RATE * dt;
          if (keysDown.has("ArrowDown"))
            look.current.targetPitch -= KEY_RATE * dt;
          if (keysDown.size > 0) keyTimer = window.setTimeout(step, 16);
          else keyTimer = undefined;
        };
        keyTimer = window.setTimeout(step, 0);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keysDown.delete(event.code);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    /* Scripted look for headless motion capture (dev only): a quiet turn
       left, a longer turn right, then attention left where it landed. */
    let autoTimers: number[] = [];
    if (process.env.NODE_ENV !== "production") {
      const auto = new URLSearchParams(window.location.search).get("autolook");
      if (auto) {
        const startAt = Number(auto) * 1000;
        const set = (yaw: number, pitch: number) => () => {
          if (!visitorState.atWorking) return;
          engaged.current = true;
          look.current.targetYaw = yaw;
          look.current.targetPitch = pitch;
        };
        autoTimers = [
          window.setTimeout(set(-0.5, 0.12), startAt),
          window.setTimeout(set(0.62, 0.05), startAt + 3000),
          window.setTimeout(set(0.18, -0.08), startAt + 6000),
        ];
      }
    }

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (keyTimer !== undefined) window.clearTimeout(keyTimer);
      autoTimers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return null;
}
