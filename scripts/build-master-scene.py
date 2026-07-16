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
import hashlib
import json
import math
import os
import sys
import uuid
from datetime import datetime, timezone
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
if len(argv) < 2:
    raise SystemExit("Usage: build-master-scene.py -- <glb> <output> [build|preview|wide|pano]")

glb_path = argv[0]
output_target = argv[1]
mode = argv[2] if len(argv) > 2 else "build"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINAL_LEFT_BOUNDARY_X = -3.2
EXTENDED_LEFT_BOUNDARY_X = -5.7
SHELL_OBJECTS = {
    "rear_wall": "Mesh_1",
    "floor": "Mesh_163",
    "ceiling": "Mesh_25",
    "baseboard": "Mesh_21",
}


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_input_paths():
    paths = {
        os.path.abspath(__file__),
        os.path.join(REPO_ROOT, "assets/master/credits.json"),
        os.path.join(REPO_ROOT, "assets/master/camera-contract.json"),
        os.path.join(REPO_ROOT, "docs/progress/0108-scene.glb"),
    }
    scan_root = os.path.join(REPO_ROOT, "assets/master/scans")
    for root, _directories, filenames in os.walk(scan_root):
        for filename in filenames:
            if filename != ".DS_Store":
                paths.add(os.path.join(root, filename))
    brand_root = os.path.join(REPO_ROOT, "assets/master/brand")
    for root, _directories, filenames in os.walk(brand_root):
        for filename in filenames:
            if filename != ".DS_Store":
                paths.add(os.path.join(root, filename))
    return sorted(paths)


def relative_hash_manifest(paths):
    return {
        os.path.relpath(path, REPO_ROOT): sha256_file(path)
        for path in paths
    }


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
    destination = os.path.abspath(output)
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=destination)
    provenance = json.loads(scene["master_build_provenance"])
    provenance["master_sha256"] = sha256_file(destination)
    provenance_path = f"{destination}.provenance.json"
    with open(provenance_path, "w", encoding="utf-8") as target:
        json.dump(provenance, target, indent=2, sort_keys=True)
        target.write("\n")
    print("MASTER BUILD COMPLETE:", destination)


scene = build_master(glb_path)
BASE_OBJECTS = set(bpy.data.objects)


def object_world_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(min(point[index] for point in points) for index in range(3)),
        Vector(max(point[index] for point in points) for index in range(3)),
    )


def bounds_record(bounds):
    minimum, maximum = bounds
    return {
        "min": [round(value, 6) for value in minimum],
        "max": [round(value, 6) for value in maximum],
    }


def nearest_surface_point(point, objects):
    nearest_point = None
    nearest_distance = math.inf
    for obj in objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        local_point = obj.matrix_world.inverted() @ point
        found, location, _normal, _index = obj.closest_point_on_mesh(
            local_point, distance=2.0
        )
        if not found:
            continue
        world_point = obj.matrix_world @ location
        distance = (world_point - point).length
        if distance < nearest_distance:
            nearest_point = world_point
            nearest_distance = distance
    return nearest_point, nearest_distance


def remap_mesh_min_x(object_name, new_min_x):
    obj = bpy.data.objects.get(object_name)
    if obj is None or obj.type != "MESH":
        raise RuntimeError(f"Missing shell mesh {object_name}")
    old_min, old_max = object_world_bounds(obj)
    span = max(old_max.x - old_min.x, 1e-8)
    inverse = obj.matrix_world.inverted()
    for vertex in obj.data.vertices:
        world = obj.matrix_world @ vertex.co
        ratio = (world.x - old_min.x) / span
        world.x = new_min_x + ratio * (old_max.x - new_min_x)
        vertex.co = inverse @ world
    obj.data.update()
    return old_min.x, old_max.x


