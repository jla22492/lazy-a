"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

/**
 * Attention & Conversation (WORK ORDERS 0075 + 0076) — the interface.
 *
 * ATTENTION: the room never responds to hover; the interface may respond
 * to attention. When the pointer RESTS on a destination (~0.45s), a quiet
 * label appears — one label always, opacity over ~90ms, no motion. Labels
 * name the DESTINATION, never the object.
 *
 * CONVERSATION: clicking a destination is not navigation — it is paying
 * closer attention, and the room respectfully gives it space. The body
 * leans in (~18cm, one ease, never a new composition), and an editorial
 * caption — almost typeset, never UI — quietly materializes beside the
 * object. The room remains fully visible and unchanged: the host. Escape
 * or a click on empty space eases the body back. Content is placeholder
 * layout awaiting authorship: the destination's name and quiet unwritten
 * lines. Navigation changes attention before it changes location.
 */

interface Destination {
  id: string;
  /** Placeholder destination name — authorship pending. */
  label: string;
  /** World-space attention center. */
  center: [number, number, number];
  /** Physical radius the pointer ray must rest within. */
  radius: number;
  /** Where the label anchors, world space. */
  anchor: [number, number, number];
  /** Where the caption typesets itself during conversation. */
  caption: [number, number, number];
  /** How far the body leans for this conversation, meters. */
  intimacy: number;
}

const DESTINATIONS: readonly Destination[] = [
  {
    id: "films",
    label: "FILMS",
    center: [0.55, 1.52, -0.44],
    radius: 0.38,
    anchor: [0.55, 1.06, -0.42],
    caption: [1.06, 1.52, -0.42],
    intimacy: 0.2,
  },
  {
    id: "journal",
    label: "JOURNAL",
    center: [-1.43, 0.98, -0.28],
    radius: 0.17,
    anchor: [-1.43, 1.13, -0.26],
    caption: [-0.98, 1.06, -0.26],
    intimacy: 0.16,
  },
  {
    id: "work",
    label: "WORK",
    center: [0.78, 0.95, 0.04],
    radius: 0.13,
    anchor: [0.78, 1.08, 0.06],
    caption: [1.14, 1.02, 0.06],
    intimacy: 0.15,
  },
];

/** Rest, not flyby. */
const DWELL_SECONDS = 0.45;
const RELEASE_SECONDS = 0.22;
const DECAY_RATE = 2.2;

/** The lean: one ease of mass, there and back. */
const LEAN_SECONDS = 0.9;

const TYPE_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: TYPE_FAMILY,
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.22em",
  color: "#5d574d",
  whiteSpace: "nowrap",
  userSelect: "none",
  pointerEvents: "none",
  transform: "translate(-50%, 0)",
  transition: "opacity 90ms linear",
};

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

/** The editorial caption: typeset, not UI — placeholder lines unwritten. */
function Caption({ destination }: { destination: Destination }) {
  return (
    <div
      style={{
        fontFamily: TYPE_FAMILY,
        color: "#4c463d",
        width: "200px",
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 500,
          letterSpacing: "0.22em",
        }}
      >
        {destination.label}
      </div>
      <div
        style={{
          height: "1px",
          background: "#8a8375",
          opacity: 0.5,
          margin: "10px 0 12px",
          width: "56px",
        }}
      />
      {/* Unwritten lines: layout awaiting authorship, never lorem. */}
      {[112, 96, 104].map((width, index) => (
        <div
          key={index}
          style={{
            height: "7px",
            width: `${width}px`,
            background: "#8a8375",
            opacity: 0.28,
            marginBottom: "9px",
            borderRadius: "1px",
          }}
        />
      ))}
    </div>
  );
}

