#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { createGzip } from "node:zlib";

const root = path.resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? 3018);

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".glb", "model/gltf-binary"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".txt", "text/plain; charset=utf-8"],
  [".webm", "video/webm"],
]);

function resolvedRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://local").pathname);
  const relative = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const absolute = path.resolve(root, `.${relative}`);
  return absolute === root || absolute.startsWith(`${root}${path.sep}`)
    ? absolute
    : null;
}

function parseRange(value, size) {
  const match = value?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= size) {
    return null;
  }
  return { start, end };
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  const file = resolvedRequestPath(request.url ?? "/");
  if (!file) {
    response.writeHead(403).end();
    return;
  }

  let fileStat;
  try {
    fileStat = await stat(file);
  } catch {
    response.writeHead(404).end();
    return;
  }
  if (!fileStat.isFile()) {
    response.writeHead(404).end();
    return;
  }

  const headers = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Type": MIME_TYPES.get(path.extname(file)) ?? "application/octet-stream",
  };
  const requestedRange = request.headers.range;
  const range = requestedRange ? parseRange(requestedRange, fileStat.size) : null;
  if (requestedRange && !range) {
    response.writeHead(416, {
      ...headers,
      "Content-Range": `bytes */${fileStat.size}`,
    }).end();
    return;
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? fileStat.size - 1;
  const acceptsGzip = /(?:^|,)\s*gzip(?:\s*;|\s*,|$)/i.test(
    request.headers["accept-encoding"] ?? "",
  );
  const contentType = headers["Content-Type"];
  const compress =
    !range &&
    acceptsGzip &&
    (contentType.startsWith("text/") ||
      contentType.startsWith("application/json") ||
      contentType.startsWith("text/javascript"));
  response.writeHead(range ? 206 : 200, {
    ...headers,
    ...(compress
      ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" }
      : { "Content-Length": end - start + 1 }),
    ...(range
      ? { "Content-Range": `bytes ${start}-${end}/${fileStat.size}` }
      : {}),
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(file, { start, end });
  if (compress) {
    stream.pipe(createGzip()).pipe(response);
  } else {
    stream.pipe(response);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}/ with byte ranges`);
});
