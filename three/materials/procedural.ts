/**
 * Procedural material textures (WORK ORDER 0041) — texture as storytelling.
 *
 * Every surface here is authored in code: deterministic (seeded), tuned by
 * parameters that speak the production-design language (age, wear, tone)
 * rather than rendering language. The goal is never "realistic wood" — it
 * is "someone has worked on this surface for years."
 *
 * Rooms are written in layers of time: an object's `arrived` answer in the
 * dressing manifest decides how much history its surface carries. What
 * arrived years ago wears; what arrived this morning doesn't.
 *
 * Textures are generated on a 2D canvas at runtime (client only — these
 * functions run inside the R3F tree, which never executes during SSR).
 */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

/** Deterministic PRNG — captures must render identically on every load. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas unavailable");
  return context;
}

function toTexture(context: CanvasRenderingContext2D): CanvasTexture {
  const texture = new CanvasTexture(context.canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Hex color to [r, g, b]. */
function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function style(color: [number, number, number], alpha: number): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

export interface WoodParams {
  seed: number;
  /** Base plank color. */
  base: string;
  /** Darker grain streak color. */
  grain: string;
  /** 0..1 — how many years of work the surface carries. */
  age: number;
  /** Grain runs along U (the geometry's long axis maps to U). */
  size?: number;
  /**
   * Worked regions in UV space: wear (scuffs, lightened sheen, scratches)
   * concentrates here — the bench's active zone, a chair's seat edge.
   */
  wearSpots?: ReadonlyArray<{ u: number; v: number; r: number }>;
  /** Ghosts of old mugs: faint rings at these UV spots. */
  rings?: ReadonlyArray<{ u: number; v: number; r: number }>;
  /**
   * Halos (WORK ORDER 0050): the darker, un-sunned disc under an object
   * that never moves — the shadow of a habit. UV space.
   */
  halos?: ReadonlyArray<{ u: number; v: number; r: number }>;
}

/**
 * Wood that has been worked on: long grain, tonal plank variation, and —
 * with age — scuffs, faint rings, and scratches where the work happens.
 */
