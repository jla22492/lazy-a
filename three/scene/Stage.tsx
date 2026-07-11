"use client";

import { useEffect, useState } from "react";

import { Canvas, type RootState } from "@react-three/fiber";
import { AgXToneMapping } from "three";

import { CameraRig } from "@/components/camera/CameraRig";
import { Notebook } from "@/components/room/Notebook";
import { RoomShell } from "@/components/room/RoomShell";
import { Workbench } from "@/components/room/Workbench";
import { WorkspaceZones } from "@/components/room/WorkspaceZones";
import { RoomClockDriver } from "@/three/animation/RoomClockDriver";
import { Daylight } from "@/three/lighting/Daylight";
import { activeStudy } from "@/three/scene/cameraStudies";
import { Floor } from "@/three/scene/Floor";
import { STAGE } from "@/three/scene/constants";
import { scheduleProgressShot } from "@/three/scene/progressShot";

/** Progress captures always render at exactly 16:9 (1280x720). */
const CAPTURE_SIZE = { width: 1280, height: 720 } as const;

/** True when this page load exists to take a progress screenshot (dev only). */
function isCaptureRun(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("shot")
  );
}

/** The film stage: neutral void, base lighting, bare floor, the workbench, a human camera. */
export function Stage() {
  /* Camera studies (WORK ORDER 0006): ?study=<id> previews an alternative
     viewpoint. Without the parameter, this is exactly the baseline. */
  const study = activeStudy();
  /* Applied after mount so server and client render identically; the
     resize observer then re-measures the pinned canvas. */
  const [captureMode, setCaptureMode] = useState(false);
  useEffect(() => {
    if (isCaptureRun()) setCaptureMode(true);
  }, []);
  return (
    /* Capture runs pin the canvas to 1280x720 so progress screenshots are
       true 16:9 regardless of the capturing browser's window shape. */
    <div style={captureMode ? CAPTURE_SIZE : { width: "100%", height: "100%" }}>
      <Canvas
        /* PCF with a blur radius: a soft penumbra without VSM's
           receivers-also-cast side effects (WORK ORDER 0015). */
        shadows="percentage"
        /* AgX tone mapping: calmer highlight rolloff than ACES — the frame
           reads photographic rather than rendered. preserveDrawingBuffer
           keeps the frame readable for progress screenshots. */
        gl={{ preserveDrawingBuffer: true, toneMapping: AgXToneMapping }}
        camera={{
          fov: study.fov,
          near: STAGE.camera.near,
          far: STAGE.camera.far,
          position: [...study.position],
        }}
        onCreated={(state) => {
          state.camera.lookAt(...study.lookAt);
          if (process.env.NODE_ENV !== "production") {
            /* Progress screenshots (docs/progress/) force a synchronous
             render through this handle when the page is not visible and
             requestAnimationFrame is paused. Dev only. */
            (window as Window & { __stage?: RootState }).__stage = state;
            scheduleProgressShot(state);
          }
        }}
      >
        <color attach="background" args={[STAGE.backgroundColor]} />
        <RoomClockDriver />
        <Daylight />
        <Floor />
        <RoomShell />
        <Workbench />
        <Notebook />
        <WorkspaceZones />
        <CameraRig />
      </Canvas>
    </div>
  );
}
