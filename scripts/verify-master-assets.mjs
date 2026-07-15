#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

const suppliedArchive = (details) => ({
  archivePath: `${dirname(details.entryPoint)}/source.zip`,
  ...details,
});

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
  suppliedArchive({
    id: "mug",
    entryPoint: "assets/master/scans/coffee-cup/scene.gltf",
    archiveSha256:
      "58371d1d881e0808535ab221697fb613af52ead7d6752c1eff65be2169efa0d9",
    creator: "Ane07",
    source:
      "https://sketchfab.com/3d-models/red-mug-bdf703f536454fe9bae49000dbb73d26",
    license: "SKETCHFAB Standard",
    licensePath: "assets/master/scans/coffee-cup/license.txt",
    licenseSha256:
      "2f6af0f21674bf8805bc026a3496010a400c8583fc0fd19f4e9ebee5b6ee44e5",
  }),
  suppliedArchive({
    id: "lamp",
    entryPoint: "assets/master/scans/desk-lamp/scene.gltf",
    archiveSha256:
      "99a81c159ba7c625a886b980a4362d234101b4b1fe8de63d46d5c0f14323a167",
    creator: "olleli1125",
    source:
      "https://sketchfab.com/3d-models/desk-lamp-7be9e6cbf6e04365a028217a4874730e",
    license: "CC-BY-4.0",
    licensePath: "assets/master/scans/desk-lamp/license.txt",
    licenseSha256:
      "3ff3784606178d12a1f5d0ccfc601fd3651f0214f6aa8981b993173574215197",
  }),
  suppliedArchive({
    id: "plant",
    entryPoint: "assets/master/scans/peace-lily/scene.gltf",
    archiveSha256:
      "9849a44503eb54c66cbbd90876e15f7f48c5c9c23106c5f08130f587b336836f",
    creator: "aqpetteri",
    source:
      "https://sketchfab.com/3d-models/peace-lily-9036c0e1761b471aa4e8035d8e972308",
    license: "CC-BY-4.0",
    licensePath: "assets/master/scans/peace-lily/license.txt",
    licenseSha256:
      "2f7a46855ed7b4c495171151fdfb9f2839ed9b3a58ef7eee4d944c8013fce35d",
  }),
  { id: "blanket", entryPoint: "assets/master/scans/blanket/texture.jpg" },
  suppliedArchive({
    id: "headphones",
    entryPoint: "assets/master/scans/sony-mdr-7506/scene.gltf",
    archiveSha256:
      "2bf70f31ce0df920b8e33fd90912f85ed9a28cef1b6cf1761878db7910f29eff",
    creator: "AndreiVNK",
    source:
      "https://sketchfab.com/3d-models/sony-mdr-7506-headphones-05735b74d3524f00b648231138122a28",
    license: "CC-BY-4.0",
    licensePath: "assets/master/scans/sony-mdr-7506/license.txt",
    licenseSha256:
      "2600112a2d88eef0bd6bfc15f9beba0fbda8048843b5da41da5dab7e69774eb9",
  }),
  suppliedArchive({
    id: "pictureFrame",
    entryPoint: "assets/master/scans/gold-picture-frame/scene.gltf",
    archiveSha256:
      "ab862ff4be59cd230a33f8f3d37b291cdfe72aa73d142adcbf70036b82b2ec71",
    creator: "balchinostudio",
    source:
      "https://sketchfab.com/3d-models/a-gold-wooden-picture-frame-0f061366cdd6451f9f996dfb5afcb0ce",
    license: "CC-BY-4.0",
    licensePath: "assets/master/scans/gold-picture-frame/license.txt",
    licenseSha256:
      "85ebac1454df857d36ffa6dbc9a962065a7b97df6f5a2a2064d2eedafbc31c34",
  }),
  suppliedArchive({
    id: "trashCan",
    entryPoint: "assets/master/scans/trash-can/source/trash_can.glb",
    archivePath: "assets/master/scans/trash-can/source.zip",
    archiveSha256:
      "b8f0d4847f0cd6ebb491e2557f4d2bb42c71afe18d884e7148f2672f2006fb09",
    creator: "Unresolved; user-supplied archive contains no attribution metadata",
    source: "User-supplied archive: trash-can_mesh.zip",
    license: "Unresolved; user-supplied archive contains no license metadata",
  }),
  suppliedArchive({
    id: "basketball",
    entryPoint: "assets/master/scans/basketball/scene.gltf",
    archiveSha256:
      "df7768fc1fcc39e36ca1cebb45494dd4089ef91206f567b2b89d2c9556979656",
    creator: "BenAissa_Karim",
    source:
      "https://sketchfab.com/3d-models/basketball-ff3b7016740e403f902a7ee54b07ef52",
    license: "CC-BY-4.0",
    licensePath: "assets/master/scans/basketball/license.txt",
    licenseSha256:
      "9ec95727064d95a5e9db0dbbc620f4ff04a8cef28a4b19524b60b249981d258b",
    renderableMaterials: ["Ball"],
    nonRenderableMaterials: ["Floor", "Khayt"],
  }),
  suppliedArchive({
    id: "seating",
    entryPoint: "assets/master/scans/leather-seating/scene.gltf",
    entryPointSha256:
      "c4aa1870e45653a81918c7baa3768e6ba00ce02ce6a46cf8ae66c3ee69cc1662",
    dependencySha256: {
      "assets/master/scans/leather-seating/scene.bin":
        "b4f8b4a691c82b083e1db0252a9e9b3e858441277d34eebb6da470cb48f29040",
      "assets/master/scans/leather-seating/textures/TEXSET_A_baseColor.png":
        "897ffaf4de937c03be2a9416298da290a796b2b8a9208168a3f2c16ae258ad64",
      "assets/master/scans/leather-seating/textures/TEXSET_A_emissive.png":
        "6b94b0a78362f7208ccaf9f63e6d3cf965697ebec141f92cab8173198b7ecabf",
      "assets/master/scans/leather-seating/textures/TEXSET_A_metallicRoughness.png":
        "847e3312ce6389cfe79378dd23f4ea40ef6b279492a6ef1c23ef4483a1afd8a7",
      "assets/master/scans/leather-seating/textures/TEXSET_A_normal.png":
        "c1d6c5a7fa13819879e994bf6f8216581f5e3f27e4276eabc50a817370bae356",
    },
    archiveSha256:
      "efbe16f542ff58b54b03c1a195dac3a0d3032d2dd30ab4b8d60c40e086687169",
    creator: "YJ_",
    source:
      "https://sketchfab.com/3d-models/leather-armchair-coffee-table-floorlamp-fcce92a09de84456a071ea6117b57cbc",
    license: "CC-BY-4.0",
    licensePath: "assets/master/scans/leather-seating/license.txt",
    licenseSha256:
      "b9140285ea6836aa01346e45f7f83c64ea6234ff15d7043451ea373597cf1204",
  }),
  {
    id: "logo",
    entryPoint: "assets/master/brand/lazy-a-logo-letterpress.png",
    entryPointSha256:
      "599bec1d52fc8a78fa7a0d5fff5db51502655769e11abd32818cdc236563664f",
    creator: "Lazy A Productions",
    source: "User-supplied master letterpress artwork",
    license: "Proprietary brand artwork",
    dimensions: { width: 2000, height: 1588 },
  },
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
  { label: "/tmp", pattern: /\/tmp(?:\/|\b)/ },
  { label: "Downloads", pattern: /\bDownloads\b/ },
  { label: "Path.home()", pattern: /\bPath\.home\s*\(/ },
  { label: "Python tempfile", pattern: /\btempfile\b/ },
  { label: "temporary environment path", pattern: /\b(?:TMPDIR|TEMP|TMP)\b/ },
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

  for (const {
    entryPoint,
    archivePath,
    licensePath,
    dependencySha256,
  } of required) {
    for (const requiredPath of [archivePath, licensePath].filter(Boolean)) {
      try {
        const details = await stat(absolutePath(requiredPath));
        if (!details.isFile() || details.size === 0) missing.push(requiredPath);
      } catch {
        missing.push(requiredPath);
      }
    }

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

    for (const [dependency, expectedHash] of Object.entries(
      dependencySha256 ?? {},
    )) {
      try {
        const details = await stat(absolutePath(dependency));
        if (!details.isFile() || details.size === 0) {
          missing.push(dependency);
          continue;
        }
        const actualHash = await sha256(dependency);
        if (actualHash !== expectedHash) {
          missing.push(
            `${dependency} hash ${actualHash} expected ${expectedHash}`,
          );
        }
      } catch {
        missing.push(dependency);
      }
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

  for (const asset of required) {
    const { id, entryPoint } = asset;
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
      if (
        asset.entryPointSha256 &&
        actualEntryPointHash !== asset.entryPointSha256
      ) {
        issues.push(
          `id "${id}" entry point hash ${actualEntryPointHash} expected ${asset.entryPointSha256}`,
        );
      }

      for (const field of ["creator", "source", "license"]) {
        if (asset[field] && credit[field] !== asset[field]) {
          issues.push(
            `id "${id}" ${field}=${JSON.stringify(credit[field])} expected ${JSON.stringify(asset[field])}`,
          );
        }
      }

      if (asset.dimensions) {
        const source = await readFile(absolutePath(entryPoint));
        const pngSignature = "89504e470d0a1a0a";
        if (
          source.length < 24 ||
          source.subarray(0, 8).toString("hex") !== pngSignature
        ) {
          issues.push(`id "${id}" entry point is not a valid PNG`);
        } else {
          const width = source.readUInt32BE(16);
          const height = source.readUInt32BE(20);
          if (
            width !== asset.dimensions.width ||
            height !== asset.dimensions.height
          ) {
            issues.push(
              `id "${id}" dimensions=${width}x${height} expected ${asset.dimensions.width}x${asset.dimensions.height}`,
            );
          }
        }
      }

      if (asset.archivePath) {
        if (credit.archivePath !== asset.archivePath) {
          issues.push(
            `id "${id}" must use archivePath "${asset.archivePath}"`,
          );
        }

        try {
          const actualArchiveHash = await sha256(asset.archivePath);
          if (actualArchiveHash !== asset.archiveSha256) {
            issues.push(
              `id "${id}" source archive hash ${actualArchiveHash} expected ${asset.archiveSha256}`,
            );
          }
          if (credit.archiveSha256 !== asset.archiveSha256) {
            issues.push(
              `id "${id}" archiveSha256=${credit.archiveSha256} expected ${asset.archiveSha256}`,
            );
          }
        } catch (error) {
          if (error?.code !== "ENOENT") throw error;
        }
      } else {
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

      if (asset.renderableMaterials) {
        if (
          JSON.stringify(credit.renderableMaterials) !==
          JSON.stringify(asset.renderableMaterials)
        ) {
          issues.push(
            `id "${id}" renderableMaterials must be ["Ball"]`,
          );
        }
        if (
          JSON.stringify(credit.nonRenderableMaterials) !==
          JSON.stringify(asset.nonRenderableMaterials)
        ) {
          issues.push(
            `id "${id}" nonRenderableMaterials must be ["Floor","Khayt"]`,
          );
        }

        const gltf = JSON.parse(await readFile(absolutePath(entryPoint), "utf8"));
        const materialNames = new Set(
          (gltf.materials ?? []).map((material) => material.name),
        );
        for (const material of [
          ...asset.renderableMaterials,
          ...asset.nonRenderableMaterials,
        ]) {
          if (!materialNames.has(material)) {
            issues.push(`id "${id}" entry point is missing material "${material}"`);
          }
        }
      }

      if (asset.licensePath) {
        const actualLicenseHash = await sha256(asset.licensePath);
        if (actualLicenseHash !== asset.licenseSha256) {
          issues.push(
            `id "${id}" license hash ${actualLicenseHash} expected ${asset.licenseSha256}`,
          );
        }
        if (credit.licenseSha256 !== asset.licenseSha256) {
          issues.push(
            `id "${id}" licenseSha256=${credit.licenseSha256} expected ${asset.licenseSha256}`,
          );
        }
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
