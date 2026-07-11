import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";

const FILENAME_PATTERN = /^(R-)?\d{4}[A-Za-z0-9-]*\.(png|mp4|webm)$/;
const DATA_PREFIXES = [
  "data:image/png;base64,",
  "data:video/mp4;base64,",
  "data:video/webm;base64,",
];

/**
 * Development-only endpoint backing the progress-capture convention
 * (docs/progress/NNNN.png stills and NNNN.mp4/.webm motion reviews).
 * Never available in production builds.
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
  const prefix = DATA_PREFIXES.find((p) => dataUrl?.startsWith(p));
  if (!dataUrl || !prefix) {
    return NextResponse.json(
      { error: "expected a PNG or video data URL" },
      { status: 400 },
    );
  }

  const directory = path.join(process.cwd(), "docs", "progress");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, filename),
    Buffer.from(dataUrl.slice(prefix.length), "base64"),
  );

  return NextResponse.json({ saved: filename });
}
