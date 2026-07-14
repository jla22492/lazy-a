/**
 * Interface state shared with the desk contact impression (WORK ORDER 0117).
 *
 * CONTACT reveals evidence that was already physically latent: a pressure
 * impression on a working sheet/desk surface. The navigation gesture writes
 * contactLevel 0..1; the desk artifact reads it and fades the trace in.
 */

let contactLevel = 0;

export function setContactLevel(level: number): void {
  contactLevel = Math.min(Math.max(level, 0), 1);
  if (typeof window !== "undefined") {
    (window as Window & { __lazyAContactLevel?: number }).__lazyAContactLevel =
      contactLevel;
  }
}

export function getContactLevel(): number {
  return contactLevel;
}
