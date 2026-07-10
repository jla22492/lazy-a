import { NextResponse } from "next/server";

import { getProjectState } from "@/lib/studio";

/** Machine-readable project state for tools and AI assistants. */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getProjectState());
}
