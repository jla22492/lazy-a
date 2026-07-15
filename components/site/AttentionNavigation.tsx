"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { useFrame, useThree } from "@react-three/fiber";
import {
  PerspectiveCamera,
  Quaternion,
  Vector3,
  type Camera,
} from "three";

import { setContactLevel } from "@/three/interface/contact";
import { mapPlateQuad, selectPlateVariant } from "@/lib/plateSpace";
import { setJournalLevel } from "@/three/interface/journal";
import { setQuietLevel } from "@/three/interface/quiet";
import {
  INITIAL_PLATE_EXPERIENCE,
  NAVIGATION_SHEET,
  plateExperienceReducer,
  type ExperienceEvent,
  type ExperienceState,
} from "@/three/animation/plateExperience";
import {
  plateManifest,
  type CameraSample,
  type DestinationId,
  type EndpointId,
  type Variant,
} from "@/three/scene/plateManifest";

type NavigationExperienceEvent = Extract<
  ExperienceEvent,
  { type: "SELECT" | "CLOSE" }
>;

export interface AttentionNavigationProps {
  /** Sends user navigation intent to an optional Stage-owned reducer. */
  onExperienceEvent?: (event: NavigationExperienceEvent) => void;
}

interface CameraSnapshot {
  endpoint: EndpointId;
  requested: DestinationId | null;
  transition: string | null;
  phase: ExperienceState["phase"];
  camera: {
    position: [number, number, number];
    quaternion: [number, number, number, number];
    fov: number;
  };
  framing: {
    coverage: {
      notebook: number;
      contactPaper: number;
      charger: number;
      leftHistory: number;
    };
  };
}

interface ActiveTransition {
  id: string;
  elapsed: number;
  progress: number;
}

const DESTINATIONS = NAVIGATION_SHEET.rows.map(({ id }) => id);

interface ScreenPoint {
  x: number;
  y: number;
}

function pointInConvexQuad(point: ScreenPoint, quad: readonly ScreenPoint[]) {
  let sign = 0;
  for (let index = 0; index < quad.length; index += 1) {
    const start = quad[index];
    const end = quad[(index + 1) % quad.length];
    const cross =
      (end.x - start.x) * (point.y - start.y) -
      (end.y - start.y) * (point.x - start.x);
    if (Math.abs(cross) < 1e-7) continue;
    const nextSign = Math.sign(cross);
    if (sign !== 0 && nextSign !== sign) return false;
    sign = nextSign;
  }
  return true;
}

function arrivalDone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as Window & { __arrivalDone?: boolean }).__arrivalDone === true
  );
}

function cameraFov(camera: Camera): number {
  return camera instanceof PerspectiveCamera ? camera.fov : 35;
}

function setCameraFov(camera: Camera, fov: number): void {
  if (!(camera instanceof PerspectiveCamera)) return;
  if (camera.fov === fov) return;
  camera.fov = fov;
  camera.updateProjectionMatrix();
}

function applyCameraSample(camera: Camera, sample: CameraSample): void {
  camera.position.set(...sample.position);
  camera.quaternion.set(...sample.quaternion);
  setCameraFov(camera, sample.fov);
  camera.updateMatrixWorld();
}

function interpolateCameraSample(
  camera: Camera,
  from: CameraSample,
  to: CameraSample,
  amount: number,
): void {
  camera.position
    .set(...from.position)
    .lerp(new Vector3(...to.position), amount);
  camera.quaternion
    .set(...from.quaternion)
    .slerp(new Quaternion(...to.quaternion), amount)
    .normalize();
  setCameraFov(camera, from.fov + (to.fov - from.fov) * amount);
  camera.updateMatrixWorld();
}

function copySnapshot(snapshot: CameraSnapshot): CameraSnapshot {
  return {
    ...snapshot,
    camera: {
      position: [...snapshot.camera.position],
      quaternion: [...snapshot.camera.quaternion],
      fov: snapshot.camera.fov,
    },
    framing: { coverage: { ...snapshot.framing.coverage } },
  };
}

