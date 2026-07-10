import type { ReactNode } from "react";

import {
  getProjectState,
  type CreativeLock,
  type LockStatus,
} from "@/lib/studio";

/**
 * Production board — derived from the repository. Live per-request in
 * development; frozen at build time for the public GitHub Pages export,
 * which rebuilds on every push, so it is always current per-commit.
 */
export const dynamic = "force-static";

/** Progress images live under the Pages basePath in the public build. */
const IMAGE_PREFIX =
  process.env.STATIC_EXPORT === "1" ? "/lazy-a/studio/progress" : "/studio/progress";

export const metadata = {
  title: "Lazy A — Studio",
  robots: { index: false, follow: false },
};

const LOCK_GLYPHS: Record<LockStatus, string> = {
  locked: "🔒",
  "in-review": "🟡",
  "not-started": "⚪",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-neutral-300 pb-2 text-xs uppercase tracking-[0.25em] text-neutral-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-6">
      <dt className="w-32 shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{value}</dd>
    </div>
  );
}

/** Minimal markdown rendering for Build Reports: headings, lists, bold. */
function inlineBold(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}

function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="list-disc space-y-1 pl-5">
        {list.map((item, i) => (
          <li key={i}>{inlineBold(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  source.split("\n").forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      list.push(trimmed.slice(2));
      return;
    }
    flushList(`list-${i}`);
    if (trimmed === "" || /^-{3,}$/.test(trimmed)) return;
    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h3
          key={i}
          className="pt-2 text-xs uppercase tracking-[0.2em] text-neutral-500"
        >
          {trimmed.slice(2)}
        </h3>,
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h4 key={i} className="pt-2 font-medium text-neutral-900">
          {trimmed.slice(3)}
        </h4>,
      );
    } else {
      blocks.push(
        <p key={i} className="text-neutral-700">
          {inlineBold(trimmed)}
        </p>,
      );
    }
  });
  flushList("list-end");
  return <div className="space-y-2 text-sm leading-relaxed">{blocks}</div>;
}

function Locks({ locks }: { locks: CreativeLock[] }) {
  if (locks.length === 0) {
    return (
      <p className="text-sm text-neutral-500">No creative locks recorded.</p>
    );
  }
  return (
    <ul className="space-y-2 text-sm leading-relaxed">
      {locks.map((lock) => (
        <li key={lock.text} className="flex gap-3">
          <span aria-hidden>{LOCK_GLYPHS[lock.status]}</span>
          <span className="text-neutral-800">{lock.text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function StudioPage() {
  const state = getProjectState();

  return (
    <div className="min-h-screen overflow-y-auto bg-[#faf9f6] text-neutral-900 antialiased">
      <main className="mx-auto max-w-2xl space-y-14 px-6 py-16">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">
            Lazy A
          </p>
          <h1 className="text-lg font-medium tracking-wide">Studio</h1>
        </header>

        <Section title="Current Build">
          <dl className="space-y-2 text-sm">
            <Field label="Version" value={state.version} />
            <Field label="Commit" value={state.latestCommit} />
            <Field label="Work Order" value={state.currentWorkOrder} />
            <Field label="Phase" value={state.phase} />
          </dl>
        </Section>

        <Section title="Current Experience">
          {state.latestScreenshot ? (
            <figure className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${IMAGE_PREFIX}/${state.latestScreenshot}`}
                alt={`Latest progress screenshot (${state.latestScreenshot})`}
                className="w-full border border-neutral-200"
              />
              <figcaption className="text-xs text-neutral-500">
                {state.latestScreenshot}
              </figcaption>
            </figure>
          ) : (
            <p className="text-sm text-neutral-500">
              No progress screenshots yet.
            </p>
          )}
        </Section>

        <Section title="Build Report">
          {state.buildReport ? (
            <Markdown source={state.buildReport} />
          ) : (
            <p className="text-sm text-neutral-500">
              No Build Report recorded.
            </p>
          )}
        </Section>

        <Section title="Creative Locks">
          <Locks locks={state.creativeLocks} />
        </Section>

        <Section title="Decisions Required">
          {state.decisionsRequired.length > 0 ? (
            <ul className="space-y-3 border-l-2 border-neutral-900 pl-4 text-sm leading-relaxed">
              {state.decisionsRequired.map((decision) => (
                <li key={decision} className="font-medium">
                  {decision}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">
              No decisions currently require Creative Director review.
            </p>
          )}
        </Section>

        <Section title="Project Timeline">
          <ul className="space-y-8">
            {state.screenshots.map((shot) => (
              <li key={shot} className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${IMAGE_PREFIX}/${shot}`}
                  alt={`Progress screenshot ${shot}`}
                  className="w-full border border-neutral-200"
                />
                <p className="text-xs text-neutral-500">
                  {shot.replace(/\.png$/, "")}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  );
}
