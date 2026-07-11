import { execSync } from "child_process";
import { readdirSync, readFileSync } from "fs";
import path from "path";

/**
 * Studio state derivation (INFRASTRUCTURE WORK ORDER 0002).
 * Everything shown in /studio and /studio/state.json is derived live from
 * the repository — PROJECT_STATUS.md, BUILD_REPORT.md, docs/progress/, and
 * git — so the Studio never requires manual editing and never duplicates a
 * source of truth.
 */

const ROOT = process.cwd();
const PROGRESS_DIR = path.join(ROOT, "docs", "progress");

export type LockStatus = "locked" | "in-review" | "not-started";

export interface CreativeLock {
  status: LockStatus;
  text: string;
}

export interface ProjectState {
  /** Bump only for breaking shape changes; additive fields are free. */
  schemaVersion: 1;
  version: string;
  phase: string;
  currentWorkOrder: string;
  latestCommit: string;
  latestScreenshot: string | null;
  /** All progress screenshots, newest first. */
  screenshots: string[];
  creativeLocks: CreativeLock[];
  decisionsRequired: string[];
  /** The latest Build Report, verbatim markdown. */
  buildReport: string;
}

function readDocsFile(name: string): string {
  try {
    return readFileSync(path.join(ROOT, "docs", name), "utf8");
  } catch {
    return "";
  }
}

/** Extract one `## Heading` section's body from a markdown document. */
function section(markdown: string, heading: string): string {
  /* (?![\s\S]) is true end-of-input; a bare $ with the m flag would match
     at every line end and truncate the section to its first line. */
  const match = markdown.match(
    new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |(?![\\s\\S]))`, "m"),
  );
  if (!match) return "";
  return match[1]
    .split("\n")
    .filter((line) => !/^-{3,}\s*$/.test(line))
    .join("\n")
    .trim();
}

const LOCK_MARKERS: ReadonlyArray<[string, LockStatus]> = [
  ["🔒", "locked"],
  ["🟡", "in-review"],
  ["⚪", "not-started"],
];

function parseCreativeLocks(body: string): CreativeLock[] {
  return body
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .flatMap((line) => {
      for (const [marker, status] of LOCK_MARKERS) {
        if (line.startsWith(marker)) {
          return [{ status, text: line.slice(marker.length).trim() }];
        }
      }
      return [];
    });
}

function parseDecisionsRequired(body: string): string[] {
  if (!body || /^none\.?$/i.test(body)) return [];
  return body
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Chronological ordering for progress filenames: work-order number, then
 * base captures before R- revisions of the same number, then study
 * suffixes (0006-A … 0006-E) alphabetically.
 */
function shotSortKey(name: string): [number, number, string] {
  const match = name.match(/^(R-)?(\d{4})(.*)\.(?:png|mp4|webm)$/);
  if (!match) return [Number.MAX_SAFE_INTEGER, 0, name];
  return [Number.parseInt(match[2], 10), match[1] ? 1 : 0, match[3]];
}

/** All progress captures (stills and motion reviews), newest first. */
export function listScreenshots(): string[] {
  let names: string[];
  try {
    names = readdirSync(PROGRESS_DIR).filter((name) =>
      /\.(png|mp4|webm)$/.test(name),
    );
  } catch {
    return [];
  }
  return names
    .sort((a, b) => {
      const [na, ra, sa] = shotSortKey(a);
      const [nb, rb, sb] = shotSortKey(b);
      return na - nb || ra - rb || sa.localeCompare(sb);
    })
    .reverse();
}

function latestCommit(): string {
  /* CI builds (GitHub Pages) read the commit from the environment. */
  const envSha = process.env.GITHUB_SHA;
  if (envSha) return envSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

export function getProjectState(): ProjectState {
  const status = readDocsFile("PROJECT_STATUS.md");
  const report = readDocsFile("BUILD_REPORT.md");
  const screenshots = listScreenshots();

  return {
    schemaVersion: 1,
    version: section(status, "Current Version") || "unknown",
    phase: section(status, "Current Sprint") || "unknown",
    currentWorkOrder: section(status, "Current Work Order") || "unknown",
    latestCommit: latestCommit(),
    latestScreenshot: screenshots[0] ?? null,
    screenshots,
    creativeLocks: parseCreativeLocks(section(status, "Creative Locks")),
    decisionsRequired: parseDecisionsRequired(
      section(report, "Decisions Required"),
    ),
    buildReport: report,
  };
}
