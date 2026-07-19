"use client";

import { createContext, type RefObject, useContext } from "react";

import type { Texture } from "three";

import type { PlateProjectionFrame, PlateVariant } from "@/lib/plateAssets";

export interface CompositorFrame {
  plateTexture: Texture;
  projection: PlateProjectionFrame;
  mediaTime: number;
  frameIndex: number;
  variant: PlateVariant;
}

export const CompositorFrameContext =
  createContext<RefObject<CompositorFrame | null> | null>(null);

export function useCompositorFrame(): RefObject<CompositorFrame | null> {
  const frame = useContext(CompositorFrameContext);
  if (!frame) {
    throw new Error(
      "useCompositorFrame must be rendered inside PlateCompositor",
    );
  }
  return frame;
}
