"use client";

import { Canvas } from "@react-three/fiber";

import { CameraRig } from "@/components/camera/CameraRig";
import { RoomShell } from "@/components/room/RoomShell";
import { Workbench } from "@/components/room/Workbench";
import { Daylight } from "@/three/lighting/Daylight";
import { Floor } from "@/three/scene/Floor";
import { STAGE } from "@/three/scene/constants";

/** The film stage: neutral void, base lighting, bare floor, the workbench, a human camera. */
export function Stage() {
  return (
    <Canvas
      shadows="soft"
      /* Keep the frame readable after render so progress screenshots
         (docs/progress/) can capture the canvas directly. */
      gl={{ preserveDrawingBuffer: true }}
      camera={{
        fov: STAGE.camera.fov,
        near: STAGE.camera.near,
        far: STAGE.camera.far,
        position: STAGE.camera.position,
      }}
      onCreated={({ camera }) => {
        camera.lookAt(...STAGE.camera.lookAt);
      }}
    >
      <color attach="background" args={[STAGE.backgroundColor]} />
      <Daylight />
      <Floor />
      <RoomShell />
      <Workbench />
      <CameraRig />
    </Canvas>
  );
}
