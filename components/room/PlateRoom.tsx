"use client";

import { useEffect, useRef } from "react";

import type { PlateStatus } from "@/components/room/PlateCompositor";
import { whenRoomIsSettled } from "@/lib/deferredAssets";
import {
  preloadDestination,
  preloadDestinationReturn,
  preloadDestinations,
  preloadForwardPrefixes,
  preloadForwardTransitions,
  preloadOpening,
  type PlateDestinationId,
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
  const forwardWarmVariant = useRef<PlateVariant | null>(null);
  const prefixWarmVariant = useRef<PlateVariant | null>(null);

  useEffect(() => {
    void preloadOpening(manifest, variant).catch(() => {
      // The persistent server-rendered opening photograph remains visible.
    });
  }, [manifest, variant]);

  useEffect(() => {
    if (prefixWarmVariant.current === variant) return;
    prefixWarmVariant.current = variant;
    void preloadForwardPrefixes(manifest, variant);
  }, [manifest, variant]);

  useEffect(() => {
    if (state.endpoint !== "desk" || forwardWarmVariant.current === variant) {
      return;
    }
    forwardWarmVariant.current = variant;
    void preloadForwardTransitions(manifest, variant);
  }, [manifest, state.endpoint, variant]);

  useEffect(() => {
    if (state.endpoint !== "desk" || destinationPreloadStarted.current) return;
    destinationPreloadStarted.current = true;
    whenRoomIsSettled(() => {
      void preloadDestinations(manifest, variant);
    });
  }, [manifest, state.endpoint, variant]);

  useEffect(() => {
    if (
      state.phase !== "resting" ||
      state.endpoint === "opening" ||
      state.endpoint === "desk"
    ) {
      return;
    }
    void preloadDestinationReturn(manifest, variant, state.endpoint);
  }, [manifest, state.endpoint, state.phase, variant]);

  useEffect(() => {
    const warmCandidate = (event: Event) => {
      const destination = (event as CustomEvent).detail?.destination as
        PlateDestinationId | null | undefined;
      if (!destination) return;
      void preloadDestination(manifest, variant, destination);
    };
    window.addEventListener("lazy-a:navigation-candidate", warmCandidate);
    return () => {
      window.removeEventListener("lazy-a:navigation-candidate", warmCandidate);
    };
  }, [manifest, variant]);

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
