"use client";

import {
  createContext,
  type PropsWithChildren,
  type RefObject,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { LinearFilter, NoColorSpace, VideoTexture } from "three";

import { assetPath } from "@/lib/assetPath";
import {
  INITIAL_HERO_STATE,
  heroLifecycleReducer,
  type HeroPhase,
} from "@/three/animation/heroLifecycle";

const HERO_FILM = {
  src: "/videos/hero-print-placeholder.mp4",
  settleBeatSeconds: 1.8,
} as const;

interface HeroMedia {
  video: HTMLVideoElement | null;
  texture: VideoTexture | null;
  phase: HeroPhase;
  presentedFrames: RefObject<number>;
}

const HeroMediaContext = createContext<HeroMedia | null>(null);

function arrivalDone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as Window & { __arrivalDone?: boolean }).__arrivalDone === true
  );
}

export function useHeroMedia(): HeroMedia {
  const media = useContext(HeroMediaContext);
  if (!media) {
    throw new Error("useHeroMedia must be rendered inside HeroFilm");
  }
  return media;
}

/**
 * The hero source exists for the whole visit. It owns only decoded media and
 * the one-shot lifecycle; world geometry, treatment, depth, and presentation
 * belong to the Canvas compositor.
 */
export function HeroFilm({ children }: PropsWithChildren) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [state, dispatch] = useReducer(
    heroLifecycleReducer,
    INITIAL_HERO_STATE,
  );
  const readyRef = useRef(false);
  const beatPassedRef = useRef(false);
  const settleDispatchedRef = useRef(false);
  const playAttemptedRef = useRef(false);
  const presentedFramesRef = useRef(0);
  const presentedFrameCallbackRef = useRef(0);

  const texture = useMemo(() => {
    if (!video) return;
    const nextTexture = new VideoTexture(video);
    nextTexture.colorSpace = NoColorSpace;
    nextTexture.flipY = false;
    nextTexture.generateMipmaps = false;
    nextTexture.minFilter = LinearFilter;
    nextTexture.magFilter = LinearFilter;
    return nextTexture;
  }, [video]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  useEffect(() => {
    if (!video || readyRef.current) return;
    readyRef.current = true;
    presentedFramesRef.current = 0;
    dispatch({ type: "READY" });
    if (beatPassedRef.current && !settleDispatchedRef.current) {
      settleDispatchedRef.current = true;
      dispatch({ type: "DESK_SETTLED" });
    }
  }, [video]);

  useEffect(() => {
    let beatTimer = 0;
    const beginBeat = () => {
      beatTimer = window.setTimeout(() => {
        beatPassedRef.current = true;
        if (readyRef.current && !settleDispatchedRef.current) {
          settleDispatchedRef.current = true;
          dispatch({ type: "DESK_SETTLED" });
        }
      }, HERO_FILM.settleBeatSeconds * 1000);
    };
    if (arrivalDone()) {
      beginBeat();
      return () => window.clearTimeout(beatTimer);
    }
    const arrivalPoll = window.setInterval(() => {
      if (!arrivalDone()) return;
      window.clearInterval(arrivalPoll);
      beginBeat();
    }, 50);
    return () => {
      window.clearInterval(arrivalPoll);
      window.clearTimeout(beatTimer);
    };
  }, []);

  useEffect(() => {
    if (
      state.phase !== "playing" ||
      state.playCount !== 1 ||
      !video ||
      playAttemptedRef.current
    ) {
      return;
    }
    playAttemptedRef.current = true;
    if ("requestVideoFrameCallback" in video) {
      const observe: VideoFrameRequestCallback = (_now, metadata) => {
        presentedFramesRef.current = metadata.presentedFrames;
        if (!video.ended) {
          presentedFrameCallbackRef.current =
            video.requestVideoFrameCallback(observe);
        }
      };
      presentedFrameCallbackRef.current =
        video.requestVideoFrameCallback(observe);
    }
    void video.play().catch(() => dispatch({ type: "FAILED" }));
  }, [state, video]);

  useEffect(
    () => () => {
      if (!video) return;
      if (
        presentedFrameCallbackRef.current &&
        "cancelVideoFrameCallback" in video
      ) {
        video.cancelVideoFrameCallback(presentedFrameCallbackRef.current);
        presentedFrameCallbackRef.current = 0;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
    },
    [video],
  );

  const media = useMemo<HeroMedia>(
    () => ({
      video,
      texture: texture ?? null,
      phase: state.phase,
      presentedFrames: presentedFramesRef,
    }),
    [state.phase, texture, video],
  );

  return (
    <HeroMediaContext.Provider value={media}>
      <video
        ref={setVideo}
        data-lazy-a-hero="true"
        src={assetPath(HERO_FILM.src)}
        muted
        playsInline
        preload="none"
        loop={false}
        controls={false}
        disablePictureInPicture
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
        onPlaying={() => dispatch({ type: "PLAYING" })}
        onEnded={(event) => {
          event.currentTarget.pause();
          dispatch({ type: "ENDED" });
        }}
        onError={() => dispatch({ type: "FAILED" })}
      />
      {children}
    </HeroMediaContext.Provider>
  );
}