export function woodTexture(params: WoodParams): CanvasTexture {
  const size = params.size ?? 1024;
  const random = seededRandom(params.seed);
  const context = makeCanvas(size, size);
  const base = rgb(params.base);
  const grain = rgb(params.grain);

  context.fillStyle = style(base, 1);
  context.fillRect(0, 0, size, size);

  /* Plank bands across V — subtle tonal disagreement between boards. */
  const plankCount = 5 + Math.floor(random() * 3);
  const plankHeight = size / plankCount;
  for (let plank = 0; plank < plankCount; plank++) {
    const shift = (random() - 0.5) * 22;
    context.fillStyle = `rgba(${base[0] + shift}, ${base[1] + shift}, ${
      base[2] + shift
    }, 0.55)`;
    context.fillRect(0, plank * plankHeight, size, plankHeight);
    /* Board seam. */
    context.fillStyle = style(grain, 0.35);
    context.fillRect(0, plank * plankHeight, size, 1.5);
  }

  /* Grain: long horizontal streaks, wavering slightly. */
  const streaks = 260;
  for (let index = 0; index < streaks; index++) {
    const y = random() * size;
    const length = size * (0.2 + random() * 0.8);
    const x = random() * size;
    const alpha = 0.06 + random() * 0.16;
    const wobble = (random() - 0.5) * 3;
    context.strokeStyle = style(random() < 0.85 ? grain : base, alpha);
    context.lineWidth = 0.6 + random() * 1.6;
    context.beginPath();
    context.moveTo(x - length / 2, y);
    context.quadraticCurveTo(x, y + wobble, x + length / 2, y);
    context.stroke();
  }

  /* Sparse knots. */
  const knots = 2 + Math.floor(random() * 3);
  for (let index = 0; index < knots; index++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 4 + random() * 9;
    const gradient = context.createRadialGradient(x, y, 1, x, y, radius);
    gradient.addColorStop(0, style(grain, 0.5));
    gradient.addColorStop(1, style(grain, 0));
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  /* Layers of time. */
  const age = params.age;
  if (age > 0) {
    /* Wear spots: worked regions lighten and scratch. */
    for (const spot of params.wearSpots ?? []) {
      const cx = spot.u * size;
      const cy = spot.v * size;
      const radius = spot.r * size;
      const gradient = context.createRadialGradient(cx, cy, 1, cx, cy, radius);
      gradient.addColorStop(0, `rgba(255, 250, 240, ${0.16 * age})`);
      gradient.addColorStop(1, "rgba(255, 250, 240, 0)");
      context.fillStyle = gradient;
      context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      /* Fine scratches through the worked region, along the grain. */
      const scratches = Math.floor(14 * age);
      for (let index = 0; index < scratches; index++) {
        const y = cy + (random() - 0.5) * radius * 1.4;
        const x = cx + (random() - 0.5) * radius;
        const length = radius * (0.3 + random() * 0.9);
        context.strokeStyle = `rgba(30, 24, 18, ${0.05 + random() * 0.08})`;
        context.lineWidth = 0.5 + random();
        context.beginPath();
        context.moveTo(x - length / 2, y);
        context.lineTo(x + length / 2, y + (random() - 0.5) * 2);
        context.stroke();
      }
    }
    /* Ghost rings of mugs past. */
    for (const ring of params.rings ?? []) {
      const cx = ring.u * size;
      const cy = ring.v * size;
      const radius = ring.r * size;
      context.strokeStyle = `rgba(60, 45, 30, ${0.14 + 0.16 * age})`;
      context.lineWidth = 2 + random() * 1.5;
      context.beginPath();
      /* An incomplete ring — the mug was lifted mid-set. */
      const start = random() * Math.PI * 2;
      context.arc(cx, cy, radius, start, start + Math.PI * (1.2 + random() * 0.7));
      context.stroke();
    }
    /* Halos: the un-sunned disc under something that never moves. */
    for (const halo of params.halos ?? []) {
      const cx = halo.u * size;
      const cy = halo.v * size;
      const radius = halo.r * size;
      const gradient = context.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius);
      gradient.addColorStop(0, `rgba(40, 30, 20, ${0.12 * age})`);
      gradient.addColorStop(0.8, `rgba(40, 30, 20, ${0.05 * age})`);
      gradient.addColorStop(1, "rgba(40, 30, 20, 0)");
      context.fillStyle = gradient;
      context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }

    /* General patina: sparse darker flecks. */
    const flecks = Math.floor(500 * age);
    for (let index = 0; index < flecks; index++) {
      context.fillStyle = `rgba(30, 24, 18, ${random() * 0.09})`;
      context.fillRect(random() * size, random() * size, 1 + random() * 2, 1);
    }
  }

  return toTexture(context);
}

export interface PaperParams {
  seed: number;
  base: string;
  /** 0..1 — fiber visibility; heavier for kraft, lighter for fine paper. */
  fiber: number;
  /** 0..1 — handling: edge darkening, faint creases. */
  handled?: number;
  size?: number;
}

