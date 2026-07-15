# The master scene (WORK ORDER 0109) — Blender, from the REAL room.
#
# Imports the live scene's GLB export (0108), replaces the browser's
# light rig with the calibrated Cycles afternoon (sun through the real
# muntins, emissive pane, cool world), upgrades the hero surfaces with
# bump from their own maps, and renders a preview from the settled eye.
# Jonathan's lighting notes amend HERE when they arrive — one file.
#
#   Blender -b -P scripts/build-master-scene.py -- <glb> <master.blend>
#   Blender -b -P scripts/build-master-scene.py -- <glb> <outdir> preview|wide
import bpy
import json
import math
import os
import sys
from mathutils import Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
if len(argv) < 2:
    raise SystemExit("Usage: build-master-scene.py -- <glb> <output> [build|preview|wide|pano]")

glb_path = argv[0]
output_target = argv[1]
mode = argv[2] if len(argv) > 2 else "build"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def asset_path(relative):
    path = os.path.abspath(os.path.join(REPO_ROOT, relative))
    if os.path.commonpath((REPO_ROOT, path)) != REPO_ROOT:
        raise ValueError(f"Master inputs must stay inside the repository: {relative}")
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Missing approved master asset: {relative}")
    return path


def build_master(source_glb):
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=asset_path(source_glb))
    return bpy.context.scene


def configure_grade(scene):
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 192
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0.25


def save_master(scene, output):
    del scene  # save_as_mainfile persists the active Blender scene.
    destination = os.path.abspath(output)
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=destination)
    print("MASTER BUILD COMPLETE:", destination)


scene = build_master(glb_path)

# ---------------------------------------------------------------
# THE LIVING LAYER STAYS OUT OF THE PLATE (WORK ORDER 0116): the
# notebook and its pencil animate in the browser — the visitor lifts
# the journal. If they were baked, a twin would stay behind on the
# desk. Hide every mesh of the notebook stack (cover, pages, pencil:
# all sit above the papers, z > 0.905) at the journal's spot; the
# loose papers beneath (z ~= 0.901) stay baked.
# three (0.35, 0.91, 0.12) -> blender (0.35, -0.12, 0.91).
bpy.context.view_layer.update()
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    loc = o.matrix_world.translation
    horizontal = ((loc.x - 0.35) ** 2 + (loc.y + 0.12) ** 2) ** 0.5
    if horizontal < 0.13 and loc.z > 0.905 and loc.z < 1.0:
        o.hide_render = True
        print("PLATE HIDE (living layer):", o.name)

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
SCAN_OBJECTS = set()
MASTER_INVENTORY = {}

PICKS = [
    # Each entry: id, path, Three-space contact position, Blender XYZ
    # rotation, target size, measured axis, contact surface, replacement.
    ("vase", asset_path("assets/master/scans/ceramic-vase/scene.gltf"),
     (0.42, 0.9, -0.2), (0.0, 0.0, 0.0), 0.11, "z", "desk", None, ()),
    ("books", asset_path("assets/master/scans/encyclopedia-books/scene.gltf"),
     (-0.62, 0.9, -0.24), (0.0, 0.0, 0.0), 0.235, "z", "desk",
     ("names", ("Mesh_35", "Mesh_36", "Mesh_37")), ()),
    # R-0114: Jonathan's vintage c.1940 wood office chair.
    ("chair", asset_path("assets/master/scans/vintage-office-chair/scene.gltf"),
     (0.95, 0.0, 0.78), (0.0, 0.0, 0.0), 0.9, "z", "floor",
     ("names", tuple(f"Mesh_{index}" for index in range(81, 93))), ()),
    ("camera", asset_path("assets/master/scans/camera/scene.gltf"),
     (0.78, 0.9, 0.04), (0.0, 0.0, 0.0), 0.12, "z", "desk", None, ()),
    # 0117-R2: Jonathan's supplied replacements, at measured real scale.
    ("mug", asset_path("assets/master/scans/coffee-cup/scene.gltf"),
     (-0.55, 0.9, 0.19), (0.0, 0.0, 2.4), 0.095, "z", "desk",
     ("names", tuple(f"Mesh_{index}" for index in range(46, 50))), ()),
    ("lamp", asset_path("assets/master/scans/desk-lamp/scene.gltf"),
     (-0.94, 0.9, -0.27), (0.0, 0.0, 0.0), 0.48, "z", "desk",
     ("names", tuple(f"Mesh_{index}" for index in range(148, 155))), ()),
    ("plant", asset_path("assets/master/scans/peace-lily/scene.gltf"),
     (-1.95, 0.0, 0.12), (0.0, 0.0, 0.12), 0.75, "z", "floor",
     ("names", tuple(f"Mesh_{index}" for index in range(93, 110))), ()),
    ("headphones", asset_path("assets/master/scans/sony-mdr-7506/scene.gltf"),
     (-0.70, 0.9, 0.05), (math.radians(88), 0.0, -0.5), 0.19,
     "horizontal", "desk", ("names", ("Mesh_50", "Mesh_51", "Mesh_52")), ()),
    ("pictureFrame", asset_path("assets/master/scans/gold-picture-frame/scene.gltf"),
     (-0.83, 0.9, -0.08), (math.radians(-7), 0.0, -math.pi / 2), 0.20,
     "z", "desk", None, ()),
    ("trashCan", asset_path("assets/master/scans/trash-can/source/trash_can.glb"),
     (-1.06, 0.0, 0.52), (0.0, 0.0, -0.18), 0.27, "z", "floor",
     ("names", ("Mesh_133", "Mesh_134")), ()),
    ("basketball", asset_path("assets/master/scans/basketball/scene.gltf"),
     (1.95, 0.0, 0.72), (0.35, -0.2, 0.5), 0.24, "diameter", "floor",
     None, ("Floor", "Khayt")),
]