def extend_left_room():
    # Move the complete thin left-boundary assembly, including its doorway and
    # wall history, while keeping furniture and the rear wall in place.
    moved = []
    delta = EXTENDED_LEFT_BOUNDARY_X - ORIGINAL_LEFT_BOUNDARY_X
    for obj in list(BASE_OBJECTS):
        if obj.type != "MESH":
            continue
        minimum, maximum = object_world_bounds(obj)
        if (
            maximum.x - minimum.x < 0.65
            and minimum.x <= ORIGINAL_LEFT_BOUNDARY_X + 0.15
            and maximum.x >= ORIGINAL_LEFT_BOUNDARY_X - 0.15
        ):
            world = obj.matrix_world.copy()
            world.translation.x += delta
            obj.matrix_world = world
            moved.append(obj.name)

    surface_bounds = {
        surface: {"before": bounds_record(object_world_bounds(bpy.data.objects[name]))}
        for surface, name in SHELL_OBJECTS.items()
    }
    extended = {}
    for name in ("Mesh_1", "Mesh_21", "Mesh_25", "Mesh_79", "Mesh_163"):
        old_min, right_edge = remap_mesh_min_x(name, EXTENDED_LEFT_BOUNDARY_X)
        extended[name] = {
            "old_min_x": round(old_min, 6),
            "new_min_x": EXTENDED_LEFT_BOUNDARY_X,
            "right_edge_x": round(right_edge, 6),
        }
    bpy.context.view_layer.update()
    for surface, name in SHELL_OBJECTS.items():
        surface_bounds[surface]["after"] = bounds_record(
            object_world_bounds(bpy.data.objects[name])
        )
    return moved, extended, surface_bounds


(
    LEFT_BOUNDARY_OBJECTS,
    EXTENDED_SHELL_OBJECTS,
    EXTENDED_SHELL_BOUNDS,
) = extend_left_room()

# The ceiling pendant no longer belongs to this practical-light room.
for object_name in ("Mesh_76", "Mesh_77", "Mesh_78"):
    pendant = bpy.data.objects.get(object_name)
    if pendant is not None:
        pendant.hide_render = True

# The approved identity surface is the existing card directly left of the old
# logo card. Move the pair and its tape remnant together so their physical
# relationship remains intact while the left card enters the portrait frame.
for object_name in ("Mesh_31", "Mesh_32", "Mesh_33"):
    card = bpy.data.objects.get(object_name)
    if card is None or card.type != "MESH":
        raise RuntimeError(f"Missing approved leaning card {object_name}")
    world = card.matrix_world.copy()
    world.translation.x += 0.18
    card.matrix_world = world
    card["lazy_a_card_pair_shift_x"] = 0.18
bpy.data.objects["Mesh_31"]["lazy_a_logo_card_owner"] = True
bpy.data.objects["Mesh_33"]["lazy_a_logo_card_owner"] = False

# The tiny remnant beside the cards is original geometry, but its inherited
# near-black material read as a low-resolution render chip. Keep the lived-in
# tape gesture and give it a procedural, matte masking-tape finish.
card_tape = bpy.data.objects.get("Mesh_32")
if card_tape is None or card_tape.type != "MESH":
    raise RuntimeError("Missing approved card-pair tape remnant Mesh_32")