export function AttentionNavigation() {
  const dwellRef = useRef<Record<string, number>>({});
  const [active, setActive] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const [conversation, setConversation] = useState<string | null>(null);
  const conversationRef = useRef<string | null>(null);
  /** Lean progress 0..1 and the pose it leans from. */
  const leanT = useRef(0);
  const basePose = useRef<{ position: Vector3; gaze: Vector3 } | null>(null);

  const centers = useMemo(
    () =>
      DESTINATIONS.map((destination) => ({
        ...destination,
        centerV: new Vector3(...destination.center),
      })),
    [],
  );

  /* Dev-only capture aid: ?talk=<id> opens a conversation after the
     arrival, so headless review media can photograph it. */
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

  /* Escape ends the conversation; so does a click on empty space. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        conversationRef.current = null;
        setConversation(null);
      }
    };
    const onClick = () => {
      if (!arrivalDone()) return;
      const candidate = activeRef.current;
      if (candidate && conversationRef.current !== candidate) {
        conversationRef.current = candidate;
        setConversation(candidate);
      } else if (!candidate && conversationRef.current) {
        conversationRef.current = null;
        setConversation(null);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, []);

  useFrame((state, delta) => {
    const { raycaster, pointer, camera } = state;
    raycaster.setFromCamera(pointer, camera);
    const ray = raycaster.ray;
    let candidate: string | null = null;
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
    const dwell = dwellRef.current;
    for (const destination of centers) {
      const current = dwell[destination.id] ?? 0;
      dwell[destination.id] =
        destination.id === candidate
          ? Math.min(current + delta, DWELL_SECONDS + 0.4)
          : Math.max(current - delta * DECAY_RATE, 0);
    }
    let next = activeRef.current;
    if (next && (dwell[next] ?? 0) < RELEASE_SECONDS) next = null;
    if (!next && candidate && (dwell[candidate] ?? 0) >= DWELL_SECONDS) {
      next = candidate;
    }
    if (next !== activeRef.current) {
      activeRef.current = next;
      setActive(next);
    }

    /* The lean: toward the conversation's object, and back. */
    if (!arrivalDone()) return;
    const talking = conversationRef.current;
    const target = talking
      ? centers.find((d) => d.id === talking) ?? null
      : null;
    const direction = talking ? 1 : -1;
    const before = leanT.current;
    leanT.current = Math.min(
      Math.max(leanT.current + (direction * delta) / LEAN_SECONDS, 0),
      1,
    );
    if (leanT.current === 0 && before === 0) {
      basePose.current = null;
      return;
    }
    if (!basePose.current) {
      /* The stance the body leans from — captured at conversation start. */
      basePose.current = {
        position: camera.position.clone(),
        gaze: camera.position
          .clone()
          .add(camera.getWorldDirection(new Vector3()).multiplyScalar(4)),
      };
    }
    const pose = basePose.current;
    const eased = easeInOutCubic(leanT.current);
    /* Lean target persists through the ease-back even after target clears. */
    if (target) lastTarget.current = target;
    const leanTo = lastTarget.current;
    if (!leanTo) return;
    const toward = leanTo.centerV
      .clone()
      .sub(pose.position)
      .setY(0)
      .normalize()
      .multiplyScalar(leanTo.intimacy);
    camera.position.copy(pose.position).addScaledVector(toward, eased);
    const gazePoint = pose.gaze
      .clone()
      .lerp(leanTo.centerV, eased * 0.3);
    camera.lookAt(gazePoint);
  });

  const lastTarget = useRef<(typeof centers)[number] | null>(null);

  return (
    <>
      {centers.map((destination) => (
        <Html
          key={destination.id}
          position={destination.anchor}
          zIndexRange={[5, 5]}
          style={{
            ...LABEL_STYLE,
            opacity:
              active === destination.id && conversation !== destination.id
                ? 1
                : 0,
          }}
        >
          {destination.label}
        </Html>
      ))}
      {centers.map((destination) => (
        <Html
          key={`caption-${destination.id}`}
          position={destination.caption}
          zIndexRange={[6, 6]}
          style={{
            opacity: conversation === destination.id ? 1 : 0,
            transition: "opacity 240ms linear",
            pointerEvents: "none",
          }}
        >
          <Caption destination={destination} />
        </Html>
      ))}
    </>
  );
}
