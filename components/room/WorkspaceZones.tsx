"use client";

import { WORKBENCH } from "@/three/scene/constants";
import { WORKSPACE, type WorkZoneName } from "@/three/scene/workspace";
import { fromWorkbench } from "@/three/scene/world";

/** Just above the tabletop so the overlay never z-fights the surface. */
const OVERLAY_LIFT = 0.002;
const OVERLAY_OPACITY = 0.35;

const ZONE_COLORS: Record<WorkZoneName, string> = {
  reference: "#7d8fa6",
  resting: "#8fa67d",
  active: "#a68f7d",
  temporary: "#a67da4",
};

const FLAT = -Math.PI / 2;

/**
 * Development overlay for the workbench language (WORK ORDER 0010).
 * Renders only in development and only with ?zones=1 in the URL — never
 * part of the visitor experience (the production build strips it).
 */
export function WorkspaceZones() {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  if (new URLSearchParams(window.location.search).get("zones") !== "1") {
    return null;
  }

  return (
    <group
      position={fromWorkbench([0, WORKBENCH.surfaceHeight + OVERLAY_LIFT, 0])}
    >
      {(Object.keys(WORKSPACE) as WorkZoneName[]).map((name) => {
        const zone = WORKSPACE[name];
        const width = zone.xRange[1] - zone.xRange[0];
        const depth = zone.zRange[1] - zone.zRange[0];
        const centerX = (zone.xRange[0] + zone.xRange[1]) / 2;
        const centerZ = (zone.zRange[0] + zone.zRange[1]) / 2;
        return (
          <mesh key={name} position={[centerX, 0, centerZ]} rotation-x={FLAT}>
            <planeGeometry args={[width, depth]} />
            <meshBasicMaterial
              color={ZONE_COLORS[name]}
              transparent
              opacity={OVERLAY_OPACITY}
            />
          </mesh>
        );
      })}
    </group>
  );
}