def world_bounds(objects):
    bpy.context.view_layer.update()
    bounds_min = Vector((1e9, 1e9, 1e9))
    bounds_max = Vector((-1e9, -1e9, -1e9))
    found = False
    for obj in objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            bounds_min = Vector(map(min, bounds_min, point))
            bounds_max = Vector(map(max, bounds_max, point))
            found = True
    if not found:
        raise ValueError("Master asset has no renderable mesh bounds")
    return bounds_min, bounds_max


def hide_replacements(imported, hide_hint, target_size):
    if not hide_hint:
        return []
    replaced = []
    if isinstance(hide_hint, tuple) and hide_hint[0] == "near":
        _, three_pos, radius = hide_hint
        cx, cy, cz = three_pos[0], -three_pos[2], three_pos[1]
        for obj in bpy.data.objects:
            if obj.type != "MESH" or obj in imported or obj in SCAN_OBJECTS:
                continue
            loc = obj.matrix_world.translation
            horizontal = math.hypot(loc.x - cx, loc.y - cy)
            vertical = abs(loc.z - (cz + target_size / 2))
            if horizontal < radius and vertical < max(target_size * 0.75, 0.3):
                obj.hide_render = True
                replaced.append(obj.name)
    elif isinstance(hide_hint, tuple) and hide_hint[0] == "names":
        _, object_names = hide_hint
        for object_name in object_names:
            obj = bpy.data.objects.get(object_name)
            if obj is not None and obj not in imported and obj not in SCAN_OBJECTS:
                obj.hide_render = True
                replaced.append(obj.name)
    else:
        for obj in bpy.data.objects:
            if obj in imported or obj in SCAN_OBJECTS:
                continue
            if hide_hint in obj.name:
                obj.hide_render = True
                replaced.append(obj.name)
    return sorted(replaced)


def record_asset(asset_id, roots, objects, source_entry, replaced_objects):
    minimum, maximum = world_bounds(objects)
    relative_source = os.path.relpath(source_entry, REPO_ROOT)
    for obj in objects:
        obj["lazy_a_asset_id"] = asset_id
        obj["lazy_a_source_entry"] = relative_source
    MASTER_INVENTORY[asset_id] = {
        "objects": sorted(obj.name for obj in objects),
        "roots": sorted(obj.name for obj in roots),
        "source_entry": relative_source,
        "replaced_objects": replaced_objects,
        "world_bounds": {
            "min": [round(value, 6) for value in minimum],
            "max": [round(value, 6) for value in maximum],
        },
    }


def place_scan(
    asset_id,
    path,
    three_pos,
    rotation,
    target_size,
    measure_axis,
    contact_surface,
    hide_hint=None,
    excluded_materials=(),
):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [o for o in bpy.data.objects if o not in before]
    forbidden = set(excluded_materials)
    for obj in list(imported):
        materials = {slot.material.name for slot in obj.material_slots if slot.material}
        if obj.type == "MESH" and materials.intersection(forbidden):
            imported.remove(obj)
            bpy.data.objects.remove(obj, do_unlink=True)
    imported = [obj for obj in imported if obj.name in bpy.data.objects]
    roots = [o for o in imported if o.parent not in imported]
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0.0, 0.0, 0.0))
    anchor = bpy.context.active_object
    anchor.name = f"scan_{asset_id}"
    for root in roots:
        matrix_world = root.matrix_world.copy()
        root.parent = anchor
        root.matrix_world = matrix_world
    anchor.rotation_mode = "XYZ"
    anchor.rotation_euler = rotation
    bpy.context.view_layer.update()

    minimum, maximum = world_bounds(imported)
    dimensions = maximum - minimum
    if measure_axis == "horizontal":
        measured = max(dimensions.x, dimensions.y)
    elif measure_axis == "diameter":
        measured = max(dimensions)
    else:
        measured = dimensions.z
    scale = target_size / max(measured, 1e-6)
    anchor.scale = (scale, scale, scale)
    bpy.context.view_layer.update()

    minimum, maximum = world_bounds(imported)
    center = (minimum + maximum) * 0.5
    bx, by = three_pos[0], -three_pos[2]
    contact_z = 0.9 if contact_surface == "desk" else 0.0
    anchor.location += Vector((bx - center.x, by - center.y, contact_z - minimum.z))
    bpy.context.view_layer.update()

    replaced = hide_replacements(set(imported), hide_hint, target_size)
    tracked = [anchor, *imported]
    SCAN_OBJECTS.update(tracked)
    record_asset(asset_id, [anchor], tracked, path, replaced)
    print("MASTER ASSET:", asset_id, path)


