/**
 * World coordinate convention — permanent.
 *
 * The world origin (0, 0, 0) is the exact center of the future workbench.
 * Every object, camera position, and room dimension is defined as an offset
 * from this point, so room geometry can grow around the workbench without
 * relocating any existing system. This convention never changes.
 *
 * Axes follow three.js defaults: +Y is up, the floor lies in the XZ plane
 * at Y = 0.
 */

export type Offset = readonly [number, number, number];

/** The exact center of the future workbench. */
export const WORKBENCH_ORIGIN: Offset = [0, 0, 0];

/** Resolve a position expressed as an offset from the workbench origin. */
export function fromWorkbench(offset: Offset): [number, number, number] {
  return [
    WORKBENCH_ORIGIN[0] + offset[0],
    WORKBENCH_ORIGIN[1] + offset[1],
    WORKBENCH_ORIGIN[2] + offset[2],
  ];
}
