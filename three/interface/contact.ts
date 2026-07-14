export type ContactRevealPhase = "idle" | "revealing" | "hold" | "reversing";

export interface ContactRevealState {
  phase: ContactRevealPhase;
  mechanism: "raking-light";
  lampLevel: number;
  revealLevel: number;
  paperOpacity: number;
  standalonePlaneCount: 0;
}

type ContactRevealWindow = Window & {
  __lazyAContactLevel?: number;
  __lazyAContactReveal?: ContactRevealState;
};

const PAPER_OPACITY = 1;

let contactLevel = 0;
let contactReveal: ContactRevealState = createContactReveal("idle", 0);

function clampLevel(level: number): number {
  return Number.isFinite(level) ? Math.min(Math.max(level, 0), 1) : 0;
}

function createContactReveal(
  phase: ContactRevealPhase,
  level: number,
): ContactRevealState {
  return {
    phase,
    mechanism: "raking-light",
    lampLevel: level,
    revealLevel: level,
    paperOpacity: PAPER_OPACITY,
    standalonePlaneCount: 0,
  };
}

function phaseForLevel(
  level: number,
  previousLevel: number,
): ContactRevealPhase {
  if (level < previousLevel) return "reversing";
  if (level === 0) return "idle";
  if (level === 1) return "hold";
  return "revealing";
}

function publishContactReveal(): void {
  if (typeof window === "undefined") return;
  const contactWindow = window as ContactRevealWindow;
  contactWindow.__lazyAContactLevel = contactLevel;
  contactWindow.__lazyAContactReveal = contactReveal;
}

export function setContactLevel(level: number): void {
  const previousLevel = contactLevel;
  contactLevel = clampLevel(level);
  contactReveal = createContactReveal(
    phaseForLevel(contactLevel, previousLevel),
    contactLevel,
  );
  publishContactReveal();
}

export function getContactLevel(): number {
  return contactLevel;
}

export function getContactRevealState(): Readonly<ContactRevealState> {
  return contactReveal;
}

publishContactReveal();
