/**
 * Public-asset URLs for plain string references (video textures, audio).
 *
 * Static images go through framework imports, which already understand
 * the GitHub Pages basePath; anything referenced by raw URL — a video
 * element's src, for example — must prepend it explicitly.
 */
export function assetPath(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}
