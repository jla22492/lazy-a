"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
  VideoTexture,
} from "three";

import { assetPath } from "@/lib/assetPath";
import { getPlateProjection } from "@/lib/plateAssets";
import {
  mapPlateQuad,
  selectPlateVariant,
} from "@/lib/plateSpace";
import {
  INITIAL_HERO_STATE,
  heroLifecycleReducer,
} from "@/three/animation/heroLifecycle";
import { plateManifest } from "@/three/scene/plateManifest";

const HERO_FILM = {
  src: "/videos/hero-print-placeholder.mp4",
  settleBeatSeconds: 1.8,
} as const;

const HERO_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const HERO_FRAGMENT_SHADER = `
  uniform sampler2D heroMap;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(heroMap, vUv);
  }
`;

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
  const outputColorSpace = useThree((state) => state.gl.outputColorSpace);
  const viewportSize = useThree((state) => state.size);
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
  const geometry = useMemo(() => {
    const next = new BufferGeometry();
    next.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(12), 3),
    );
    next.setAttribute(
      "uv",
      new Float32BufferAttribute(
        [0, 1, 1, 1, 1, 0, 0, 0],
        2,
      ),
    );
    next.setIndex([0, 1, 2, 0, 2, 3]);
    return next;
  }, []);
  const material = useMemo(
    () =>
      texture
        ? new ShaderMaterial({
            uniforms: { heroMap: { value: texture } },
            vertexShader: HERO_VERTEX_SHADER,
            fragmentShader: HERO_FRAGMENT_SHADER,
            depthTest: false,
            depthWrite: false,
            side: DoubleSide,
            toneMapped: false,
          })
        : null,
    [texture],
  );

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

  useEffect(
    () => () => {
      geometry.dispose();
      material?.dispose();
    },
    [geometry, material],
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (mesh) {
      const hero = getPlateProjection()?.hero;
      const variant = selectPlateVariant(viewportSize.width);
      const profile = plateManifest.variants[variant];
      const mapped = hero
        ? mapPlateQuad(
            hero,
            { width: profile.width, height: profile.height },
            viewportSize,
          )
        : [];
      mesh.visible = mapped.length === 8;
      if (mapped.length === 8) {
        const positions = geometry.getAttribute("position");
        const normalized: number[] = [];
        for (let index = 0; index < 4; index += 1) {
          const x = mapped[index * 2] / viewportSize.width;
          const y = mapped[index * 2 + 1] / viewportSize.height;
          positions.setXYZ(index, x * 2 - 1, 1 - y * 2, 0);
          normalized.push(x, y);
        }
        positions.needsUpdate = true;
        window.__lazyAHeroProjection = normalized;
      }
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

  if (!texture || !material) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={100}
    />
  );
}
