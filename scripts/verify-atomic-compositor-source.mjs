/**
 * Source contract for WO 0117-R4 Task 3.
 *
 * The real-Chrome occlusion and lifecycle gates prove rendered behavior. This
 * contract pins the ownership boundaries that keep those behaviors atomic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const runtimeFiles = {
  compositor: "components/room/PlateCompositor.tsx",
  surface: "components/room/HeroSurface.tsx",
  film: "components/room/HeroFilm.tsx",
  room: "components/room/PlateRoom.tsx",
  stage: "three/scene/Stage.tsx",
  navigation: "components/site/AttentionNavigation.tsx",
  assets: "lib/plateAssets.ts",
  page: "app/page.tsx",
  arrival: "scripts/verify-arrival-continuity.mjs",
};

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(absolutePath), `${relativePath} is missing`);
  return fs.readFileSync(absolutePath, "utf8");
}

function parse(relativePath, source) {
  return ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function framePriorities(relativePath, source) {
  const priorities = [];
  walk(parse(relativePath, source), (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isIdentifier(node.expression) ||
      node.expression.text !== "useFrame"
    ) {
      return;
    }
    const priority = node.arguments[1];
    if (!priority) {
      priorities.push(0);
      return;
    }
    if (ts.isNumericLiteral(priority)) {
      priorities.push(Number(priority.text));
      return;
    }
    if (
      ts.isPrefixUnaryExpression(priority) &&
      priority.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(priority.operand)
    ) {
      priorities.push(-Number(priority.operand.text));
      return;
    }
    priorities.push(Number.NaN);
  });
  return priorities;
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function assertNoCameraWrites(relativePath, source) {
  for (const pattern of [
    /\bcamera\.position\.(?:set|copy|lerp|add|sub)\s*\(/,
    /\bcamera\.quaternion\.(?:set|copy|slerp|multiply)\s*\(/,
    /\bcamera\.fov\s*=/,
    /\bcamera\.lookAt\s*\(/,
    /\bcamera\.updateProjectionMatrix\s*\(/,
  ]) {
    assert.doesNotMatch(
      source,
      pattern,
      `${relativePath} must not write/interpolate the camera`,
    );
  }
}

const sources = Object.fromEntries(
  Object.entries(runtimeFiles).map(([key, relativePath]) => [
    key,
    read(relativePath),
  ]),
);

assertNoCameraWrites(runtimeFiles.stage, sources.stage);
assertNoCameraWrites(runtimeFiles.navigation, sources.navigation);

const compositorPriorities = framePriorities(
  runtimeFiles.compositor,
  sources.compositor,
);
assert.deepEqual(
  compositorPriorities.filter((priority) => priority === -100),
  [-100],
  "PlateCompositor must select plate texture, projection, and camera once at priority -100",
);
assert.equal(
  compositorPriorities.filter((priority) => priority > 0).length,
  1,
  "PlateCompositor must own exactly one positive-priority presenter",
);

const renderCalls = Object.values(sources).reduce(
  (total, source) => total + count(source, /\bgl\.render\s*\(/g),
  0,
);
assert.equal(
  renderCalls,
  1,
  "the Task 3 runtime must call gl.render(scene, camera) exactly once",
);

const renderIndex = sources.compositor.indexOf("gl.render(scene, camera)");
const publishIndex = sources.compositor.indexOf(
  "window.__lazyACompositor = detail",
);
const eventIndex = sources.compositor.indexOf(
  'new CustomEvent("lazy-a:compositor-frame-presented"',
);
assert.ok(renderIndex >= 0, "PlateCompositor presenter must render the scene");
assert.ok(
  publishIndex > renderIndex && eventIndex > publishIndex,
  "compositor diagnostics and event must publish only after gl.render",
);
assert.doesNotMatch(
  sources.compositor,
  /if\s*\(\s*detail\.heroFramePresented\s*>\s*0\s*\)/,
  "every rendered plate frame must dispatch the canonical compositor event",
);
assert.match(
  sources.arrival,
  /addEventListener\(\s*"lazy-a:compositor-frame-presented"/,
  "arrival continuity must bind decoded frames to the post-render compositor event",
);
assert.doesNotMatch(
  sources.arrival,
  /attempts\s*<\s*30/,
  "arrival continuity must not expire camera binding on a fixed startup poll",
);

assert.match(sources.compositor, /renderOrder=\{-1000\}/);
assert.match(sources.compositor, /depthWrite=\{false\}/);
assert.match(sources.compositor, /depthTest=\{false\}/);
assert.match(
  sources.compositor,
  /object-fit:\s*cover/,
  "plate shader must preserve object-fit cover crop",
);
assert.match(
  sources.compositor,
  /texture\.flipY\s*=\s*true/,
  "browser image and video plate textures must preserve upright orientation",
);
assert.match(
  sources.compositor,
  /texture\.colorSpace\s*=\s*NoColorSpace/,
  "plate bytes must bypass implicit texture conversion",
);
assert.match(
  sources.compositor,
  /sRGBTransferEOTF\(texture2D\(plateMap,\s*plateUv\)\)/,
  "plate shader must decode authored sRGB bytes exactly once",
);

assert.doesNotMatch(
  sources.room,
  /<video\b/,
  "PlateRoom must not render visible DOM transition video",
);
assert.doesNotMatch(
  sources.room,
  /<img\b/,
  "the server opening photograph, not PlateRoom, owns the DOM fallback",
);
assert.equal(
  count(sources.stage, /<Canvas\b/g),
  1,
  "Stage must mount exactly one Canvas",
);
assert.match(
  sources.page,
  /<RoomBootstrap\s*\/>[\s\S]*<Stage\s*\/>/,
  "the server-rendered opening photograph must remain below Stage",
);

assert.match(
  sources.film,
  /<video[\s\S]*data-lazy-a-hero=/,
  "HeroFilm must expose one browser-observable hero video",
);
assert.match(
  sources.film,
  /nextTexture\.colorSpace\s*=\s*NoColorSpace/,
  "hero video bytes must bypass implicit texture conversion",
);
assert.equal(
  count(sources.film, /data-lazy-a-hero=/g),
  1,
  "HeroFilm must expose exactly one marked hero source",
);
for (const forbidden of [
  "useFrame",
  "CanvasTexture",
  "BufferGeometry",
  "ShaderMaterial",
  "__lazyAHeroProjection",
  "__lazyAHeroOcclusion",
  "heroOcclusionMask",
  "heroOccluders",
]) {
  assert.ok(
    !sources.film.includes(forbidden),
    `HeroFilm media/lifecycle owner must not contain ${forbidden}`,
  );
}

assert.match(sources.surface, /hero-compositor\.glb/);
assert.match(sources.surface, /hero-room-treatment\.png/);
assert.match(sources.surface, /HeroLiveSurface/);
assert.match(sources.surface, /HeroOccluder_/);
assert.match(sources.surface, /colorWrite:\s*false/);
assert.match(sources.surface, /depthWrite:\s*true/);
assert.match(sources.surface, /depthTest:\s*true/);
assert.match(
  sources.surface,
  /\(texture2D\(roomTreatment,\s*vUv\)\.rgb\s*-\s*0\.5\)\s*\*\s*2\.0/,
);
assert.match(
  sources.surface,
  /sRGBTransferEOTF\(texture2D\(heroMap,\s*vUv\)\)/,
  "hero shader must decode sRGB before applying the linear room transfer",
);
assert.doesNotMatch(sources.surface, /CanvasTexture|atob\(|drawImage\(/);

for (const legacy of [
  "__lazyAHeroOcclusion",
  "heroOcclusionMask",
  "evaluated-mesh-rle-varint",
  "fixed RGB",
]) {
  assert.ok(
    !Object.values(sources).some((source) => source.includes(legacy)),
    `Task 3 runtime must retire ${legacy}`,
  );
}

console.log(
  "Atomic compositor source contract passed: one camera writer, one presenter, DOM media lifecycle, authored depth, and calibrated treatment.",
);
