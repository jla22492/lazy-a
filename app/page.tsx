import { Wordmark } from "@/components/site/Wordmark";
import { Stage } from "@/three/scene/Stage";

export default function Home() {
  return (
    <main className="fixed inset-0">
      <Stage />
      <Wordmark />
    </main>
  );
}
