"use client";

import { useEffect, useRef } from "react";

import type { PlateStatus } from "@/components/room/PlateCompositor";
import { whenRoomIsSettled } from "@/lib/deferredAssets";
import {
  preloadDesk,
  preloadDestinations,
  preloadOpening,
  type PlateExperienceState,
  type PlateManifestAdapter,
  type PlateVariant,
} from "@/lib/plateAssets";

interface PlateRoomProps {
  variant: PlateVariant;
  state: PlateExperienceState;
  status: PlateStatus;
  manifest: PlateManifestAdapter;
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

/**
 * Experience-state observability and network warming remain outside Canvas.
 * Visible plate media, projection sampling, and presentation are owned only by
 * PlateCompositor.
 */
export function PlateRoom({
  variant,
  state,
  status,
  manifest,
}: PlateRoomProps) {
  const destinationPreloadStarted = useRef(false);

  useEffect(() => {
    void preloadOpening(manifest, variant).catch(() => {
      // The persistent server-rendered opening photograph remains visible.
    });
    void preloadDesk(manifest, variant).catch(() => {
      // The same opening photograph remains the failure fallback.
    });
  }, [manifest, variant]);

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

  return null;
}
