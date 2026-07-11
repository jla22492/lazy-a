/**
 * The acceptance system (WORK ORDER 0026) — the room's half of the
 * conversation. The visitor offers; the room accepts.
 *
 * The visitor never performs an interaction. They offer one, through
 * requestInteraction(target): the offer consumes their intent, and the
 * room delivers the final answer. An answered offer is spent — even a
 * declined one — because an offer is a moment, not a standing request.
 *
 * Every future interaction begins with exactly one request and ends
 * with exactly one response. No concrete interactions exist yet.
 */

import { consumeIntent } from "@/three/animation/intent";

export type InteractionOutcome =
  /** The room accepts; the interaction may proceed. */
  | "accepted"
  /** No committed intent existed — nothing was truly offered. */
  | "declined-no-intent"
  /** Intent existed, but the room judged the moment wrong. */
  | "declined-by-room";

export interface AcceptancePolicy {
  /** The target this policy speaks for, e.g. "notebook". */
  target: string;
  /**
   * The room's judgment, consulted only after intent is confirmed.
   * Future context — timing, state, an impossible moment in progress —
   * belongs here.
   */
  accepts: () => boolean;
}

const policies = new Map<string, AcceptancePolicy>();

/** Register the room's policy for a target. Returns its unregister function. */
export function registerAcceptancePolicy(policy: AcceptancePolicy): () => void {
  policies.set(policy.target, policy);
  return () => {
    policies.delete(policy.target);
  };
}

/** The last answered offer, for engineering introspection only. */
let lastResponse: { target: string; outcome: InteractionOutcome } | null = null;

/**
 * The single semantic gateway for all future interactions: the visitor
 * offers, the room answers.
 */
export function requestInteraction(target: string): InteractionOutcome {
  const outcome = answer(target);
  lastResponse = { target, outcome };
  return outcome;
}

function answer(target: string): InteractionOutcome {
  if (!consumeIntent(target)) return "declined-no-intent";
  const policy = policies.get(target);
  if (policy && !policy.accepts()) return "declined-by-room";
  return "accepted";
}

/** Introspection for engineering only. */
export function lastInteractionResponse(): Readonly<{
  target: string;
  outcome: InteractionOutcome;
} | null> {
  return lastResponse;
}
