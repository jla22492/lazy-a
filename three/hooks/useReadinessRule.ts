"use client";

import { useEffect } from "react";

import {
  registerReadinessRule,
  type ReadinessRule,
} from "@/three/animation/readiness";

/**
 * Register a target's readiness rule for this component's lifetime
 * (WORK ORDER 0024). The rule object should be stable across renders.
 */
export function useReadinessRule(rule: ReadinessRule): void {
  useEffect(() => registerReadinessRule(rule), [rule]);
}
