import type { RootState } from "@react-three/fiber";

/** Frames to let settle before capturing, so shadows and tone mapping are final. */
const WARMUP_FRAMES = 10;

const CAPTURE_WIDTH = 1280;

/** Motion reviews default to a 12-second clip at normal speed. */
const DEFAULT_RECORD_SECONDS = 12;
const RECORD_FPS = 30;
const RECORD_BITS_PER_SECOND = 6_000_000;

/** Preferred first; the recorder falls back to whatever the browser supports. */
const RECORD_MIME_CANDIDATES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm",
];

function post(filename: string, dataUrl: string): void {
  void fetch("/api/progress-shot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, dataUrl }),
  });
}

/**
 * Progress capture (development only).
 * ?shot=<NNNN.png> posts a still of the canvas to /api/progress-shot;
 * ?record=<NNNN.mp4>&seconds=N records a normal-speed clip the same way
 * (WORK ORDER 0018 — motion reviews). If the browser cannot encode mp4,
 * the recorder falls back to webm and the saved extension follows the
 * actual encoding. Stills preserve the canvas's native aspect (scaled to
 * 1280 wide); the 16:9 convention comes from the pinned capture viewport.
 * Inert without the parameters and in production.
 */
export function scheduleProgressShot(state: RootState): void {
  if (process.env.NODE_ENV === "production") return;

  const params = new URLSearchParams(window.location.search);
  const shotName = params.get("shot");
  const recordName = params.get("record");
  if (!shotName && !recordName) return;

  const seconds = Number(params.get("seconds")) || DEFAULT_RECORD_SECONDS;

  let frames = 0;
  const tick = () => {
    frames += 1;
    if (frames < WARMUP_FRAMES) {
      requestAnimationFrame(tick);
      return;
    }
    /* ?shotdelay=N defers either capture — stills for timing a pose,
       recordings for opening a clip mid-journey (WORK ORDER 0028). */
    const shotDelay = Number(params.get("shotdelay")) || 0;
    if (shotName) {
      window.setTimeout(() => captureStill(state, shotName), shotDelay * 1000);
    }
    if (recordName) {
      window.setTimeout(
        () => captureClip(state, recordName, seconds),
        shotDelay * 1000,
      );
    }
  };
  requestAnimationFrame(tick);
}

function captureStill(state: RootState, filename: string): void {
  const source = state.gl.domElement;
  const target = document.createElement("canvas");
  target.width = CAPTURE_WIDTH;
  target.height = Math.round((CAPTURE_WIDTH * source.height) / source.width);
  target.getContext("2d")?.drawImage(source, 0, 0, target.width, target.height);
  post(filename, target.toDataURL("image/png"));
}

function captureClip(
  state: RootState,
  filename: string,
  seconds: number,
): void {
  const mimeType = RECORD_MIME_CANDIDATES.find((candidate) =>
    MediaRecorder.isTypeSupported(candidate),
  );
  if (!mimeType) return;

  const isMp4 = mimeType.startsWith("video/mp4");
  const savedName = isMp4
    ? filename.replace(/\.webm$/, ".mp4")
    : filename.replace(/\.mp4$/, ".webm");

  const stream = state.gl.domElement.captureStream(RECORD_FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: RECORD_BITS_PER_SECOND,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: isMp4 ? "video/mp4" : "video/webm" });
    const reader = new FileReader();
    reader.onload = () => post(savedName, String(reader.result));
    reader.readAsDataURL(blob);
  };
  recorder.start();
  window.setTimeout(() => recorder.stop(), seconds * 1000);
}
