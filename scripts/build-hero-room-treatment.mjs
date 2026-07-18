#!/usr/bin/env node

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

const [sourceArgument, treatedArgument, outputArgument] = process.argv.slice(2);

if (!sourceArgument || !treatedArgument || !outputArgument) {
  console.error(
    "Usage: node scripts/build-hero-room-treatment.mjs <source.png> <treated.png> <output.png>",
  );
  process.exit(2);
}

const sourcePath = resolve(sourceArgument);
const treatedPath = resolve(treatedArgument);
const outputPath = resolve(outputArgument);

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));
const srgbToLinear = (value) => {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};
const linearToSrgbByte = (value) => {
  const clamped = Math.max(0, Math.min(1, value));
  const encoded =
    clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return clampByte(encoded * 255);
};

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

const [source, treated] = await Promise.all([
  loadRgb(sourcePath),
  loadRgb(treatedPath),
]);

if (
  source.width !== treated.width ||
  source.height !== treated.height ||
  source.channels !== 3 ||
  treated.channels !== 3
) {
  throw new Error(
    `Source ${source.width}x${source.height}x${source.channels} and treated ${treated.width}x${treated.height}x${treated.channels} images must be matching RGB rasters`,
  );
}

const transfer = Buffer.alloc(source.data.length);
let absoluteError = 0;
for (let index = 0; index < transfer.length; index += 1) {
  const sourceLinear = srgbToLinear(source.data[index]);
  const treatedLinear = srgbToLinear(treated.data[index]);
  const signedDelta = treatedLinear - sourceLinear;
  const encoded = clampByte(127.5 + signedDelta * 127.5);
  transfer[index] = encoded;

  const reconstructed = linearToSrgbByte(
    sourceLinear + (encoded / 255 - 0.5) * 2,
  );
  absoluteError += Math.abs(reconstructed - treated.data[index]);
}

const meanChannelError = absoluteError / transfer.length;
if (meanChannelError > 2) {
  throw new Error(
    `Room-treatment transfer reconstruction error ${meanChannelError.toFixed(6)} exceeds 2`,
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await sharp(transfer, {
  raw: { width: source.width, height: source.height, channels: 3 },
})
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

console.log(
  JSON.stringify({
    output: outputPath,
    dimensions: [source.width, source.height],
    encoding: "signed-linear-rgb-transfer-centered-at-0.5",
    meanChannelError: Number(meanChannelError.toFixed(6)),
  }),
);
