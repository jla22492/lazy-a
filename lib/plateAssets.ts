"use client";

import { assetPath } from "@/lib/assetPath";

declare global {
  interface Window {
    __lazyAPlateProjection?: PlateProjectionFrame;
  }
}

export type PlateVariant = "wide" | "portrait";
export type PlateEndpointId =
  "opening" | "desk" | "films" | "journal" | "contact" | "about";
export type PlateDestinationId = Exclude<PlateEndpointId, "opening" | "desk">;

export interface PlateExperienceState {
  endpoint: PlateEndpointId;
  requested: PlateDestinationId | null;
  transition: string | null;
  phase: "opening" | "transitioning" | "resting";
}

export interface PlateCameraSample {
  position: readonly [number, number, number];
  quaternion: readonly [number, number, number, number];
  fov: number;
}

export interface PlateProjectionFrame {
  camera: PlateCameraSample;
  hero:
    | readonly [number, number, number, number, number, number, number, number]
    | null;
  heroReciprocalW: readonly [number, number, number, number] | null;
  lampLevel: number;
  visibleBulbLevel: number;
  revealLevel: number;
  contactIndentDepth: number;
}

export interface PlateAsset {
  id: string;
  src: string;
  kind: "image" | "video";
  poster?: string;
  durationSeconds?: number;
  fps?: number;
  objectPosition?: string;
  projection?: PlateProjectionFrame;
  projectionFrames?: readonly PlateProjectionFrame[];
}

export interface PlateProfile {
  objectPosition: string;
  endpoints: Record<PlateEndpointId, PlateAsset>;
  transitions: Readonly<Record<string, PlateAsset>>;
}

export interface PlateManifestAdapter {
  profiles: Record<PlateVariant, PlateProfile>;
}

const ENDPOINTS: readonly PlateEndpointId[] = [
  "opening",
  "desk",
  "films",
  "journal",
  "contact",
  "about",
];

