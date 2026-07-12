/**
 * Interface state shared with the notebook (WORK ORDER 0090) — the
 * journal's illumination.
 *
 * Jonathan's ruling (SPRINT_05): JOURNAL is the notebook on the desk,
 * and the focused object IS the content — choosing it illuminates a
 * written paragraph ON the page. The interface eases this level with
 * the same motion as the lean (one gesture, every effect — the 0081
 * pattern); the notebook reads it each frame and lets its words rise
 * out of the closed cover exactly that far.
 *
 * journalLevel is 0 (at rest) .. 1 (full conversation).
 */

let journalLevel = 0;

export function setJournalLevel(level: number): void {
  journalLevel = Math.min(Math.max(level, 0), 1);
}

export function getJournalLevel(): number {
  return journalLevel;
}

/** The words' quiet self-light at full illumination (tone-mapped). */
export const JOURNAL_GLOW = 0.55;

/**
 * The placeholder paragraph — PLAUSIBLE WORDS, NOT AUTHORED WORDS.
 * Jonathan directed placeholder journal text for 05A, explicitly
 * flagged for authorship; the notebook's true voice remains governed
 * by docs/THE_NOTEBOOK.md and belongs to Jonathan and the Creative
 * Director. Replace, don't edit.
 */
export const JOURNAL_PLACEHOLDER = [
  "Lazy A is a small production company.",
  "We make films the way this room makes",
  "anything: slowly, by hand, with more",
  "taken away than added. The name is",
  "honest — we would rather do one true",
  "thing than ten loud ones.",
] as const;
