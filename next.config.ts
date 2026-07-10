import type { NextConfig } from "next";

/**
 * STATIC_EXPORT=1 produces the public GitHub Pages build — the Creative
 * Director's review surface at https://jla22492.github.io/lazy-a/.
 * Local development and the regular `npm run build` are unaffected.
 */
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = staticExport
  ? {
      output: "export",
      basePath: "/lazy-a",
      trailingSlash: true,
    }
  : {};

export default nextConfig;
