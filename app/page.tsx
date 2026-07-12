import { Stage } from "@/three/scene/Stage";

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