export function AttentionNavigation({
  onExperienceEvent,
}: AttentionNavigationProps = {}) {
  const { camera, gl, size } = useThree();
  const variant: Variant = selectPlateVariant(size.width);
  const profile = plateManifest.variants[variant];
  const navigation = profile.navigation;

  const conversationRef = useRef<DestinationId | null>(null);
  const candidateRef = useRef<DestinationId | null>(null);
  const pointerAlive = useRef(false);
  const experienceRef = useRef<ExperienceState>(INITIAL_PLATE_EXPERIENCE);
  const activeTransitionRef = useRef<ActiveTransition | null>(null);
  const deskSampleRef = useRef<CameraSample | null>(null);
  const historyRef = useRef<CameraSnapshot[]>([]);

  const sheetProjection = useMemo(() => {
    const values = navigation.screenQuads.desk ??
      navigation.screenQuad ?? [0, 0, 1, 0, 1, 1, 0, 1];
    const mapped = mapPlateQuad(
      values,
      { width: profile.width, height: profile.height },
      size,
    );
    const normalizedQuad = [0, 1, 2, 3].map((index) => ({
      x: mapped[index * 2] / size.width,
      y: mapped[index * 2 + 1] / size.height,
    }));
    const projectNormalized = (localX: number, localY: number): ScreenPoint => {
      const u =
        (localX - navigation.bounds.x) / navigation.bounds.width;
      const v =
        (localY - navigation.bounds.y) / navigation.bounds.height;
      const top = {
        x: normalizedQuad[0].x + (normalizedQuad[1].x - normalizedQuad[0].x) * u,
        y: normalizedQuad[0].y + (normalizedQuad[1].y - normalizedQuad[0].y) * u,
      };
      const bottom = {
        x: normalizedQuad[3].x + (normalizedQuad[2].x - normalizedQuad[3].x) * u,
        y: normalizedQuad[3].y + (normalizedQuad[2].y - normalizedQuad[3].y) * u,
      };
      return {
        x: top.x + (bottom.x - top.x) * v,
        y: top.y + (bottom.y - top.y) * v,
      };
    };
    const rowQuad = (rect: (typeof navigation.rows)[number]["rect"]) => [
      projectNormalized(rect.x, rect.y),
      projectNormalized(rect.x + rect.width, rect.y),
      projectNormalized(rect.x + rect.width, rect.y + rect.height),
      projectNormalized(rect.x, rect.y + rect.height),
    ];
    return { projectNormalized, rowQuad };
  }, [navigation, profile.height, profile.width, size]);

  const setConversation = useCallback((id: DestinationId | null): void => {
    conversationRef.current = id;
    (window as Window & { __lazyAConversation?: DestinationId | null })
      .__lazyAConversation = id;
  }, []);

  const setExperience = useCallback((next: ExperienceState): void => {
    experienceRef.current = next;
    (window as Window & { __lazyAEndpoint?: EndpointId }).__lazyAEndpoint =
      next.endpoint;
  }, []);

  const localEvent = useCallback(
    (event: ExperienceEvent): ExperienceState => {
      const next = plateExperienceReducer(experienceRef.current, event);
      setExperience(next);
      return next;
    },
    [setExperience],
  );

  const snapshot = useCallback((): CameraSnapshot => {
    const state = experienceRef.current;
    const coverage = profile.endpoints[state.endpoint].framing.coverage;
    return {
      endpoint: state.endpoint,
      requested: state.requested,
      transition: state.transition,
      phase: state.phase,
      camera: {
        position: camera.position.toArray() as [number, number, number],
        quaternion: camera.quaternion.toArray() as [
          number,
          number,
          number,
          number,
        ],
        fov: cameraFov(camera),
      },
      framing: { coverage: { ...coverage } },
    };
  }, [camera, profile]);

  const recordSnapshot = useCallback((): void => {
    historyRef.current.push(snapshot());
  }, [snapshot]);

  const requestDestination = useCallback(
    (destination: DestinationId): void => {
      if (!arrivalDone() || !DESTINATIONS.includes(destination)) return;
      setConversation(destination);
      const event: NavigationExperienceEvent = {
        type: "SELECT",
        destination,
      };
      onExperienceEvent?.(event);
      localEvent(event);
    },
    [localEvent, onExperienceEvent, setConversation],
  );

  const close = useCallback((): void => {
    setConversation(null);
    const event: NavigationExperienceEvent = { type: "CLOSE" };
    onExperienceEvent?.(event);
    localEvent(event);
  }, [localEvent, onExperienceEvent, setConversation]);

  useEffect(() => {
    const wake = () => {
      pointerAlive.current = true;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onClick = () => {
      if (!arrivalDone()) return;
      const candidate = candidateRef.current;
      if (candidate) requestDestination(candidate);
      else if (conversationRef.current) close();
    };
    window.addEventListener("pointermove", wake, { once: true });
    window.addEventListener("mousemove", wake, { once: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [close, requestDestination]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("talk");
    if (!DESTINATIONS.includes(id as DestinationId)) return;
    const timer = window.setInterval(() => {
      if (!arrivalDone()) return;
      requestDestination(id as DestinationId);
      window.clearInterval(timer);
    }, 150);
    return () => window.clearInterval(timer);
  }, [requestDestination]);

  useEffect(() => {
    const matchesAtScreenPoint = (
      screenX: number,
      screenY: number,
    ): DestinationId[] => {
      const rect = gl.domElement.getBoundingClientRect();
      const normalized = {
        x: (screenX - rect.left) / rect.width,
        y: (screenY - rect.top) / rect.height,
      };
      return navigation.rows
        .filter(({ rect: row }) =>
          pointInConvexQuad(normalized, sheetProjection.rowQuad(row)),
        )
        .map(({ id }) => id);
    };
    const projectSheetPoint = (localX: number, localY: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      const normalized = sheetProjection.projectNormalized(localX, localY);
      return {
        x: rect.left + normalized.x * rect.width,
        y: rect.top + normalized.y * rect.height,
      };
    };
    const navigationDebug = {
      sheet: {
        bounds: { ...NAVIGATION_SHEET.bounds },
        rows: NAVIGATION_SHEET.rows.map(({ id, rect }) => ({
          id,
          rect: { ...rect },
        })),
      },
      projectSheetPoint,
      matchesAtScreenPoint,
    };
    const cameraDebug = {
      snapshot,
      history: () => historyRef.current.map(copySnapshot),
      clearHistory: () => {
        historyRef.current = [];
      },
      requestDestination,
      close,
    };
    const debugWindow = window as Window & {
      __lazyANavigationDebug?: typeof navigationDebug;
      __lazyACameraDebug?: typeof cameraDebug;
    };
    debugWindow.__lazyANavigationDebug = navigationDebug;
    debugWindow.__lazyACameraDebug = cameraDebug;
    return () => {
      if (debugWindow.__lazyANavigationDebug === navigationDebug) {
        delete debugWindow.__lazyANavigationDebug;
      }
      if (debugWindow.__lazyACameraDebug === cameraDebug) {
        delete debugWindow.__lazyACameraDebug;
      }
    };
  }, [close, gl, navigation, profile, requestDestination, sheetProjection, snapshot]);

  useFrame((state, delta) => {
    if (arrivalDone() && experienceRef.current.phase === "opening") {
      deskSampleRef.current = {
        position: camera.position.toArray() as [number, number, number],
        quaternion: camera.quaternion.toArray() as [
          number,
          number,
          number,
          number,
        ],
        fov: cameraFov(camera),
      };
      localEvent({ type: "ARRIVAL_SETTLED" });
      recordSnapshot();
    }

    const current = experienceRef.current;
    if (
      current.phase === "resting" &&
      current.endpoint === "desk" &&
      current.requested
    ) {
      localEvent({ type: "SELECT", destination: current.requested });
    }

    let candidate: DestinationId | null = null;
    if (
      pointerAlive.current &&
      arrivalDone() &&
      experienceRef.current.phase === "resting" &&
      experienceRef.current.endpoint === "desk"
    ) {
      const normalized = {
        x: (state.pointer.x + 1) / 2,
        y: (1 - state.pointer.y) / 2,
      };
      candidate =
        navigation.rows.find(({ rect: row }) =>
          pointInConvexQuad(normalized, sheetProjection.rowQuad(row)),
        )?.id ?? null;
    }
    candidateRef.current = candidate;
    (window as Window & { __lazyANavCandidate?: DestinationId | null })
      .__lazyANavCandidate = candidate;

    const experience = experienceRef.current;
    if (experience.phase !== "transitioning" || !experience.transition) {
      activeTransitionRef.current = null;
      const active = experience.endpoint;
      setQuietLevel(active === "desk" || active === "opening" ? 0 : 1);
      setJournalLevel(active === "journal" ? 1 : 0);
      setContactLevel(active === "contact" ? 1 : 0);
      return;
    }

    const [from, to] = experience.transition.split("-to-") as [
      EndpointId,
      EndpointId,
    ];
    const destination = (from === "desk" ? to : from) as DestinationId;
    const authored = profile.transitions[`desk-${destination}`];
    if (!authored) return;

    let active = activeTransitionRef.current;
    if (!active || active.id !== experience.transition) {
      active = { id: experience.transition, elapsed: 0, progress: 0 };
      activeTransitionRef.current = active;
    }
    active.elapsed = Math.min(active.elapsed + delta, authored.duration);
    active.progress = active.elapsed / authored.duration;
    const forwardProgress = from === "desk" ? active.progress : 1 - active.progress;
    const framePosition = forwardProgress * (authored.frames.length - 1);
    const lowerIndex = Math.floor(framePosition);
    const upperIndex = Math.min(lowerIndex + 1, authored.frames.length - 1);
    interpolateCameraSample(
      camera,
      authored.frames[lowerIndex].camera,
      authored.frames[upperIndex].camera,
      framePosition - lowerIndex,
    );

    const effectProgress = from === "desk" ? active.progress : 1 - active.progress;
    setQuietLevel(effectProgress);
    setJournalLevel(destination === "journal" ? effectProgress : 0);
    setContactLevel(destination === "contact" ? effectProgress : 0);

    if (active.progress < 1) return;
    if (to === "desk" && deskSampleRef.current) {
      applyCameraSample(camera, deskSampleRef.current);
    } else {
      applyCameraSample(camera, profile.endpoints[to].projection.camera);
    }
    activeTransitionRef.current = null;
    localEvent({ type: "TRANSITION_ENDED" });
    recordSnapshot();
  });

  return null;
}