const DESTINATIONS: readonly PlateDestinationId[] = [
  "films",
  "journal",
  "contact",
  "about",
];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function firstRecord(...values: unknown[]): UnknownRecord | undefined {
  return values.find(isRecord) as UnknownRecord | undefined;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function publicAssetUrl(src: string): string {
  if (!src.startsWith("/") || src.startsWith("/_next/")) return src;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (basePath && src.startsWith(`${basePath}/`)) return src;
  return assetPath(src);
}

function mediaKind(src: string, hint?: unknown): PlateAsset["kind"] {
  if (hint === "video" || hint === "image") return hint;
  return /\.(?:mp4|webm|mov)(?:[?#]|$)/i.test(src) ? "video" : "image";
}

function cameraSample(value: unknown): PlateCameraSample | undefined {
  if (!isRecord(value)) return undefined;
  const position = value.position;
  const quaternion = value.quaternion;
  const fov = value.fov;
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every((item) => typeof item === "number") ||
    !Array.isArray(quaternion) ||
    quaternion.length !== 4 ||
    !quaternion.every((item) => typeof item === "number") ||
    typeof fov !== "number"
  ) {
    return undefined;
  }
  return {
    position: position as unknown as readonly [number, number, number],
    quaternion: quaternion as unknown as readonly [
      number,
      number,
      number,
      number,
    ],
    fov,
  };
}

function projectionFrame(value: unknown): PlateProjectionFrame | undefined {
  if (!isRecord(value)) return undefined;
  const camera = cameraSample(value.camera);
  if (!camera) return undefined;
  const hero = value.hero;
  const heroReciprocalW = value.heroReciprocalW;
  return {
    camera,
    hero:
      hero === null ||
      (Array.isArray(hero) &&
        hero.length === 8 &&
        hero.every((item) => typeof item === "number"))
        ? (hero as PlateProjectionFrame["hero"])
        : null,
    heroReciprocalW:
      hero === null
        ? null
        : Array.isArray(heroReciprocalW) &&
            heroReciprocalW.length === 4 &&
            heroReciprocalW.every(
              (item) =>
                typeof item === "number" && Number.isFinite(item) && item > 0,
            )
          ? (heroReciprocalW as unknown as readonly [
              number,
              number,
              number,
              number,
            ])
          : null,
    lampLevel: typeof value.lampLevel === "number" ? value.lampLevel : 0,
    visibleBulbLevel:
      typeof value.visibleBulbLevel === "number" ? value.visibleBulbLevel : 0,
    revealLevel: typeof value.revealLevel === "number" ? value.revealLevel : 0,
    contactIndentDepth:
      typeof value.contactIndentDepth === "number"
        ? value.contactIndentDepth
        : 0,
  };
}

function plateAsset(
  id: string,
  value: unknown,
  preferred: "endpoint" | "transition",
  profileObjectPosition: string,
): PlateAsset | undefined {
  if (typeof value === "string") {
    return {
      id,
      src: publicAssetUrl(value),
      kind: mediaKind(value),
    };
  }
  if (!isRecord(value)) return undefined;

  const src =
    preferred === "transition"
      ? firstString(
          value.forward,
          value.video,
          value.clip,
          value.media,
          value.src,
          value.url,
        )
      : firstString(
          value.still,
          value.image,
          value.src,
          value.url,
          value.poster,
        );
  if (!src) return undefined;

  const rawFrames = Array.isArray(value.projectionFrames)
    ? value.projectionFrames
    : Array.isArray(value.frames)
      ? value.frames
      : [];
  const projectionFrames = rawFrames
    .map(projectionFrame)
    .filter((frame): frame is PlateProjectionFrame => Boolean(frame));

  return {
    id,
    src: publicAssetUrl(src),
    kind: mediaKind(src, value.kind ?? value.type),
    poster: firstString(value.poster)
      ? publicAssetUrl(String(value.poster))
      : undefined,
    durationSeconds:
      typeof value.durationSeconds === "number"
        ? value.durationSeconds
        : typeof value.duration === "number"
          ? value.duration
          : undefined,
    fps: typeof value.fps === "number" ? value.fps : undefined,
    objectPosition: firstString(value.objectPosition, profileObjectPosition),
    projection: projectionFrame(value.projection ?? value.frame),
    projectionFrames:
      projectionFrames.length > 0 ? projectionFrames : undefined,
  };
}

function fallbackEndpoint(
  variant: PlateVariant,
  endpoint: PlateEndpointId,
): PlateAsset {
  return {
    id: `${variant}-${endpoint}`,
    // The emergency photograph must come from the same current-lamp master
    // as every authored endpoint; using the historic 0114 still caused an
    // obsolete-lamp flash while the generated manifest was loading.
    src: publicAssetUrl(`/room/${variant}/stills/opening.jpg`),
    kind: "image",
    objectPosition: variant === "portrait" ? "52% 50%" : "50% 50%",
  };
}

function fallbackProfile(variant: PlateVariant): PlateProfile {
  return {
    objectPosition: variant === "portrait" ? "52% 50%" : "50% 50%",
    endpoints: Object.fromEntries(
      ENDPOINTS.map((endpoint) => [
        endpoint,
        fallbackEndpoint(variant, endpoint),
      ]),
    ) as unknown as Record<PlateEndpointId, PlateAsset>,
    transitions: {},
  };
}

export const FALLBACK_PLATE_MANIFEST: PlateManifestAdapter = {
  profiles: {
    wide: fallbackProfile("wide"),
    portrait: fallbackProfile("portrait"),
  },
};

function profileSource(
  manifest: UnknownRecord,
  variant: PlateVariant,
): unknown {
  const profiles = firstRecord(manifest.profiles, manifest.variants);
  return profiles?.[variant] ?? manifest[variant];
}

function transitionEntries(value: unknown): ReadonlyArray<[string, unknown]> {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      if (!isRecord(item)) return [];
      const id = firstString(item.id, item.name, item.transition);
      return [[id ?? `transition-${index}`, item]];
    });
  }
  return isRecord(value) ? Object.entries(value) : [];
}

/**
 * The generated manifest is intentionally normalized at one boundary. The
 * Blender/export worker can use `profiles` or `variants`, and can represent
 * assets as paths or records, without leaking that shape into the room.
 */
export function adaptPlateManifest(input: unknown): PlateManifestAdapter {
  const exported = isRecord(input)
    ? (input.plateManifest ?? input.PLATE_MANIFEST ?? input.default ?? input)
    : input;
  if (!isRecord(exported)) return FALLBACK_PLATE_MANIFEST;

  const profiles = {} as Record<PlateVariant, PlateProfile>;
  for (const variant of ["wide", "portrait"] as const) {
    const fallback = FALLBACK_PLATE_MANIFEST.profiles[variant];
    const rawProfile = profileSource(exported, variant);
    const profile = isRecord(rawProfile) ? rawProfile : {};
    const profileObjectPosition =
      firstString(profile.objectPosition) ?? fallback.objectPosition;
    const rawEndpoints = firstRecord(
      profile.endpoints,
      profile.stills,
      profile,
    );
    const endpoints = {} as Record<PlateEndpointId, PlateAsset>;
    for (const endpoint of ENDPOINTS) {
      endpoints[endpoint] =
        plateAsset(
          `${variant}-${endpoint}`,
          rawEndpoints?.[endpoint],
          "endpoint",
          profileObjectPosition,
        ) ?? fallback.endpoints[endpoint];
    }

    const transitions: Record<string, PlateAsset> = {};
    for (const [id, value] of transitionEntries(
      profile.transitions ?? exported.transitions,
    )) {
      const asset = plateAsset(id, value, "transition", profileObjectPosition);
      if (!asset) continue;
      transitions[id] = asset;

      // Browsers do not support dependable negative video playback. The
      // exporter therefore packages a real reversed clip beside every
      // forward transition; expose it under the reducer's destination-desk id.
      if (isRecord(value) && isRecord(value.reverse)) {
        const reverseSource = firstString(
          value.reverse.source,
          value.reverse.video,
          value.reverse.src,
        );
        const from = firstString(value.reverse.from, value.to);
        const to = firstString(value.reverse.to, value.from);
        if (reverseSource && from && to) {
          const reverseId = `${from}-${to}`;
          transitions[reverseId] = {
            ...asset,
            id: reverseId,
            src: publicAssetUrl(reverseSource),
            projectionFrames: asset.projectionFrames
              ? [...asset.projectionFrames].reverse()
              : undefined,
          };
        }
      }
    }
    profiles[variant] = {
      objectPosition: profileObjectPosition,
      endpoints,
      transitions,
    };
  }
  return { profiles };
}

