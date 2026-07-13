"use client";

/**
 * The loading strategy (WORK ORDER 0104) — heavy things arrive late,
 * on purpose.
 *
 * The 4-second clock is measured on a COLD visit, so nothing heavy may
 * load before the settle. Everything photographic — scanned surfaces,
 * real props, the eventual pre-rendered room — registers here instead:
 * fetches begin only after the arrival completes (plus a breath), while
 * the visitor's attention is on the hero print. The room quietly
 * upgrades itself during the magic window.
 */

type DeferredTask = () => void;

const queue: DeferredTask[] = [];
let draining = false;

function arrivalDone(): boolean {
  return Boolean(
    (window as Window & { __arrivalDone?: boolean }).__arrivalDone,
  );
}

/** A breath after the settle before the network wakes. */
const POST_SETTLE_DELAY_MS = 900;
/** Stagger between heavy fetches so none competes with the hero. */
const STAGGER_MS = 350;

function drain(): void {
  if (draining) return;
  draining = true;
  const step = () => {
    const task = queue.shift();
    if (!task) {
      draining = false;
      return;
    }
    task();
    window.setTimeout(step, STAGGER_MS);
  };
  window.setTimeout(step, POST_SETTLE_DELAY_MS);
}

function watchArrival(): void {
  if (arrivalDone()) {
    drain();
    return;
  }
  const timer = window.setInterval(() => {
    if (arrivalDone()) {
      window.clearInterval(timer);
      drain();
    }
  }, 200);
}

let watching = false;

/** Run `load` only after the room has settled; order of registration
    is the order of arrival. */
export function whenRoomIsSettled(load: DeferredTask): void {
  if (typeof window === "undefined") return;
  queue.push(load);
  if (!watching) {
    watching = true;
    watchArrival();
  } else if (arrivalDone() && !draining) {
    drain();
  }
}
