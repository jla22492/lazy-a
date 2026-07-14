"use client";

import { Suspense, useEffect, useRef, useState } from "react";

import {
  BackSide,
  PMREMGenerator,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type MeshBasicMaterial,
} from "three";
import { useFrame, useLoader } from "@react-three/fiber";

import { assetPath } from "@/lib/assetPath";
import { whenRoomIsSettled } from "@/lib/deferredAssets";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useThree } from "@react-three/fiber";

import { provideReflections } from "@/three/lighting/reflections";


import { Canvas, type RootState } from "@react-three/fiber";
import { AgXToneMapping } from "three";

import { AttentionNavigation } from "@/components/site/AttentionNavigation";
import { Arrival } from "@/components/camera/Arrival";
import { AttentionSensor } from "@/components/camera/AttentionSensor";
import { CameraRig } from "@/components/camera/CameraRig";
import { IntentSensor } from "@/components/camera/IntentSensor";
import { FirstLook } from "@/components/camera/FirstLook";
import { FirstStep } from "@/components/camera/FirstStep";
import { Notebook } from "@/components/room/Notebook";
import { RoomShell } from "@/components/room/RoomShell";
import { DustMotes } from "@/components/room/DustMotes";
import { EdgeOfFrameDressing } from "@/components/room/EdgeOfFrameDressing";
import { FloorWear } from "@/components/room/FloorWear";
import { Infrastructure } from "@/components/room/Infrastructure";
import { OffscreenWorld } from "@/components/room/OffscreenWorld";
import { PeripheralRoomDressing } from "@/components/room/PeripheralRoomDressing";
import { ReferenceWallDressing } from "@/components/room/ReferenceWallDressing";
import { UpperWall } from "@/components/room/UpperWall";
import { Workbench } from "@/components/room/Workbench";
import { Pencil, WorkbenchDressing } from "@/components/room/WorkbenchDressing";
import { WorkspaceZones } from "@/components/room/WorkspaceZones";
import { RoomClockDriver } from "@/three/animation/RoomClockDriver";
import { Daylight } from "@/three/lighting/Daylight";
import { activeStudy } from "@/three/scene/cameraStudies";
import { Floor } from "@/three/scene/Floor";
import { STAGE } from "@/three/scene/constants";
import { scheduleProgressShot } from "@/three/scene/progressShot";

/** Progress captures always render at exactly 16:9 (1280x720). */
const CAPTURE_SIZE = { width: 1280, height: 720 } as const;

/** True when this page load exists to take a progress capture (dev only). */
function isCaptureRun(): boolean {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return params.has("shot") || params.has("record");
}

/**
 * The pre-rendered room, SPIKE (WORK ORDER 0107): ?pano=1 swaps the
 * static geometry for a Cycles equirect panorama on a rotation-only
 * sphere, keeping the LIVE layers — the hero's film, the interface,
 * the journal — composited on top. The interaction grammar never
 * cares whether the pixels behind it are live or baked.
 */
