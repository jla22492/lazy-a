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

| ID             | Normalized entry point                                      |
| -------------- | ----------------------------------------------------------- |
| `vase`         | `assets/master/scans/ceramic-vase/scene.gltf`               |
| `books`        | `assets/master/scans/encyclopedia-books/scene.gltf`         |
| `chair`        | `assets/master/scans/vintage-office-chair/scene.gltf`       |
| `camera`       | `assets/master/scans/camera/scene.gltf`                     |
| `mug`          | `assets/master/scans/coffee-cup/scene.gltf`                 |
| `lamp`         | `assets/master/scans/desk-lamp/scene.gltf`                  |
| `plant`        | `assets/master/scans/peace-lily/scene.gltf`                 |
| `blanket`      | `assets/master/scans/blanket/texture.jpg`                   |
| `headphones`   | `assets/master/scans/sony-mdr-7506/scene.gltf`              |
| `pictureFrame` | `assets/master/scans/gold-picture-frame/scene.gltf`         |
| `trashCan`     | `assets/master/scans/trash-can/source/trash_can.glb`        |
| `basketball`   | `assets/master/scans/basketball/scene.gltf`                 |
| `seating`      | `assets/master/scans/leather-seating/scene.gltf`             |
| `logo`         | `assets/master/brand/lazy-a-logo-letterpress.png`            |

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
Every user-supplied archive also records its repository-relative `archivePath`
and exact `archiveSha256`. Poly Haven entries identify the normalized API
download because those models were retrieved as individual glTF dependencies
rather than one archive. `entryPointSha256` pins every normalized entry point;
`licenseSha256` pins each supplied license file. The gate recomputes the entry
point, recovered archive, and supplied license hashes.

Poly Haven creator and source facts come from its official asset API and use
the site's CC0 license. Sketchfab creator, source, and license facts come from
the supplied archive metadata. The recovered chair, mug, lamp, blanket,
headphones, peace lily, picture frame, trash can, basketball, and leather
seating archives are preserved beside their normalized entry points. The exact
original Lazy A letterpress PNG is pinned as proprietary brand artwork and must
not be redrawn or generatively altered. The trash-can archive contains no
attribution or license metadata, so both remain explicitly unresolved rather
than guessed.

The supplied basketball scene also contains display geometry. Its credits
record is an import contract: only material `Ball` is renderable; materials
`Floor` and `Khayt` are non-renderable and must be excluded by the master-scene
builder.

After building, verify the saved scene's required inventory and approved grade:

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b \
  build/wo-0117-r/master.blend -P scripts/verify-master-blend.py
```
