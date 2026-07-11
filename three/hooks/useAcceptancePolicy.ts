"use client";

import { useEffect } from "react";

import {
  registerAcceptancePolicy,
  type AcceptancePolicy,
} from "@/three/animation/acceptance";

/**
 * Register the room's acceptance policy for a target for this
 * component's lifetime (WORK ORDER 0026). The policy object should be
 * stable across renders.
 */
export function useAcceptancePolicy(policy: AcceptancePolicy): void {
  useEffect(() => registerAcceptancePolicy(policy), [policy]);
}