card_tape_material = bpy.data.materials.new("CardPairMaskingTape")
card_tape_material.use_nodes = True
card_tape_bsdf = card_tape_material.node_tree.nodes.get("Principled BSDF")
card_tape_bsdf.inputs["Base Color"].default_value = (0.46, 0.39, 0.27, 1.0)
card_tape_bsdf.inputs["Roughness"].default_value = 0.96
card_tape_bsdf.inputs["Specular IOR Level"].default_value = 0.18
card_tape.data.materials.clear()
card_tape.data.materials.append(card_tape_material)
card_tape["lazy_a_material_role"] = "matte-masking-tape-remnant"

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
     (-1.45, 0.44, -0.29), (0.0, 0.0, 0.0), 0.235, "z", "shelf",
     ("names", (
         "Mesh_35", "Mesh_36", "Mesh_37",
         "Mesh_121", "Mesh_122", "Mesh_123",
         "Mesh_129", "Mesh_130", "Mesh_131", "Mesh_132",
     )), ()),
    # R-0114: Jonathan's vintage c.1940 wood office chair.
    ("chair", asset_path("assets/master/scans/vintage-office-chair/scene.gltf"),
     (0.95, 0.0, 0.78), (0.0, 0.0, 0.0), 0.9, "z", "floor",
     ("names", tuple(f"Mesh_{index}" for index in range(81, 93))), ()),
    ("camera", asset_path("assets/master/scans/camera/scene.gltf"),
     (0.78, 0.9, 0.04), (0.0, 0.0, 0.0), 0.12, "z", "desk",
     ("names", tuple(f"Mesh_{index}" for index in range(58, 65))), ()),
    # 0117-R2: Jonathan's supplied replacements, at measured real scale.
    ("mug", asset_path("assets/master/scans/coffee-cup/scene.gltf"),
     (-0.55, 0.9, 0.19), (0.0, 0.0, 2.4), 0.095, "z", "desk",
     ("names", tuple(f"Mesh_{index}" for index in range(46, 50))), ()),
    ("lamp", asset_path("assets/master/scans/desk-lamp/scene.gltf"),
     (-0.67, 0.9, -0.295), (0.0, 0.0, 0.0), 0.48, "z", "desk",
     ("names", tuple(f"Mesh_{index}" for index in range(148, 155))), ()),
    ("plant", asset_path("assets/master/scans/peace-lily/scene.gltf"),
     (1.68, 0.0, -0.06), (0.0, 0.0, 0.12), 0.75, "z", "floor",
     ("names", tuple(f"Mesh_{index}" for index in range(93, 110))), ()),
    ("headphones", asset_path("assets/master/scans/sony-mdr-7506/scene.gltf"),
     (-0.70, 0.9, 0.05), (math.radians(88), 0.0, -0.5), 0.19,
     "horizontal", "desk", ("names", ("Mesh_50", "Mesh_51", "Mesh_52")), ()),
    ("pictureFrame", asset_path("assets/master/scans/gold-picture-frame/scene.gltf"),
     (-0.52, 0.9, -0.26), (math.radians(-7), 0.0, -math.pi / 2 + 1.00), 0.20,
     "z", "desk", None, ()),
    ("trashCan", asset_path("assets/master/scans/trash-can/source/trash_can.glb"),
     (-1.06, 0.0, 0.52), (0.0, 0.0, -0.18), 0.27, "z", "floor",
     ("names", ("Mesh_133", "Mesh_134")), ()),
    ("basketball", asset_path("assets/master/scans/basketball/scene.gltf"),
     (1.70, 0.0, 0.35), (0.35, -0.2, 0.5), 0.239, "diameter", "floor",
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
    support_z = {
        "floor": 0.0,
        "shelf": object_world_bounds(bpy.data.objects["Mesh_112"])[1].z,
        "desk": object_world_bounds(bpy.data.objects["Mesh_26"])[1].z,
    }
    contact_z = support_z[contact_surface]
    anchor.location += Vector((bx - center.x, by - center.y, contact_z - minimum.z))
    bpy.context.view_layer.update()

    replaced = hide_replacements(set(imported), hide_hint, target_size)
    tracked = [anchor, *imported]
    SCAN_OBJECTS.update(tracked)
    record_asset(asset_id, [anchor], tracked, path, replaced)
    print("MASTER ASSET:", asset_id, path)
    return anchor, imported


PLACED_ASSETS = {}
for pick in PICKS:
    PLACED_ASSETS[pick[0]] = place_scan(*pick)

# The supplied seating vignette opens toward the unseen room at screen-left.
# Its floor lamp is the tallest component, so the set's Z dimension provides a
# stable real-world 1.65m scale.
seating_source = asset_path("assets/master/scans/leather-seating/scene.gltf")
PLACED_ASSETS["seating"] = place_scan(
    "seating",
    seating_source,
    (-3.45, 0.0, -0.10),
    (0.0, 0.0, -math.pi / 2),
    1.65,
    "z",
    "floor",
)


def renderable_mesh_names(objects):
    return sorted(
        obj.name for obj in objects if obj.type == "MESH" and not obj.hide_render
    )


def project_bounds(objects, camera_contract, viewport):
    data = bpy.data.cameras.new("MasterContractCameraData")
    data.sensor_fit = "VERTICAL"
    data.sensor_height = 36.0
    data.lens = data.sensor_height / (
        2.0 * math.tan(math.radians(camera_contract["fov"]) / 2.0)
    )
    camera = bpy.data.objects.new("MasterContractCamera", data)
    bpy.context.collection.objects.link(camera)
    position = Vector(
        (
            camera_contract["position"][0],
            -camera_contract["position"][2],
            camera_contract["position"][1],
        )
    )
    target = Vector(
        (
            camera_contract["target"][0],
            -camera_contract["target"][2],
            camera_contract["target"][1],
        )
    )
    camera.location = position
    camera.rotation_euler = (target - position).to_track_quat("-Z", "Y").to_euler()
    previous_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x, scene.render.resolution_y = viewport
    bpy.context.view_layer.update()
    projected = [
        world_to_camera_view(scene, camera, obj.matrix_world @ Vector(corner))
        for obj in objects
        for corner in obj.bound_box
    ]
    visible = [point for point in projected if point.z > 0.0]
    min_x = min(point.x for point in visible)
    max_x = max(point.x for point in visible)
    min_y = 1.0 - max(point.y for point in visible)
    max_y = 1.0 - min(point.y for point in visible)
    clipped = (
        max(0.0, min_x),
        max(0.0, min_y),
        min(1.0, max_x),
        min(1.0, max_y),
    )
    full_area = max(max_x - min_x, 0.0) * max(max_y - min_y, 0.0)
    clipped_area = max(clipped[2] - clipped[0], 0.0) * max(
        clipped[3] - clipped[1], 0.0
    )
    scene.render.resolution_x, scene.render.resolution_y = previous_resolution
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(data)
    return {
        "projected_bounds": [round(value, 6) for value in (min_x, min_y, max_x, max_y)],
        "visible_bounds": [round(value, 6) for value in clipped],
        "visible_fraction": round(clipped_area / max(full_area, 1e-8), 6),
    }


camera_objects = PLACED_ASSETS["camera"][1]
MASTER_INVENTORY["camera"]["components"] = {
    "body": renderable_mesh_names(
        [obj for obj in camera_objects if "strap" not in obj.name.lower()]
    ),
    "strap": renderable_mesh_names(
        [obj for obj in camera_objects if "strap" in obj.name.lower()]
    ),
}
lamp_objects = PLACED_ASSETS["lamp"][1]
MASTER_INVENTORY["lamp"]["components"] = {
    "fixture": renderable_mesh_names(lamp_objects),
}

chair_min, chair_max = world_bounds(PLACED_ASSETS["chair"][1])
chair_points = [
    obj.matrix_world @ vertex.co
    for obj in PLACED_ASSETS["chair"][1]
    if obj.type == "MESH" and not obj.hide_render
    for vertex in obj.data.vertices
]
chair_back_points = [
    point
    for point in chair_points
    if point.z >= chair_min.z + (chair_max.z - chair_min.z) * 0.50
    and point.y <= chair_min.y + (chair_max.y - chair_min.y) * 0.38
]
chair_back_min = Vector(
    min(point[index] for point in chair_back_points) for index in range(3)
)
chair_back_max = Vector(
    max(point[index] for point in chair_back_points) for index in range(3)
)
MASTER_INVENTORY["chair"]["regions"] = {
    "back": {
        "min": [round(value, 6) for value in chair_back_min],
        "max": [round(value, 6) for value in chair_back_max],
    }
}

seating_anchor, seating_objects = PLACED_ASSETS["seating"]
seating_chair_objects = [
    obj
    for obj in seating_objects
    if obj.type == "MESH" and not obj.hide_render and "ARMCHAIR" in obj.name.upper()
]
seating_floor_lamp_objects = [
    obj
    for obj in seating_objects
    if obj.type == "MESH" and not obj.hide_render and "FLOORLAMP" in obj.name.upper()
]
seating_table_objects = [
    obj
    for obj in seating_objects
    if obj.type == "MESH" and not obj.hide_render and "COFFEETABLE" in obj.name.upper()
]
seating_component_objects = [
    *seating_chair_objects,
    *seating_floor_lamp_objects,
    *seating_table_objects,
]
# The archive's outer bound is 1.65m, but its visible lamp mesh is 1.613m.
# Correct the complete set uniformly so the recognizable lamp itself establishes
# scale; the chair and table retain the supplier's proportions.
seating_lamp_points = [
    obj.matrix_world @ vertex.co
    for obj in seating_floor_lamp_objects
    for vertex in obj.data.vertices
]
seating_visible_lamp_height = max(point.z for point in seating_lamp_points) - min(
    point.z for point in seating_lamp_points
)
seating_scale_correction = 1.65 / seating_visible_lamp_height
seating_anchor.scale *= seating_scale_correction
bpy.context.view_layer.update()
# Preserve the supplied set as one left-opening vignette. The chair back,
# floor lamp, and only the nearest table corner enter the opening frame; most
# of the seating area remains physically beyond the left edge.
seating_group_pivot = sum(
    (obj.matrix_world.translation for obj in seating_component_objects), Vector()
) / len(seating_component_objects)
seating_group_transform = (
    Matrix.Translation(seating_group_pivot + Vector((0.28, -1.00, 0.0)))
    @ Matrix.Rotation(math.radians(30), 4, "Z")
    @ Matrix.Translation(-seating_group_pivot)
)
seating_anchor.matrix_world = seating_group_transform @ seating_anchor.matrix_world
bpy.context.view_layer.update()
for obj in seating_floor_lamp_objects:
    world = obj.matrix_world.copy()
    world.translation.x += 0.15
    world.translation.y += 0.40
    obj.matrix_world = world
for obj in seating_table_objects:
    world = obj.matrix_world.copy()
    world.translation.x += 1.40
    world.translation.y -= 0.45
    obj.matrix_world = world


def ground_component(objects):
    minimum_z = min(
        (obj.matrix_world @ vertex.co).z
        for obj in objects
        if obj.type == "MESH" and not obj.hide_render
        for vertex in obj.data.vertices
    )
    for obj in objects:
        world = obj.matrix_world.copy()
        world.translation.z -= minimum_z
        obj.matrix_world = world


for component_objects in (
    seating_chair_objects,
    seating_floor_lamp_objects,
    seating_table_objects,
):
    ground_component(component_objects)
bpy.context.view_layer.update()

# Grade only the chair leather. The source texture remains intact, but its
# saturation and sharp highlight are brought into the room's photographic key.
for obj in seating_chair_objects:
    for slot in obj.material_slots:
        if slot.material is None:
            continue
        material = slot.material.copy()
        material.name = f"{material.name}_LazyAChairGrade"
        slot.material = material
        bsdf = (
            material.node_tree.nodes.get("Principled BSDF")
            if material.node_tree
            else None
        )
        if bsdf is None:
            continue
        bsdf.inputs["Roughness"].default_value = 0.68
        base_color = bsdf.inputs["Base Color"]
        if base_color.is_linked:
            source_socket = base_color.links[0].from_socket
            material.node_tree.links.remove(base_color.links[0])
            grade = material.node_tree.nodes.new("ShaderNodeHueSaturation")
            grade.name = "LazyAChairPhotographicGrade"
            grade.inputs["Saturation"].default_value = 0.72
            grade.inputs["Value"].default_value = 0.82
            material.node_tree.links.new(source_socket, grade.inputs["Color"])
            material.node_tree.links.new(grade.outputs["Color"], base_color)
bpy.context.view_layer.update()
record_asset(
    "seating",
    [seating_anchor],
    [seating_anchor, *seating_objects],
    seating_source,
    [],
)
seating_components = {
    "floor_lamp": renderable_mesh_names(
        seating_floor_lamp_objects
    ),
    "chair": renderable_mesh_names(
        seating_chair_objects
    ),
    "coffee_table": renderable_mesh_names(
        seating_table_objects
    ),
}
seating_chair_points = [
    obj.matrix_world @ vertex.co
    for obj in seating_chair_objects
    for vertex in obj.data.vertices
]
seating_chair_min_z = min(point.z for point in seating_chair_points)
seating_chair_height = max(point.z for point in seating_chair_points) - seating_chair_min_z
seating_back_points = [
    point
    for point in seating_chair_points
    if point.z >= seating_chair_min_z + seating_chair_height * 0.65
]
seating_seat_points = [
    point
    for point in seating_chair_points
    if seating_chair_min_z + seating_chair_height * 0.35
    <= point.z
    <= seating_chair_min_z + seating_chair_height * 0.55
]
seating_back_center = sum(seating_back_points, Vector()) / len(seating_back_points)
seating_seat_center = sum(seating_seat_points, Vector()) / len(seating_seat_points)
seating_facing = seating_seat_center - seating_back_center
seating_facing.z = 0.0
seating_facing.normalize()
seating_component_centers = {}
for role, objects in {
    "chair": seating_chair_objects,
    "floor_lamp": seating_floor_lamp_objects,
    "coffee_table": seating_table_objects,
}.items():
    minimum, maximum = world_bounds(objects)
    seating_component_centers[role] = (minimum + maximum) * 0.5
seating_component_distances = {}
for left, right in (
    ("chair", "floor_lamp"),
    ("chair", "coffee_table"),
    ("floor_lamp", "coffee_table"),
):
    delta = seating_component_centers[right] - seating_component_centers[left]
    delta.z = 0.0
    seating_component_distances[f"{left}_to_{right}"] = round(delta.length, 6)
with open(asset_path("assets/master/camera-contract.json"), encoding="utf-8") as source:
    camera_contract = json.load(source)
opening_camera = {
    "fov": 35,
    "position": [-0.6, 1.6, 4.9],
    "target": [0.05, 0.92, 0.0],
}
opening_projection = project_bounds(
    seating_chair_objects, opening_camera, (1280, 720)
)
MASTER_INVENTORY["seating"].update(
    {
        "components": seating_components,
        "component_centers": {
            role: [round(value, 6) for value in center]
            for role, center in seating_component_centers.items()
        },
        "component_distances": seating_component_distances,
        "facing_vector": [round(value, 6) for value in seating_facing],
        "facing_measurement": "seat-centroid-minus-high-back-centroid",
        "default_frame_visibility": {
            "camera": "opening",
            "visible_region": "chair_back_floor_lamp_table_edge",
            "measurement": "occlusion_aware_component_render_gate",
        },
        "default_frame_projection": {"camera": "opening", **opening_projection},
    }
)

# R3: the blanket is a pinned authored drape. A free-fall cloth solve can report
# success after falling through the chair and floor, so its folds and chair
# contact are part of the reproducible master geometry.
blanket_tex = asset_path("assets/master/scans/blanket/texture.jpg")
columns = 25
rows = 34
vertices = []
faces = []
for row in range(rows):
    v = row / (rows - 1)
    for column in range(columns):
        u = column / (columns - 1)
        width = 0.42 - 0.055 * v + 0.018 * math.sin(math.pi * v)
        center_x = 0.95 + 0.012 * math.sin(v * math.pi * 2.5)
        x = center_x + (u - 0.5) * width
        if v <= 0.18:
            bend = v / 0.18
            y = -0.92 - 0.14 * bend
            z = 0.88 + 0.045 * math.sin(math.pi * bend) - 0.02 * bend
        else:
            fall = (v - 0.18) / 0.82
            y = -1.06 - 0.012 * math.sin(math.pi * fall)
            z = 0.86 - 0.48 * fall
        fold = (
            0.62 * math.sin(u * math.pi * 6.0 + v * 0.8)
            + 0.25 * math.sin(u * math.pi * 10.5 - v * 2.2 + 0.4)
            + 0.13 * math.sin(u * math.pi * 3.0 + v * 4.1)
        )
        fold_weight = math.sin(math.pi * min(v / 0.88, 1.0))
        y += 0.034 * fold * fold_weight
        z += 0.012 * math.cos(u * math.pi * 4.0 - v) * math.sin(math.pi * v)
        if v > 0.82:
            hem = (v - 0.82) / 0.18
            z += 0.026 * math.sin(u * math.pi * 3.0 + 0.45) * hem
            x += 0.008 * math.sin(u * math.pi * 2.0) * hem
        candidate = Vector((x, y, z))
        if v <= 0.22:
            surface, distance = nearest_surface_point(
                candidate, PLACED_ASSETS["chair"][1]
            )
            if surface is not None and distance <= 0.20:
                offset = candidate - surface
                if offset.length < 1e-6:
                    offset = Vector((0.0, -1.0, 0.0))
                candidate = surface + offset.normalized() * 0.004
        vertices.append(tuple(candidate))
for row in range(rows - 1):
    for column in range(columns - 1):
        start = row * columns + column
        faces.append((start, start + 1, start + columns + 1, start + columns))

blanket_mesh = bpy.data.meshes.new("scan_blanket_mesh")
blanket_mesh.from_pydata(vertices, [], faces)
blanket_mesh.update()
cloth = bpy.data.objects.new("scan_blanket_0", blanket_mesh)
bpy.context.collection.objects.link(cloth)
cloth.name = "scan_blanket_0"
uv_layer = blanket_mesh.uv_layers.new(name="BlanketUV")
for polygon in blanket_mesh.polygons:
    for loop_index in polygon.loop_indices:
        vertex_index = blanket_mesh.loops[loop_index].vertex_index
        row, column = divmod(vertex_index, columns)
        uv_layer.data[loop_index].uv = (
            column / (columns - 1),
            1.0 - row / (rows - 1),
        )
solidify = cloth.modifiers.new("blanket_thickness", "SOLIDIFY")
solidify.thickness = 0.004
solidify.offset = 0.0
mat = bpy.data.materials.new("blanket_fabric")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.95
tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(blanket_tex)
mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
cloth.data.materials.append(mat)
for polygon in blanket_mesh.polygons:
    polygon.use_smooth = True
SCAN_OBJECTS.add(cloth)
record_asset("blanket", [cloth], [cloth], blanket_tex, [])
MASTER_INVENTORY["blanket"]["construction"] = "authored-pinned-drape"

# The physical navigation paper belongs to the master. The shot author adds
# only its graphite lettering and profile-specific reading incline.
nav_width = 0.30
nav_height = 0.20
nav_thickness = 0.0007
nav_incline = math.radians(7.0)
nav_yaw = math.radians(-5.0)
nav_center_x = -0.115
nav_center_y = -0.265
desk_height = object_world_bounds(bpy.data.objects["Mesh_26"])[1].z
near_edge_drop = math.sin(nav_incline) * nav_height / 2.0
bpy.ops.mesh.primitive_cube_add(
    size=1.0,
    location=(
        nav_center_x,
        nav_center_y,
        desk_height + near_edge_drop + nav_thickness / 2.0,
    ),
    rotation=(nav_incline, 0.0, nav_yaw),
)
navigation_sheet = bpy.context.active_object
navigation_sheet.name = "ProductionNavigationSheet"
navigation_sheet.dimensions = (nav_width, nav_height, nav_thickness)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
navigation_paper = bpy.data.materials.new("ProductionSheetPaper")
navigation_paper.use_nodes = True
navigation_bsdf = navigation_paper.node_tree.nodes["Principled BSDF"]
navigation_bsdf.inputs["Base Color"].default_value = (0.78, 0.735, 0.64, 1.0)
navigation_bsdf.inputs["Roughness"].default_value = 0.94
navigation_sheet.data.materials.append(navigation_paper)
navigation_sheet["lazy_a_authored_role"] = "physical-navigation-sheet"
navigation_sheet["lazy_a_row_order"] = json.dumps(
    ["films", "journal", "contact", "about"]
)

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

# The supplied floor lamp is the visible source of a restrained seating-area
# practical. Its spill gives the locked ABOUT pan room history without moving
# the furniture into frame or inventing a sourceless UI spotlight.
seating_lamp_min, seating_lamp_max = world_bounds(seating_floor_lamp_objects)
seating_lamp_center = (seating_lamp_min + seating_lamp_max) * 0.5
bpy.ops.object.light_add(
    type="POINT",
    location=(
        seating_lamp_center.x,
        seating_lamp_center.y,
        seating_lamp_max.z - 0.18,
    ),
)
seating_practical = bpy.context.active_object
seating_practical.name = "SeatingFloorLampPractical"
seating_practical.data.energy = 32.0
seating_practical.data.color = (1.0, 0.72, 0.48)
seating_practical.data.shadow_soft_size = 0.16
seating_practical["lazy_a_physical_source"] = seating_floor_lamp_objects[0].name

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

rear_min, rear_max = object_world_bounds(bpy.data.objects["Mesh_1"])
scene["master_spatial_contracts"] = json.dumps(
    {
        "left_shell": {
            "original_left_x": ORIGINAL_LEFT_BOUNDARY_X,
            "left_boundary_x": EXTENDED_LEFT_BOUNDARY_X,
            "right_edge_before_x": EXTENDED_SHELL_BOUNDS["rear_wall"]["before"][
                "max"
            ][0],
            "right_edge_after_x": round(rear_max.x, 6),
            "moved_boundary_objects": sorted(LEFT_BOUNDARY_OBJECTS),
            "extended_shell_objects": EXTENDED_SHELL_OBJECTS,
            "surface_bounds": EXTENDED_SHELL_BOUNDS,
        },
        "about_profiles": ["wide", "portrait"],
    },
    sort_keys=True,
)

scene["master_asset_inventory"] = json.dumps(MASTER_INVENTORY, sort_keys=True)
scene["master_build_provenance"] = json.dumps(
    {
        "builder_sha256": sha256_file(os.path.abspath(__file__)),
        "asset_inventory_sha256": sha256_file(
            asset_path("assets/master/credits.json")
        ),
        "source_glb_sha256": sha256_file(asset_path(glb_path)),
        "source_glb": os.path.relpath(asset_path(glb_path), REPO_ROOT),
        "input_files_sha256": relative_hash_manifest(build_input_paths()),
        "blender_version": bpy.app.version_string,
        "build_timestamp": datetime.now(timezone.utc).isoformat().replace(
            "+00:00", "Z"
        ),
        "invocation_id": str(uuid.uuid4()),
    },
    sort_keys=True,
)

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
