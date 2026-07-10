import { NextResponse } from "next/server";

import { getProjectState } from "@/lib/studio";

/**
 * Machine-readable project state for tools and AI assistants.
 * Live per-request in development; statically generated per-commit in the
 * public GitHub Pages export.
 */
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(getProjectState());
}
