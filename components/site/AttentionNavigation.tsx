"use client";

import { useMemo, useRef, useState } from "react";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

/**
 * Attention navigation (WORK ORDER 0075) — the interface's first gesture.
 *
 * The room never responds to hover; the interface may respond to
 * attention. When the pointer RESTS on a destination object (~0.45s of
 * dwell — "I was already looking there," never "I triggered something"),
 * a quiet label appears: opacity over ~90ms, no motion, one label always,
 * no exceptions. The room remains unchanged — no glow, no pulse, no
 * acknowledgment. Objects are not navigation; they are evidence that
 * navigation belongs there, so labels name the DESTINATION, never the
 * object. Label words are operational placeholders awaiting authorship.
 *
 * The dwell/hysteresis grammar is the notebook pipeline's completed
 * research, reborn as the interface's foundation.
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
}

const DESTINATIONS: readonly Destination[] = [
  {
    id: "films",
    label: "FILMS",
    center: [0.55, 1.52, -0.44],
    radius: 0.38,
    anchor: [0.55, 1.06, -0.42],
  },
  {
    id: "journal",
    label: "JOURNAL",
    center: [-1.43, 0.98, -0.28],
    radius: 0.17,
    anchor: [-1.43, 1.13, -0.26],
  },
  {
    id: "work",
    label: "WORK",
    center: [0.78, 0.95, 0.04],
    radius: 0.13,
    anchor: [0.78, 1.08, 0.06],
  },
];

/** Rest, not flyby. */
const DWELL_SECONDS = 0.45;
/** Release below this, so edge-of-object jitter never flickers. */
const RELEASE_SECONDS = 0.22;
const DECAY_RATE = 2.2;

const LABEL_STYLE: React.CSSProperties = {
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
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

export function AttentionNavigation() {
  const dwellRef = useRef<Record<string, number>>({});
  const [active, setActive] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);

  const centers = useMemo(
    () =>
      DESTINATIONS.map((destination) => ({
        ...destination,
        centerV: new Vector3(...destination.center),
      })),
    [],
  );

  useFrame((state, delta) => {
    const { raycaster, pointer, camera } = state;
    raycaster.setFromCamera(pointer, camera);
    const ray = raycaster.ray;
    /* The nearest destination whose center the pointer's ray rests within. */
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
    /* One label, always: the active one holds until it decays out. */
    let next = activeRef.current;
    if (next && (dwell[next] ?? 0) < RELEASE_SECONDS) next = null;
    if (!next && candidate && (dwell[candidate] ?? 0) >= DWELL_SECONDS) {
      next = candidate;
    }
    if (next !== activeRef.current) {
      activeRef.current = next;
      setActive(next);
    }
  });

  return (
    <>
      {centers.map((destination) => (
        <Html
          key={destination.id}
          position={destination.anchor}
          zIndexRange={[5, 5]}
          style={{
            ...LABEL_STYLE,
            opacity: active === destination.id ? 1 : 0,
          }}
        >
          {destination.label}
        </Html>
      ))}
    </>
  );
}
