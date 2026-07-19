#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const repositoryRoot = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(resolve(repositoryRoot, "public/room/manifest.json"), "utf8"),
);
const treatment = manifest.hero?.treatment;
const profile = manifest.variants?.wide;
const width = 720;
const height = 1008;
const channels = 3;
const exposure = 2 ** 0.25;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function srgbToLinear(value) {
  const encoded = value / 255;
  return encoded <= 0.04045
    ? encoded / 12.92
    : ((encoded + 0.055) / 1.055) ** 2.4;
}

function linearToSrgbByte(value) {
  const linear = clamp(value);
  const encoded =
    linear <= 0.0031308
      ? linear * 12.92
      : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(clamp(encoded) * 255);
}

function multiplyMatrix(columns, vector) {
  return [
    columns[0][0] * vector[0] +
      columns[1][0] * vector[1] +
      columns[2][0] * vector[2],
    columns[0][1] * vector[0] +
      columns[1][1] * vector[1] +
      columns[2][1] * vector[2],
    columns[0][2] * vector[0] +
      columns[1][2] * vector[1] +
      columns[2][2] * vector[2],
  ];
}

const linearSrgbToRec2020 = [
  [0.6274, 0.0691, 0.0164],
  [0.3293, 0.9195, 0.088],
  [0.0433, 0.0113, 0.8956],
];
const linearRec2020ToSrgb = [
  [1.6605, -0.1246, -0.0182],
  [-0.5876, 1.1329, -0.1006],
  [-0.0728, -0.0083, 1.1187],
];
const agxInset = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
];
const agxOutset = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
];

function agxContrast(value) {
  const x = clamp(value);
  const x2 = x * x;
  const x4 = x2 * x2;
  return (
    15.5 * x4 * x2 -
    40.14 * x4 * x +
    31.96 * x4 -
    6.868 * x2 * x +
    0.4298 * x2 +
    0.1191 * x -
    0.00232
  );
}

function agxToneMap(input) {
  const agxMinEv = -12.47393;
  const agxMaxEv = 4.026069;
  let color = multiplyMatrix(
    linearSrgbToRec2020,
    input.map((value) => value * exposure),
  );
  color = multiplyMatrix(agxInset, color);
  color = color.map((value) => {
    const encoded =
      (Math.log2(Math.max(value, 1e-10)) - agxMinEv) /
      (agxMaxEv - agxMinEv);
    return agxContrast(encoded);
  });
  color = multiplyMatrix(agxOutset, color).map(
    (value) => Math.max(0, value) ** 2.2,
  );
  return multiplyMatrix(linearRec2020ToSrgb, color).map((value) =>
    clamp(value),
  );
}

async function loadRgb(path) {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height || info.channels !== 3) {
    throw new Error(
      `${path} must be the ${width}x${height} three-channel hero texture`,
    );
  }
  return data;
}

async function loadLut(path, size) {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    info.width !== size * size ||
    info.height !== size ||
    info.channels !== 3
  ) {
    throw new Error(`${path} must be a ${size ** 2}x${size} display LUT`);
  }
  return data;
}

function sampleDisplayLut(data, size, color) {
  const scaled = color.map((value) => clamp(value) * (size - 1));
  const low = scaled.map(Math.floor);
  const high = low.map((value) => Math.min(value + 1, size - 1));
  const fraction = scaled.map((value, index) => value - low[index]);
  const sample = (red, green, blue, channel) => {
    const fileRow = size - 1 - green;
    const index = (fileRow * size * size + blue * size + red) * 3 + channel;
    return data[index];
  };
  const interpolate = (left, right, amount) =>
    left + (right - left) * amount;
  return [0, 1, 2].map((channel) => {
    const blueSamples = [low[2], high[2]].map((blue) => {
      const greenSamples = [low[1], high[1]].map((green) =>
        interpolate(
          sample(low[0], green, blue, channel),
          sample(high[0], green, blue, channel),
          fraction[0],
        ),
      );
      return interpolate(greenSamples[0], greenSamples[1], fraction[1]);
    });
    return srgbToLinear(
      interpolate(blueSamples[0], blueSamples[1], fraction[2]),
    );
  });
}

