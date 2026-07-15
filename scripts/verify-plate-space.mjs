/** WO 0117-R2 gate: every authored plate point uses the browser's cover crop. */

import assert from "node:assert/strict";
import {
  coverTransform,
  mapPlatePoint,
  mapPlateQuad,
  pointInConvexQuad,
  selectPlateVariant,
} from "../lib/plateSpace.ts";

const WIDE = { width: 1280, height: 720 };
const PHONE = { width: 375, height: 812 };
const viewports = [
  { width: 1280, height: 720, expected: "wide" },
  { width: 1316, height: 1329, expected: "wide" },
  { width: 1024, height: 768, expected: "wide" },
  { width: 768, height: 1024, expected: "wide" },
  { width: 375, height: 812, expected: "portrait" },
];

for (const viewport of viewports) {
  const variant = selectPlateVariant(viewport.width);
  assert.equal(variant, viewport.expected, `${viewport.width} profile`);
  const source = variant === "wide" ? WIDE : PHONE;
  const transform = coverTransform(source, viewport);
  const topLeft = mapPlatePoint({ x: 0, y: 0 }, source, viewport);
  const bottomRight = mapPlatePoint({ x: 1, y: 1 }, source, viewport);
  assert.equal(topLeft.x, transform.offsetX);
  assert.equal(topLeft.y, transform.offsetY);
  assert.equal(bottomRight.x, transform.offsetX + source.width * transform.scale);
  assert.equal(bottomRight.y, transform.offsetY + source.height * transform.scale);

  const quad = mapPlateQuad(
    [0.25, 0.25, 0.75, 0.25, 0.75, 0.75, 0.25, 0.75],
    source,
    viewport,
  );
  const center = mapPlatePoint({ x: 0.5, y: 0.5 }, source, viewport);
  assert.ok(pointInConvexQuad(center, quad), `${viewport.width} mapped center`);
  assert.ok(
    !pointInConvexQuad({ x: center.x, y: quad[1] - 2 }, quad),
    `${viewport.width} empty margin`,
  );
}

console.log("Plate-space gate passed for five viewport shapes.");
