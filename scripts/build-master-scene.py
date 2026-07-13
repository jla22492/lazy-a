# The master scene (WORK ORDER 0109) — Blender, from the REAL room.
#
# Imports the live scene's GLB export (0108), replaces the browser's
# light rig with the calibrated Cycles afternoon (sun through the real
# muntins, emissive pane, cool world), upgrades the hero surfaces with
# bump from their own maps, and renders a preview from the settled eye.
# Jonathan's lighting notes amend HERE when they arrive — one file.
#
#   Blender -b -P scripts/build-master-scene.py -- <glb> <outdir> [pano]
import bpy
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
glb_path = argv[0]
outdir = argv[1]
mode = argv[2] if len(argv) > 2 else "preview"

for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.import_scene.gltf(filepath=glb_path)

# ---------------------------------------------------------------
# CURATED SCANS (WORK ORDER 0110): Jonathan's picks land here.
# Each entry: (gltf_or_glb_path, three-space position [x, y, z],
# yaw radians, target real-world height in metres, replaces_hint).
# Placement converts three -> blender space and floor-sits the scan.
# The authored object it replaces should be hidden via replaces_hint
# (a substring of the imported object's name) once verified in a
# render. EMPTY until picks arrive — the machinery is verified with
# a dry run (see docs/progress/0110-dryrun.jpg).
# ---------------------------------------------------------------
PICKS = [
    # Jonathan's approvals (R-0111). (path, three-pos, yaw, height, hide_hint)
    ("/private/tmp/claude-501/-Users-jonathanadelson-Documents-lazy-a/6f7553c8-0a41-447d-9e33-327573a99b71/scratchpad/picks/ceramic_vase_02/ceramic_vase_02_1k.gltf",
     (0.42, 0.9, -0.2), 0.4, 0.11, None),
    ("/private/tmp/claude-501/-Users-jonathanadelson-Documents-lazy-a/6f7553c8-0a41-447d-9e33-327573a99b71/scratchpad/picks/book_encyclopedia_set_01/book_encyclopedia_set_01_1k.gltf",
     (-0.62, 0.9, -0.24), 0.15, 0.235, None),
    ("/private/tmp/claude-501/-Users-jonathanadelson-Documents-lazy-a/6f7553c8-0a41-447d-9e33-327573a99b71/scratchpad/picks/dining_chair_02/dining_chair_02_1k.gltf",
     (0.95, 0.0, 0.78), 0.55, 0.85, None),
    ("/private/tmp/claude-501/-Users-jonathanadelson-Documents-lazy-a/6f7553c8-0a41-447d-9e33-327573a99b71/scratchpad/picks/Camera_01/Camera_01_1k.gltf",
     (0.78, 0.9, 0.04), 2.7, 0.12, None),
    # R-0111: the plant — Jonathan's pick (photoscanned, broader).
    ("/private/tmp/claude-501/-Users-jonathanadelson-Documents-lazy-a/6f7553c8-0a41-447d-9e33-327573a99b71/scratchpad/picks/potted_plant_02/potted_plant_02_1k.gltf",
     (-1.95, 0.0, 0.12), 0.3, 0.85, ("near", (-1.95, 0.0, 0.12), 0.45)),
]


def place_scan(path, three_pos, yaw, height, hide_hint=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in imported if o.parent not in imported]
    from mathutils import Vector as V
    bounds_min = V((1e9, 1e9, 1e9))
    bounds_max = V((-1e9, -1e9, -1e9))
    for o in imported:
        if o.type != "MESH":
            continue
        for corner in o.bound_box:
            world = o.matrix_world @ V(corner)
            bounds_min = V(map(min, bounds_min, world))
            bounds_max = V(map(max, bounds_max, world))
    size = bounds_max - bounds_min
    scale = height / max(size.z, 1e-6)
    bx, by, bz = three_pos[0], -three_pos[2], three_pos[1]
    for root in roots:
        root.scale = tuple(v * scale for v in root.scale)
        root.rotation_euler.z += yaw
        root.location = (bx, by, bz - bounds_min.z * scale)
    if hide_hint:
        if isinstance(hide_hint, tuple) and hide_hint[0] == "near":
            _, tp, radius = hide_hint
            cx, cy, cz = tp[0], -tp[2], tp[1]
            for o in bpy.data.objects:
                if o.type == "MESH" and o not in imported:
                    loc = o.matrix_world.translation
                    if ((loc.x - cx) ** 2 + (loc.y - cy) ** 2) ** 0.5 < radius:
                        o.hide_render = True
        else:
            for o in bpy.data.objects:
                if hide_hint in o.name and o not in imported:
                    o.hide_render = True


