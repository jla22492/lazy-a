#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

const required = [
  { id: "vase", entryPoint: "assets/master/scans/ceramic-vase/scene.gltf" },
  {
    id: "books",
    entryPoint: "assets/master/scans/encyclopedia-books/scene.gltf",
  },
  {
    id: "chair",
    entryPoint: "assets/master/scans/vintage-office-chair/scene.gltf",
  },
  { id: "camera", entryPoint: "assets/master/scans/camera/scene.gltf" },
  { id: "mug", entryPoint: "assets/master/scans/coffee-cup/scene.gltf" },
  { id: "lamp", entryPoint: "assets/master/scans/desk-lamp/scene.gltf" },
  { id: "plant", entryPoint: "assets/master/scans/potted-plant/scene.gltf" },
  { id: "blanket", entryPoint: "assets/master/scans/blanket/texture.jpg" },
];

const builderPath = "scripts/build-master-scene.py";
const creditsPath = "assets/master/credits.json";
const requiredCreditFields = [
  "id",
  "creator",
  "source",
  "license",
  "entryPoint",
  "entryPointSha256",
];
const forbiddenBuilderReferences = [
  { label: "/private/tmp", pattern: /\/private\/tmp/ },
  { label: "~/Downloads", pattern: /~\/Downloads(?:\/|\b)/ },
  { label: "absolute macOS user path", pattern: /\/Users\/[^/\s"']+\// },
  { label: "absolute Linux user path", pattern: /\/home\/[^/\s"']+\// },
  {
    label: "absolute Windows user path",
    pattern: /[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"']+[\\/]+/i,
  },
];

function absolutePath(relativePath) {
  return fileURLToPath(
    new URL(relativePath, new URL(`file://${repositoryRoot}/`)),
  );
}

async function sha256(relativePath) {
  const content = await readFile(absolutePath(relativePath));
  return createHash("sha256").update(content).digest("hex");
}

async function findMissingAssets() {
  const missing = [];

  for (const { entryPoint } of required) {
    try {
      const details = await stat(absolutePath(entryPoint));
      if (!details.isFile() || details.size === 0) {
        missing.push(entryPoint);
        continue;
      }
      if (entryPoint.endsWith(".gltf")) {
        const gltf = JSON.parse(
          await readFile(absolutePath(entryPoint), "utf8"),
        );
        const uris = [
          ...(gltf.buffers ?? []).map((item) => item.uri),
          ...(gltf.images ?? []).map((item) => item.uri),
        ].filter((uri) => typeof uri === "string" && !uri.startsWith("data:"));
        for (const uri of uris) {
          const dependency = join(dirname(entryPoint), decodeURIComponent(uri));
          try {
            const dependencyDetails = await stat(absolutePath(dependency));
            if (!dependencyDetails.isFile() || dependencyDetails.size === 0) {
              missing.push(`${entryPoint} -> ${uri}`);
            }
          } catch {
            missing.push(`${entryPoint} -> ${uri}`);
          }
        }
      }
    } catch {
      missing.push(entryPoint);
    }
  }

  return missing;
}

async function findForbiddenReferences() {
  const source = await readFile(absolutePath(builderPath), "utf8");
  const references = [];

  source.split(/\r?\n/).forEach((line, index) => {
    for (const { label, pattern } of forbiddenBuilderReferences) {
      if (pattern.test(line)) {
        references.push(`${builderPath}:${index + 1} (${label})`);
      }
    }
  });

  return references;
}

async function findCreditIssues() {
  let credits;
  try {
    credits = JSON.parse(await readFile(absolutePath(creditsPath), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [`${creditsPath} is missing`];
    }
    return [`${creditsPath} is not valid JSON`];
  }

  if (!Array.isArray(credits)) {
    return [`${creditsPath} must contain a JSON array`];
  }

  const issues = [];
  const creditsById = new Map();

  credits.forEach((credit, index) => {
    if (!credit || typeof credit !== "object" || Array.isArray(credit)) {
      issues.push(`entry ${index + 1} must be an object`);
      return;
    }

    for (const field of requiredCreditFields) {
      if (
        !Object.hasOwn(credit, field) ||
        typeof credit[field] !== "string" ||
        credit[field].trim() === ""
      ) {
        issues.push(
          `entry ${index + 1} needs non-empty string field "${field}"`,
        );
      }
    }

    if (typeof credit.id === "string") {
      if (creditsById.has(credit.id)) {
        issues.push(`duplicate id "${credit.id}"`);
      } else {
        creditsById.set(credit.id, credit);
      }
    }
  });

  for (const { id, entryPoint } of required) {
    const credit = creditsById.get(id);
    if (!credit) {
      issues.push(`missing entry for id "${id}"`);
    } else if (credit.entryPoint !== entryPoint) {
      issues.push(`id "${id}" must use entryPoint "${entryPoint}"`);
    } else {
      const actualEntryPointHash = await sha256(entryPoint);
      if (credit.entryPointSha256 !== actualEntryPointHash) {
        issues.push(
          `id "${id}" entryPointSha256=${credit.entryPointSha256} expected ${actualEntryPointHash}`,
        );
      }

      const archivePath = join(dirname(entryPoint), "source.zip");
      try {
        const archiveDetails = await stat(absolutePath(archivePath));
        if (archiveDetails.isFile()) {
          const actualArchiveHash = await sha256(archivePath);
          if (credit.archiveSha256 !== actualArchiveHash) {
            issues.push(
              `id "${id}" archiveSha256=${credit.archiveSha256} expected ${actualArchiveHash}`,
            );
          }
        }
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  }

  for (const id of creditsById.keys()) {
    if (!required.some((asset) => asset.id === id)) {
      issues.push(`unexpected id "${id}"`);
    }
  }

  return issues;
}

function printSection(title, items) {
  if (items.length === 0) return;
  console.error(`${title}:`);
  for (const item of items) console.error(`  - ${item}`);
}

const [missingAssets, forbiddenReferences, creditIssues] = await Promise.all([
  findMissingAssets(),
  findForbiddenReferences(),
  findCreditIssues(),
]);

const issueCount =
  missingAssets.length + forbiddenReferences.length + creditIssues.length;

if (issueCount > 0) {
  console.error(`Master asset verification failed (${issueCount} issues).`);
  printSection("Missing or empty durable assets", missingAssets);
  printSection("Forbidden builder references", forbiddenReferences);
  printSection("Credits inventory", creditIssues);
  console.error(
    "Restore the approved files under assets/master/scans, use repository-relative builder paths, and complete assets/master/credits.json.",
  );
  process.exitCode = 1;
} else {
  console.log(
    `Master assets verified: ${required.length} durable entries, ${required.length} credit records, repository-relative builder paths.`,
  );
}
