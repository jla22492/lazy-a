/**
 * The interface's type system (WORK ORDER 0077) — one cloth.
 *
 * The wordmark, the attention labels, and the conversation captions are
 * the website's entire typographic surface, and they are cut from the
 * same system: one family, one tracking, one ink ramp. Real website
 * typography, not environmental typography — quiet enough to belong in
 * the room's world without pretending to be in the room.
 *
 * The family is a restrained system sans until typography is authored
 * properly; every consumer reads from here so that day is one edit.
 */

export const TYPE = {
  family:
    'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
  /** The single tracking used everywhere — the system's signature. */
  tracking: "0.22em",
  size: {
    /** The wordmark. */
    mark: "13px",
    /** Conversation caption titles. */
    caption: "12px",
    /** Attention labels. */
    label: "11px",
  },
  weight: 500,
  ink: {
    /** Primary interface ink — a step darker than the plaster behind it. */
    primary: "#5d574d",
    /** Caption body ink, a step quieter. */
    quiet: "#6d675d",
    /** Hairlines and unwritten lines. */
    hairline: "#8a8375",
  },
} as const;
