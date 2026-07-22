import type { NextConfig } from "next";

/** STATIC_EXPORT=1 produces the public GitHub Pages artifact. */
const staticExport = process.env.STATIC_EXPORT === "1";

function deploymentBasePath(value: string | undefined): string {
  if (value === undefined) return "/lazy-a";
  const path = value.trim();
  if (path === "") return "";
  if (!path.startsWith("/") || path.endsWith("/") || path.includes("//")) {
    throw new Error(
      `PAGES_BASE_PATH must be empty or one clean absolute segment path; received ${JSON.stringify(value)}`,
    );
  }
  return path;
}

const pagesBasePath = deploymentBasePath(process.env.PAGES_BASE_PATH);

const nextConfig: NextConfig = staticExport
  ? {
      output: "export",
      ...(pagesBasePath ? { basePath: pagesBasePath } : {}),
      trailingSlash: true,
      /* Plain-URL assets (video textures) prepend this themselves via
         lib/assetPath — the framework only rewrites imports and links. */
      env: { NEXT_PUBLIC_BASE_PATH: pagesBasePath },
    }
  : { env: { NEXT_PUBLIC_BASE_PATH: "" } };

export default nextConfig;
