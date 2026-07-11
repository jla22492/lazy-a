/**
 * The intent system (WORK ORDER 0025) — the final layer of the decision
 * pipeline. Readiness permits; intent commits.
 *
 * Intent is a deliberate, held commitment toward a ready target:
 * - commitment can only BEGIN on a target that is ready,
 * - it must be HELD for a human moment (a decision, not a twitch),
 * - it CANCELS instantly if readiness breaks mid-hold,
 * - the resulting intent is CONSUMED exactly once and expires quickly
 *   if nothing uses it.
 *
 * Accidental interaction is therefore structurally impossible: a stray
 * input either lands on nothing ready, or dies before the hold matures.
 * No input is bound yet — future deliberate actions speak through this
 * layer, and future interactions ask one question: consumeIntent(target).
 */

import { isReady } from "@/three/animation/readiness";

/** A deliberate hold — long enough to be a decision, short enough to feel immediate. */
const COMMIT_AFTER_SECONDS = 0.35;

/** Unconsumed intent goes stale quickly; commitment is a moment, not a state. */
const INTENT_TTL_SECONDS = 0.5;

interface Commit {
  target: string;
  heldFor: number;
}

interface Intent {
  target: string;
  age: number;
}

let commit: Commit | null = null;
let intent: Intent | null = null;

/**
 * A deliberate action has started toward a target. Returns false — and
 * establishes nothing — unless the target is currently ready.
 */
export function beginCommit(target: string): boolean {
  if (!isReady(target)) return false;
  commit = { target, heldFor: 0 };
  return true;
}

/** The deliberate action was released before maturing: no intent. */
export function releaseCommit(): void {
  commit = null;
}

/** Advance the pipeline. Called once per frame by the IntentSensor. */
export function tickIntent(dt: number): void {
  if (intent) {
    intent.age += dt;
    if (intent.age > INTENT_TTL_SECONDS) intent = null;
  }
  if (!commit) return;
  if (!isReady(commit.target)) {
    /* Conditions broke mid-hold — the moment has passed. */
    commit = null;
    return;
  }
  commit.heldFor += dt;
  if (commit.heldFor >= COMMIT_AFTER_SECONDS) {
    intent = { target: commit.target, age: 0 };
    commit = null;
  }
}

/** Whether committed intent currently exists for a target. */
export function hasIntent(target: string): boolean {
  return intent?.target === target;
}

/**
 * Consume intent for a target — exactly once. This is the single gate
 * every future interaction passes through.
 */
export function consumeIntent(target: string): boolean {
  if (intent?.target !== target) return false;
  intent = null;
  return true;
}

/** Introspection for engineering only. */
export function intentOf(): {
  committing: string | null;
  heldFor: number;
  intent: string | null;
} {
  return {
    committing: commit?.target ?? null,
    heldFor: commit?.heldFor ?? 0,
    intent: intent?.target ?? null,
  };
}
