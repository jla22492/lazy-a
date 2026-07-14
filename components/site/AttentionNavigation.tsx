"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

import { MOTION } from "@/components/site/motion";
import { setContactLevel } from "@/three/interface/contact";
import { setJournalLevel } from "@/three/interface/journal";
import { setQuietLevel } from "@/three/interface/quiet";
import { WORKBENCH } from "@/three/scene/constants";
import { PRODUCTION_NAV_SHEET } from "@/three/scene/dressing/workbench";

interface Destination {
  id: "films" | "journal" | "contact" | "about";
  /** World-space attention center on the handwritten production sheet. */
  center: [number, number, number];
  /** Physical radius the pointer ray can hit. */
  radius: number;
  /** Where the head turns once the word is chosen. */
  focus: [number, number, number];
  /** How much of the head turn resolves toward the focus point. */
  gazePull: number;
  /** A human posture adjustment, not a software zoom. */
  posture?: [number, number, number];
}

type ResolvedDestination = Destination & {
  centerV: Vector3;
  focusV: Vector3;
  postureV: Vector3;
};

/**
 * R-0117: navigation is explicit and physical. The visitor reads a
 * production scratch sheet on the desk — pencil words the maker wrote for
 * himself — then the room turns toward the corresponding object.
 */
function navWordCenter(id: Destination["id"]): [number, number, number] {
  const word = PRODUCTION_NAV_SHEET.words.find((item) => item.id === id);
  if (!word) throw new Error(`Unknown production note target: ${id}`);
  const yaw = PRODUCTION_NAV_SHEET.yaw;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const x = PRODUCTION_NAV_SHEET.at.x + word.x * cos + word.z * sin;
  const z = PRODUCTION_NAV_SHEET.at.z - word.x * sin + word.z * cos;
  return [x, WORKBENCH.surfaceHeight + 0.012, z];
}

const DESTINATIONS: readonly Destination[] = [
  {
    id: "films",
    center: navWordCenter("films"),
    radius: 0.062,
    focus: [0.47, 1.22, -0.42],
    gazePull: 0.44,
  },
  {
    id: "journal",
    center: navWordCenter("journal"),
    radius: 0.068,
    focus: [0.35, 0.9, 0.12],
    gazePull: 1.0,
    posture: [0.02, -0.11, -0.18],
  },
  {
    id: "contact",
    center: navWordCenter("contact"),
    radius: 0.07,
    focus: [0.68, 0.88, 0.1],
    gazePull: 0.86,
    posture: [0.025, -0.045, -0.08],
  },
  {
    id: "about",
    center: navWordCenter("about"),
    radius: 0.062,
    focus: [-1.12, 1.08, -0.12],
    gazePull: 0.65,
    posture: [-0.03, 0, -0.02],
  },
];

const LEAN_SECONDS = MOTION.lean.durationSeconds;

function easeInOutCubic(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return clamped < 0.5
    ? 4 * clamped ** 3
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function arrivalDone(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as Window & { __arrivalDone?: boolean }).__arrivalDone,
  );
}

function setDebugConversation(id: string | null): void {
  if (typeof window === "undefined") return;
  (window as Window & { __lazyAConversation?: string | null })
    .__lazyAConversation = id;
}

function setDebugCandidate(id: string | null): void {
  if (typeof window === "undefined") return;
  (window as Window & { __lazyANavCandidate?: string | null })
    .__lazyANavCandidate = id;
}

export function AttentionNavigation() {
  const [conversation, setConversation] = useState<string | null>(null);
  const conversationRef = useRef<string | null>(null);
  const candidateRef = useRef<string | null>(null);
  const pointerAlive = useRef(false);
  const leanT = useRef(0);
  const basePose = useRef<{ position: Vector3; gaze: Vector3 } | null>(null);
  const lastTarget = useRef<ResolvedDestination | null>(null);

  const centers = useMemo<ResolvedDestination[]>(
    () =>
      DESTINATIONS.map((destination) => ({
        ...destination,
        centerV: new Vector3(...destination.center),
        focusV: new Vector3(...destination.focus),
        postureV: destination.posture
          ? new Vector3(...destination.posture)
          : new Vector3(),
      })),
    [],
  );

  useEffect(() => {
    setDebugConversation(conversation);
  }, [conversation]);

  /* Dev-only capture aid: ?talk=<id> opens a conversation after arrival. */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("talk");
    if (!id || !DESTINATIONS.some((d) => d.id === id)) return;
    const timer = window.setInterval(() => {
      if (arrivalDone()) {
        conversationRef.current = id;
        setConversation(id);
        window.clearInterval(timer);
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const wake = () => {
      pointerAlive.current = true;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        conversationRef.current = null;
        setConversation(null);
      }
    };
    const onClick = () => {
      if (!arrivalDone()) return;
      const candidate = candidateRef.current;
      if (candidate) {
        conversationRef.current = candidate;
        setConversation(candidate);
      } else if (conversationRef.current) {
        conversationRef.current = null;
        setConversation(null);
      }
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
  }, []);

  useFrame((state, delta) => {
    const { raycaster, pointer, camera } = state;
    let candidate: string | null = null;
    if (pointerAlive.current) {
      raycaster.setFromCamera(pointer, camera);
      const ray = raycaster.ray;
      let best = Infinity;
      for (const destination of centers) {
        const distance = ray.distanceToPoint(destination.centerV);
        if (distance < destination.radius) {
          const depth = destination.centerV.distanceTo(camera.position);
          if (depth < best) {
            best = depth;
            candidate = destination.id;
          }
        }
      }
    }
    candidateRef.current = candidate;
    setDebugCandidate(candidate);

    if (!arrivalDone()) return;
    const talking = conversationRef.current;
    const target = talking
      ? centers.find((destination) => destination.id === talking) ?? null
      : null;
    const direction = talking ? 1 : -1;
    const before = leanT.current;
    leanT.current = Math.min(
      Math.max(leanT.current + (direction * delta) / LEAN_SECONDS, 0),
      1,
    );
    if (leanT.current === 0 && before === 0) {
      basePose.current = null;
      setQuietLevel(0);
      setJournalLevel(0);
      setContactLevel(0);
      return;
    }
    if (!basePose.current) {
      basePose.current = {
        position: camera.position.clone(),
        gaze: camera.position
          .clone()
          .add(camera.getWorldDirection(new Vector3()).multiplyScalar(4)),
      };
    }

    const pose = basePose.current;
    const eased = easeInOutCubic(leanT.current);
    setQuietLevel(eased);
    if (target) lastTarget.current = target;
    const turnTo = lastTarget.current;
    setJournalLevel(turnTo?.id === "journal" ? eased : 0);
    setContactLevel(turnTo?.id === "contact" ? eased : 0);
    if (!turnTo) return;

    camera.position.copy(pose.position).addScaledVector(turnTo.postureV, eased);
    const gazePoint = pose.gaze
      .clone()
      .lerp(turnTo.focusV, eased * turnTo.gazePull);
    camera.lookAt(gazePoint);
  });

  return null;
}
