import type { RootState } from "@react-three/fiber";

/** Frames to let settle before capturing, so shadows and tone mapping are final. */
const WARMUP_FRAMES = 10;

const CAPTURE_WIDTH = 1280;

/**
 * Progress-screenshot self-capture (development only).
 * Opening the page with ?shot=<NNNN.png> waits for the scene's first frames,
 * then posts a PNG of the canvas to /api/progress-shot, which writes
 * docs/progress/<NNNN.png>. The capture preserves the canvas's native
 * aspect ratio (scaled to 1280 wide) so frames are never distorted — the
 * 16:9 review convention is achieved by capturing from a 16:9 viewport.
 * Inert without the parameter and in production.
 */
export function scheduleProgressShot(state: RootState): void {
  if (process.env.NODE_ENV === "production") return;

  const filename = new URLSearchParams(window.location.search).get("shot");
  if (!filename) return;

  let frames = 0;
  const tick = () => {
    frames += 1;
    if (frames < WARMUP_FRAMES) {
      requestAnimationFrame(tick);
      return;
    }
    const source = state.gl.domElement;
    const target = document.createElement("canvas");
    target.width = CAPTURE_WIDTH;
    target.height = Math.round((CAPTURE_WIDTH * source.height) / source.width);
    target
      .getContext("2d")
      ?.drawImage(source, 0, 0, target.width, target.height);
    void fetch("/api/progress-shot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        dataUrl: target.toDataURL("image/png"),
      }),
    });
  };
  requestAnimationFrame(tick);
}
