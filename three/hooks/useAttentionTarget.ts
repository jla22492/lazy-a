"use client";

import { useEffect } from "react";

import {
  registerAttentionTarget,
  type AttentionTarget,
} from "@/three/animation/attention";

/**
 * Register an object as meaningful to the room's attention system for
 * this component's lifetime (WORK ORDER 0023). The target object should
 * be stable across renders.
 */
export function useAttentionTarget(target: AttentionTarget): void {
  useEffect(() => registerAttentionTarget(target), [target]);
}