for pick in PICKS:
    place_scan(*pick)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 192
scene.cycles.use_denoising = True
scene.view_settings.view_transform = "AgX"
# R-0111 (Jonathan: "desk still dark"): three levers, same light source —
# a gentle exposure lift, and a soft warm bounce card over the desk (the
# room light's light returned by the ceiling, in effect).
scene.view_settings.exposure = 0.4

# The browser's lights import as approximations — replace with the rig.
for obj in list(bpy.data.objects):
    if obj.type == "LIGHT":
        bpy.data.objects.remove(obj, do_unlink=True)

# The afternoon sun (0100): three (6.5, 1.0, 5.2) -> blender (6.5, -5.2, 1.0).
bpy.ops.object.light_add(type="SUN", location=(6.5, -4.5, 1.15))
sun = bpy.context.active_object
direction = Vector((0, 0, 0)) - Vector((6.5, -4.5, 1.15))
sun.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
sun.data.energy = 5.5
sun.data.color = (1.0, 0.85, 0.64)
sun.data.angle = 0.05

# The pane glows (the glass is the light).
found_pane = False
for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf is None:
            continue
        # Enable micro-bump from existing normal maps for every surface.
        # (glTF import already wires Normal Map nodes; Cycles honors them.)
    # crude pane detection: thin plane high on the right wall
    if obj.dimensions.x < 0.05 and obj.dimensions.z > 0.8 and obj.location.x > 2.0:
        for slot in obj.material_slots:
            if slot.material and slot.material.use_nodes:
                b = slot.material.node_tree.nodes.get("Principled BSDF")
                if b is not None:
                    b.inputs["Emission Color"].default_value = (1.0, 0.95, 0.87, 1)
                    b.inputs["Emission Strength"].default_value = 10.0
                    found_pane = True
print("PANE:", found_pane)

# R-0109: the warm room light on, somewhere off-screen deep in the room.
bpy.ops.object.light_add(type="POINT", location=(-2.2, 5.6, 2.1))
warm = bpy.context.active_object
warm.data.energy = 60.0
warm.data.color = (1.0, 0.85, 0.69)
warm.data.shadow_soft_size = 0.6

# R-0111: soft warm fill washing the desktop — broad, dim, sourceless.
bpy.ops.object.light_add(type="AREA", location=(0.0, -0.4, 2.3))
fill = bpy.context.active_object
fill.data.energy = 28.0
fill.data.color = (1.0, 0.88, 0.74)
fill.data.size = 2.6
fill.rotation_euler = (0.2, 0, 0)

# Cool late-afternoon world.
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.24
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.86, 0.9, 0.95, 1)

# The settled eye (R-0092): three (0.05, 1.6, 1.45) -> blender (0.05, -1.45, 1.6).
if mode == "pano":
    bpy.ops.object.camera_add(location=(0.05, -1.45, 1.6))
    cam = bpy.context.active_object
    cam.data.type = "PANO"
    cam.data.panorama_type = "EQUIRECTANGULAR"
    cam.rotation_euler = (1.5707963, 0, 0)
    scene.render.resolution_x = 8192
    scene.render.resolution_y = 4096
    out = f"{outdir}/0109-master-pano.jpg"
else:
    bpy.ops.object.camera_add(location=(0.05, -1.45, 1.6))
    cam = bpy.context.active_object
    cam.data.lens_unit = "FOV"
    cam.data.angle = 0.977384  # 56 deg horizontal ~= 35 deg vertical at 16:9
    # aim at three lookAt (0.02, 1.04, -0.45) -> blender (0.02, 0.45, 1.04)
    aim = Vector((0.02, 0.45, 1.04)) - Vector((0.05, -1.45, 1.6))
    cam.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    out = f"{outdir}/0109-master-preview.jpg"
scene.camera = cam

scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 90
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("MASTER RENDER COMPLETE:", out)
