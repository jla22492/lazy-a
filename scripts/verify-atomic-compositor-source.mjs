/**
 * Source contract for WO 0117-R5 delivered-pixel continuity.
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
  surface: "components/room/PlateHeroComposite.tsx",
  film: "components/room/HeroFilm.tsx",
  room: "components/room/PlateRoom.tsx",
  stage: "three/scene/Stage.tsx",
  navigation: "components/site/AttentionNavigation.tsx",
  assets: "lib/plateAssets.ts",
  page: "app/page.tsx",
  heroState: "three/animation/heroLifecycle.ts",
  arrival: "scripts/verify-arrival-continuity.mjs",
  lifecycle: "scripts/verify-hero-lifecycle.mjs",
  resilience: "scripts/verify-compositor-resilience.mjs",
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
  2,
  "the runtime must render one offscreen coverage pass and one final scene",
);
assert.doesNotMatch(
  sources.surface,
  /\buseFrame\b/,
  "hero resources must run on PlateCompositor's frame scheduler",
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
assert.match(
  sources.film,
  /!videoReady\s*\|\|\s*!surfaceReady/,
  "hero READY must wait for both decoded video and physical surface resources",
);
assert.match(
  sources.film,
  /preload=\{loadReleased\s*\?\s*"auto"\s*:\s*"none"\}/,
  "hero media must remain unfetched until the desk-settle release",
);
assert.match(
  sources.film,
  /arrivalDone\(\)[\s\S]*setLoadReleased\(true\)[\s\S]*video\s*&&\s*loadReleased[\s\S]*video\.load\(\)/,
  "desk settle must explicitly release and decode the deferred hero video",
);
assert.match(
  sources.stage,
  /setHeroReleased\(true\)[\s\S]*heroReleased=\{heroReleased\}/,
  "desk settle must release the deferred plate-space hero resources",
);
assert.doesNotMatch(
  sources.room,
  /preloadDesk/,
  "the desk still must not compete with arrival before settle",
);
assert.match(
  sources.surface,
  /setSurfaceReady\(true\)/,
  "the mounted authored surface must explicitly release hero playback",
);
assert.match(
  sources.heroState,
  /DESK_SETTLED[\s\S]*phase:\s*"starting"[\s\S]*PLAYING[\s\S]*state\.phase\s*===\s*"starting"/,
  "the hero lifecycle must wait in a pre-play presentation phase",
);
assert.match(
  sources.film,
  /HERO_FIRST_FRAME_PRESENTED[\s\S]*video\.play\(\)/,
  "hero playback must wait for the compositor's first-frame presentation",
);
assert.match(
  sources.surface,
  /geometry\.setIndex\(\[0,\s*2,\s*1,\s*0,\s*3,\s*2\]\)/,
  "the clip-space hero quad must preserve front-facing counter-clockwise winding",
);
assert.match(
  sources.compositor,
  /gl\.render\(scene,\s*camera\)[\s\S]*heroPhase\s*===\s*"starting"[\s\S]*presentedFrames\.current\s*>=\s*1[\s\S]*HERO_FIRST_FRAME_PRESENTED/,
  "the first-frame handshake must be dispatched only after the room is rendered",
);
assert.match(
  sources.compositor,
  /profile:\s*frame\.variant[\s\S]*plateSource:/,
  "compositor diagnostics must bind presented profile and plate source",
);
assert.match(
  sources.compositor,
  /activeProfileSize\s*=\s*plateManifest\.variants\[media\.variant\]/,
  "plate crop dimensions must follow active media during breakpoint swaps",
);
assert.match(
  sources.compositor,
  /previous\.asset\.id\s*===\s*compactTransitionId\(state\.transition\)/,
  "in-motion breakpoint swaps must preserve canonical transition progress",
);
assert.match(
  sources.compositor,
  /typeof startTime\s*===\s*"function"\s*\?\s*startTime\(\)\s*:\s*startTime/,
  "replacement media must sample transition progress when it is ready to hand off",
);
assert.doesNotMatch(
  sources.compositor,
  /Math\.max\(\s*media\.mediaTime\.current,\s*media\.video\.currentTime\s*\)/,
  "camera selection must never run ahead of the decoded plate frame",
);
assert.match(
  sources.compositor,
  /requestVideoFrameCallback\(observeFrame\)[\s\S]*new VideoTexture\(video\)/,
  "decoded camera time must register before the video texture presentation callback",
);
assert.match(
  sources.compositor,
  /video\.addEventListener\("error",\s*failed\)/,
  "plate faults must remain observed after loadeddata",
);
assert.match(
  sources.compositor,
  /video\.addEventListener\("abort",\s*failed\)/,
  "plate aborts must remain observed after loadeddata",
);
assert.match(
  sources.compositor,
  /window\.setTimeout\(\s*fail,\s*window\.__heroReferenceTiming\s*\?\s*120_000\s*:\s*2_000,\s*\)/,
  "plate transitions need a two-second visitor fallback and a bounded reference-capture hold",
);
assert.match(
  sources.navigation,
  /compositorFrame\.current\?\.variant\s*!==\s*variant/,
  "navigation must remain inert while a breakpoint profile swap is pending",
);
assert.match(
  sources.lifecycle,
  /verifyCatalogIndependentLifecycle/,
  "one-shot lifecycle behavior must execute without the final pixel catalog",
);
assert.match(
  sources.resilience,
  /verifyDelayedHeroSurface[\s\S]*verifyBreakpointProfileSwap[\s\S]*verifyPostStartMediaFault/,
  "slow surface, breakpoint, and post-start fault paths need behavioral coverage",
);
assert.equal(
  count(sources.film, /data-lazy-a-hero=/g),
  1,
  "HeroFilm must expose exactly one marked hero source",
);
for (const forbidden of [
  "useFrame",
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
assert.match(sources.surface, /treatment\.gain/);
assert.match(sources.surface, /treatment\.offset/);
assert.match(sources.surface, /treatment\.displayLut/);
assert.match(sources.surface, /HeroLiveSurface/);
assert.match(sources.surface, /HeroOccluder_/);
assert.match(
  sources.surface,
  /HeroOccluder_ProductionNavigationSheet_[\s\S]*occluderMatchesProfile[\s\S]*\["wide",\s*"portrait"\]/,
  "profiled navigation coverage must follow the active physical room dressing",
);
assert.match(sources.surface, /colorWrite:\s*false/);
assert.match(sources.surface, /depthWrite:\s*true/);
assert.match(sources.surface, /depthTest:\s*true/);
assert.match(
  sources.surface,
  /hero\.rgb\s*\*\s*gain\s*\+\s*offset/,
  "hero treatment must apply the calibrated scene-linear room response",
);
assert.match(
  sources.surface,
  /blenderDisplayTransform\(hero\.rgb\s*\*\s*gain\s*\+\s*offset\)/,
  "hero treatment must use the Blender-authored display transform",
);
assert.match(
  sources.surface,
  /EXPECTED_OCCLUDERS[\s\S]*missingOccluders[\s\S]*unexpectedOccluders/,
  "hero coverage must fail closed when its authored geometry is incomplete",
);
assert.match(
  sources.surface,
  /mapPlateQuad\([\s\S]*objectPosition\.x[\s\S]*objectPosition\.y/,
  "hero projection must share the plate object-position crop",
);
assert.match(
  sources.surface,
  /mix\(plate,\s*treated,\s*heroCoverage\)/,
  "foreground coverage must preserve exact plate pixels in linear space",
);
assert.match(
  sources.surface,
  /sRGBTransferEOTF\(texture2D\(heroMap,\s*heroUv\)\)/,
  "hero shader must decode sRGB before applying the linear room transfer",
);
assert.doesNotMatch(sources.surface, /CanvasTexture|atob\(|drawImage\(/);

for (const legacy of [
  "__lazyAHeroOcclusion",
  "heroOcclusionMask",
  "evaluated-mesh-rle-varint",
  "fixed RGB",
]) {
  const productionSources = [
    sources.compositor,
    sources.surface,
    sources.film,
    sources.room,
    sources.stage,
    sources.navigation,
    sources.assets,
    sources.page,
  ];
  assert.ok(
    !productionSources.some((source) => source.includes(legacy)),
    `Task 3 runtime must retire ${legacy}`,
  );
}

console.log(
  "Atomic compositor source contract passed: one camera writer, one presenter, plate-space hero, authored MSAA coverage, and Blender-authored display treatment.",
);