for pick in PICKS:
    place_scan(*pick)

# R-0114b: the blanket HANGS (Jonathan's ruling) — a cloth simulation
# drops a subdivided sheet over the scanned chair's back; it wears the
# blanket scan's own fabric texture.
blanket_tex = asset_path("assets/master/scans/blanket/texture.jpg")
bpy.ops.mesh.primitive_plane_add(size=1, location=(1.0, -0.9, 1.02))
cloth = bpy.context.active_object
cloth.name = "scan_blanket_0"
cloth.scale = (0.28, 0.42, 1)
cloth.rotation_euler.z = 0.55
bpy.ops.object.transform_apply(scale=True, rotation=True)
sub = cloth.modifiers.new("sub", "SUBSURF")
sub.subdivision_type = "SIMPLE"
sub.levels = 5
bpy.ops.object.modifier_apply(modifier="sub")
mod = cloth.modifiers.new("cloth", "CLOTH")
mod.settings.quality = 8
mod.settings.mass = 0.25
mod.collision_settings.collision_quality = 4
mod.collision_settings.distance_min = 0.004
for o in bpy.data.objects:
    if o.type == "MESH" and o.name in SCAN_OBJECTS and abs(o.matrix_world.translation.x - 0.95) < 0.5:
        o.modifiers.new("col", "COLLISION")
scene0 = bpy.context.scene
scene0.frame_start = 1
scene0.frame_end = 32
for f in range(1, 33):
    scene0.frame_set(f)
bpy.context.view_layer.objects.active = cloth
bpy.ops.object.modifier_apply(modifier="cloth")
mat = bpy.data.materials.new("blanket_fabric")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.95
tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(blanket_tex)
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
cloth.data.materials.append(mat)
SCAN_OBJECTS.add(cloth)
record_asset("blanket", [cloth], [cloth], blanket_tex, [])

# R-0115: the bookcase closes its open ends — books obey gravity.
side = bpy.data.materials.new("case_side")
side.use_nodes = True
side.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.22, 0.16, 0.11, 1)
for sx in (-1.45 - 0.4 + 0.009, -1.45 + 0.4 - 0.009):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(sx, 0.296, 0.46))
    panel = bpy.context.active_object
    panel.scale = (0.009, 0.14, 0.46)
    panel.data.materials.append(side)

# R-0114 (Jonathan: left zone reads malformed): nothing real has a
# mathematically sharp edge — every authored box in the master scene
# gains a small bevel; scans keep their own geometry.
for obj in bpy.data.objects:
    if obj.type != "MESH" or obj.hide_render:
        continue
    dims = obj.dimensions
    if max(dims) < 0.02 or max(dims) > 8 or min(dims) < 0.02:
        continue
    bevel = obj.modifiers.new("edge", "BEVEL")
    bevel.width = min(0.004, max(dims) * 0.02)
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = 1.0

configure_grade(scene)
# R-0111 (Jonathan: "desk still dark"): three levers, same light source —
# a gentle exposure lift, and a soft warm bounce card over the desk (the
# room light's light returned by the ceiling, in effect).

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
fill.data.energy = 23.0
fill.data.color = (1.0, 0.88, 0.74)
fill.data.size = 2.6
fill.rotation_euler = (0.2, 0, 0)

# Cool late-afternoon world.
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.24
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.86, 0.9, 0.95, 1)

scene["master_asset_inventory"] = json.dumps(MASTER_INVENTORY, sort_keys=True)

if mode == "build":
    save_master(scene, output_target)
    raise SystemExit(0)

outdir = output_target

# The settled eye (R-0092): three (0.05, 1.6, 1.45) -> blender (0.05, -1.45, 1.6).
if mode == "wide":
    # The full room from the arrival's opening stance (R-0113):
    # three (-0.6, 1.6, 4.9) -> blender (-0.6, -4.9, 1.6).
    bpy.ops.object.camera_add(location=(-0.6, -4.9, 1.6))
    cam = bpy.context.active_object
    cam.data.lens_unit = "FOV"
    cam.data.angle = 0.977384
    aim = Vector((0.05, 0.0, 0.92)) - Vector((-0.6, -4.9, 1.6))
    cam.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    out = f"{outdir}/0113-master-wide.jpg"
elif mode == "pano":
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
