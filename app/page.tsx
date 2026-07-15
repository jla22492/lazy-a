"use client";

import dynamic from "next/dynamic";

import { assetPath } from "@/lib/assetPath";
import { PHONE_MAX_WIDTH } from "@/lib/plateSpace";

function RoomBootstrap() {
  return (
    <picture>
      <source
        media={`(max-width: ${PHONE_MAX_WIDTH}px)`}
        srcSet={assetPath("/room/portrait/stills/opening.jpg")}
      />
      {/* The interactive room replaces this exact authored opening frame. */}
      <img
        src={assetPath("/room/wide/stills/opening.jpg")}
        alt=""
        draggable={false}
        className="room-bootstrap"
      />
    </picture>
  );
}

const Stage = dynamic(
  () => import("@/three/scene/Stage").then((module) => module.Stage),
  { loading: RoomBootstrap, ssr: false },
);

/**
 * The homepage is only the room. Since R-0087 the logo lives INSIDE it —
 * letterpress on the note pinned above the lamp — never as an overlay
 * (Jonathan's ruling: it should feel like part of the room, not like
 * every other website).
 */
export default function Home() {
  return (
    <main className="fixed inset-0">
      <Stage />
    </main>
  );
}
