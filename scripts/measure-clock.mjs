/**
 * The stranger's clock, measured (WORK ORDER 0093) — Jonathan's 4/5/6
 * acceptance criteria, taken from a real browser session the way a
 * visitor experiences it, never estimated:
 *
 *   ≤4s  the arrival settles into the seated working position
 *   ~5s  the hero print begins to move, unprompted
 *   ≤6s  a destination answers attention (rest → label)
 *
 *   node scripts/measure-clock.mjs [url]
 *
 * Method: page time zero is navigation commit. The settle is detected
 * by a static wall region ceasing to change; the magic by the hero
 * region beginning to change AFTER the settle; the answer by resting
 * the pointer on the notebook at 6s-minus-dwell and timing the label.
 */

import { chromium } from "playwright";

const url = process.argv[2] ?? "https://jla22492.github.io/lazy-a/";
const JOURNAL_REST = [890, 584];

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: "commit" });

const beats = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const t0 = performance.now();
      const g = document.createElement("canvas").getContext("2d");
      g.canvas.width = 320;
      g.canvas.height = 180;
      let prevWall = null;
      let prevHero = null;
      let settleAt = null;
      let stillFrames = 0;
      let magicAt = null;
      let heroMovedStreak = 0;
      const sample = () => {
        const c = document.querySelector("canvas");
        if (!c) return null;
        g.drawImage(c, 0, 0, 320, 180);
        const wall = g.getImageData(70, 40, 50, 30).data;
        const hero = g.getImageData(232, 30, 46, 72).data; /* film interior only — the streamed wall upgrades must not read as magic */
        return { wall, hero };
      };
      const diff = (a, b) => {
        if (!a || !b) return Infinity;
        let max = 0;
        for (let i = 0; i < a.length; i += 7) {
          const d = Math.abs(a[i] - b[i]);
          if (d > max) max = d;
        }
        return max;
      };
      const tick = setInterval(() => {
        const s = sample();
        if (!s) return;
        const now = (performance.now() - t0) / 1000;
        const wallMoved = diff(prevWall, s.wall) > 4;
        const heroMoved = diff(prevHero, s.hero) > 6;
        if (prevWall) {
          if (settleAt === null) {
            /* The settle: the wall stops moving and stays stopped. */
            if (!wallMoved && now > 1.5) {
              stillFrames += 1;
              if (stillFrames >= 4) settleAt = now - 0.4;
            } else {
              stillFrames = 0;
            }
          } else if (magicAt === null) {
            /* Sustained motion only: the poster image's one-frame
               pop-in must not count as the magic. */
            heroMovedStreak = heroMoved ? heroMovedStreak + 1 : 0;
            if (heroMovedStreak >= 3) magicAt = now - 0.2;
          }
        }
        prevWall = s.wall;
        prevHero = s.hero;
        if ((settleAt !== null && magicAt !== null) || now > 12) {
          clearInterval(tick);
          resolve({ settleAt, magicAt });
        }
      }, 100);
    }),
);

/* The answer: rest on the notebook, time the label's appearance. */
await page.mouse.move(200, 300);
const restStart = Date.now();
await page.mouse.move(JOURNAL_REST[0], JOURNAL_REST[1], { steps: 5 });
let answerMs = null;
for (let i = 0; i < 40; i++) {
  const visible = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("div")].filter(
      (n) => n.textContent === "JOURNAL" && n.children.length === 0,
    );
    return nodes.length && getComputedStyle(nodes[0]).opacity === "1";
  });
  if (visible) {
    answerMs = Date.now() - restStart;
    break;
  }
  await page.waitForTimeout(50);
}
await browser.close();

const settle = beats.settleAt;
const magic = beats.magicAt;
const answer = answerMs === null ? null : answerMs / 1000;
const verdicts = [
  ["settle ≤ 4s", settle, settle !== null && settle <= 4],
  ["magic ≈ 5s (4–6s window)", magic, magic !== null && magic >= 4 && magic <= 6],
  ["answer ≤ 1s of rest", answer, answer !== null && answer <= 1],
];
let failed = 0;
for (const [name, value, ok] of verdicts) {
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}: ${value === null ? "not detected" : value.toFixed(2) + "s"}`,
  );
}
process.exit(failed ? 1 : 0);
