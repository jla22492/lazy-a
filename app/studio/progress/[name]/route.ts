import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

/** Serves docs/progress/ captures (stills and motion reviews) to the Studio. */
export const dynamic = "force-dynamic";

const FILENAME_PATTERN = /^(R-)?\d{4}[A-Za-z0-9-]*\.(png|mp4|webm)$/;

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  mp4: "video/mp4",
  webm: "video/webm",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!FILENAME_PATTERN.test(name)) {
    return new NextResponse(null, { status: 400 });
  }
  const extension = name.split(".").pop() ?? "png";
  try {
    const file = await readFile(
      path.join(process.cwd(), "docs", "progress", name),
    );
    return new NextResponse(new Uint8Array(file), {
      headers: { "Content-Type": CONTENT_TYPES[extension] ?? "image/png" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
