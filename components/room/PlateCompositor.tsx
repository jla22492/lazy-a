"use client";

import {
  Suspense,
  type PropsWithChildren,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useFrame } from "@react-three/fiber";
import {
  LinearFilter,
  NoColorSpace,
  PerspectiveCamera,
  Texture,
  TextureLoader,
  Vector2,
  VideoTexture,
  type Mesh,
  type ShaderMaterial,
} from "three";

import { useHeroMedia } from "@/components/room/HeroFilm";
import {
  CompositorFrameContext,
  type CompositorFrame,
  useCompositorFrame,
} from "@/components/room/CompositorFrameContext";
import {
  PlateHeroComposite,
  type PlateHeroController,
} from "@/components/room/PlateHeroComposite";
import {
  claimPreparedPlateVideo,
  endpointAsset,
  publishPlateProjection,
  transitionAsset,
  transitionPrefixAsset,
  TRANSITION_PREFIX_FRAMES,
  type PlateAsset,
  type PlateExperienceState,
  type PlateManifestAdapter,
  type PreparedPlateVideo,
  type PlateVariant,
} from "@/lib/plateAssets";
import { parsePlateObjectPosition } from "@/lib/plateSpace";
import { plateManifest } from "@/three/scene/plateManifest";

const PLATE_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const HERO_FIRST_FRAME_PRESENTED = "lazy-a:hero-first-frame-presented";

const PLATE_FRAGMENT_SHADER = `
  uniform sampler2D plateMap;
  uniform vec2 sourceSize;
  uniform vec2 viewportSize;
  uniform vec2 objectPosition;
  varying vec2 vUv;
  void main() {
    // Preserve the authored CSS object-fit: cover crop inside Canvas.
    float coverScale = max(
      viewportSize.x / sourceSize.x,
      viewportSize.y / sourceSize.y
    );
    vec2 visibleSource = viewportSize / coverScale;
    vec2 cropOrigin = (sourceSize - visibleSource) * objectPosition;
    vec2 plateUv = (cropOrigin + vUv * visibleSource) / sourceSize;
    gl_FragColor = sRGBTransferEOTF(texture2D(plateMap, plateUv));
    #include <colorspace_fragment>
  }
`;

export { useCompositorFrame };

export type PlateStatus = "ready" | "transitioning" | "retained";

export interface CompositorDiagnostic {
  atomic: true;
  plateMediaTime: number;
  projectionFrame: number;
  heroFramePresented: number;
  profile: PlateVariant;
  plateSource: string;
  treatment: "scene-linear-blender-agx-lut-room-response";
  occlusion: "authored-msaa-coverage";
}

interface PlateCompositorProps extends PropsWithChildren {
  variant: PlateVariant;
  state: PlateExperienceState;
  manifest: PlateManifestAdapter;
  heroReleased: boolean;
  onDeskSettled: () => void;
  onTransitionEnded: () => void;
  onStatusChange: (status: PlateStatus) => void;
}

interface ActivePlateMedia {
  asset: PlateAsset;
  texture: Texture;
  video: HTMLVideoElement | null;
  usesVideoFrameCallback: boolean;
  mediaTime: RefObject<number>;
  variant: PlateVariant;
  onFault: (listener: () => void) => () => void;
  dispose: () => void;
}

declare global {
  interface Window {
    __lazyACompositor?: CompositorDiagnostic;
    __lazyAMediaTransition?: {
      source: string;
      preparedReused: boolean;
      playRequestedAt: number;
    };
    __heroReferenceTiming?: unknown;
  }
}

