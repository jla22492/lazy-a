"use client";

import type { PlateExperienceState } from "@/lib/plateAssets";

interface ReturnToDeskProps {
  experience: PlateExperienceState;
  onClose: () => void;
}

/** A production-note tab that remains physically subordinate to the room. */
export function ReturnToDesk({ experience, onClose }: ReturnToDeskProps) {
  const visible =
    experience.phase === "resting" &&
    experience.endpoint !== "opening" &&
    experience.endpoint !== "desk";

  return (
    <button
      type="button"
      aria-label="Return to desk"
      className="room-return-tab"
      data-lazy-a-return="desk"
      hidden={!visible}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <span aria-hidden="true">← DESK</span>
    </button>
  );
}
