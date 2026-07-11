/**
 * The readiness system (WORK ORDER 0024).
 *
 * Observation enables readiness. Readiness enables interaction.
 * Interaction never happens directly from gaze — a target becomes READY
 * only when every condition of its rule agrees: the visitor is in the
 * right place, has stopped moving, is genuinely observing, and whatever
 * future context demands. Every future interaction asks one question —
 * isReady(target) — instead of independently checking many conditions.
 *
 * Entirely invisible: no feedback, no UI, no responses.
 */

import { getAttention } from "@/three/animation/attention";
import { visitorState } from "@/three/animation/visitorState";
import type { StandingPositionName } from "@/three/scene/workspace";

export interface ReadinessCondition {
  /** Human-readable, e.g. "observed" or "standing-at-working". */
  name: string;
  isMet: () => boolean;
}

export interface ReadinessRule {
  /** The attention-target name this rule guards, e.g. "notebook". */
  target: string;
  conditions: ReadonlyArray<ReadinessCondition>;
}

const rules = new Map<string, ReadinessRule>();

/** Register a target's readiness rule. Returns its unregister function. */
export function registerReadinessRule(rule: ReadinessRule): () => void {
  rules.set(rule.target, rule);
  return () => {
    rules.delete(rule.target);
  };
}

/** The one question every future interaction asks. */
export function isReady(target: string): boolean {
  const rule = rules.get(target);
  if (!rule) return false;
  return rule.conditions.every((condition) => condition.isMet());
}

/** Introspection for engineering: which conditions hold a target back. */
export function readinessOf(target: string): {
  ready: boolean;
  unmet: string[];
} {
  const rule = rules.get(target);
  if (!rule) return { ready: false, unmet: ["no-rule-registered"] };
  const unmet = rule.conditions
    .filter((condition) => !condition.isMet())
    .map((condition) => condition.name);
  return { ready: unmet.length === 0, unmet };
}

/**
 * The shared condition vocabulary. Future context conditions join here
 * so every rule speaks the same language.
 */
export const conditions = {
  /** The visitor is genuinely observing the target (sustained gaze). */
  observed(target: string): ReadinessCondition {
    return {
      name: "observed",
      isMet: () => getAttention().observed === target,
    };
  },
  /** The body occupies a specific standing position. */
  atPosition(position: StandingPositionName): ReadinessCondition {
    return {
      name: `standing-at-${position}`,
      isMet: () => visitorState.position === position,
    };
  },
  /** The body is not currently in motion. */
  still(): ReadinessCondition {
    return {
      name: "not-moving",
      isMet: () => !visitorState.moving,
    };
  },
};
