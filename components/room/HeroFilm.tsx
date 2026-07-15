"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, Vector3, VideoTexture } from "three";

import { assetPath } from "@/lib/assetPath";
import {
  INITIAL_HERO_STATE,
  heroLifecycleReducer,
} from "@/three/animation/heroLifecycle";
import {
  REFLECTION_INTENSITY,
  useReflections,
} from "@/three/lighting/reflections";
import { HERO_PRINT } from "@/three/scene/dressing/referenceWall";

const HERO_FILM = {
  src: "/videos/hero-print-placeholder.mp4",
  border: 0.018,
  settleBeatSeconds: 1.8,
  roughness: 0.52,
} as const;

declare global {
  interface Window {
    __lazyAHeroProjection?: readonly number[];
  }
}

function arrivalDone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as Window & { __arrivalDone?: boolean }).__arrivalDone === true
  );
}

/**
 * The living image remains mounted for the whole visit. Camera and navigation
 * state never enter this component, so neither can pause or restart the film.
 */
export function HeroFilm() {
  const { width, height, thickness } = HERO_PRINT;
  const outputColorSpace = useThree((state) => state.gl.outputColorSpace);
  const reflections = useReflections();
  const [state, dispatch] = useReducer(
    heroLifecycleReducer,
    INITIAL_HERO_STATE,
  );
  const [texture, setTexture] = useState<VideoTexture | null>(null);
  const meshRef = useRef<Mesh>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readyRef = useRef(false);
  const beatElapsed = useRef(0);
  const beatPassed = useRef(false);
  const settleDispatched = useRef(false);
  const playAttempted = useRef(false);

  useEffect(() => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.defaultMuted = true;
    video.loop = false;
    video.playsInline = true;
    video.controls = false;
    video.crossOrigin = "anonymous";
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.dataset.lazyAHero = "true";
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const videoTexture = new VideoTexture(video);
    videoTexture.colorSpace = outputColorSpace;
    videoRef.current = video;

    const onReady = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      video.currentTime = 0;
      setTexture(videoTexture);
      dispatch({ type: "READY" });
      if (beatPassed.current && !settleDispatched.current) {
        settleDispatched.current = true;
        dispatch({ type: "DESK_SETTLED" });
      }
    };
    const onPlaying = () => dispatch({ type: "PLAYING" });
    const onEnded = () => {
      video.pause();
      dispatch({ type: "ENDED" });
    };
    const onFailed = () => dispatch({ type: "FAILED" });

    video.addEventListener("canplay", onReady, { once: true });
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onFailed, { once: true });
    video.src = assetPath(HERO_FILM.src);
    video.load();

    return () => {
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onFailed);
      video.pause();
      video.removeAttribute("src");
      video.load();
      videoTexture.dispose();
      videoRef.current = null;
      delete window.__lazyAHeroProjection;
    };
  }, [outputColorSpace]);

  useEffect(() => {
    const video = videoRef.current;
    if (
      state.phase !== "playing" ||
      state.playCount !== 1 ||
      !video ||
      playAttempted.current
    ) {
      return;
    }
    playAttempted.current = true;
    void video.play().catch(() => dispatch({ type: "FAILED" }));
  }, [state]);

  useFrame(({ camera }, delta) => {
    const mesh = meshRef.current;
    if (mesh) {
      const halfWidth = (width - HERO_FILM.border * 2) / 2;
      const halfHeight = (height - HERO_FILM.border * 2) / 2;
      mesh.updateWorldMatrix(true, false);
      window.__lazyAHeroProjection = [
        [-halfWidth, halfHeight],
        [halfWidth, halfHeight],
        [halfWidth, -halfHeight],
        [-halfWidth, -halfHeight],
      ].flatMap(([x, y]) => {
        const projected = new Vector3(x, y, 0)
          .applyMatrix4(mesh.matrixWorld)
          .project(camera);
        return [(projected.x + 1) / 2, (1 - projected.y) / 2];
      });
    }
    if (beatPassed.current || !arrivalDone()) return;
    beatElapsed.current += delta;
    if (beatElapsed.current < HERO_FILM.settleBeatSeconds) return;
    beatPassed.current = true;
    if (readyRef.current && !settleDispatched.current) {
      settleDispatched.current = true;
      dispatch({ type: "DESK_SETTLED" });
    }
  });

  if (!texture) return null;

  return (
    <mesh
      ref={meshRef}
      position={[0, 0, thickness * 1.1 + 0.0004]}
      receiveShadow
    >
      <planeGeometry
        args={[width - HERO_FILM.border * 2, height - HERO_FILM.border * 2]}
      />
      <meshStandardMaterial
        map={texture}
        roughness={HERO_FILM.roughness}
        envMap={reflections ?? undefined}
        envMapIntensity={REFLECTION_INTENSITY.gloss}
      />
    </mesh>
  );
}
