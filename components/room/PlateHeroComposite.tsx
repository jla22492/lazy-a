"use client";

import { useEffect, useMemo, useRef } from "react";

import { useGLTF, useTexture } from "@react-three/drei";
import {
  BufferGeometry,
  type Camera,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PerspectiveCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type BufferAttribute,
  type Texture,
  type WebGLRenderer,
} from "three";

import { useHeroMedia } from "@/components/room/HeroFilm";
import { assetPath } from "@/lib/assetPath";
import { mapPlateQuad } from "@/lib/plateSpace";
import type { PlateProjectionFrame, PlateVariant } from "@/lib/plateAssets";
import { plateManifest } from "@/three/scene/plateManifest";

const HERO_COMPOSITOR = "/room/hero/hero-compositor.glb";
const PROFILED_NAVIGATION_PROXY = "HeroOccluder_ProductionNavigationSheet_";
const EXPECTED_OCCLUDERS = new Set([
  ...plateManifest.hero.geometry.occluders
    .filter((name) => name !== "ProductionNavigationSheet")
    .map((name) => `HeroOccluder_${name}`),
  `${PROFILED_NAVIGATION_PROXY}wide`,
  `${PROFILED_NAVIGATION_PROXY}portrait`,
]);

const HERO_VERTEX_SHADER = `
  attribute vec3 heroUvQ;
  varying vec3 vHeroUvQ;

  void main() {
    vHeroUvQ = heroUvQ;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const HERO_FRAGMENT_SHADER = `
  uniform sampler2D heroMap;
  uniform sampler2D heroGain;
  uniform sampler2D heroOffset;
  uniform sampler2D displayLut;
  uniform sampler2D foregroundCoverage;
  uniform sampler2D plateMap;
  uniform float gainRange;
  uniform float offsetRange;
  uniform float displayLutSize;
  uniform vec2 sourceSize;
  uniform vec2 viewportSize;
  uniform vec2 objectPosition;
  varying vec3 vHeroUvQ;

  vec2 plateUvAt(vec2 screenUv) {
    float coverScale = max(
      viewportSize.x / sourceSize.x,
      viewportSize.y / sourceSize.y
    );
    vec2 visibleSource = viewportSize / coverScale;
    vec2 cropOrigin = (sourceSize - visibleSource) * objectPosition;
    return (cropOrigin + screenUv * visibleSource) / sourceSize;
  }

  vec3 blenderDisplayTransform(vec3 color) {
    float maximumIndex = displayLutSize - 1.0;
    vec3 scaled = clamp(color, 0.0, 1.0) * maximumIndex;
    float blueLow = floor(scaled.b);
    float blueHigh = min(blueLow + 1.0, maximumIndex);
    vec2 lowUv = vec2(
      (scaled.r + blueLow * displayLutSize + 0.5) /
        (displayLutSize * displayLutSize),
      1.0 - (scaled.g + 0.5) / displayLutSize
    );
    vec2 highUv = vec2(
      (scaled.r + blueHigh * displayLutSize + 0.5) /
        (displayLutSize * displayLutSize),
      lowUv.y
    );
    vec3 encoded = mix(
      texture2D(displayLut, lowUv).rgb,
      texture2D(displayLut, highUv).rgb,
      fract(scaled.b)
    );
    return sRGBTransferEOTF(vec4(encoded, 1.0)).rgb;
  }

  void main() {
    vec2 heroUv = vHeroUvQ.xy / vHeroUvQ.z;
    vec4 hero = sRGBTransferEOTF(texture2D(heroMap, heroUv));
    vec3 gain = texture2D(heroGain, heroUv).rgb * gainRange;
    vec3 offset = texture2D(heroOffset, heroUv).rgb * offsetRange;
    vec3 treated = blenderDisplayTransform(hero.rgb * gain + offset);
    vec2 screenUv = gl_FragCoord.xy / viewportSize;
    vec2 plateUv = plateUvAt(screenUv);
    vec3 plate = sRGBTransferEOTF(texture2D(plateMap, plateUv)).rgb;
    float foreground = texture2D(foregroundCoverage, plateUv).r;
    float heroCoverage = 1.0 - foreground;
    gl_FragColor = vec4(mix(plate, treated, heroCoverage), 1.0);
    #include <colorspace_fragment>
  }
