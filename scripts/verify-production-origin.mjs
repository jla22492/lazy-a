#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".txt",
  ".webmanifest",
  ".xml",
]);

const FORBIDDEN_PRODUCTION_PATHS = [
  /\/lazy-a\/_next\//,
  /\/lazy-a\/room\//,
  /\/lazy-a\/studio(?:\/|\\u002f)/,
  /NEXT_PUBLIC_BASE_PATH["']?\s*[:=]\s*["']\/lazy-a["']/,
];

async function textFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(absolute);
      }
    }
  }
  await visit(root);
  return files;
}

export async function verifyProductionOrigin(root) {
  const errors = [];
  const indexPath = path.join(root, "index.html");
  let index = "";
  try {
    index = await readFile(indexPath, "utf8");
  } catch {
    return [`missing production entrypoint: ${indexPath}`];
  }

  const files = await textFiles(root);
  let corpus = "";
  for (const file of files) {
    const source = await readFile(file, "utf8");
    corpus += `\n${source}`;
    for (const pattern of FORBIDDEN_PRODUCTION_PATHS) {
      if (pattern.test(source)) {
        errors.push(
          `subpath deployment leaked into ${path.relative(root, file)}: ${pattern}`,
        );
      }
    }
  }

  if (!index.includes('/_next/')) {
    errors.push("index.html does not reference root-hosted /_next assets");
  }
  if (!corpus.includes('/room/')) {
    errors.push("export does not reference root-hosted /room media");
  }

  return errors;
}

async function runSelfTest() {
  const scratch = await mkdtemp(path.join(tmpdir(), "lazy-a-origin-gate-"));
  try {
    const good = path.join(scratch, "good");
    const bad = path.join(scratch, "bad");
    await mkdir(path.join(good, "_next"), { recursive: true });
    await mkdir(path.join(bad, "_next"), { recursive: true });
    await writeFile(
      path.join(good, "index.html"),
      '<script src="/_next/app.js"></script><img src="/room/opening.jpg">',
    );
    await writeFile(path.join(good, "_next", "app.js"), 'const basePath="";');
    await writeFile(
      path.join(bad, "index.html"),
      '<script src="/lazy-a/_next/app.js"></script><img src="/lazy-a/room/opening.jpg">',
    );
    await writeFile(
      path.join(bad, "_next", "app.js"),
      'const NEXT_PUBLIC_BASE_PATH="/lazy-a";',
    );

    const goodErrors = await verifyProductionOrigin(good);
    const badErrors = await verifyProductionOrigin(bad);
    if (goodErrors.length !== 0 || badErrors.length < 3) {
      throw new Error(
        `self-test failed: good=${JSON.stringify(goodErrors)} bad=${JSON.stringify(badErrors)}`,
      );
    }
    console.log("PASS production-origin verifier self-test");
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv.includes("--selftest")) {
  await runSelfTest();
} else {
  const root = path.resolve(process.argv[2] ?? "out");
  const errors = await verifyProductionOrigin(root);
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exit(1);
  }
  console.log(`PASS production-root artifact: ${root}`);
}
