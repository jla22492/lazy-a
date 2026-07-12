"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

import { MOTION } from "@/components/site/motion";
import { TYPE } from "@/components/site/type";
import { setJournalLevel } from "@/three/interface/journal";
import { setQuietLevel } from "@/three/interface/quiet";

/**
 * Attention & Conversation (WORK ORDERS 0075 + 0076) — the interface.
 *
 * ATTENTION: the room never responds to hover; the interface may respond
 * to attention. When the pointer RESTS on a destination (~0.45s), a quiet
 * label appears — one label always, opacity over ~90ms, no motion. Labels
 * name the DESTINATION, never the object.
 *
 * CONVERSATION: clicking a destination is not navigation — it is paying
 * closer attention. Since R-0090 (Jonathan's ruling) the body never
 * travels: the visitor stays in the chair and only the HEAD turns
 * toward the chosen object, one ease, exactly like glancing between
 * the wall and the notebook at your own desk. An editorial caption —
 * almost typeset, never UI — quietly materializes beside the object
 * (or, for JOURNAL, the words rise on the page itself). Escape or a
 * click on empty space turns the head back. Content is placeholder
 * layout awaiting authorship. Navigation changes attention before it
 * changes location.
 */

interface Destination {
  id: string;
  /** Destination name (Jonathan's SPRINT_05 rulings). */
  label: string;
  /** World-space attention center. */
  center: [number, number, number];
  /** Physical radius the pointer ray must rest within. */
  radius: number;
  /** Where the label anchors, world space. */
  anchor: [number, number, number];
  /** Where the caption typesets itself during conversation.
      JOURNAL has none: its content illuminates ON the notebook. */
  caption?: [number, number, number];
  /** How far the head turns toward the object (0..1) — a person
      shifting attention at their own desk. Reading the notebook needs
      a real look down; the wall needs barely a glance. */
  gazePull: number;
  /** The first project experience (0082): unwritten gallery frames. */
  gallery?: boolean;
  /** Each destination's unwritten lines carry their own rhythm (0084):
      never the same blank twice, applied to the interface itself. */
  lineWidths: readonly number[];
}

/**
 * The destinations, REMAPPED (WORK ORDER 0090, Jonathan's SPRINT_05
 * rulings, superseding the 0075 placeholders): JOURNAL is the notebook
 * on the desk, CONTACT is the phone charger (the phone left with its
 * owner — contact), FILMS is the photographs propped against the wall.
 * All three live inside the seated composition (0089). The sprint brief
 * asked for the wall photographs reconciled sensibly with the actual
 * wall objects: from the seated frame those are the rear band's propped
 * test prints; the pinned cluster sits above the resting frame. CONTACT
 * anchors on the charger's visible cable run — the part of the charger
 * the seated frame actually holds.
 */
const DESTINATIONS: readonly Destination[] = [
  {
    id: "films",
    label: "FILMS",
    /* The propped test prints, both of them — one attention center. */
    center: [-0.02, 0.99, -0.37],
    radius: 0.2,
    anchor: [-0.02, 1.12, -0.42],
    /* Clear wall above-left of the prints — re-measured after the hero
       re-hang claimed the old spot (scripts/probe-projection.mjs). */
    caption: [-0.25, 1.28, -0.44],
    gazePull: 0.3,
    gallery: true,
    lineWidths: [118, 88],
  },
  {
    id: "journal",
    label: "JOURNAL",
    /* The notebook itself, on the desk. At the seated frame's shallow
       angle a larger sphere shadows the charger's line of sight and
       steals its dwell (depth rule) — 0.10 still covers the page. */
    center: [0.35, 0.91, 0.12],
    radius: 0.1,
    anchor: [0.35, 0.97, 0.0],
    /* No caption: the journal's words illuminate ON the page. */
    /* Reading is a real look down — the page must fill the regard. */
    gazePull: 0.85,
    lineWidths: [],
  },
  {
    id: "contact",
    label: "CONTACT",
    /* The charger's cable where it rises over the bench's rear edge —
       the most comfortably reachable stretch in the seated frame
       (measured: scripts/probe-projection.mjs). */
    center: [0.63, 0.9, -0.35],
    radius: 0.16,
    anchor: [0.63, 0.98, -0.38],
    /* Clear wall right of the hero print, under the sticky notes —
       re-measured after the re-hang (scripts/probe-projection.mjs). */
    caption: [0.95, 0.98, -0.44],
    gazePull: 0.45,
    /* Contact will be the briefest destination. */
    lineWidths: [64, 88],
  },
];