`;

interface AuthoredMesh {
  name: string;
  geometry: BufferGeometry;
  matrix: Matrix4;
}

interface AuthoredHero {
  surface: AuthoredMesh;
  occluders: readonly AuthoredMesh[];
}

export interface PlateHeroFrame {
  gl: WebGLRenderer;
  camera: Camera;
  size: { width: number; height: number };
  projection: PlateProjectionFrame;
  variant: PlateVariant;
  plateTexture: Texture;
  objectPosition: Vector2;
}

export interface PlateHeroController {
  prepareFrame: (frame: PlateHeroFrame) => void;
  clear: () => void;
}

interface PlateHeroCompositeProps {
  registerController: (controller: PlateHeroController | null) => void;
}

declare global {
  interface Window {
    __lazyAHeroProjection?: readonly number[];
    __lazyAHeroSurfaceReady?: boolean;
  }
}

function prepareDataTexture(texture: Texture): Texture {
  const prepared = texture.clone();
  prepared.colorSpace = NoColorSpace;
  prepared.flipY = false;
  prepared.generateMipmaps = false;
  prepared.minFilter = LinearFilter;
  prepared.magFilter = LinearFilter;
  prepared.needsUpdate = true;
  return prepared;
}

function occluderMatchesProfile(
  name: string,
  profile: "wide" | "portrait" | undefined,
): boolean {
  if (!name.startsWith(PROFILED_NAVIGATION_PROXY)) return true;
  return (
    profile !== undefined && name === `${PROFILED_NAVIGATION_PROXY}${profile}`
  );
}

function createHeroGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array(12), 3),
  );
  geometry.setAttribute(
    "heroUvQ",
    new Float32BufferAttribute(new Float32Array(12), 3),
  );
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  return geometry;
}

function createMaskScenes(authored: AuthoredHero) {
  const surfaceMaterial = new MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    side: DoubleSide,
    toneMapped: false,
  });
  const occluderMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    toneMapped: false,
  });
  const scenes = Object.fromEntries(
    (["wide", "portrait"] as const).map((profile) => {
      const scene = new Scene();
      const surface = new Mesh(authored.surface.geometry, surfaceMaterial);
      surface.name = authored.surface.name;
      surface.matrix.copy(authored.surface.matrix);
      surface.matrixAutoUpdate = false;
      surface.frustumCulled = false;
      surface.renderOrder = 0;
      scene.add(surface);
      for (const descriptor of authored.occluders) {
        if (!occluderMatchesProfile(descriptor.name, profile)) continue;
        const mesh = new Mesh(descriptor.geometry, occluderMaterial);
        mesh.name = descriptor.name;
        mesh.matrix.copy(descriptor.matrix);
        mesh.matrixAutoUpdate = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        scene.add(mesh);
      }
      scene.updateMatrixWorld(true);
      return [profile, scene];
    }),
  ) as Record<"wide" | "portrait", Scene>;
  return { scenes, surfaceMaterial, occluderMaterial };
}

function phaseIsVisible(phase: string): boolean {
  return phase === "starting" || phase === "playing" || phase === "held";
}

/**
 * The visitor-facing image is drawn in the exact plate projection. Authored
 * world geometry survives only in an offscreen coverage pass that preserves
 * the photographed card, pencils, and their delivery-resolution edge pixels.
 */
export function PlateHeroComposite({
  registerController,
}: PlateHeroCompositeProps) {
  const { scene: loadedScene } = useGLTF(assetPath(HERO_COMPOSITOR));
  const [loadedGain, loadedOffset, loadedDisplayLut] = useTexture([
    assetPath(plateManifest.hero.treatment.gain),
    assetPath(plateManifest.hero.treatment.offset),
    assetPath(plateManifest.hero.treatment.displayLut),
  ]);
  const { texture, phase, setSurfaceReady } = useHeroMedia();
  const heroMeshRef = useRef<Mesh>(null);
  const drawBufferSize = useMemo(() => new Vector2(), []);
  const savedClearColor = useMemo(() => new Color(), []);
  const maskCamera = useMemo(() => new PerspectiveCamera(), []);
  const targetState = useRef({ width: 0, height: 0, samples: 0 });

  const authored = useMemo<AuthoredHero>(() => {
    const cloned = loadedScene.clone(true);
    cloned.updateMatrixWorld(true);
    let surface: AuthoredMesh | null = null;
    const occluders: AuthoredMesh[] = [];
    cloned.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const descriptor = {
        name: object.name,
        geometry: object.geometry,
        matrix: object.matrixWorld.clone(),
      };
      if (object.name === "HeroLiveSurface") {
        surface = descriptor;
      } else if (object.name.startsWith("HeroOccluder_")) {
        occluders.push(descriptor);
      }
    });
    const foundOccluders = new Set(
      occluders.map((descriptor) => descriptor.name),
    );
    const missingOccluders = [...EXPECTED_OCCLUDERS].filter(
      (name) => !foundOccluders.has(name),
    );
    const unexpectedOccluders = [...foundOccluders].filter(
      (name) => !EXPECTED_OCCLUDERS.has(name),
    );
    if (
      !surface ||
      missingOccluders.length > 0 ||
      unexpectedOccluders.length > 0
    ) {
      throw new Error(
        [
          "hero-compositor.glb does not match the authored geometry contract",
          missingOccluders.length
            ? `missing: ${missingOccluders.join(", ")}`
            : "",
          unexpectedOccluders.length
            ? `unexpected: ${unexpectedOccluders.join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("; "),
      );
    }
    return { surface, occluders };
  }, [loadedScene]);

  const heroGain = useMemo(() => prepareDataTexture(loadedGain), [loadedGain]);
  const heroOffset = useMemo(
    () => prepareDataTexture(loadedOffset),
    [loadedOffset],
  );
  const displayLut = useMemo(
    () => prepareDataTexture(loadedDisplayLut),
    [loadedDisplayLut],
  );
  const maskTarget = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, {
      format: RGBAFormat,
      type: UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: false,
    });
    target.samples = 4;
    target.resolveDepthBuffer = false;
    target.texture.colorSpace = NoColorSpace;
    return target;
  }, []);
  const heroGeometry = useMemo(() => createHeroGeometry(), []);
  const maskScenes = useMemo(() => createMaskScenes(authored), [authored]);

  const heroMaterial = useMemo(
    () =>
      texture
        ? new ShaderMaterial({
            uniforms: {
              heroMap: { value: texture },
              heroGain: { value: heroGain },
              heroOffset: { value: heroOffset },
              displayLut: { value: displayLut },
              foregroundCoverage: { value: maskTarget.texture },
              plateMap: { value: null as Texture | null },
              gainRange: { value: plateManifest.hero.treatment.gainRange },
              offsetRange: {
                value: plateManifest.hero.treatment.offsetRange,
              },
              displayLutSize: {
                value: plateManifest.hero.treatment.displayLutSize,
              },
              sourceSize: { value: new Vector2(1, 1) },
              viewportSize: { value: new Vector2(1, 1) },
              objectPosition: { value: new Vector2(0.5, 0.5) },
            },
            vertexShader: HERO_VERTEX_SHADER,
            fragmentShader: HERO_FRAGMENT_SHADER,
            transparent: false,
            depthWrite: false,
            depthTest: false,
            toneMapped: false,
          })
        : null,
    [displayLut, heroGain, heroOffset, maskTarget.texture, texture],
  );

  useEffect(() => {
    if (!heroMaterial) return;
    setSurfaceReady(true);
    window.__lazyAHeroSurfaceReady = true;
    return () => {
      setSurfaceReady(false);
      delete window.__lazyAHeroSurfaceReady;
    };
  }, [heroMaterial, setSurfaceReady]);

  useEffect(
    () => () => {
      heroGeometry.dispose();
      heroGain.dispose();
      heroOffset.dispose();
      displayLut.dispose();
      heroMaterial?.dispose();
      maskTarget.dispose();
      maskScenes.surfaceMaterial.dispose();
      maskScenes.occluderMaterial.dispose();
      delete window.__lazyAHeroProjection;
    },
    [
      displayLut,
      heroGain,
      heroGeometry,
      heroMaterial,
      heroOffset,
      maskScenes,
      maskTarget,
    ],
  );

  useEffect(() => {
    if (!heroMaterial) {
      registerController(null);
      return;
    }
    const controller: PlateHeroController = {
      clear() {
        if (heroMeshRef.current) heroMeshRef.current.visible = false;
        window.__lazyAHeroProjection = undefined;
      },
      prepareFrame({
        gl,
        camera,
        size,
        projection,
        variant,
        plateTexture,
        objectPosition,
      }) {
        const mesh = heroMeshRef.current;
        const hero = projection.hero;
        const reciprocalW = projection.heroReciprocalW;
        if (!mesh || !hero || !reciprocalW) {
          if (mesh) mesh.visible = false;
          window.__lazyAHeroProjection = undefined;
          return;
        }

        const profile = plateManifest.variants[variant];
        const mapped = mapPlateQuad(
          hero,
          { width: profile.width, height: profile.height },
          size,
          { x: objectPosition.x, y: objectPosition.y },
        );
        const positions = heroGeometry.getAttribute(
          "position",
        ) as BufferAttribute;
        const heroUvQ = heroGeometry.getAttribute("heroUvQ") as BufferAttribute;
        const uv = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ] as const;
        for (let index = 0; index < 4; index += 1) {
          const x = (mapped[index * 2] / size.width) * 2 - 1;
          const y = 1 - (mapped[index * 2 + 1] / size.height) * 2;
          const q = reciprocalW[index];
          positions.setXYZ(index, x, y, 0);
          heroUvQ.setXYZ(index, uv[index][0] * q, uv[index][1] * q, q);
        }
        positions.needsUpdate = true;
        heroUvQ.needsUpdate = true;
        heroGeometry.computeBoundingSphere();

        gl.getDrawingBufferSize(drawBufferSize);
        const samples = Math.min(4, gl.capabilities.maxSamples);
        if (
          targetState.current.width !== profile.width ||
          targetState.current.height !== profile.height ||
          targetState.current.samples !== samples
        ) {
          maskTarget.samples = samples;
          maskTarget.setSize(profile.width, profile.height);
          targetState.current = {
            width: profile.width,
            height: profile.height,
            samples,
          };
        }
        heroMaterial.uniforms.plateMap.value = plateTexture;
        heroMaterial.uniforms.sourceSize.value.set(
          profile.width,
          profile.height,
        );
        heroMaterial.uniforms.viewportSize.value.copy(drawBufferSize);
        heroMaterial.uniforms.objectPosition.value.copy(objectPosition);

        maskCamera.position.copy(camera.position);
        maskCamera.quaternion.copy(camera.quaternion);
        maskCamera.near =
          camera instanceof PerspectiveCamera ? camera.near : 0.1;
        maskCamera.far = camera instanceof PerspectiveCamera ? camera.far : 200;
        maskCamera.fov =
          camera instanceof PerspectiveCamera ? camera.fov : profile.fov;
        maskCamera.aspect = profile.width / profile.height;
        maskCamera.updateProjectionMatrix();
        maskCamera.updateMatrixWorld(true);

        const previousTarget = gl.getRenderTarget();
        const previousAlpha = gl.getClearAlpha();
        gl.getClearColor(savedClearColor);
        gl.setRenderTarget(maskTarget);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, true);
        gl.render(maskScenes.scenes[variant], maskCamera);
        gl.setRenderTarget(previousTarget);
        gl.setClearColor(savedClearColor, previousAlpha);

        mesh.visible = phaseIsVisible(phase);
        window.__lazyAHeroProjection = [0, 1, 2, 3].flatMap((index) => [
          mapped[index * 2] / size.width,
          mapped[index * 2 + 1] / size.height,
        ]);
      },
    };
    registerController(controller);
    return () => registerController(null);
  }, [
    drawBufferSize,
    heroGeometry,
    heroMaterial,
    maskCamera,
    maskScenes,
    maskTarget,
    phase,
    registerController,
    savedClearColor,
  ]);

  if (!heroMaterial) return null;
  return (
    <mesh
      ref={heroMeshRef}
      name="PlateHeroComposite"
      geometry={heroGeometry}
      material={heroMaterial}
      frustumCulled={false}
      renderOrder={-900}
      visible={false}
    />
  );
}
