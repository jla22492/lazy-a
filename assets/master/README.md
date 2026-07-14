# Durable Master Assets

This directory is the repository-owned source for the approved Work Order
0117-R master-scene inputs. The Blender builder must not depend on downloads,
temporary directories, or paths inside a particular user's home directory.

Run the reproducibility gate from anywhere inside or outside the repository:

```bash
node /path/to/lazy-a/scripts/verify-master-assets.mjs
```

The gate exits non-zero when a required entry point is missing or empty, the
builder contains a forbidden machine-local path, or the credits inventory does
not match the required IDs and entry points.

## Required Inventory

| ID        | Normalized entry point                                |
| --------- | ----------------------------------------------------- |
| `vase`    | `assets/master/scans/ceramic-vase/scene.gltf`         |
| `books`   | `assets/master/scans/encyclopedia-books/scene.gltf`   |
| `chair`   | `assets/master/scans/vintage-office-chair/scene.gltf` |
| `camera`  | `assets/master/scans/camera/scene.gltf`               |
| `mug`     | `assets/master/scans/coffee-cup/scene.gltf`           |
| `lamp`    | `assets/master/scans/desk-lamp/scene.gltf`            |
| `plant`   | `assets/master/scans/potted-plant/scene.gltf`         |
| `blanket` | `assets/master/scans/blanket/texture.jpg`             |

Keep each model's referenced buffers and source textures beside its normalized
entry point. Do not substitute a visually similar model when an approved source
is unavailable.

## Restore Procedure

1. Recover the exact archive used for the approved render.
2. Record its SHA-256 before extraction.
3. Preserve the source archive under the matching scan directory.
4. Extract the archive without renaming or discarding referenced buffers and
   textures.
5. Normalize only the entry point to the path in the table above, updating its
   relative buffer and texture URIs when necessary.
6. Complete the matching `credits.json` record from the source page and archive
   metadata, then run `node scripts/verify-master-assets.mjs`.

Compute an archive checksum with:

```bash
shasum -a 256 path/to/original-archive
```

## Credits Inventory

`credits.json` is a JSON array with one record per required ID. The gate
requires non-empty string fields `id`, `creator`, `source`, `license`, and
`entryPoint`, and requires the IDs and entry points to match the table above.
`archiveSha256` contains the original archive checksum for each recovered
user-supplied model. Poly Haven entries identify the normalized API download
because those models were retrieved as individual glTF dependencies rather
than one archive. `entryPointSha256` pins every normalized entry point; the
gate recomputes both entry-point and recovered-archive hashes.

Poly Haven creator and source facts come from its official asset API and use
the site's CC0 license. Sketchfab creator, source, and license facts come from
its official model API. The recovered chair, mug, lamp, and blanket archives
are preserved beside their normalized entry points. The lamp archive contains
no creator metadata, so that creator remains explicitly unresolved rather than
guessed; its Fab source and license are recorded.

After building, verify the saved scene's eight-ID inventory and approved grade:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b \
  build/wo-0117-r/master.blend -P scripts/verify-master-blend.py
```
