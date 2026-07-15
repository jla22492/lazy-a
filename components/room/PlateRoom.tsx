"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  endpointAsset,
  preloadDesk,
  preloadDestinations,
  preloadOpening,
  preloadPlateAsset,
  publishPlateProjection,
  transitionAsset,
  type PlateAsset,
  type PlateExperienceState,
  type PlateManifestAdapter,
  type PlateVariant,
  FALLBACK_PLATE_MANIFEST,
} from "@/lib/plateAssets";
import { whenRoomIsSettled } from "@/lib/deferredAssets";

type PlateStatus = "ready" | "transitioning" | "retained";

interface PlateRoomProps {
  variant: PlateVariant;
  state: PlateExperienceState;
  manifest: PlateManifestAdapter;
  onDeskSettled: () => void;
  onTransitionEnded: () => void;
}

declare global {
  interface Window {
    __lazyAPlateState?: {
      profile: PlateVariant;
      state: string;
      status: PlateStatus;
      photographic: true;
      primitiveFallbackMounted: false;
    };
  }
}

function transitionTarget(state: PlateExperienceState): PlateAsset["id"] {
  if (state.requested) return state.requested;
  const transition = state.transition?.toLowerCase() ?? "";
  for (const endpoint of [
    "desk",
    "films",
    "journal",
    "contact",
    "about",
  ] as const) {
    if (transition.endsWith(endpoint) || transition.includes(`to-${endpoint}`)) {
      return endpoint;
    }
  }
  return state.endpoint;
}

function fallbackDuration(state: PlateExperienceState): number {
  return state.endpoint === "opening" ? 2.6 : 0.9;
}

const fullBleedMedia = {
  position: "absolute",
  inset: 0,
  display: "block",
  width: "100%",
  height: "100%",
  minWidth: "100%",
  minHeight: "100%",
  objectFit: "cover",
} as const;

/**
 * A decoded endpoint still always remains below transition media. Failed or
 * blocked media is removed, revealing that last coherent photograph without
 * replacing it with geometry or visitor-facing status UI.
 */
