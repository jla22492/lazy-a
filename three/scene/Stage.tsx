"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Canvas, type RootState } from "@react-three/fiber";
import { AgXToneMapping } from "three";

import { HeroFilm } from "@/components/room/HeroFilm";
import {
  PlateCompositor,
  type PlateStatus,
} from "@/components/room/PlateCompositor";
import { PlateRoom } from "@/components/room/PlateRoom";
import { AttentionNavigation } from "@/components/site/AttentionNavigation";
import { announceRoomSettled } from "@/lib/deferredAssets";
import {
  adaptPlateManifest,
  type PlateExperienceState,
  type PlateVariant,
} from "@/lib/plateAssets";
import { PHONE_MAX_WIDTH, selectPlateVariant } from "@/lib/plateSpace";
import { RoomClockDriver } from "@/three/animation/RoomClockDriver";
import {
  plateExperienceReducer,
  type ExperienceEvent,
} from "@/three/animation/plateExperience";
import { activeStudy } from "@/three/scene/cameraStudies";
import { STAGE } from "@/three/scene/constants";
import { plateManifest } from "@/three/scene/plateManifest";
import { scheduleProgressShot } from "@/three/scene/progressShot";

const CAPTURE_SIZE = { width: 1280, height: 720 } as const;
const INITIAL_EXPERIENCE: PlateExperienceState = {
  endpoint: "opening",
  requested: null,
  transition: "opening-to-desk",
  phase: "transitioning",
};
const AUTHORED_PLATES = adaptPlateManifest(plateManifest);

function isCaptureRun(): boolean {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return params.has("shot") || params.has("record");
}

function viewportVariant(width: number): PlateVariant {
  return width <= PHONE_MAX_WIDTH ? selectPlateVariant(width) : "wide";
}

/** The visitor runtime is one Canvas, one authored plate frame, and one camera. */
export function Stage() {
  const study = activeStudy();
  const stageRef = useRef<HTMLDivElement>(null);
  const [captureMode] = useState(isCaptureRun);
  const [variant, setVariant] = useState<PlateVariant>("wide");
  const [plateStatus, setPlateStatus] = useState<PlateStatus>("ready");
  const [heroReleased, setHeroReleased] = useState(false);
  const [experience, setExperience] =
    useState<PlateExperienceState>(INITIAL_EXPERIENCE);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const updateVariant = (width: number) =>
      setVariant(viewportVariant(width));
    updateVariant(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateVariant(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      experience.phase !== "resting" ||
      experience.endpoint !== "desk" ||
      !experience.requested
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setExperience((current) =>
        current.phase === "resting" &&
        current.endpoint === "desk" &&
        current.requested
          ? plateExperienceReducer(current, {
              type: "SELECT",
              destination: current.requested,
            })
          : current,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [experience]);

  const settleAtDesk = useCallback(() => {
    announceRoomSettled();
    setHeroReleased(true);
    setExperience({
      endpoint: "desk",
      requested: null,
      transition: null,
      phase: "resting",
    });
  }, []);

  const transitionEnded = useCallback(() => {
    setExperience((current) =>
      plateExperienceReducer(current, { type: "TRANSITION_ENDED" }),
    );
  }, []);

  const handleExperienceEvent = useCallback(
    (event: Extract<ExperienceEvent, { type: "SELECT" | "CLOSE" }>) => {
      setExperience((current) => plateExperienceReducer(current, event));
    },
    [],
  );

  return (
    <div
      ref={stageRef}
      data-room-renderer="plate"
      style={
        captureMode
          ? { ...CAPTURE_SIZE, position: "relative", overflow: "hidden" }
          : {
              position: "relative",
              width: "100%",
              height: "100%",
              minWidth: 1,
              minHeight: 1,
              overflow: "hidden",
            }
      }
    >
      <HeroFilm>
        <PlateRoom
          variant={variant}
          state={experience}
          status={plateStatus}
          manifest={AUTHORED_PLATES}
        />
        <Canvas
          shadows={false}
          gl={{
            alpha: true,
            preserveDrawingBuffer: true,
            toneMapping: AgXToneMapping,
          }}
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
          }}
          camera={{
            fov: study.fov,
            near: STAGE.camera.near,
            far: STAGE.camera.far,
            position: [...study.position],
          }}
          onCreated={(state) => {
            state.gl.setClearColor(0x000000, 0);
            if (process.env.NODE_ENV !== "production") {
              (window as Window & { __stage?: RootState }).__stage = state;
              scheduleProgressShot(state);
            }
          }}
        >
          <PlateCompositor
            variant={variant}
            state={experience}
            manifest={AUTHORED_PLATES}
            heroReleased={heroReleased}
            onDeskSettled={settleAtDesk}
            onTransitionEnded={transitionEnded}
            onStatusChange={setPlateStatus}
          >
            <RoomClockDriver />
            <AttentionNavigation
              experience={experience}
              onExperienceEvent={handleExperienceEvent}
            />
          </PlateCompositor>
        </Canvas>
      </HeroFilm>
    </div>
  );
}