/** Rest, not flyby. */
const DWELL_SECONDS = MOTION.dwellSeconds;
const RELEASE_SECONDS = MOTION.releaseSeconds;
const DECAY_RATE = 2.2;

/** The lean: one ease of mass, there and back. */
const LEAN_SECONDS = MOTION.lean.durationSeconds;

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: TYPE.family,
  fontSize: TYPE.size.label,
  fontWeight: TYPE.weight,
  letterSpacing: TYPE.tracking,
  color: TYPE.ink.primary,
  whiteSpace: "nowrap",
  userSelect: "none",
  pointerEvents: "none",
  transform: "translate(-50%, 0)",
  transition: `opacity ${MOTION.answer.durationMs}ms ${MOTION.answer.ease}`,
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
        fontFamily: TYPE.family,
        color: TYPE.ink.primary,
        width: "200px",
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: TYPE.size.caption,
          fontWeight: TYPE.weight,
          letterSpacing: TYPE.tracking,
        }}
      >
        {destination.label}
      </div>
      <div
        style={{
          height: "1px",
          background: TYPE.ink.hairline,
          opacity: 0.5,
          margin: "10px 0 12px",
          width: "56px",
        }}
      />
      {/* Unwritten lines: layout awaiting authorship, never lorem. */}
      {destination.lineWidths.map((width, index) => (
        <div
          key={index}
          style={{
            height: "7px",
            width: `${width}px`,
            background: TYPE.ink.hairline,
            opacity: 0.28,
            marginBottom: "9px",
            borderRadius: "1px",
          }}
        />
      ))}
      {destination.gallery && (
        /* The work appears (0082): three unwritten frames — small prints
           awaiting their films, each materializing a beat after the last.
           Physical-history styling, not UI: paper tone, hairline edge. */
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              style={{
                width: "58px",
                height: "39px",
                background: "#b3ab9c",
                opacity: 0.42,
                border: "1px solid rgba(138, 131, 117, 0.45)",
                transitionDelay: `${120 + index * MOTION.siblingDelayMs}ms`,
              }}
            />
          ))}
        </div>
      )}
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

  /* Attention needs a real pointer: before the first pointer movement
     the framework reports the pointer at the frame's center, which now
     rests on the propped prints — a label must never appear for a
     visitor who hasn't moved their mouse. */
  const pointerAlive = useRef(false);
  useEffect(() => {
    const wake = () => {
      pointerAlive.current = true;
    };
    window.addEventListener("pointermove", wake, { once: true });
    return () => window.removeEventListener("pointermove", wake);
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
    /* Consequence (0081): the room quiets exactly as far as the head
       turns — one gesture, two effects. */
    setQuietLevel(eased);
    /* Turn target persists through the ease-back even after it clears. */
    if (target) lastTarget.current = target;
    const turnTo = lastTarget.current;
    /* The journal's words rise on the page with the same motion (0090):
       one gesture, every effect. */
    setJournalLevel(turnTo?.id === "journal" ? eased : 0);
    if (!turnTo) return;
    /* HEAD ONLY (R-0090, Jonathan's ruling): the body stays in the
       chair — the camera never travels toward the object. Choosing a
       destination turns the head, exactly like glancing from the wall
       down to the notebook at your own desk. */
    camera.position.copy(pose.position);
    const gazePoint = pose.gaze
      .clone()
      .lerp(turnTo.centerV, eased * turnTo.gazePull);
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
      {centers
        .filter((destination) => destination.caption)
        .map((destination) => (
          <Html
            key={`caption-${destination.id}`}
            position={destination.caption}
            zIndexRange={[6, 6]}
            style={{
              opacity: conversation === destination.id ? 1 : 0,
              transition: `opacity ${MOTION.materialize.durationMs}ms ${MOTION.materialize.ease}`,
              pointerEvents: "none",
            }}
          >
            <Caption destination={destination} />
          </Html>
        ))}
    </>
  );
}
