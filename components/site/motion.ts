/**
 * The interface's motion language (WORK ORDER 0083) — one rhythm.
 *
 * Every duration and ease the interface uses, in one place, named for
 * what they mean rather than what they do. The room's motion (arrival,
 * breath, dust) lives on the room clock; THIS file is the website's
 * motion — and the two share a philosophy: nothing announces, nothing
 * bounces, everything settles.
 *
 * The values are the ones the Creative Director tuned across 0072-0082;
 * codifying them makes the rhythm auditable and the eventual authored
 * motion pass a one-file edit, like the type system (0077).
 */

export const MOTION = {
  /** A label answering attention: "oh," never "look." */
  answer: { durationMs: 90, ease: "linear" },
  /** Content materializing: quiet, present, unhurried. */
  materialize: { durationMs: 240, ease: "linear" },
  /** The stagger between siblings arriving (gallery frames). */
  siblingDelayMs: 70,
  /** The body leaning in or back: one ease of mass. */
  lean: { durationSeconds: 0.9 },
  /** Rest before the interface believes attention (dwell). */
  dwellSeconds: 0.45,
  /** Attention released: hysteresis so edges never flicker. */
  releaseSeconds: 0.22,
} as const;
