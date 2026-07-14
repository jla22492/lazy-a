export type HeroPhase = "preloading" | "armed" | "playing" | "held" | "failed";

export interface HeroState {
  phase: HeroPhase;
  playCount: number;
}

export type HeroEvent =
  | { type: "READY" }
  | { type: "DESK_SETTLED" }
  | { type: "PLAYING" }
  | { type: "ENDED" }
  | { type: "FAILED" };

export const INITIAL_HERO_STATE: HeroState = {
  phase: "preloading",
  playCount: 0,
};

export function heroLifecycleReducer(
  state: HeroState,
  event: HeroEvent,
): HeroState {
  switch (event.type) {
    case "READY":
      return state.phase === "preloading"
        ? { ...state, phase: "armed" }
        : state;
    case "DESK_SETTLED":
    case "PLAYING":
      return state.phase === "armed" && state.playCount === 0
        ? { phase: "playing", playCount: 1 }
        : state;
    case "ENDED":
      return state.phase === "playing" ? { ...state, phase: "held" } : state;
    case "FAILED":
      return state.phase === "held" ? state : { ...state, phase: "failed" };
  }
}
