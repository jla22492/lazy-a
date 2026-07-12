import wordmark from "@/public/brand/wordmark.png";

/**
 * The wordmark (WORK ORDER 0073, real logo since 0087) — orientation,
 * not UI.
 *
 * The first second has one job: "you're in the right place." The 0073
 * ruling still governs: top-left, very small, quiet, no animation, no
 * entrance — almost disappointingly restrained. What changed in 0087 is
 * only WHAT sits there: Jonathan's letterpress logo replaces the
 * placeholder text. The mark is served re-inked in the type system's
 * primary (one cloth, 0077) on a transparent ground, so it floats over
 * the plaster at the same step of contrast the text wordmark held —
 * read at a glance, forgotten a moment later.
 */

/** Rendered width; the source is 480px wide for crisp high-DPI rendering. */
const WORDMARK_WIDTH_PX = 84;

export function Wordmark() {
  return (
    <img
      src={wordmark.src}
      alt="Lazy A Productions"
      width={WORDMARK_WIDTH_PX}
      height={Math.round(
        (WORDMARK_WIDTH_PX * wordmark.height) / wordmark.width,
      )}
      style={{
        position: "fixed",
        top: "24px",
        left: "32px",
        userSelect: "none",
        pointerEvents: "none",
        zIndex: 10,
      }}
    />
  );
}
