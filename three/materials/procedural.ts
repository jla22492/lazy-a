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

import { whenRoomIsSettled } from "@/lib/deferredAssets";

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
  /** 0..1 — sun-fade: the tone washes toward white, unevenly (0066). */
  faded?: number;
  /** A corner that was bent and never flattened (0066). */
  bentCorner?: boolean;
  /** Which scanned stock underlies the sheet (0101). */
  stock?: PaperStock;
  size?: number;
}

/** The photographic stocks (WORK ORDER 0101): scanned paper, CC0
    (ambientCG), neutralized offline so any base tone can tint it. */
export type PaperStock = "fiber" | "smooth" | "kraft";

const stockImages = new Map<PaperStock, HTMLImageElement>();
const stockWaiters = new Map<PaperStock, Array<() => void>>();

function requestStock(stock: PaperStock, onReady: () => void): void {
  const loaded = stockImages.get(stock);
  if (loaded) {
    onReady();
    return;
  }
  const waiters = stockWaiters.get(stock);
  if (waiters) {
    waiters.push(onReady);
    return;
  }
  stockWaiters.set(stock, [onReady]);
  /* Photographic weight waits for the settle (0104). */
  whenRoomIsSettled(() => {
    const image = new Image();
    image.onload = () => {
      stockImages.set(stock, image);
      for (const waiter of stockWaiters.get(stock) ?? []) waiter();
      stockWaiters.delete(stock);
    };
    const prefix = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    image.src = `${prefix}/textures/paper/${stock}.jpg`;
  });
}

/** Paper you could almost feel — since 0101 built on a PHOTOGRAPH of
    paper (progressively: procedural first paint, re-drawn with the
    scanned stock the moment it loads), with the history layers on top. */
export function paperTexture(params: PaperParams): CanvasTexture {
  const size = params.size ?? 512;
  const context = makeCanvas(size, size);
  const texture = drawPaper(context, params, null);
  const stock = params.stock ?? "fiber";
  if (typeof window !== "undefined") {
    requestStock(stock, () => {
      drawPaper(context, params, stockImages.get(stock) ?? null);
      texture.needsUpdate = true;
    });
  }
  return texture;
}

