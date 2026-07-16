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

async function addressPixels(profile) {
  const imagePath = path.join(root, `public/room/proof/${profile}-contact.jpg`);
  const { data, info } = await sharp(imagePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const quad = manifest.variants[profile].contact.addressScreenQuads.contact;
  assert.equal(quad.length, 8, `${profile}: CONTACT address quad`);
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
  const crop = await addressPixels(profile);
  const metrics = measure(crop.values, crop.width, crop.height);
  if (!readable(metrics)) failures.push(`${profile}: ${JSON.stringify(metrics)}`);

  const blank = new Array(crop.values.length).fill(percentile(crop.values, 0.5));
  assert.equal(
    readable(measure(blank, crop.width, crop.height)),
    false,
    `${profile}: blank-paper negative control must fail`,
  );
  console.log(`PASS ${profile} CONTACT proof contrast`, metrics);
}

if (failures.length) {
  console.error("CONTACT proof readability failed:\n  - " + failures.join("\n  - "));
  process.exit(1);
}

console.log("CONTACT proof readability and blank-paper negative controls passed.");
