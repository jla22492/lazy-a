import {
  plateManifest,
  type DestinationId,
  type EndpointId,
  type Rect,
} from "@/three/scene/plateManifest";

export interface ExperienceState {
  endpoint: EndpointId;
  requested: DestinationId | null;
  transition: string | null;
  phase: "opening" | "transitioning" | "resting";
}

export type ExperienceEvent =
  | { type: "ARRIVAL_SETTLED" }
  | { type: "SELECT"; destination: DestinationId }
  | { type: "TRANSITION_ENDED" }
  | { type: "CLOSE" };

export const INITIAL_PLATE_EXPERIENCE: ExperienceState = {
  endpoint: "opening",
  requested: null,
  transition: null,
  phase: "opening",
};

/** One generated source of truth for the rendered sheet and its hit regions. */
export const NAVIGATION_SHEET = plateManifest.variants.wide.navigation satisfies {
  bounds: Rect;
  rows: readonly { id: DestinationId; rect: Rect }[];
};

function contains(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x < rect.x + rect.width &&
    y >= rect.y &&
    y < rect.y + rect.height
  );
}

export function navigationMatches(
  localX: number,
  localY: number,
): DestinationId[] {
  if (!contains(NAVIGATION_SHEET.bounds, localX, localY)) return [];
  return NAVIGATION_SHEET.rows
    .filter(({ rect }) => contains(rect, localX, localY))
    .map(({ id }) => id);
}

export function hitTestNavigation(
  localX: number,
  localY: number,
): DestinationId | null {
  return navigationMatches(localX, localY)[0] ?? null;
}

export function plateExperienceReducer(
  state: ExperienceState,
  event: ExperienceEvent,
): ExperienceState {
  switch (event.type) {
    case "ARRIVAL_SETTLED":
      if (state.phase !== "opening") return state;
      return {
        endpoint: "desk",
        requested: null,
        transition: null,
        phase: "resting",
      };

    case "SELECT": {
      if (state.phase === "opening") return state;
      if (state.phase === "transitioning") {
        return { ...state, requested: event.destination };
      }
      if (state.endpoint === event.destination) {
        return { ...state, requested: null };
      }
      if (state.endpoint === "desk") {
        return {
          endpoint: "desk",
          requested: event.destination,
          transition: `desk-to-${event.destination}`,
          phase: "transitioning",
        };
      }
      return {
        endpoint: state.endpoint,
        requested: event.destination,
        transition: `${state.endpoint}-to-desk`,
        phase: "transitioning",
      };
    }

    case "TRANSITION_ENDED": {
      if (state.phase !== "transitioning" || !state.transition) return state;
      const [, to] = state.transition.split("-to-") as [
        EndpointId,
        EndpointId,
      ];
      if (to === "desk") {
        return {
          endpoint: "desk",
          requested: state.requested,
          transition: null,
          phase: "resting",
        };
      }
      return {
        endpoint: to,
        requested: null,
        transition: null,
        phase: "resting",
      };
    }

    case "CLOSE":
      if (state.phase === "opening") return state;
      if (state.phase === "transitioning") {
        return { ...state, requested: null };
      }
      if (state.endpoint === "desk") {
        return { ...state, requested: null };
      }
      return {
        endpoint: state.endpoint,
        requested: null,
        transition: `${state.endpoint}-to-desk`,
        phase: "transitioning",
      };
  }
}