function prepareTexture(texture: Texture): Texture {
  texture.colorSpace = NoColorSpace;
  texture.flipY = true;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

async function loadImageMedia(
  asset: PlateAsset,
  variant: PlateVariant,
): Promise<ActivePlateMedia> {
  const texture = prepareTexture(
    await new TextureLoader().loadAsync(asset.src),
  );
  const mediaTime = { current: 0 };
  return {
    asset,
    texture,
    video: null,
    usesVideoFrameCallback: false,
    mediaTime,
    variant,
    onFault: () => () => {},
    dispose: () => texture.dispose(),
  };
}

function loadVideoMedia(
  asset: PlateAsset,
  variant: PlateVariant,
  prepared: PreparedPlateVideo,
  startTime: number | (() => number) = 0,
): Promise<ActivePlateMedia> {
  return new Promise((resolve, reject) => {
    const video = prepared.video;
    video.dataset.lazyAPlate = asset.id;
    const mediaTime = { current: 0 };
    const faultListeners = new Set<() => void>();
    let videoFrameCallback = 0;
    const usesVideoFrameCallback = "requestVideoFrameCallback" in video;
    let resolved = false;
    const cleanupListeners = () => {
      video.removeEventListener("error", failed);
      video.removeEventListener("abort", failed);
    };
    const dispose = () => {
      cleanupListeners();
      if (videoFrameCallback) {
        video.cancelVideoFrameCallback(videoFrameCallback);
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
      texture.dispose();
    };
    const observeFrame: VideoFrameRequestCallback = (_now, metadata) => {
      mediaTime.current = metadata.mediaTime;
      if (!video.ended) {
        videoFrameCallback = video.requestVideoFrameCallback(observeFrame);
      }
    };
    if (usesVideoFrameCallback) {
      // Register before VideoTexture so camera/projection time advances before
      // Three marks the corresponding decoded texture frame for presentation.
      videoFrameCallback = video.requestVideoFrameCallback(observeFrame);
    }
    const texture = prepareTexture(new VideoTexture(video));
    const finish = () => {
      resolved = true;
      mediaTime.current = video.currentTime;
      resolve({
        asset,
        texture,
        video,
        usesVideoFrameCallback,
        mediaTime,
        variant,
        onFault(listener) {
          faultListeners.add(listener);
          return () => faultListeners.delete(listener);
        },
        dispose,
      });
    };
    const positionAtRequestedStart = () => {
      const requestedStart =
        typeof startTime === "function" ? startTime() : startTime;
      const boundedStart = Math.min(
        Math.max(0, requestedStart),
        Number.isFinite(video.duration)
          ? Math.max(0, video.duration - 1 / (asset.fps ?? 30))
          : 0,
      );
      if (boundedStart <= 0.001) {
        video.currentTime = 0;
        finish();
        return;
      }
      video.addEventListener("seeked", finish, { once: true });
      video.currentTime = boundedStart;
    };
    const failed = () => {
      if (resolved) {
        for (const listener of faultListeners) listener();
        return;
      }
      dispose();
      reject(new Error(`Plate video failed: ${asset.id}`));
    };
    video.addEventListener("error", failed);
    video.addEventListener("abort", failed);
    positionAtRequestedStart();
  });
}

function transitionTarget(state: PlateExperienceState): PlateAsset["id"] {
  const transition = state.transition?.toLowerCase() ?? "";
  for (const endpoint of [
    "desk",
    "films",
    "journal",
    "contact",
    "about",
  ] as const) {
    if (
      transition.endsWith(endpoint) ||
      transition.includes(`to-${endpoint}`)
    ) {
      return endpoint;
    }
  }
  return state.requested ?? state.endpoint;
}

function compactTransitionId(transition: string | null): string | null {
  return transition?.replace(/-to-/g, "-") ?? null;
}

function objectPosition(asset: PlateAsset): Vector2 {
  const point = parsePlateObjectPosition(asset.objectPosition);
  return new Vector2(point.x, point.y);
}

/**
 * One negative-priority selector binds plate texture, authored camera, and
 * projection. One positive-priority presenter draws exactly once and only then
 * publishes the frame that reached the drawing buffer.
 */
export function PlateCompositor({
  variant,
  state,
  manifest,
  heroReleased,
  onDeskSettled,
  onTransitionEnded,
  onStatusChange,
  children,
}: PlateCompositorProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const activeMediaRef = useRef<ActivePlateMedia | null>(null);
  const frameRef = useRef<CompositorFrame | null>(null);
  const heroControllerRef = useRef<PlateHeroController | null>(null);
  const runRef = useRef(0);
  const mountedRef = useRef(true);
  const { phase: heroPhase, presentedFrames } = useHeroMedia();
  const profileSize = plateManifest.variants[variant];
  const uniforms = useMemo(
    () => ({
      plateMap: { value: null as Texture | null },
      sourceSize: {
        value: new Vector2(profileSize.width, profileSize.height),
      },
      viewportSize: { value: new Vector2(1, 1) },
      objectPosition: { value: new Vector2(0.5, 0.5) },
    }),
    [profileSize.height, profileSize.width],
  );

  const replaceMedia = useCallback((media: ActivePlateMedia) => {
    const previous = activeMediaRef.current;
    activeMediaRef.current = media;
    if (previous && previous !== media) previous.dispose();
  }, []);
  const registerHeroController = useCallback(
    (controller: PlateHeroController | null) => {
      heroControllerRef.current = controller;
    },
    [],
  );

  const completeTransition = useCallback(
    (experience: PlateExperienceState, run: number) => {
      if (!mountedRef.current || runRef.current !== run) return;
      onStatusChange("ready");
      const target = transitionTarget(experience);
      if (target === "desk" && experience.endpoint === "opening") {
        onDeskSettled();
      } else {
        onTransitionEnded();
      }
    },
    [onDeskSettled, onStatusChange, onTransitionEnded],
  );

  const retainFallback = useCallback(
    async (
      experience: PlateExperienceState,
      run: number,
      transition: PlateAsset | undefined,
    ) => {
      if (!mountedRef.current || runRef.current !== run) return;
      onStatusChange("retained");
      const target = transitionTarget(experience);
      try {
        const endpoint = endpointAsset(
          manifest,
          variant,
          target as Parameters<typeof endpointAsset>[2],
        );
        const fallback = await loadImageMedia(endpoint, variant);
        if (!mountedRef.current || runRef.current !== run) {
          fallback.dispose();
          return;
        }
        replaceMedia(fallback);
      } catch {
        // The persistent server-rendered opening photograph remains below.
      }
      const duration =
        transition?.durationSeconds ??
        (experience.endpoint === "opening" ? 2.6 : 0.9);
      window.setTimeout(
        () => completeTransition(experience, run),
        duration * 1000,
      );
    },
    [completeTransition, manifest, onStatusChange, replaceMedia, variant],
  );

  useEffect(() => {
    if (state.phase === "transitioning") return;
    if (activeMediaRef.current?.variant === variant) return;
    const run = ++runRef.current;
    const endpoint = endpointAsset(manifest, variant, state.endpoint);
    onStatusChange("transitioning");
    void loadImageMedia(endpoint, variant)
      .then((media) => {
        if (!mountedRef.current || runRef.current !== run) {
          media.dispose();
          return;
        }
        replaceMedia(media);
        onStatusChange("ready");
      })
      .catch(() => onStatusChange("retained"));
  }, [
    manifest,
    onStatusChange,
    replaceMedia,
    state.endpoint,
    state.phase,
    variant,
  ]);

  useEffect(() => {
    if (state.phase !== "transitioning" || !state.transition) return;
    const experience = { ...state };
    const previous = activeMediaRef.current;
    const resumeTime = () =>
      previous?.video &&
      previous.asset.id === compactTransitionId(state.transition)
        ? previous.mediaTime.current
        : 0;
    const run = ++runRef.current;
    const transition = transitionAsset(manifest, variant, state.transition);
    onStatusChange("transitioning");
    if (!transition) {
      void retainFallback(experience, run, transition);
      return;
    }
    const availablePrefix = transitionPrefixAsset(transition);
    const prefixHandoffTime = TRANSITION_PREFIX_FRAMES / (transition.fps ?? 30);
    const prefix =
      availablePrefix && resumeTime() < prefixHandoffTime
        ? availablePrefix
        : undefined;
    let fullMediaPromise: Promise<{
      prepared: PreparedPlateVideo;
      media: ActivePlateMedia;
    }> | null = null;
    const loadFullMedia = () => {
      if (fullMediaPromise) return fullMediaPromise;
      fullMediaPromise = claimPreparedPlateVideo(transition).then(
        async (prepared) => ({
          prepared,
          media: await loadVideoMedia(
            transition,
            variant,
            prepared,
            prefix ? prefixHandoffTime : resumeTime,
          ),
        }),
      );
      void fullMediaPromise.catch(() => {});
      return fullMediaPromise;
    };
    const initialMedia = prefix
      ? claimPreparedPlateVideo(prefix).then(async (prepared) => ({
          prepared,
          media: await loadVideoMedia(prefix, variant, prepared, () =>
            Math.max(1 / (prefix.fps ?? 30), resumeTime()),
          ),
          prefix: true,
        }))
      : loadFullMedia().then((loaded) => ({ ...loaded, prefix: false }));
    let releaseTransitionWatch = () => {};
    let completed = false;
    const playLoadedMedia = ({
      media,
      prepared,
      prefix: isPrefix,
    }: {
      media: ActivePlateMedia;
      prepared: PreparedPlateVideo;
      prefix: boolean;
    }) => {
      if (!mountedRef.current || runRef.current !== run) {
        media.dispose();
        return;
      }
      replaceMedia(media);
      const video = media.video;
      if (!video) return;
      let stallTimer = 0;
      const cleanupWatch = () => {
        window.clearTimeout(stallTimer);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("playing", armStallWatch);
        video.removeEventListener("timeupdate", armStallWatch);
        video.removeEventListener("playing", announceOpeningPlayback);
        unsubscribeFault();
      };
      const fail = () => {
        if (completed || runRef.current !== run) return;
        completed = true;
        cleanupWatch();
        media.dispose();
        if (activeMediaRef.current === media) {
          activeMediaRef.current = null;
        }
        void retainFallback(experience, run, transition);
      };
      const armStallWatch = () => {
        window.clearTimeout(stallTimer);
        stallTimer = window.setTimeout(
          fail,
          window.__heroReferenceTiming ? 120_000 : 2_000,
        );
      };
      const announceOpeningPlayback = () => {
        if (experience.endpoint !== "opening") return;
        window.dispatchEvent(
          new CustomEvent("lazy-a:plate-transition-playing", {
            detail: { variant: media.variant, source: transition.src },
          }),
        );
      };
      const onEnded = () => {
        if (completed) return;
        cleanupWatch();
        video.pause();
        if (isPrefix) {
          void loadFullMedia()
            .then((loaded) => {
              if (!mountedRef.current || runRef.current !== run) {
                loaded.media.dispose();
                return;
              }
              playLoadedMedia({ ...loaded, prefix: false });
            })
            .catch(fail);
          return;
        }
        completed = true;
        media.mediaTime.current = video.duration;
        completeTransition(experience, run);
      };
      const unsubscribeFault = media.onFault(fail);
      releaseTransitionWatch = cleanupWatch;
      video.addEventListener("ended", onEnded, { once: true });
      video.addEventListener("playing", announceOpeningPlayback, {
        once: true,
      });
      video.addEventListener("playing", armStallWatch);
      video.addEventListener("timeupdate", armStallWatch);
      armStallWatch();
      window.__lazyAMediaTransition = {
        source: transition.src,
        preparedReused: prepared.preparedReused,
        playRequestedAt: performance.now(),
      };
      void video
        .play()
        .then(() => {
          if (isPrefix) void loadFullMedia().catch(fail);
        })
        .catch(fail);
    };
    void initialMedia
      .then(playLoadedMedia)
      .catch(() => retainFallback(experience, run, transition));
    return () => releaseTransitionWatch();
  }, [
    completeTransition,
    manifest,
    onStatusChange,
    replaceMedia,
    retainFallback,
    state,
    variant,
  ]);

  useEffect(
    () => () => {
      runRef.current += 1;
      activeMediaRef.current?.dispose();
      activeMediaRef.current = null;
      frameRef.current = null;
      delete window.__lazyACompositor;
      delete window.__lazyAMediaTransition;
    },
    [],
  );

  useFrame(({ gl, camera, size }) => {
    const media = activeMediaRef.current;
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!media || !mesh || !material) {
      if (mesh) mesh.visible = false;
      heroControllerRef.current?.clear();
      frameRef.current = null;
      return;
    }
    const frames = media.asset.projectionFrames;
    const activeProfileSize = plateManifest.variants[media.variant];
    const mediaTime =
      media.video && !media.usesVideoFrameCallback
        ? media.video.currentTime
        : media.mediaTime.current;
    const frameIndex = frames?.length
      ? Math.min(
          Math.round(mediaTime * (media.asset.fps ?? 30)),
          frames.length - 1,
        )
      : 0;
    const projection = frames?.[frameIndex] ?? media.asset.projection;
    if (!projection) {
      mesh.visible = false;
      heroControllerRef.current?.clear();
      frameRef.current = null;
      return;
    }

    camera.position.set(...projection.camera.position);
    camera.quaternion.set(...projection.camera.quaternion);
    if (
      camera instanceof PerspectiveCamera &&
      camera.fov !== projection.camera.fov
    ) {
      camera.fov = projection.camera.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    publishPlateProjection(projection);

    material.uniforms.plateMap.value = media.texture;
    material.uniforms.sourceSize.value.set(
      activeProfileSize.width,
      activeProfileSize.height,
    );
    material.uniforms.viewportSize.value.set(size.width, size.height);
    material.uniforms.objectPosition.value.copy(objectPosition(media.asset));
    mesh.visible = true;
    frameRef.current = {
      plateTexture: media.texture,
      projection,
      mediaTime,
      frameIndex,
      variant: media.variant,
    };
    heroControllerRef.current?.prepareFrame({
      gl,
      camera,
      size,
      projection,
      variant: media.variant,
      plateTexture: media.texture,
      objectPosition: material.uniforms.objectPosition.value,
    });
  }, -100);

  useFrame(({ gl, scene, camera }) => {
    gl.render(scene, camera);
    const frame = frameRef.current;
    if (!frame) return;
    const detail: CompositorDiagnostic = {
      atomic: true,
      plateMediaTime: frame.mediaTime,
      projectionFrame: frame.frameIndex,
      heroFramePresented: presentedFrames.current,
      profile: frame.variant,
      plateSource: activeMediaRef.current?.asset.src ?? "",
      treatment: "scene-linear-blender-agx-lut-room-response",
      occlusion: "authored-msaa-coverage",
    };
    window.__lazyACompositor = detail;
    window.dispatchEvent(
      new CustomEvent("lazy-a:compositor-frame-presented", { detail }),
    );
    if (heroPhase === "starting" && presentedFrames.current >= 1) {
      window.dispatchEvent(new Event(HERO_FIRST_FRAME_PRESENTED));
    }
  }, 1000);

  return (
    <CompositorFrameContext.Provider value={frameRef}>
      <mesh ref={meshRef} frustumCulled={false} renderOrder={-1000}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={PLATE_VERTEX_SHADER}
          fragmentShader={PLATE_FRAGMENT_SHADER}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      {heroReleased && (
        <Suspense fallback={null}>
          <PlateHeroComposite registerController={registerHeroController} />
        </Suspense>
      )}
      {children}
    </CompositorFrameContext.Provider>
  );
}
