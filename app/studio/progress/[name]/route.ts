import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

/** Serves docs/progress/ screenshots to the Studio. */
export const dynamic = "force-dynamic";

const FILENAME_PATTERN = /^(R-)?\d{4}[A-Za-z0-9-]*\.png$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!FILENAME_PATTERN.test(name)) {
    return new NextResponse(null, { status: 400 });
  }
  try {
    const file = await readFile(
      path.join(process.cwd(), "docs", "progress", name),
    );
    return new NextResponse(new Uint8Array(file), {
      headers: { "Content-Type": "image/png" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