export function endpointAsset(
  manifest: PlateManifestAdapter,
  variant: PlateVariant,
  endpoint: PlateEndpointId,
): PlateAsset {
  return manifest.profiles[variant].endpoints[endpoint];
}

export function transitionAsset(
  manifest: PlateManifestAdapter,
  variant: PlateVariant,
  transition: string | null,
): PlateAsset | undefined {
  if (!transition) return undefined;
  const transitions = manifest.profiles[variant].transitions;
  const compact = transition.replace(/-to-/g, "-");
  return (
    transitions[transition] ??
    transitions[compact] ??
    transitions[transition.replace(/-/g, "_")] ??
    Object.values(transitions).find((asset) =>
      [asset.id, asset.src].some((value) =>
        value.toLowerCase().includes(compact.toLowerCase()),
      ),
    )
  );
}

const preloadCache = new Map<string, Promise<PlateAsset>>();

function loadImage(asset: PlateAsset): Promise<PlateAsset> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(asset);
    image.onerror = () => reject(new Error(`Plate image failed: ${asset.id}`));
    image.decoding = "async";
    image.src = asset.src;
  });
}

function loadVideo(asset: PlateAsset): Promise<PlateAsset> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const cleanup = () => {
      video.removeEventListener("loadeddata", loaded);
      video.removeEventListener("error", failed);
    };
    const loaded = () => {
      cleanup();
      resolve(asset);
    };
    const failed = () => {
      cleanup();
      reject(new Error(`Plate video failed: ${asset.id}`));
    };
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadeddata", loaded, { once: true });
    video.addEventListener("error", failed, { once: true });
    video.src = asset.src;
    video.load();
  });
}

export function preloadPlateAsset(asset: PlateAsset): Promise<PlateAsset> {
  const cached = preloadCache.get(asset.src);
  if (cached) return cached;
  const pending = asset.kind === "video" ? loadVideo(asset) : loadImage(asset);
  preloadCache.set(asset.src, pending);
  pending.catch(() => preloadCache.delete(asset.src));
  return pending;
}

export function preloadOpening(
  manifest: PlateManifestAdapter,
  variant: PlateVariant,
): Promise<PlateAsset> {
  return preloadPlateAsset(endpointAsset(manifest, variant, "opening"));
}

export function preloadDesk(
  manifest: PlateManifestAdapter,
  variant: PlateVariant,
): Promise<PlateAsset> {
  return preloadPlateAsset(endpointAsset(manifest, variant, "desk"));
}

export function preloadDestinations(
  manifest: PlateManifestAdapter,
  variant: PlateVariant,
): Promise<PromiseSettledResult<PlateAsset>[]> {
  const profile = manifest.profiles[variant];
  return Promise.allSettled(
    DESTINATIONS.map((destination) =>
      preloadPlateAsset(profile.endpoints[destination]),
    ),
  );
}

export function preloadDestination(
  manifest: PlateManifestAdapter,
  variant: PlateVariant,
  destination: PlateDestinationId,
): Promise<PromiseSettledResult<PlateAsset>[]> {
  const profile = manifest.profiles[variant];
  const transition = transitionAsset(
    manifest,
    variant,
    `desk-${destination}`,
  );
  return Promise.allSettled([
    preloadPlateAsset(profile.endpoints[destination]),
    ...(transition ? [preloadPlateAsset(transition)] : []),
  ]);
}

let activeProjection: PlateProjectionFrame | null = null;

export function publishPlateProjection(
  projection: PlateProjectionFrame | undefined,
): void {
  if (!projection) return;
  activeProjection = projection;
  if (typeof window !== "undefined") {
    window.__lazyAPlateProjection = projection;
  }
}

export function getPlateProjection(): PlateProjectionFrame | null {
  return activeProjection;
}
