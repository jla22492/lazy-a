#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "public/room/manifest.json"), "utf8"),
);

function percentile(values, amount) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * amount))];
}

function measure(values, width, height) {
  if (values.length === 0 || width <= 0 || height <= 0) {
    return { darkContrast: 0, edgeP95: 0, edgeP99: 0 };
  }
  const edges = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x + 1 < width) edges.push(Math.abs(values[index] - values[index + 1]));
      if (y + 1 < height) edges.push(Math.abs(values[index] - values[index + width]));
    }
  }
  const median = percentile(values, 0.5);
  return {
    darkContrast: median - percentile(values, 0.1),
    edgeP95: percentile(edges, 0.95),
    edgeP99: percentile(edges, 0.99),
  };
}

function readable(metrics) {
  return metrics.darkContrast >= 6 && metrics.edgeP95 >= 1.5 && metrics.edgeP99 >= 4;
}

async function addressPixels(profile, endpoint) {
  const imagePath = path.join(root, `public/room/proof/${profile}-${endpoint}.jpg`);
  const { data, info } = await sharp(imagePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const quad = manifest.variants[profile].contact.addressScreenQuads[endpoint];
  assert.equal(quad.length, 8, `${profile}: ${endpoint} address quad`);
  const xs = [quad[0], quad[2], quad[4], quad[6]];
  const ys = [quad[1], quad[3], quad[5], quad[7]];
  const left = Math.max(0, Math.floor(Math.min(...xs) * info.width));
  const right = Math.min(info.width, Math.ceil(Math.max(...xs) * info.width));
  const top = Math.max(0, Math.floor(Math.min(...ys) * info.height));
  const bottom = Math.min(info.height, Math.ceil(Math.max(...ys) * info.height));
  const width = right - left;
  const height = bottom - top;
  const values = [];
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      values.push(
        data[offset] * 0.2126 +
          data[offset + 1] * 0.7152 +
          data[offset + 2] * 0.0722,
      );
    }
  }
  return { values, width, height };
}

const failures = [];
for (const profile of ["wide", "portrait"]) {
  const restingCrop = await addressPixels(profile, "desk");
  const activeCrop = await addressPixels(profile, "contact");
  assert.ok(
    activeCrop.values.length > 0 && activeCrop.width > 0 && activeCrop.height > 0,
    `${profile}: activated CONTACT crop must be visible`,
  );
  const resting = measure(restingCrop.values, restingCrop.width, restingCrop.height);
  const active = measure(activeCrop.values, activeCrop.width, activeCrop.height);
  if (!readable(active)) failures.push(`${profile} active: ${JSON.stringify(active)}`);
  if (
    active.darkContrast < resting.darkContrast + 4 ||
    active.edgeP95 < resting.edgeP95 + 0.5 ||
    active.edgeP99 < resting.edgeP99 + 2
  ) {
    failures.push(
      `${profile} activation delta: resting=${JSON.stringify(resting)} active=${JSON.stringify(active)}`,
    );
  }

  const blank = new Array(activeCrop.values.length).fill(
    percentile(activeCrop.values, 0.5),
  );
  assert.equal(
    readable(measure(blank, activeCrop.width, activeCrop.height)),
    false,
    `${profile}: blank-paper negative control must fail`,
  );
  console.log(`PASS ${profile} CONTACT proof activation`, { resting, active });
}

if (failures.length) {
  console.error("CONTACT proof readability failed:\n  - " + failures.join("\n  - "));
  process.exit(1);
}

console.log(
  "CONTACT proof resting-to-lit activation and blank-paper negative controls passed.",
);