/** Paper you could almost feel: fiber noise, tone drift, handled edges. */
export function paperTexture(params: PaperParams): CanvasTexture {
  const size = params.size ?? 512;
  const random = seededRandom(params.seed);
  const context = makeCanvas(size, size);
  const base = rgb(params.base);

  context.fillStyle = style(base, 1);
  context.fillRect(0, 0, size, size);

  /* Fiber: short faint strokes in every direction. */
  const fibers = Math.floor(1400 * params.fiber);
  for (let index = 0; index < fibers; index++) {
    const x = random() * size;
    const y = random() * size;
    const angle = random() * Math.PI;
    const length = 1 + random() * 3;
    const tone = random() < 0.5 ? 255 : 0;
    context.strokeStyle = `rgba(${tone}, ${tone}, ${tone}, ${
      0.02 + random() * 0.035
    })`;
    context.lineWidth = 0.5;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }

  /* Broad tone drift so sheets never read as one flat value. */
  for (let index = 0; index < 4; index++) {
    const x = random() * size;
    const y = random() * size;
    const radius = size * (0.3 + random() * 0.4);
    const gradient = context.createRadialGradient(x, y, 1, x, y, radius);
    const shift = random() < 0.5 ? 0 : 255;
    gradient.addColorStop(0, `rgba(${shift}, ${shift}, ${shift}, 0.025)`);
    gradient.addColorStop(1, `rgba(${shift}, ${shift}, ${shift}, 0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  /* Handling: darkened edges, one or two faint creases. */
  const handled = params.handled ?? 0;
  if (handled > 0) {
    const edge = context.createLinearGradient(0, 0, 0, size);
    edge.addColorStop(0, `rgba(60, 50, 40, ${0.06 * handled})`);
    edge.addColorStop(0.12, "rgba(60, 50, 40, 0)");
    edge.addColorStop(0.88, "rgba(60, 50, 40, 0)");
    edge.addColorStop(1, `rgba(60, 50, 40, ${0.08 * handled})`);
    context.fillStyle = edge;
    context.fillRect(0, 0, size, size);
    const creases = Math.round(handled * 2);
    for (let index = 0; index < creases; index++) {
      const y = size * (0.25 + random() * 0.5);
      context.strokeStyle = `rgba(60, 50, 40, ${0.05 + 0.05 * handled})`;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(size, y + (random() - 0.5) * 20);
      context.stroke();
    }
  }

  return toTexture(context);
}

/**
 * Texture cache: dressing components request textures directly during
 * render; identical parameter sets share one generated canvas. Keys are
 * the parameter objects' JSON — parameters are small and serializable.
 */
const textureCache = new Map<string, CanvasTexture>();

function cached(key: string, build: () => CanvasTexture): CanvasTexture {
  const existing = textureCache.get(key);
  if (existing) return existing;
  const texture = build();
  textureCache.set(key, texture);
  return texture;
}

export function wood(params: WoodParams): CanvasTexture {
  return cached(`wood:${JSON.stringify(params)}`, () => woodTexture(params));
}

export function paper(params: PaperParams): CanvasTexture {
  return cached(`paper:${JSON.stringify(params)}`, () => paperTexture(params));
}

export function cardboard(seed: number, base: string): CanvasTexture {
  return cached(`cardboard:${seed}:${base}`, () =>
    cardboardTexture(seed, base),
  );
}

export interface PlasterParams {
  seed: number;
  base: string;
  /** 0..1 — blemishes and tonal history; keep low, the walls stay quiet. */
  age: number;
  size?: number;
  /**
   * Ghosts (WORK ORDER 0050): lighter rectangles where prints used to
   * hang — the wall around them aged, and when they came down the old
   * paint showed. Corners keep a fleck of adhesive residue. UV space.
   */
  ghosts?: ReadonlyArray<{ u: number; v: number; w: number; h: number }>;
  /** Old pin holes that outlived their pins. UV space. */
  pinHoles?: ReadonlyArray<{ u: number; v: number }>;
  /**
   * Tape residue (WORK ORDER 0052): the yellowed flecks left where tape
   * held something and was pulled away — the wall remembers the habit.
   */
  residue?: ReadonlyArray<{ u: number; v: number }>;
}

/**
 * Painted plaster (WORK ORDER 0042): broad tonal clouds and the faintest
 * trowel unevenness. The daylight is unremarkable by design, so the walls
 * must never perform — everything here sits at the threshold of noticing.
 */
export function plasterTexture(params: PlasterParams): CanvasTexture {
  const size = params.size ?? 1024;
  const random = seededRandom(params.seed);
  const context = makeCanvas(size, size);
  const base = rgb(params.base);

  context.fillStyle = style(base, 1);
  context.fillRect(0, 0, size, size);

  /* Broad tonal clouds — the wall was painted by a person. */
  for (let index = 0; index < 9; index++) {
    const x = random() * size;
    const y = random() * size;
    const radius = size * (0.2 + random() * 0.45);
    const gradient = context.createRadialGradient(x, y, 1, x, y, radius);
    const light = random() < 0.5;
    gradient.addColorStop(
      0,
      light ? "rgba(255, 253, 248, 0.03)" : "rgba(40, 36, 30, 0.028)",
    );
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  /* Fine grain so the surface never reads as vector-flat. */
  for (let index = 0; index < 1600; index++) {
    const tone = random() < 0.5 ? 255 : 20;
    context.fillStyle = `rgba(${tone}, ${tone}, ${tone}, ${
      random() * 0.016
    })`;
    context.fillRect(random() * size, random() * size, 1 + random(), 1);
  }

  /* Age: a few faint scuffs and one hairline blemish. */
  if (params.age > 0) {
    const scuffs = Math.round(4 * params.age);
    for (let index = 0; index < scuffs; index++) {
      const x = random() * size;
      const y = size * (0.6 + random() * 0.38);
      context.fillStyle = `rgba(70, 62, 52, ${0.04 + random() * 0.05})`;
      const w = 8 + random() * 30;
      context.fillRect(x, y, w, 1.5 + random() * 2);
    }
  }

  /* Ghosts of prints that used to hang here (canvas y runs opposite V). */
  for (const ghost of params.ghosts ?? []) {
    const gw = ghost.w * size;
    const gh = ghost.h * size;
    const gx = ghost.u * size - gw / 2;
    const gy = (1 - ghost.v) * size - gh / 2;
    /* The old paint, slightly brighter, edges soft from repainting dust. */
    for (let pass = 0; pass < 3; pass++) {
      const grow = pass * 2.5;
      context.fillStyle = `rgba(255, 252, 244, ${0.024 - pass * 0.006})`;
      context.fillRect(gx - grow, gy - grow, gw + grow * 2, gh + grow * 2);
    }
    /* Adhesive residue at two of the four corners. */
    context.fillStyle = "rgba(120, 104, 76, 0.16)";
    context.fillRect(gx - 1, gy - 1, 5, 4);
    context.fillRect(gx + gw - 4, gy + gh - 3, 5, 4);
  }

  /* Tape residue: yellowed adhesive flecks where the habit lives. */
  for (const mark of params.residue ?? []) {
    const x = mark.u * size;
    const y = (1 - mark.v) * size;
    context.fillStyle = "rgba(150, 128, 88, 0.22)";
    context.fillRect(x - 3, y - 1.5, 6, 3.5);
    context.fillStyle = "rgba(150, 128, 88, 0.1)";
    context.fillRect(x - 4.5, y - 2.5, 9, 5.5);
  }

  /* Pin holes that outlived their pins. */
  for (const hole of params.pinHoles ?? []) {
    const x = hole.u * size;
    const y = (1 - hole.v) * size;
    context.fillStyle = "rgba(45, 38, 30, 0.5)";
    context.fillRect(x, y, 2, 2);
    context.fillStyle = "rgba(255, 252, 244, 0.1)";
    context.fillRect(x, y + 2, 2, 1);
  }

  return toTexture(context);
}

/**
 * The studio floor (WORK ORDER 0042): warm troweled concrete — fine
 * aggregate, broad stains, all low contrast. Tiles via RepeatWrapping;
 * contrast stays low enough that the repeat never reads.
 */
export function concreteTexture(seed: number, base: string): CanvasTexture {
  const size = 1024;
  const random = seededRandom(seed);
  const context = makeCanvas(size, size);
  const baseColor = rgb(base);

  context.fillStyle = style(baseColor, 1);
  context.fillRect(0, 0, size, size);

  /* Broad moisture/wear stains. */
  for (let index = 0; index < 7; index++) {
    const x = random() * size;
    const y = random() * size;
    const radius = size * (0.15 + random() * 0.35);
    const gradient = context.createRadialGradient(x, y, 1, x, y, radius);
    const light = random() < 0.4;
    gradient.addColorStop(
      0,
      light ? "rgba(255, 250, 240, 0.03)" : "rgba(35, 30, 24, 0.035)",
    );
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  /* Fine aggregate speckle. */
  for (let index = 0; index < 5200; index++) {
    const tone = random() < 0.5 ? 250 : 18;
    context.fillStyle = `rgba(${tone}, ${tone}, ${tone}, ${
      random() * 0.03
    })`;
    context.fillRect(random() * size, random() * size, 1, 1);
  }

  /* A couple of hairline cracks. */
  for (let index = 0; index < 2; index++) {
    let x = random() * size;
    let y = random() * size;
    context.strokeStyle = "rgba(40, 34, 28, 0.12)";
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(x, y);
    const steps = 6 + Math.floor(random() * 5);
    for (let step = 0; step < steps; step++) {
      x += (random() - 0.5) * 90;
      y += 30 + random() * 50;
      context.lineTo(x, y);
    }
    context.stroke();
  }

  return toTexture(context);
}

export interface LeatherParams {
  seed: number;
  base: string;
  /** 0..1 — sheen lightening where a body has worn it smooth. */
  worn: number;
}

/** Worn leather: pebble grain, tone drift, smoothed where it is sat on. */
export function leatherTexture(params: LeatherParams): CanvasTexture {
  const size = 512;
  const random = seededRandom(params.seed);
  const context = makeCanvas(size, size);
  const base = rgb(params.base);

  context.fillStyle = style(base, 1);
  context.fillRect(0, 0, size, size);

  /* Pebble grain: dense small dark cells. */
  for (let index = 0; index < 3800; index++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 1 + random() * 2.2;
    context.fillStyle = `rgba(20, 14, 10, ${0.03 + random() * 0.05})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  /* Tone drift. */
  for (let index = 0; index < 4; index++) {
    const x = random() * size;
    const y = random() * size;
    const radius = size * (0.25 + random() * 0.35);
    const gradient = context.createRadialGradient(x, y, 1, x, y, radius);
    gradient.addColorStop(0, "rgba(30, 20, 12, 0.05)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  /* Worn sheen: the center smooths and lightens where a body rests. */
  if (params.worn > 0) {
    const gradient = context.createRadialGradient(
      size / 2,
      size / 2,
      1,
      size / 2,
      size / 2,
      size * 0.45,
    );
    gradient.addColorStop(0, `rgba(255, 240, 220, ${0.09 * params.worn})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  return toTexture(context);
}

/** Glazed ceramic: near-flat with faint glaze drift and sparse speckle. */
export function ceramicTexture(seed: number, base: string): CanvasTexture {
  const size = 256;
  const random = seededRandom(seed);
  const context = makeCanvas(size, size);
  const baseColor = rgb(base);

  context.fillStyle = style(baseColor, 1);
  context.fillRect(0, 0, size, size);

  for (let index = 0; index < 3; index++) {
    const x = random() * size;
    const y = random() * size;
    const radius = size * (0.3 + random() * 0.3);
    const gradient = context.createRadialGradient(x, y, 1, x, y, radius);
    gradient.addColorStop(0, "rgba(255, 252, 246, 0.05)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  for (let index = 0; index < 90; index++) {
    context.fillStyle = `rgba(60, 50, 40, ${0.04 + random() * 0.05})`;
    context.fillRect(random() * size, random() * size, 1, 1);
  }

  return toTexture(context);
}

/**
 * A soft-edged white quad (WORK ORDER 0049): alpha feathers to zero at the
 * borders. Used additively as the window's daylight patch on the floor —
 * light the renderer cannot transport itself, authored from the real
 * window and sun geometry.
 */
export function featheredQuadTexture(feather: number): CanvasTexture {
  const size = 256;
  const context = makeCanvas(size, size);
  const f = Math.floor(size * feather);
  const gradient = (a: number, b: number, vertical: boolean) => {
    const g = vertical
      ? context.createLinearGradient(0, a, 0, b)
      : context.createLinearGradient(a, 0, b, 0);
    return g;
  };
  context.fillStyle = "rgba(255, 255, 255, 1)";
  context.fillRect(0, 0, size, size);
  /* Feather all four edges by multiplying alpha down to zero. */
  context.globalCompositeOperation = "destination-in";
  for (const [a, b, vertical] of [
    [0, f, true],
    [size, size - f, true],
    [0, f, false],
    [size, size - f, false],
  ] as const) {
    const g = gradient(a, b, vertical);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(0, 0, 0, 1)");
    context.fillStyle = g;
    context.fillRect(0, 0, size, size);
  }
  context.globalCompositeOperation = "source-over";
  return toTexture(context);
}

/**
 * A one-sided alpha falloff (WORK ORDER 0049): opaque at U=0 fading to
 * transparent at U=1. Colored black and laid along wall junctions, it
 * approximates the ambient occlusion that gathers in real corners.
 */
export function cornerFalloffTexture(): CanvasTexture {
  const size = 128;
  const context = makeCanvas(size, size);
  const g = context.createLinearGradient(0, 0, size, 0);
  g.addColorStop(0, "rgba(255, 255, 255, 1)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = g;
  context.fillRect(0, 0, size, size);
  return toTexture(context);
}

/**
 * The frosted pane with presence (WORK ORDER 0049): the base daylight
 * tone carries one soft vertical darker band — something stands outside
 * the window, unexplained. The world continues past the glass.
 */
export function frostedPaneTexture(
  base: string,
  bandCenter: number,
  bandWidth: number,
): CanvasTexture {
  const size = 512;
  const context = makeCanvas(size, size);
  const baseColor = rgb(base);
  context.fillStyle = style(baseColor, 1);
  context.fillRect(0, 0, size, size);
  const cx = bandCenter * size;
  const half = (bandWidth / 2) * size;
  const g = context.createLinearGradient(cx - half * 2, 0, cx + half * 2, 0);
  g.addColorStop(0, "rgba(90, 84, 72, 0)");
  g.addColorStop(0.5, "rgba(90, 84, 72, 0.16)");
  g.addColorStop(1, "rgba(90, 84, 72, 0)");
  context.fillStyle = g;
  context.fillRect(0, 0, size, size);
  return toTexture(context);
}

export function plaster(params: PlasterParams): CanvasTexture {
  return cached(`plaster:${JSON.stringify(params)}`, () =>
    plasterTexture(params),
  );
}

export function concrete(seed: number, base: string): CanvasTexture {
  return cached(`concrete:${seed}:${base}`, () => concreteTexture(seed, base));
}

export function leather(params: LeatherParams): CanvasTexture {
  return cached(`leather:${JSON.stringify(params)}`, () =>
    leatherTexture(params),
  );
}

export function ceramic(seed: number, base: string): CanvasTexture {
  return cached(`ceramic:${seed}:${base}`, () => ceramicTexture(seed, base));
}

/** Kraft cardboard for print tubes: warm fiber plus a spiral seam. */
export function cardboardTexture(seed: number, base: string): CanvasTexture {
  const size = 512;
  const random = seededRandom(seed);
  const context = makeCanvas(size, size);
  const baseColor = rgb(base);

  context.fillStyle = style(baseColor, 1);
  context.fillRect(0, 0, size, size);

  /* Heavy kraft fiber. */
  for (let index = 0; index < 2200; index++) {
    const x = random() * size;
    const y = random() * size;
    const tone = random() < 0.5 ? 255 : 20;
    context.fillStyle = `rgba(${tone}, ${tone === 255 ? 250 : 16}, ${
      tone === 255 ? 240 : 10
    }, ${0.02 + random() * 0.03})`;
    context.fillRect(x, y, 1 + random() * 2, 1);
  }

  /* Spiral seam: diagonal darker lines (U wraps the tube). */
  context.strokeStyle = "rgba(70, 55, 40, 0.35)";
  context.lineWidth = 2;
  for (let offset = -size; offset < size * 2; offset += size / 2.5) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset + size * 0.6, size);
    context.stroke();
  }

  return toTexture(context);
}
