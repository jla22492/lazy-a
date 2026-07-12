/**
 * The wordmark (WORK ORDER 0073) — orientation, not UI.
 *
 * The first second has one job: "you're in the right place." Approved at
 * the 0073 ruling as the project's first and only pixel of website
 * chrome: HTML over the canvas, top-left, very small, low CONTRAST (not
 * low opacity), no animation, no entrance, no logo mark. Real website
 * typography, not environmental typography. Almost disappointingly
 * restrained — if someone barely notices it, it worked. Then forget it:
 * everything else happens in the room.
 */
export function Wordmark() {
  return (
    <div
      aria-label="Lazy A"
      style={{
        position: "fixed",
        top: "28px",
        left: "32px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "0.22em",
        /* A step darker than the plaster it floats over — read at a
           glance, forgotten a moment later. */
        color: "#6d675d",
        userSelect: "none",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      LAZY&nbsp;A
    </div>
  );
}
