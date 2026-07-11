/**
 * Where the visitor's body currently is (WORK ORDERS 0022, 0024).
 * A tiny shared truth so behaviors can coordinate without coupling:
 * movement behaviors write it, perception and readiness read it.
 */

import type { StandingPositionName } from "@/three/scene/workspace";

export const visitorState = {
  /** The standing position the body occupies; null while in motion. */
  position: "arrival" as StandingPositionName | null,
  /** True while a movement behavior is carrying the body. */
  moving: false,
  /** What the hands hold, if anything (WORK ORDER 0027). */
  holding: null as string | null,
};
