import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";

const FILENAME_PATTERN = /^(R-)?\d{4}[A-Za-z0-9-]*\.png$/;
const PNG_PREFIX = "data:image/png;base64,";

/**
 * Development-only endpoint backing the progress-screenshot convention
 * (docs/progress/NNNN.png, one per Work Order). Never available in
 * production builds.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const { filename, dataUrl } = (await request.json()) as {
    filename?: string;
    dataUrl?: string;
  };

  if (!filename || !FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }
  if (!dataUrl?.startsWith(PNG_PREFIX)) {
    return NextResponse.json(
      { error: "expected a PNG data URL" },
      { status: 400 },
    );
  }

  const directory = path.join(process.cwd(), "docs", "progress");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, filename),
    Buffer.from(dataUrl.slice(PNG_PREFIX.length), "base64"),
  );

  return NextResponse.json({ saved: filename });
}
