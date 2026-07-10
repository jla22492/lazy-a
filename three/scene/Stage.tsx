"use client";

import { Canvas } from "@react-three/fiber";

import { CameraRig } from "@/components/camera/CameraRig";
import { StageLights } from "@/three/lighting/StageLights";
import { Floor } from "@/three/scene/Floor";
import { STAGE } from "@/three/scene/constants";

/** The empty film stage: neutral void, base lighting, bare floor, a human camera. */
export function Stage() {
  return (
    <Canvas
      camera={{
        fov: STAGE.camera.fov,
        near: STAGE.camera.near,
        far: STAGE.camera.far,
        position: STAGE.camera.position,
      }}
    >
      <color attach="background" args={[STAGE.backgroundColor]} />
      <StageLights />
      <Floor />
      <CameraRig />
    </Canvas>
  );
}
