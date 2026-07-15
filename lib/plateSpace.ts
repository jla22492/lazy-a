import cameraContract from "../assets/master/camera-contract.json" with { type: "json" };

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type PlateVariant = "wide" | "portrait";

export const PHONE_MAX_WIDTH = cameraContract.selection.phoneMaxWidth;

export function selectPlateVariant(width: number): PlateVariant {
  return width <= PHONE_MAX_WIDTH ? "portrait" : "wide";
}

export function coverTransform(source: Size, viewport: Size) {
  const scale = Math.max(
    viewport.width / source.width,
    viewport.height / source.height,
  );
  return {
    scale,
    offsetX: (viewport.width - source.width * scale) / 2,
    offsetY: (viewport.height - source.height * scale) / 2,
  };
}

/** Maps a normalized authored plate point to CSS pixels in the viewport. */
export function mapPlatePoint(
  point: Point,
  source: Size,
  viewport: Size,
): Point {
  const { scale, offsetX, offsetY } = coverTransform(source, viewport);
  return {
    x: offsetX + point.x * source.width * scale,
    y: offsetY + point.y * source.height * scale,
  };
}

export function mapPlateQuad(
  quad: readonly number[],
  source: Size,
  viewport: Size,
): readonly number[] {
  if (quad.length !== 8) return [];
  const mapped: number[] = [];
  for (let index = 0; index < 8; index += 2) {
    const point = mapPlatePoint(
      { x: quad[index], y: quad[index + 1] },
      source,
      viewport,
    );
    mapped.push(point.x, point.y);
  }
  return mapped;
}

export function pointInConvexQuad(
  point: Point,
  values: readonly number[],
): boolean {
  if (values.length !== 8) return false;
  let sign = 0;
  for (let index = 0; index < 4; index += 1) {
    const next = (index + 1) % 4;
    const startX = values[index * 2];
    const startY = values[index * 2 + 1];
    const endX = values[next * 2];
    const endY = values[next * 2 + 1];
    const cross =
      (endX - startX) * (point.y - startY) -
      (endY - startY) * (point.x - startX);
    if (Math.abs(cross) < 1e-7) continue;
    const nextSign = Math.sign(cross);
    if (sign !== 0 && sign !== nextSign) return false;
    sign = nextSign;
  }
  return true;
}
