"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  ShaderMaterial,
  VideoTexture,
  Vector2,
  Vector4,
} from "three";

import { assetPath } from "@/lib/assetPath";
import { getPlateProjection } from "@/lib/plateAssets";
import {
  mapPlatePoint,
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

const MAX_MASK_UPLOAD_BYTES = 1_500_000;
const MASK_BYTES_PER_PIXEL = 4;
const MAX_MASK_PIXELS = Math.floor(
  MAX_MASK_UPLOAD_BYTES / MASK_BYTES_PER_PIXEL,
);
const MASK_TEXTURE_SIZE = Math.floor(Math.sqrt(MAX_MASK_PIXELS));

const HERO_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const HERO_FRAGMENT_SHADER = `
  uniform sampler2D heroMap;
  uniform sampler2D occluderMask;
  uniform vec4 occluderBounds;
  varying vec2 vUv;
  void main() {
    vec2 maskUv = (gl_FragCoord.xy - occluderBounds.xy) / occluderBounds.zw;
    if (
      all(greaterThanEqual(maskUv, vec2(0.0))) &&
      all(lessThanEqual(maskUv, vec2(1.0))) &&
      texture2D(occluderMask, maskUv).r > 0.01
    ) discard;
    gl_FragColor = texture2D(heroMap, vUv);
  }
`;

class HeroMaskTexture extends CanvasTexture {
  markForUpload() {
    this.needsUpdate = true;
  }
}

interface OccluderTexture {
  canvas: HTMLCanvasElement;
  sourceCanvas: HTMLCanvasElement;
  map: HeroMaskTexture;
}

function createOccluderTexture(): OccluderTexture {
  const canvas = document.createElement("canvas");
  canvas.width = MASK_TEXTURE_SIZE;
  canvas.height = MASK_TEXTURE_SIZE;
  const sourceCanvas = document.createElement("canvas");
  const map = new HeroMaskTexture(canvas);
  map.generateMipmaps = false;
  map.minFilter = LinearFilter;
  map.magFilter = LinearFilter;
  return { canvas, sourceCanvas, map };
}

function paintEncodedMask(
  destination: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  mask: { size: number; rle: string },
): number {
  if (sourceCanvas.width !== mask.size || sourceCanvas.height !== mask.size) {
    sourceCanvas.width = mask.size;
    sourceCanvas.height = mask.size;
  }
  const source = sourceCanvas.getContext("2d");
  if (!source) return 0;
  source.clearRect(0, 0, mask.size, mask.size);
  source.fillStyle = "#fff";
  const binary = window.atob(mask.rle);
  let offset = 0;
  let runTotal = 0;
  for (let y = 0; y < mask.size && offset < binary.length; y += 1) {
    const runCount = binary.charCodeAt(offset++);
    for (let run = 0; run < runCount && offset + 1 < binary.length; run += 1) {
      const start = binary.charCodeAt(offset++);
      const end = binary.charCodeAt(offset++);
      source.fillRect(start, y, end - start + 1, 1);
      runTotal += 1;
    }
  }
  destination.imageSmoothingEnabled = true;
  destination.imageSmoothingQuality = "high";
  destination.drawImage(
    sourceCanvas,
    0,
    0,
    mask.size,
    mask.size,
    0,
    0,
    destination.canvas.width,
    destination.canvas.height,
  );
  return runTotal;
}

declare global {
  interface Window {
    __lazyAHeroProjection?: readonly number[];
    __lazyAHeroOcclusion?: {
      polygonCount: number;
      activePolygonCount: number;
      masked: boolean;
      heroLocal: true;
      textureWidth: number;
      textureHeight: number;
      uploadBytes: number;
      source: "evaluated-mesh-rle" | "convex-fallback";
    };
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
  const lastMaskProjection =
    useRef<ReturnType<typeof getPlateProjection>>(null);
  const lastMaskViewport = useRef("");
  const lastMaskRunCount = useRef(0);
  const drawingBufferSize = useRef(new Vector2());
  const geometry = useMemo(() => {
    const next = new BufferGeometry();
    next.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(12), 3),
    );
    next.setAttribute(
      "uv",
      new Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2),
    );
    next.setIndex([0, 1, 2, 0, 2, 3]);
    return next;
  }, []);
  const occluder = useMemo(() => createOccluderTexture(), []);
  const material = useMemo(
    () =>
      texture
        ? new ShaderMaterial({
            uniforms: {
              heroMap: { value: texture },
              occluderMask: { value: occluder.map },
              occluderBounds: { value: new Vector4(0, 0, 1, 1) },
            },
            vertexShader: HERO_VERTEX_SHADER,
            fragmentShader: HERO_FRAGMENT_SHADER,
            depthTest: false,
            depthWrite: false,
            side: DoubleSide,
            toneMapped: false,
          })
        : null,
    [occluder.map, texture],
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
      delete window.__lazyAHeroOcclusion;
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
      occluder.map.dispose();
    },
    [geometry, material, occluder.map],
  );

  useFrame((renderState, delta) => {
    const mesh = meshRef.current;
    if (mesh) {
      const projection = getPlateProjection();
      const hero = projection?.hero;
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
      const bufferSize = renderState.gl.getDrawingBufferSize(
        drawingBufferSize.current,
      );
      const scaleX = bufferSize.x / viewportSize.width;
      const scaleY = bufferSize.y / viewportSize.height;
      const heroXs = mapped.filter((_, index) => index % 2 === 0);
      const heroYs = mapped.filter((_, index) => index % 2 === 1);
      const hasMappedHero = mapped.length === 8;
      const minX = hasMappedHero
        ? Math.min(bufferSize.x, Math.max(0, Math.min(...heroXs) * scaleX))
        : 0;
      const maxX = hasMappedHero
        ? Math.min(bufferSize.x, Math.max(0, Math.max(...heroXs) * scaleX))
        : 1;
      const minY = hasMappedHero
        ? Math.min(bufferSize.y, Math.max(0, Math.min(...heroYs) * scaleY))
        : 0;
      const maxY = hasMappedHero
        ? Math.min(bufferSize.y, Math.max(0, Math.max(...heroYs) * scaleY))
        : 1;
      const maskWidth = Math.max(1, maxX - minX);
      const maskHeight = Math.max(1, maxY - minY);
      const textureWidth = occluder.canvas.width;
      const textureHeight = occluder.canvas.height;
      const viewportKey = [
        viewportSize.width,
        viewportSize.height,
        bufferSize.x,
        bufferSize.y,
        minX,
        minY,
        maxX,
        maxY,
      ].join(":");
      material?.uniforms.occluderBounds.value.set(
        minX,
        bufferSize.y - maxY,
        maskWidth,
        maskHeight,
      );
      if (
        material &&
        (projection !== lastMaskProjection.current ||
          viewportKey !== lastMaskViewport.current)
      ) {
        lastMaskProjection.current = projection;
        lastMaskViewport.current = viewportKey;
        const context = occluder.canvas.getContext("2d");
        const polygons = projection?.heroOccluders ?? [];
        const encodedMask = projection?.heroOcclusionMask;
        if (context) {
          context.clearRect(
            0,
            0,
            occluder.canvas.width,
            occluder.canvas.height,
          );
          context.fillStyle = "#fff";
          context.shadowColor = "#fff";
          context.shadowBlur = Math.max(
            0.5,
            2 * Math.min(textureWidth / maskWidth, textureHeight / maskHeight),
          );
          if (encodedMask) {
            lastMaskRunCount.current = paintEncodedMask(
              context,
              occluder.sourceCanvas,
              encodedMask,
            );
          } else {
            lastMaskRunCount.current = 0;
            for (const polygon of polygons) {
              if (polygon.length < 6) continue;
              lastMaskRunCount.current += 1;
              context.beginPath();
              for (let index = 0; index < polygon.length; index += 2) {
                const point = mapPlatePoint(
                  { x: polygon[index], y: polygon[index + 1] },
                  { width: profile.width, height: profile.height },
                  viewportSize,
                );
                const x =
                  (point.x * scaleX - minX) * (textureWidth / maskWidth);
                const y =
                  (point.y * scaleY - minY) * (textureHeight / maskHeight);
                if (index === 0) context.moveTo(x, y);
                else context.lineTo(x, y);
              }
              context.closePath();
              context.fill();
            }
          }
        }
        occluder.map.markForUpload();
      }
      const polygons = projection?.heroOccluders ?? [];
      const activePolygonCount = polygons.filter(
        (polygon) => polygon.length >= 6,
      ).length;
      window.__lazyAHeroOcclusion = {
        polygonCount: polygons.length,
        activePolygonCount,
        masked: lastMaskRunCount.current > 0,
        heroLocal: true,
        textureWidth,
        textureHeight,
        uploadBytes: textureWidth * textureHeight * MASK_BYTES_PER_PIXEL,
        source: projection?.heroOcclusionMask
          ? "evaluated-mesh-rle"
          : "convex-fallback",
      };
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