function drawPaper(
  context: CanvasRenderingContext2D,
  params: PaperParams,
  photo: HTMLImageElement | null,
): CanvasTexture {
  const size = params.size ?? 512;
  const random = seededRandom(params.seed);
  const base = rgb(params.base);

  context.fillStyle = style(base, 1);
  context.fillRect(0, 0, size, size);
  if (photo) {
    /* The scanned stock, tinted by the sheet's own tone: multiply keeps
       the photographic grain while the base color stays authored. */
    context.drawImage(photo, 0, 0, size, size);
    context.globalCompositeOperation = "multiply";
    context.fillStyle = style(base, 1);
    context.fillRect(0, 0, size, size);
    context.globalCompositeOperation = "source-over";
  }

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

  /* Sun-fade: washed toward white, more at the top (0066). */
  if (params.faded) {
    const fade = context.createLinearGradient(0, 0, 0, size);
    fade.addColorStop(0, `rgba(255, 253, 246, ${0.28 * params.faded})`);
    fade.addColorStop(1, `rgba(255, 253, 246, ${0.12 * params.faded})`);
    context.fillStyle = fade;
    context.fillRect(0, 0, size, size);
  }

  /* A bent corner that never flattened: a diagonal crease of shadow and
     a thin catch-light where the paper lifts (0066). */
  if (params.bentCorner) {
    const c = size * 0.18;
    context.fillStyle = "rgba(60, 50, 40, 0.13)";
    context.beginPath();
    context.moveTo(size - c, 0);
    context.lineTo(size, 0);
    context.lineTo(size, c);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(255, 253, 246, 0.35)";
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(size - c, 0);
    context.lineTo(size, c);
    context.stroke();
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
  /**
   * Old screw holes (WORK ORDER 0057): deeper than pin holes, with a dust
   * shadow beneath — something mounted was taken down years ago.
   */
  screwHoles?: ReadonlyArray<{ u: number; v: number }>;
  /**
   * Repairs (WORK ORDER 0057): a patched rectangle repainted in slightly
   * the wrong white — fixed properly, matched imperfectly, forgotten.
   */
  repairs?: ReadonlyArray<{ u: number; v: number; w: number; h: number }>;
  /**
   * Stains (WORK ORDER 0058): soft darker drifts — the dust a vent
   * breathes onto the paint around it, year after year.
   */
  stains?: ReadonlyArray<{ u: number; v: number; w: number; h: number }>;
  /**
   * Touch-ups (WORK ORDER 0062): small irregular dabs of paint from a
   * different can in a different decade — warmer where the repair was
   * cooler. Accidents of maintenance, unconnected to anything.
   */
  touchUps?: ReadonlyArray<{ u: number; v: number; r: number }>;
  /**
   * Hairline cracks (WORK ORDER 0062): plaster giving up quietly,
   * wandering down from where the building settles.
   */
  cracks?: ReadonlyArray<{ u: number; v: number; length: number }>;
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

  /* Touch-ups: paint from a different can, a different decade. */
  for (const dab of params.touchUps ?? []) {
    const cx = dab.u * size;
    const cy = (1 - dab.v) * size;
    const r = dab.r * size;
    context.fillStyle = "rgba(238, 231, 216, 0.22)";
    context.beginPath();
    /* An irregular blob: a few overlapping ellipses, the way a brush dabs. */
    context.ellipse(cx, cy, r, r * 0.7, 0.4, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(cx + r * 0.4, cy + r * 0.3, r * 0.7, r * 0.5, -0.3, 0, Math.PI * 2);
    context.fill();
  }

  /* Hairline cracks: wandering down from where the building settles. */
  for (const crack of params.cracks ?? []) {
    const startX = crack.u * size;
    const startY = (1 - crack.v) * size;
    const totalLen = crack.length * size;
    context.strokeStyle = "rgba(58, 50, 40, 0.28)";
    context.lineWidth = 0.7;
    context.beginPath();
    context.moveTo(startX, startY);
    let x = startX;
    let y = startY;
    const cr = seededRandom(params.seed + Math.floor(startX));
    const steps = 7;
    for (let step = 0; step < steps; step++) {
      x += (cr() - 0.5) * 9;
      y += totalLen / steps;
      context.lineTo(x, y);
    }
    context.stroke();
  }

  /* Stains: the dust a vent breathes onto its wall. */
  for (const stain of params.stains ?? []) {
    const sw = stain.w * size;
    const sh = stain.h * size;
    const sx = stain.u * size - sw / 2;
    const sy = (1 - stain.v) * size - sh / 2;
    const gradient = context.createRadialGradient(
      sx + sw / 2, sy + sh / 2, 1,
      sx + sw / 2, sy + sh / 2, Math.max(sw, sh) / 2,
    );
    gradient.addColorStop(0, "rgba(60, 54, 44, 0.05)");
    gradient.addColorStop(1, "rgba(60, 54, 44, 0)");
    context.fillStyle = gradient;
    context.fillRect(sx, sy, sw, sh);
  }

  /* Repairs: patched and repainted in slightly the wrong white. */
  for (const repair of params.repairs ?? []) {
    const rw = repair.w * size;
    const rh = repair.h * size;
    const rx = repair.u * size - rw / 2;
    const ry = (1 - repair.v) * size - rh / 2;
    /* A touch cooler and brighter than the aged wall around it. */
    context.fillStyle = "rgba(242, 243, 244, 0.16)";
    context.fillRect(rx, ry, rw, rh);
    /* The faint hard edge a roller leaves against old paint. */
    context.strokeStyle = "rgba(210, 208, 200, 0.18)";
    context.lineWidth = 1;
    context.strokeRect(rx, ry, rw, rh);
  }

  /* Screw holes: deeper than pins, each with a dust shadow beneath. */
  for (const hole of params.screwHoles ?? []) {
    const x = hole.u * size;
    const y = (1 - hole.v) * size;
    context.fillStyle = "rgba(38, 32, 25, 0.65)";
    context.fillRect(x - 1.5, y - 1.5, 3.5, 3.5);
    context.fillStyle = "rgba(255, 252, 244, 0.14)";
    context.fillRect(x - 1.5, y + 2, 3.5, 1.5);
    /* Dust drift below the hole. */
    const streak = context.createLinearGradient(0, y + 3, 0, y + 22);
    streak.addColorStop(0, "rgba(70, 62, 52, 0.05)");
    streak.addColorStop(1, "rgba(70, 62, 52, 0)");
    context.fillStyle = streak;
    context.fillRect(x - 2, y + 3, 4.5, 19);
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
/**
 * The bench's front-edge face (WORK ORDER 0061): the same worked wood,
 * plus the person's tallies — small five-bar gates in graphite near the
 * working position, counting something only they know. A pattern, not a
 * biography: the marks are believable at a glance and deliberately
 * unreadable as content.
 */
export function talliedWoodTexture(params: WoodParams): CanvasTexture {
  const base = woodTexture(params);
  const context = (base.image as HTMLCanvasElement).getContext("2d");
  if (!context) return base;
  const size = (base.image as HTMLCanvasElement).width;
  const random = seededRandom(params.seed + 977);
  /* Three gate clusters right of center (the working side), mid-face. */
  /* Two gates (0066): one complete, one unfinished — enough pattern. */
  const clusters = [
    { u: 0.6, count: 5 },
    { u: 0.65, count: 3 },
  ];
  for (const cluster of clusters) {
    const cx = cluster.u * size;
    const cy = 0.52 * size;
    const barHeight = 0.16 * size;
    for (let bar = 0; bar < Math.min(cluster.count, 4); bar++) {
      const x = cx + bar * 7 + (random() - 0.5) * 2;
      context.strokeStyle = `rgba(52, 48, 44, ${0.5 + random() * 0.2})`;
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(x, cy - barHeight / 2 + (random() - 0.5) * 3);
      context.lineTo(x + (random() - 0.5) * 3, cy + barHeight / 2);
      context.stroke();
    }
    if (cluster.count >= 5) {
      context.strokeStyle = "rgba(52, 48, 44, 0.55)";
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(cx - 4, cy + barHeight / 2 - 2);
      context.lineTo(cx + 25, cy - barHeight / 2 + 2);
      context.stroke();
    }
  }
  base.needsUpdate = true;
  return base;
}

export function talliedWood(params: WoodParams): CanvasTexture {
  return cached(`talliedWood:${JSON.stringify(params)}`, () =>
    talliedWoodTexture(params),
  );
}

/**
 * Top-down alpha falloff (WORK ORDER 0059): opaque at V=1 fading down —
 * the soft occlusion where wall meets ceiling, laid along the junction.
 */
export function ceilingFalloffTexture(): CanvasTexture {
  const size = 128;
  const context = makeCanvas(size, size);
  const g = context.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "rgba(255, 255, 255, 1)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = g;
  context.fillRect(0, 0, size, size);
  return toTexture(context);
}

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
  /* The sky is brighter than the ground, even through frost (0063). */
  const sky = context.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, "rgba(255, 253, 246, 0.09)");
  sky.addColorStop(0.5, "rgba(255, 253, 246, 0)");
  sky.addColorStop(1, "rgba(120, 110, 94, 0.05)");
  context.fillStyle = sky;
  context.fillRect(0, 0, size, size);
  /* The vertical presence outside. */
  const cx = bandCenter * size;
  const half = (bandWidth / 2) * size;
  const g = context.createLinearGradient(cx - half * 2, 0, cx + half * 2, 0);
  g.addColorStop(0, "rgba(90, 84, 72, 0)");
  g.addColorStop(0.5, "rgba(90, 84, 72, 0.16)");
  g.addColorStop(1, "rgba(90, 84, 72, 0)");
  context.fillStyle = g;
  context.fillRect(0, 0, size, size);
  /* A fainter horizontal member meeting it — a railing's corner (0063). */
  const railY = 0.42 * size;
  const rail = context.createLinearGradient(0, railY - 10, 0, railY + 10);
  rail.addColorStop(0, "rgba(90, 84, 72, 0)");
  rail.addColorStop(0.5, "rgba(90, 84, 72, 0.09)");
  rail.addColorStop(1, "rgba(90, 84, 72, 0)");
  context.fillStyle = rail;
  context.fillRect(0, railY - 10, cx + half * 2, 20);
  /* Two old rain streaks in the frost. */
  for (const streakU of [0.045, 0.11]) {
    const x = streakU * size;
    const streak = context.createLinearGradient(x - 3, 0, x + 3, 0);
    streak.addColorStop(0, "rgba(255, 253, 246, 0)");
    streak.addColorStop(0.5, "rgba(255, 253, 246, 0.1)");
    streak.addColorStop(1, "rgba(255, 253, 246, 0)");
    context.fillStyle = streak;
    context.fillRect(x - 3, size * 0.15, 6, size * 0.8);
  }
  return toTexture(context);
}

/**
 * The window patch with the outside presence crossing it (0063): the
 * same vertical something that darkens the pane interrupts the light it
 * lets in — one story, two surfaces.
 */
export function windowPatchTexture(
  feather: number,
  bandV: number,
): CanvasTexture {
  const base = featheredQuadTexture(feather);
  const canvas = base.image as HTMLCanvasElement;
  const context = canvas.getContext("2d");
  if (!context) return base;
  const size = canvas.width;
  const by = bandV * size;
  const g = context.createLinearGradient(0, by - 14, 0, by + 14);
  g.addColorStop(0, "rgba(0, 0, 0, 0)");
  g.addColorStop(0.5, "rgba(0, 0, 0, 0.5)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.globalCompositeOperation = "destination-out";
  context.fillStyle = g;
  context.fillRect(0, by - 14, size, 28);
  context.globalCompositeOperation = "source-over";
  base.needsUpdate = true;
  return base;
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

/* ------------------------------------------------------------------ */
/* Relief (WORK ORDER 0095): normal maps.                             */
/* The single biggest "this is a rendering" tell is optical flatness. */
/* These height fields are generated with the same seeded language as */
/* the color layers and converted to tangent-space normals; they ride */
/* UNDER the history layer — the scars and mug rings survive.         */
/* Normal maps are data, not color: no sRGB.                          */
/* ------------------------------------------------------------------ */

function heightToNormalTexture(
  height: CanvasRenderingContext2D,
  strength: number,
): CanvasTexture {
  const { width, height: h } = height.canvas;
  const source = height.getImageData(0, 0, width, h).data;
  const out = makeCanvas(width, h);
  const image = out.createImageData(width, h);
  const at = (x: number, y: number) =>
    source[(((y + h) % h) * width + ((x + width) % width)) * 4];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 255 * 255);
      const i = (y * width + x) * 4;
      image.data[i] = 127.5 + dx * inv * 127.5;
      image.data[i + 1] = 127.5 - dy * inv * 127.5;
      image.data[i + 2] = 255 * inv * 127.5 + 127.5;
      image.data[i + 3] = 255;
    }
  }
  out.putImageData(image, 0, 0);
  const texture = new CanvasTexture(out.canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Wood relief: grain ridges along Y, plank seams, shallow gouges. */
export function woodNormal(seed: number, strength = 2.2): CanvasTexture {
  return cached(`woodNormal:${seed}:${strength}`, () => {
    /* 256: the Sobel pass is the load path's biggest cost, and the
       grain reads identically from the seat (0099 clock guard). */
    const size = 256;
    const context = makeCanvas(size, size);
    const random = seededRandom(seed);
    context.fillStyle = "rgb(128,128,128)";
    context.fillRect(0, 0, size, size);
    /* Grain: long soft vertical streaks at varying depth. */
    for (let i = 0; i < 340; i++) {
      const x = random() * size;
      const w = 1 + random() * 3;
      const tone = 118 + random() * 20;
      context.fillStyle = `rgba(${tone},${tone},${tone},${0.25 + random() * 0.3})`;
      context.fillRect(x, 0, w, size);
    }
    /* Plank seams: crisp grooves. */
    const planks = 4 + Math.floor(random() * 2);
    for (let p = 1; p < planks; p++) {
      const x = (size / planks) * p + (random() - 0.5) * 8;
      context.fillStyle = "rgba(70,70,70,0.9)";
      context.fillRect(x, 0, 2, size);
    }
    /* A few shallow dents where years landed. */
    for (let i = 0; i < 14; i++) {
      const g = context.createRadialGradient(
        random() * size, random() * size, 0,
        random() * size, random() * size, 6 + random() * 18,
      );
      g.addColorStop(0, "rgba(100,100,100,0.5)");
      g.addColorStop(1, "rgba(128,128,128,0)");
      context.fillStyle = g;
      context.fillRect(0, 0, size, size);
    }
    return heightToNormalTexture(context, strength);
  });
}

/** Plaster relief: broad undulation and the faintest trowel arcs. */
export function plasterNormal(seed: number, strength = 1.1): CanvasTexture {
  return cached(`plasterNormal:${seed}:${strength}`, () => {
    const size = 256;
    const context = makeCanvas(size, size);
    const random = seededRandom(seed);
    context.fillStyle = "rgb(128,128,128)";
    context.fillRect(0, 0, size, size);
    /* Broad clouds: the wall breathes at arm scale. */
    for (let i = 0; i < 26; i++) {
      const x = random() * size;
      const y = random() * size;
      const r = 60 + random() * 140;
      const tone = 120 + random() * 16;
      const g = context.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${tone},${tone},${tone},0.35)`);
      g.addColorStop(1, "rgba(128,128,128,0)");
      context.fillStyle = g;
      context.fillRect(0, 0, size, size);
    }
    /* Trowel: long low arcs a roller leaves at raking light. */
    context.lineWidth = 10;
    for (let i = 0; i < 12; i++) {
      const y = random() * size;
      const tone = 122 + random() * 12;
      context.strokeStyle = `rgba(${tone},${tone},${tone},0.22)`;
      context.beginPath();
      context.moveTo(-40, y);
      context.bezierCurveTo(
        size * 0.3, y + (random() - 0.5) * 60,
        size * 0.7, y + (random() - 0.5) * 60,
        size + 40, y + (random() - 0.5) * 40,
      );
      context.stroke();
    }
    return heightToNormalTexture(context, strength);
  });
}

/** Paper tooth AND wave: fine grain plus the broad, barely-there
    undulation of a real sheet — what raking light actually finds. */
export function paperNormal(seed: number, strength = 0.9): CanvasTexture {
  return cached(`paperNormal:${seed}:${strength}`, () => {
    const size = 256;
    const context = makeCanvas(size, size);
    const random = seededRandom(seed);
    context.fillStyle = "rgb(128,128,128)";
    context.fillRect(0, 0, size, size);
    /* The wave: a few broad soft swells, no sheet lies truly flat. */
    for (let i = 0; i < 5; i++) {
      const x = random() * size;
      const y = random() * size;
      const r = size * (0.25 + random() * 0.35);
      const tone = 118 + random() * 20;
      const g = context.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${tone},${tone},${tone},0.5)`);
      g.addColorStop(1, "rgba(128,128,128,0)");
      context.fillStyle = g;
      context.fillRect(0, 0, size, size);
    }
    for (let i = 0; i < 5200; i++) {
      const tone = 116 + random() * 24;
      context.fillStyle = `rgba(${tone},${tone},${tone},0.5)`;
      context.fillRect(random() * size, random() * size, 1.4, 1.4);
    }
    return heightToNormalTexture(context, strength);
  });
}


/**
 * Micro-imperfection (WORK ORDER 0099): roughness variation for touched
 * surfaces. Where hands have lived, the finish is smoother — the wear
 * spots polish; everywhere else, fine noise keeps the sheen from ever
 * reading uniform. Multiplies the material's roughness (G channel).
 */
export function touchedRoughness(
  seed: number,
  base: number,
  spots: ReadonlyArray<{ u: number; v: number; r: number }>,
): CanvasTexture {
  return cached(`touchedRoughness:${seed}:${base}`, () => {
    const size = 256;
    const context = makeCanvas(size, size);
    const random = seededRandom(seed);
    const g = Math.round(base * 255);
    context.fillStyle = `rgb(${g},${g},${g})`;
    context.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i++) {
      const tone = g + (random() - 0.5) * 26;
      context.fillStyle = `rgb(${tone},${tone},${tone})`;
      context.fillRect(random() * size, random() * size, 2, 2);
    }
    for (const spot of spots) {
      const grad = context.createRadialGradient(
        spot.u * size, spot.v * size, 0,
        spot.u * size, spot.v * size, spot.r * size,
      );
      const polished = Math.round(g * 0.78);
      grad.addColorStop(0, `rgba(${polished},${polished},${polished},0.85)`);
      grad.addColorStop(1, `rgba(${polished},${polished},${polished},0)`);
      context.fillStyle = grad;
      context.fillRect(0, 0, size, size);
    }
    const texture = new CanvasTexture(context.canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    return texture;
  });
}
