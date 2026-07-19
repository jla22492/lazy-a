#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

const [blackArgument, whiteArgument, gainArgument, offsetArgument] =
  process.argv.slice(2);

if (!blackArgument || !whiteArgument || !gainArgument || !offsetArgument) {
  console.error(
    "Usage: node scripts/build-hero-room-affine.mjs <black.png> <white.png> <gain.png> <offset.png>",
  );
  process.exit(2);
}

const blackPath = resolve(blackArgument);
const whitePath = resolve(whiteArgument);
const gainPath = resolve(gainArgument);
const offsetPath = resolve(offsetArgument);
const GAIN_RANGE = 1;
const OFFSET_RANGE = 0.05;

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

async function loadRgb(path) {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

const [black, white] = await Promise.all([
  loadRgb(blackPath),
  loadRgb(whitePath),
]);

if (
  black.width !== white.width ||
  black.height !== white.height ||
  black.channels !== 3 ||
  white.channels !== 3
) {
  throw new Error(
    "Black and white calibration bakes must be matching RGB rasters",
  );
}

const gain = Buffer.alloc(black.data.length);
const offset = Buffer.alloc(black.data.length);
let minimumGain = Number.POSITIVE_INFINITY;
let maximumGain = Number.NEGATIVE_INFINITY;
let maximumOffset = 0;

for (let index = 0; index < black.data.length; index += 1) {
  // Calibration bakes are stored with Blender's Raw view transform, so these
  // bytes already encode scene-linear values. The visitor applies the saved
  // AgX exposure after this affine material/light response.
  const blackLinear = black.data[index] / 255;
  const whiteLinear = white.data[index] / 255;
  const channelGain = Math.max(0, whiteLinear - blackLinear);
  offset[index] = clampByte((blackLinear / OFFSET_RANGE) * 255);
  gain[index] = clampByte((channelGain / GAIN_RANGE) * 255);
  minimumGain = Math.min(minimumGain, channelGain);
  maximumGain = Math.max(maximumGain, channelGain);
  maximumOffset = Math.max(maximumOffset, blackLinear);
}

await Promise.all([
  mkdir(dirname(gainPath), { recursive: true }),
  mkdir(dirname(offsetPath), { recursive: true }),
]);
const options = {
  raw: { width: black.width, height: black.height, channels: 3 },
};
await Promise.all([
  sharp(gain, options).png({ compressionLevel: 9 }).toFile(gainPath),
  sharp(offset, options).png({ compressionLevel: 9 }).toFile(offsetPath),
]);

console.log(
  JSON.stringify({
    gain: gainPath,
    offset: offsetPath,
    dimensions: [black.width, black.height],
    gainRange: GAIN_RANGE,
    offsetRange: OFFSET_RANGE,
    minimumGain: Number(minimumGain.toFixed(6)),
    maximumGain: Number(maximumGain.toFixed(6)),
    maximumOffset: Number(maximumOffset.toFixed(6)),
  }),
);
