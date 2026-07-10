import type { RootState } from "@react-three/fiber";

/** Frames to let settle before capturing, so shadows and tone mapping are final. */
const WARMUP_FRAMES = 10;

const CAPTURE_WIDTH = 1280;
const CAPTURE_HEIGHT = 720;

/**
 * Progress-screenshot self-capture (development only).
 * Opening the page with ?shot=<NNNN.png> waits for the scene's first frames,
 * then posts a 1280x720 PNG of the canvas to /api/progress-shot, which writes
 * docs/progress/<NNNN.png>. Inert without the parameter and in production.
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
    const target = document.createElement("canvas");
    target.width = CAPTURE_WIDTH;
    target.height = CAPTURE_HEIGHT;
    target
      .getContext("2d")
      ?.drawImage(state.gl.domElement, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
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