function decodeFirstVideoFrame(path) {
  const output = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      path,
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    { maxBuffer: width * height * channels * 2 },
  );
  if (output.length !== width * height * channels) {
    throw new Error(`decoded hero frame has ${output.length} bytes`);
  }
  return output;
}

if (
  !treatment?.gain ||
  !treatment?.offset ||
  !Number.isFinite(treatment.gainRange) ||
  !Number.isFinite(treatment.offsetRange)
) {
  throw new Error("manifest is missing the calibrated hero treatment");
}
if (profile?.width !== 2560 || profile?.height !== 1440) {
  throw new Error("wide authored profile is unavailable");
}

const [gain, offset, reference, displayLut] = await Promise.all([
  loadRgb(resolve(repositoryRoot, `public${treatment.gain}`)),
  loadRgb(resolve(repositoryRoot, `public${treatment.offset}`)),
  loadRgb(resolve(repositoryRoot, "build/wo-0117-r/hero-treated-first-frame.png")),
  treatment.displayLut && treatment.displayLutSize
    ? loadLut(
        resolve(repositoryRoot, `public${treatment.displayLut}`),
        treatment.displayLutSize,
      )
    : null,
]);
const source = decodeFirstVideoFrame(
  resolve(repositoryRoot, "public/videos/hero-print-placeholder.mp4"),
);
const errors = [];
const predicted = Buffer.alloc(source.length);
const errorMap = Buffer.alloc(source.length);
let totalError = 0;
let pixelsOverEight = 0;
const hotRows = new Uint32Array(height);
const hotColumns = new Uint32Array(width);

for (let index = 0; index < source.length; index += channels) {
  let treated = [0, 1, 2].map(
    (channel) =>
      srgbToLinear(source[index + channel]) *
        ((gain[index + channel] / 255) * treatment.gainRange) +
      (offset[index + channel] / 255) * treatment.offsetRange,
  );
  if (
    treatment.kind === "scene-linear-blender-agx-lut-room-response" &&
    displayLut
  ) {
    treated = sampleDisplayLut(
      displayLut,
      treatment.displayLutSize,
      treated,
    );
  } else if (treatment.kind === "scene-linear-agx-room-response") {
    treated = agxToneMap(treated);
  } else if (treatment.kind !== "calibrated-affine-room-response") {
    throw new Error(`unsupported hero treatment ${String(treatment.kind)}`);
  }
  for (let channel = 0; channel < channels; channel += 1) {
    const error = Math.abs(
      linearToSrgbByte(treated[channel]) - reference[index + channel],
    );
    predicted[index + channel] = linearToSrgbByte(treated[channel]);
    errorMap[index + channel] = Math.min(255, error * 8);
    errors.push(error);
    totalError += error;
    if (error > 8) pixelsOverEight += 1;
    if (error > 8) {
      const pixelIndex = index / channels;
      hotRows[Math.floor(pixelIndex / width)] += 1;
      hotColumns[pixelIndex % width] += 1;
    }
  }
}

errors.sort((left, right) => left - right);
const mae = totalError / errors.length;
const p95 = errors[Math.floor(errors.length * 0.95)];
const overEightRatio = pixelsOverEight / errors.length;
const summary = {
  treatment: treatment.kind,
  mae: Number(mae.toFixed(3)),
  p95,
  overEightRatio: Number(overEightRatio.toFixed(4)),
  hottestRow: hotRows.indexOf(Math.max(...hotRows)),
  hottestColumn: hotColumns.indexOf(Math.max(...hotColumns)),
};

if (process.argv.includes("--debug")) {
  const options = { raw: { width, height, channels } };
  await Promise.all([
    sharp(predicted, options)
      .png()
      .toFile(
        resolve(repositoryRoot, "build/wo-0117-r/hero-treatment-predicted.png"),
      ),
    sharp(errorMap, options)
      .png()
      .toFile(resolve(repositoryRoot, "build/wo-0117-r/hero-treatment-error.png")),
  ]);
}

if (mae > 2.2 || p95 > 12 || overEightRatio > 0.08) {
  console.error(`FAIL hero room treatment ${JSON.stringify(summary)}`);
  process.exit(1);
}

console.log(`PASS hero room treatment ${JSON.stringify(summary)}`);