function PanoRoom({ onSettledIn }: { onSettledIn: () => void }) {
  const texture = useLoader(
    TextureLoader,
    assetPath("/textures/pano-spike.jpg"),
  );
  const materialRef = useRef<MeshBasicMaterial>(null);
  const fadeT = useRef(0);
  const announced = useRef(false);
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    /* Blender's equirect centres the settled gaze (-Z) at u=0.5; the
       sphere's UVs run the opposite hand when seen from inside, so the
       map is flipped horizontally and the mesh yawed +90deg to land the
       desk exactly where the living desk stands. */
    texture.wrapS = RepeatWrapping;
    texture.repeat.x = -1;
    texture.needsUpdate = true;
    /* The 8K streams through the magic window and swaps in place. */
    whenRoomIsSettled(() => {
      const image = new Image();
      image.onload = () => {
        (texture as { image: unknown }).image = image;
        texture.needsUpdate = true;
      };
      image.src = assetPath("/textures/pano-8k.jpg");
    });
  }, [texture]);
  /* The dissolve (order 4): once the arrival settles, the pre-rendered
     room fades in over the live one — by the time the hero begins, the
     world behind the living layers is a photograph. */
  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;
    /* The plate was rendered from the WIDE settle eye. A narrow
       viewport seats the body elsewhere (0094), and from there the
       living layers would shear off the photograph — narrow viewports
       keep the geometric room. Same threshold as the Arrival's
       narrowness (aspect 1.5). */
    if (state.size.width / state.size.height < 1.5 && fadeT.current === 0) {
      return;
    }
    const arrived = (window as Window & { __arrivalDone?: boolean })
      .__arrivalDone;
    if (!arrived && fadeT.current === 0) return;
    fadeT.current = Math.min(fadeT.current + delta / 0.6, 1);
    material.opacity = fadeT.current;
    if (fadeT.current >= 1 && !announced.current) {
      announced.current = true;
      onSettledIn();
    }
  });
  return (
    <mesh position={[...STAGE.camera.position]} rotation-y={Math.PI / 2}>
      <sphereGeometry args={[20, 48, 32]} />
      {/* The Cycles frame is already AgX tone-mapped; mapping it again
          in the browser muddies it. It arrives display-ready. */}
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        side={BackSide}
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function isPanoRun(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("pano");
}

/**
 * Generates the reflection environment ONCE and hands it to the
 * reflections module (0103). scene.environment is deliberately never
 * set — the 0099 finding stands: a global environment relights the
 * room. Only subscribed shiny materials ever see this texture.
 */
function ReflectionSource() {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    provideReflections(environment);
    return () => {
      pmrem.dispose();
    };
  }, [gl]);
  return null;
}

/** The film stage: neutral void, base lighting, bare floor, the workbench, a human camera. */
export function Stage() {
  /* Camera studies (WORK ORDER 0006): ?study=<id> previews an alternative
     viewpoint. Without the parameter, this is exactly the baseline. */
  const study = activeStudy();
  /* Applied after mount so server and client render identically; the
     resize observer then re-measures the pinned canvas. */
  const [captureMode, setCaptureMode] = useState(false);
  const [pano, setPano] = useState(false);
  const [panoIn, setPanoIn] = useState(false);
  useEffect(() => {
    if (isCaptureRun()) setCaptureMode(true);
    if (isPanoRun()) {
      setPano(true);
      (window as Window & { __panoIn?: boolean }).__panoIn = true;
    }
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
        <ReflectionSource />
        <RoomClockDriver />
        <Daylight />
        <Suspense fallback={null}>
          <PanoRoom
            onSettledIn={() => {
              setPanoIn(true);
              /* The living layers read this the way they read
                 __arrivalDone — the plate is now the room. */
              (window as Window & { __panoIn?: boolean }).__panoIn = true;
            }}
          />
        </Suspense>
        {pano || panoIn ? (
          /* The plate excludes the journal's living layer — the pencil
             keeps lying across the notebook after the dissolve. The
             notebook's grounding shadow lives in Notebook itself (the
             sun's normalBias eats true grazing-angle shadows of low
             objects, so it is authored — the pencil jar's un-sunned
             disc set the precedent). */
          <Pencil />
        ) : (
          <>
            <Floor />
            <RoomShell />
            <Workbench />
            <WorkbenchDressing />
            <UpperWall />
            <PeripheralRoomDressing />
            <EdgeOfFrameDressing />
            <Infrastructure />
            <OffscreenWorld />
            <FloorWear />
          </>
        )}
        <ReferenceWallDressing />
        <DustMotes />
        <Notebook />
        <WorkspaceZones />
        <CameraRig />
        <Arrival />
        <AttentionNavigation />
        <FirstStep />
        <FirstLook />
        <AttentionSensor />
        <IntentSensor />
      </Canvas>
    </div>
  );
}
