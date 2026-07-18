"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";

import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import {
  DoubleSide,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  ShaderMaterial,
  type BufferGeometry,
} from "three";

import { useHeroMedia } from "@/components/room/HeroFilm";
import { useCompositorFrame } from "@/components/room/PlateCompositor";
import { assetPath } from "@/lib/assetPath";
import { mapPlateQuad } from "@/lib/plateSpace";
import { plateManifest } from "@/three/scene/plateManifest";

const HERO_COMPOSITOR = "/room/hero/hero-compositor.glb";
const HERO_TREATMENT = "/room/hero/hero-room-treatment.png";

const HERO_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HERO_FRAGMENT_SHADER = `
  uniform sampler2D heroMap;
  uniform sampler2D roomTreatment;
  varying vec2 vUv;
  void main() {
    vec4 hero = sRGBTransferEOTF(texture2D(heroMap, vUv));
    vec3 transfer = (texture2D(roomTreatment, vUv).rgb - 0.5) * 2.0;
    vec3 treated = clamp(hero.rgb + transfer, 0.0, 1.0);
    gl_FragColor = vec4(treated, 1.0);
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

interface HeroSurfaceProps {
  released: boolean;
}

const PROFILED_NAVIGATION_PROXY = "HeroOccluder_ProductionNavigationSheet_";

function occluderMatchesProfile(
  name: string,
  profile: "wide" | "portrait" | undefined,
) {
  if (!name.startsWith(PROFILED_NAVIGATION_PROXY)) return true;
  return (
    profile !== undefined && name === `${PROFILED_NAVIGATION_PROXY}${profile}`
  );
}

declare global {
  interface Window {
    __lazyAHeroProjection?: readonly number[];
    __lazyAHeroSurfaceReady?: boolean;
  }
}

/**
 * The impossible image is one authored physical surface. Named foreground
 * proxies write delivery-resolution depth before that surface draws.
 */
function HeroLiveSurface({ surface }: { surface: AuthoredMesh }) {
  const loadedTreatment = useTexture(assetPath(HERO_TREATMENT));
  const { texture, phase, setSurfaceReady } = useHeroMedia();
  const roomTreatment = useMemo(() => {
    const textureClone = loadedTreatment.clone();
    textureClone.colorSpace = NoColorSpace;
    textureClone.flipY = false;
    textureClone.generateMipmaps = false;
    textureClone.minFilter = LinearFilter;
    textureClone.magFilter = LinearFilter;
    textureClone.needsUpdate = true;
    return textureClone;
  }, [loadedTreatment]);
  const surfaceMaterial = useMemo(
    () =>
      texture
        ? new ShaderMaterial({
            uniforms: {
              heroMap: { value: texture },
              roomTreatment: { value: roomTreatment },
            },
            vertexShader: HERO_VERTEX_SHADER,
            fragmentShader: HERO_FRAGMENT_SHADER,
            side: DoubleSide,
            depthWrite: true,
            depthTest: true,
            toneMapped: false,
          })
        : null,
    [roomTreatment, texture],
  );

  useEffect(
    () => () => {
      roomTreatment.dispose();
      surfaceMaterial?.dispose();
    },
    [roomTreatment, surfaceMaterial],
  );

  useEffect(() => {
    if (!surfaceMaterial) return;
    setSurfaceReady(true);
    window.__lazyAHeroSurfaceReady = true;
    return () => {
      setSurfaceReady(false);
      delete window.__lazyAHeroSurfaceReady;
    };
  }, [setSurfaceReady, surfaceMaterial]);

  if (!surfaceMaterial) return null;
  return (
    <mesh
      name="HeroLiveSurface"
      geometry={surface.geometry}
      material={surfaceMaterial}
      matrix={surface.matrix}
      matrixAutoUpdate={false}
      visible={phase === "starting" || phase === "playing" || phase === "held"}
      frustumCulled={false}
      renderOrder={1}
    />
  );
}

export function HeroSurface({ released }: HeroSurfaceProps) {
  const { scene } = useGLTF(assetPath(HERO_COMPOSITOR));
  const compositorFrame = useCompositorFrame();
  const occluderMeshes = useRef(new Map<string, Mesh>());
  const authored = useMemo<AuthoredHero>(() => {
    const cloned = scene.clone(true);
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
    if (!surface || occluders.length === 0) {
      throw new Error("hero-compositor.glb is missing authored hero geometry");
    }
    const heroSurface = surface as AuthoredMesh;
    return {
      surface: heroSurface,
      occluders,
    };
  }, [scene]);
  const occluderMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        colorWrite: false,
        depthWrite: true,
        depthTest: true,
      }),
    [],
  );

  useEffect(
    () => () => {
      occluderMaterial.dispose();
      delete window.__lazyAHeroProjection;
    },
    [occluderMaterial],
  );

  useFrame(({ size }) => {
    const frame = compositorFrame.current;
    for (const [name, mesh] of occluderMeshes.current) {
      mesh.visible = occluderMatchesProfile(name, frame?.variant);
    }
    const hero = frame?.projection.hero;
    if (!hero) {
      window.__lazyAHeroProjection = undefined;
      return;
    }
    const profile = plateManifest.variants[frame.variant];
    const mapped = mapPlateQuad(
      hero,
      { width: profile.width, height: profile.height },
      size,
    );
    window.__lazyAHeroProjection = [0, 1, 2, 3].flatMap((index) => [
      mapped[index * 2] / size.width,
      mapped[index * 2 + 1] / size.height,
    ]);
  }, -50);

  return (
    <>
      {authored.occluders.map((occluder) => (
        <mesh
          key={occluder.name}
          name={occluder.name}
          ref={(mesh) => {
            if (mesh) {
              occluderMeshes.current.set(occluder.name, mesh);
            } else {
              occluderMeshes.current.delete(occluder.name);
            }
          }}
          geometry={occluder.geometry}
          material={occluderMaterial}
          matrix={occluder.matrix}
          matrixAutoUpdate={false}
          visible={false}
          frustumCulled={false}
          renderOrder={0}
        />
      ))}
      {released && (
        <Suspense fallback={null}>
          <HeroLiveSurface surface={authored.surface} />
        </Suspense>
      )}
    </>
  );
}
