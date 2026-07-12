/**
 * Interface state shared with the room's living behaviors (WORK ORDER
 * 0081) — consequence.
 *
 * When a conversation opens, the room becomes quieter: the daylight's
 * breath softens and the dust slows, easing back when the conversation
 * ends. Framing matters: the room does not perform for the visitor — it
 * quiets for the WORK, the way a host lowers the music when the guest
 * of honor speaks. (This consciously evolves the original "the room
 * never acknowledges the visitor": the room acknowledges the work.)
 *
 * quietLevel is 0 (at rest) .. 1 (full conversation), eased by the
 * interface each frame; living behaviors read it and scale themselves.
 */

let quietLevel = 0;

export function setQuietLevel(level: number): void {
  quietLevel = Math.min(Math.max(level, 0), 1);
}

export function getQuietLevel(): number {
  return quietLevel;
}

/** How far the breath softens at full conversation. */
export const BREATH_SOFTENING = 0.6;
/** How far the dust slows at full conversation. */
export const DUST_SLOWING = 0.5;
