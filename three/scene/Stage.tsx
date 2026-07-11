"use client";

import { Canvas, type RootState } from "@react-three/fiber";

import { CameraRig } from "@/components/camera/CameraRig";
import { HeroPrint } from "@/components/room/HeroPrint";
import { Notebook } from "@/components/room/Notebook";
import { RoomShell } from "@/components/room/RoomShell";
import { Workbench } from "@/components/room/Workbench";
import { WorkspaceZones } from "@/components/room/WorkspaceZones";
import { Daylight } from "@/three/lighting/Daylight";
import { activeStudy } from "@/three/scene/cameraStudies";
import { Floor } from "@/three/scene/Floor";
import { STAGE } from "@/three/scene/constants";
import { scheduleProgressShot } from "@/three/scene/progressShot";

/** The film stage: neutral void, base lighting, bare floor, the workbench, a human camera. */
export function Stage() {
  /* Camera studies (WORK ORDER 0006): ?study=<id> previews an alternative
     viewpoint. Without the parameter, this is exactly the baseline. */
  const study = activeStudy();
  return (
    <Canvas
      shadows="soft"
      /* Keep the frame readable after render so progress screenshots
         (docs/progress/) can capture the canvas directly. */
      gl={{ preserveDrawingBuffer: true }}
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
      <Daylight />
      <Floor />
      <RoomShell />
      <Workbench />
      <Notebook />
      <HeroPrint />
      <WorkspaceZones />
      <CameraRig />
    </Canvas>
  );
}
