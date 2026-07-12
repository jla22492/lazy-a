/**
 * Dev probe: project world-space points to screen coordinates from the
 * LEANED viewpoint of a conversation, so caption anchors can be placed
 * on measured clear wall instead of estimated (0078 discipline, made
 * quantitative). Usage:
 *   node scripts/probe-projection.mjs <talkId> x,y,z [x,y,z ...]
 */

import { chromium } from "playwright";

const [, , talk, ...points] = process.argv;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:3000/?shot=zz-trash.png&talk=${talk}`, {
  waitUntil: "load",
});
await page.waitForTimeout(6000);
const result = await page.evaluate((pts) => {
  const stage = window.__stage;
  if (!stage) return "no __stage (dev only)";
  const camera = stage.camera;
  camera.updateMatrixWorld();
  const view = camera.matrixWorldInverse.elements;
  const proj = camera.projectionMatrix.elements;
  const apply = (m, [x, y, z, w]) => [
    m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  ];
  return pts.map((p) => {
    const [x, y, z] = p.split(",").map(Number);
    const clip = apply(proj, apply(view, [x, y, z, 1]));
    const sx = ((clip[0] / clip[3] + 1) / 2) * 1280;
    const sy = (1 - (clip[1] / clip[3] + 1) / 2) * 720;
    return { world: p, screen: [Math.round(sx), Math.round(sy)] };
  });
}, points);
console.log(JSON.stringify(result));
await browser.close();