export function PlateRoom({
  variant,
  state,
  manifest,
  onDeskSettled,
  onTransitionEnded,
}: PlateRoomProps) {
  const profile = manifest.profiles[variant];
  const opening = profile.endpoints.opening;
  const fallbackOpening = FALLBACK_PLATE_MANIFEST.profiles[variant].endpoints.opening;
  const [current, setCurrent] = useState<PlateAsset>(fallbackOpening);
  const [transition, setTransition] = useState<PlateAsset | null>(null);
  const [status, setStatus] = useState<PlateStatus>("ready");
  const runRef = useRef(0);
  const destinationPreloadStarted = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const publishEndpoint = useCallback((asset: PlateAsset) => {
    publishPlateProjection(asset.projection);
  }, []);

  useEffect(() => {
    void preloadOpening(manifest, variant)
      .then((ready) => {
        setCurrent(ready);
        publishEndpoint(ready);
        setStatus("ready");
      })
      .catch(() => setStatus("retained"));
    void preloadDesk(manifest, variant).catch(() => {
      // The opening plate remains visitor-visible until a desk plate is ready.
    });
  }, [manifest, opening, publishEndpoint, variant]);

  const finish = useCallback(
    async (
      targetId: PlateAsset["id"],
      run: number,
      completesArrival: boolean,
    ) => {
      const target = endpointAsset(
        manifest,
        variant,
        targetId as Parameters<typeof endpointAsset>[2],
      );
      try {
        await preloadPlateAsset(target);
        if (runRef.current !== run) return;
        setCurrent(target);
        publishEndpoint(target);
        setStatus("ready");
      } catch {
        if (runRef.current !== run) return;
        setStatus("retained");
      }
      if (runRef.current !== run) return;
      setTransition(null);
      if (targetId === "desk" && completesArrival) onDeskSettled();
      else onTransitionEnded();
    },
    [manifest, onDeskSettled, onTransitionEnded, publishEndpoint, variant],
  );

  useEffect(() => {
    if (state.phase !== "transitioning" || !state.transition) {
      const endpoint = endpointAsset(manifest, variant, state.endpoint);
      void preloadPlateAsset(endpoint)
        .then((ready) => {
          setCurrent(ready);
          publishEndpoint(ready);
          setStatus("ready");
        })
        .catch(() => setStatus("retained"));
      return;
    }

    const run = ++runRef.current;
    const target = transitionTarget(state);
    const authoredTransition = transitionAsset(
      manifest,
      variant,
      state.transition,
    );
    queueMicrotask(() => {
      if (runRef.current === run) setStatus("transitioning");
    });

    if (authoredTransition) {
      void preloadPlateAsset(authoredTransition)
        .then((ready) => {
          if (runRef.current !== run) return;
          setTransition(ready);
        })
        .catch(() => {
          if (runRef.current !== run) return;
          setStatus("retained");
          void finish(target, run, state.endpoint === "opening");
        });
      return () => {
        if (runRef.current === run) runRef.current += 1;
      };
    }

    let readyTarget: PlateAsset | null = null;
    void preloadPlateAsset(
      endpointAsset(
        manifest,
        variant,
        target as Parameters<typeof endpointAsset>[2],
      ),
    )
      .then((ready) => {
        readyTarget = ready;
      })
      .catch(() => {
        setStatus("retained");
      });
    const timer = window.setTimeout(() => {
      if (runRef.current !== run) return;
      if (readyTarget) {
        setCurrent(readyTarget);
        publishEndpoint(readyTarget);
        setStatus("ready");
      } else {
        setStatus("retained");
      }
      if (target === "desk" && state.endpoint === "opening") onDeskSettled();
      else onTransitionEnded();
    }, fallbackDuration(state) * 1000);
    return () => {
      window.clearTimeout(timer);
      if (runRef.current === run) runRef.current += 1;
    };
  }, [
    finish,
    manifest,
    onDeskSettled,
    onTransitionEnded,
    publishEndpoint,
    state,
    variant,
  ]);

  useEffect(() => {
    if (state.endpoint !== "desk" || destinationPreloadStarted.current) return;
    destinationPreloadStarted.current = true;
    whenRoomIsSettled(() => {
      void preloadDestinations(manifest, variant);
    });
  }, [manifest, state.endpoint, variant]);

  useEffect(() => {
    window.__lazyAPlateState = {
      profile: variant,
      state: `${state.phase}:${state.transition ?? state.endpoint}`,
      status,
      photographic: true,
      primitiveFallbackMounted: false,
    };
    return () => {
      delete window.__lazyAPlateState;
    };
  }, [state.endpoint, state.phase, state.transition, status, variant]);

  useEffect(() => {
    const video = videoRef.current;
    const frames = transition?.projectionFrames;
    if (!video || !frames || frames.length === 0) return;
    let frame = 0;
    const sample = () => {
      const duration = video.duration;
      const progress = Number.isFinite(duration) && duration > 0
        ? video.currentTime / duration
        : 0;
      const nextFrame = Math.min(
        Math.floor(progress * frames.length),
        frames.length - 1,
      );
      if (nextFrame !== frame) {
        frame = nextFrame;
        publishPlateProjection(frames[frame]);
      }
      if (!video.paused && !video.ended) requestAnimationFrame(sample);
    };
    publishPlateProjection(frames[0]);
    const onPlaying = () => requestAnimationFrame(sample);
    video.addEventListener("playing", onPlaying);
    return () => video.removeEventListener("playing", onPlaying);
  }, [transition]);

  const objectPosition = current.objectPosition ?? "50% 50%";
  const endpointMedia = useMemo(
    () =>
      current.kind === "video" ? (
        <video
          key={current.src}
          muted
          playsInline
          autoPlay
          loop={false}
          poster={current.poster}
          src={current.src}
          style={{ ...fullBleedMedia, objectPosition }}
          onError={() => setStatus("retained")}
        />
      ) : (
        // Authored plates must preserve their exact crop; framework image
        // optimization would introduce a second responsive sizing policy.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.src}
          src={current.src}
          alt=""
          draggable={false}
          decoding="async"
          style={{ ...fullBleedMedia, objectPosition }}
          onLoad={() => {
            publishEndpoint(current);
            setStatus((currentStatus) =>
              currentStatus === "transitioning" ? currentStatus : "ready",
            );
          }}
          onError={() => setStatus("retained")}
        />
      ),
    [current, objectPosition, publishEndpoint],
  );

  return (
    <div
      data-room-renderer="plate"
      data-room-state={status}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#171512",
        pointerEvents: "none",
      }}
    >
      {endpointMedia}
      {transition && (
        <video
          ref={videoRef}
          key={transition.src}
          muted
          playsInline
          autoPlay
          preload="auto"
          poster={transition.poster}
          src={transition.src}
          style={{
            ...fullBleedMedia,
            objectPosition: transition.objectPosition ?? objectPosition,
          }}
          onCanPlay={(event) => {
            void event.currentTarget.play().catch(() => {
              setTransition(null);
              setStatus("retained");
            });
          }}
          onEnded={() => {
            const run = runRef.current;
            void finish(
              transitionTarget(state),
              run,
              state.endpoint === "opening",
            );
          }}
          onError={() => {
            const run = runRef.current;
            setTransition(null);
            setStatus("retained");
            void finish(
              transitionTarget(state),
              run,
              state.endpoint === "opening",
            );
          }}
        />
      )}
    </div>
  );
}
