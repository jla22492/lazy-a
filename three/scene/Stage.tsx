"use client";

import { Canvas } from "@react-three/fiber";

import { CameraRig } from "@/components/camera/CameraRig";
import { Workbench } from "@/components/room/Workbench";
import { StageLights } from "@/three/lighting/StageLights";
import { Floor } from "@/three/scene/Floor";
import { STAGE } from "@/three/scene/constants";

/** The film stage: neutral void, base lighting, bare floor, the workbench, a human camera. */
export function Stage() {
  return (
    <Canvas
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
      <StageLights />
      <Floor />
      <Workbench />
      <CameraRig />
    </Canvas>
  );
}
