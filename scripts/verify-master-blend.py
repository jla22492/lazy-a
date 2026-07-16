import bpy
import hashlib
import json
import math
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
from mathutils.bvhtree import BVHTree


REPO_ROOT = Path(__file__).resolve().parent.parent
EXPECTED_IDS = {
    "vase",
    "books",
    "chair",
    "camera",
    "mug",
    "lamp",
    "plant",
    "blanket",
    "headphones",
    "pictureFrame",
    "trashCan",
    "basketball",
    "seating",
}

PRESERVED_IDS = {
    "headphones",
    "mug",
    "trashCan",
    "chair",
}

ASSET_RULES = {
    "books": {
        "axis": "z",
        "size": 0.235,
        "contact": "shelf",
        "replaces": True,
        "center_bounds": ((-1.72, -1.18), (0.10, 0.40)),
    },
    "chair": {
        "axis": "z",
        "size": 0.90,
        "contact": "floor",
        "replaces": True,
    },
    "camera": {
        "axis": "z",
        "size": 0.12,
        "contact": "desk",
        "replaces": True,
    },
    "mug": {
        "axis": "z",
        "size": 0.095,
        "contact": "desk",
        "replaces": True,
        "center": (-0.55, -0.19),
    },
    "lamp": {
        "axis": "z",
        "size": 0.48,
        "contact": "desk",
        "replaces": True,
    },
    "plant": {
        "axis": "z",
        "size": 0.75,
        "contact": "floor",
        "replaces": True,
    },
    "headphones": {
        "axis": "horizontal",
        "size": 0.19,
        "contact": "desk",
        "replaces": True,
        "center": (-0.70, -0.05),
    },
    "pictureFrame": {
        "axis": "z",
        "size": 0.20,
        "contact": "desk",
        "replaces": False,
        "center_bounds": ((-0.72, -0.34), (0.12, 0.36)),
    },
    "trashCan": {
        "axis": "z",
        "size": 0.27,
        "contact": "floor",
        "replaces": True,
        "center": (-1.06, -0.52),
    },
    "basketball": {
        "axis": "diameter",
        "size": 0.239,
        "size_tolerance": 0.0005,
        "contact": "floor",
        "replaces": False,
    },
    "seating": {"contact": "floor", "replaces": False},
}

SIZE_TOLERANCE = 0.012
CONTACT_TOLERANCE = 0.006
BOUNDS_TOLERANCE = 0.001
LEGACY_CAMERA_MESHES = {f"Mesh_{index}" for index in range(58, 65)}
LEGACY_LAMP_MESHES = {f"Mesh_{index}" for index in range(148, 155)}
LEGACY_BOOK_MESHES = {
    "Mesh_35",
    "Mesh_36",
    "Mesh_37",
    "Mesh_121",
    "Mesh_122",
    "Mesh_123",
    "Mesh_129",
    "Mesh_130",
    "Mesh_131",
    "Mesh_132",
}
PENDANT_MESHES = {"Mesh_76", "Mesh_77", "Mesh_78"}
ABOUT_PROFILES = {"wide", "portrait"}
SHELL_SURFACES = {"rear_wall", "floor", "ceiling", "baseboard"}
SHELL_OBJECTS = {
    "rear_wall": "Mesh_1",
    "floor": "Mesh_163",
    "ceiling": "Mesh_25",
    "baseboard": "Mesh_21",
}
PRESERVED_BASE_OBJECTS = {
    "logo_card": ("Mesh_31",),
    "navigation_sheet": ("ProductionNavigationSheet",),
    "notebook": ("Mesh_183", "Mesh_184", "Mesh_185", "Mesh_186", "Mesh_53"),
    "charger": ("Mesh_161", "Mesh_162"),
    "contact_paper": ("Mesh_56",),
}
ABOUT_POSES = {
    "wide": {
        "viewport": (1280, 720),
        "position": (0.02, 1.58, 1.45),
        "target": (-1.28, 1.22, -0.08),
    },
    "portrait": {
        "viewport": (375, 812),
        "position": (0.22, 1.58, 2.27),
        "target": (-1.52, 0.92, -0.08),
    },
}


def close(actual, expected, tolerance=1e-6):
    return math.isclose(actual, expected, abs_tol=tolerance)


def load_json_property(owner, key, issues, label):
    raw = owner.get(key)
    if not isinstance(raw, str):
        issues.append(f"{label} metadata missing")
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        issues.append(f"{label} metadata is not valid JSON")
        return {}
    if not isinstance(value, dict):
        issues.append(f"{label} metadata is not an object")
        return {}
    return value


def valid_bounds(bounds):
    if not isinstance(bounds, dict):
        return False
    minimum = bounds.get("min")
    maximum = bounds.get("max")
    return (
        isinstance(minimum, list)
        and isinstance(maximum, list)
        and len(minimum) == 3
        and len(maximum) == 3
        and all(isinstance(value, (int, float)) for value in [*minimum, *maximum])
        and all(minimum[index] <= maximum[index] for index in range(3))
    )


def bounds_vectors(bounds):
    return Vector(bounds["min"]), Vector(bounds["max"])


def world_bounds(objects):
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    found = False
    for obj in objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            minimum = Vector(map(min, minimum, point))
            maximum = Vector(map(max, maximum, point))
            found = True
    return (minimum, maximum) if found else None


def mesh_world_points(objects):
    return [
        obj.matrix_world @ vertex.co
        for obj in objects
        if obj.type == "MESH" and not obj.hide_render
        for vertex in obj.data.vertices
    ]


def mesh_world_min_z(objects):
    points = mesh_world_points(objects)
    return min((point.z for point in points), default=math.inf)


def mesh_world_bounds(objects):
    points = mesh_world_points(objects)
    if not points:
        return None
    return (
        Vector(min(point[index] for point in points) for index in range(3)),
        Vector(max(point[index] for point in points) for index in range(3)),
    )


def oriented_mesh_dimensions(objects):
    points = mesh_world_points(objects)
    basis_object = next(
        (obj for obj in objects if obj.type == "MESH" and not obj.hide_render),
        None,
    )
    if not points or basis_object is None:
        return None
    rotation = basis_object.matrix_world.to_3x3()
    axes = [
        (rotation @ axis).normalized()
        for axis in (
            Vector((1.0, 0.0, 0.0)),
            Vector((0.0, 1.0, 0.0)),
            Vector((0.0, 0.0, 1.0)),
        )
    ]
    dimensions = [
        max(point.dot(axis) for point in points)
        - min(point.dot(axis) for point in points)
        for axis in axes
    ]
    return sorted(dimensions)


def bounds_center(objects):
    bounds = world_bounds(objects)
    return (bounds[0] + bounds[1]) * 0.5 if bounds is not None else None


def measured_seating_facing(objects):
    points = mesh_world_points(objects)
    if not points:
        return None
    minimum_z = min(point.z for point in points)
    height = max(point.z for point in points) - minimum_z
    back = [point for point in points if point.z >= minimum_z + height * 0.65]
    seat = [
        point
        for point in points
        if minimum_z + height * 0.35 <= point.z <= minimum_z + height * 0.55
    ]
    if not back or not seat:
        return None
    back_center = sum(back, Vector()) / len(back)
    seat_center = sum(seat, Vector()) / len(seat)
    facing = seat_center - back_center
    facing.z = 0.0
    return facing.normalized() if facing.length > 1e-6 else None


def bvh_overlap_count(left_objects, right_objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()

    def world_tree(obj):
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            vertices = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
            polygons = [tuple(triangle.vertices) for triangle in mesh.loop_triangles]
            return BVHTree.FromPolygons(vertices, polygons, all_triangles=True)
        finally:
            evaluated.to_mesh_clear()

    total = 0
    for left in left_objects:
        if left.type != "MESH" or left.hide_render:
            continue
        left_tree = world_tree(left)
        for right in right_objects:
            if right.type != "MESH" or right.hide_render:
                continue
            right_tree = world_tree(right)
            total += len(left_tree.overlap(right_tree))
    return total


def get_record_objects(asset_id, record, issues):
    objects = []
    object_names = record.get("objects", [])
    if not isinstance(object_names, list) or not object_names:
        issues.append(f"{asset_id} has no scene objects")
        return objects
    for object_name in object_names:
        obj = bpy.data.objects.get(object_name)
        if obj is None:
            issues.append(f"{asset_id} references missing object {object_name}")
            continue
        objects.append(obj)
        if obj.get("lazy_a_asset_id") != asset_id:
            issues.append(
                f"{object_name} lazy_a_asset_id={obj.get('lazy_a_asset_id')} "
                f"expected={asset_id}"
            )
    return objects


def get_component_meshes(asset_id, record, component, issues):
    components = record.get("components")
    if not isinstance(components, dict):
        return []
    object_names = components.get(component)
    if not isinstance(object_names, list) or not object_names:
        issues.append(f"{asset_id} component {component} has no objects")
        return []
    meshes = []
    tracked = set(record.get("objects", []))
    for object_name in object_names:
        obj = bpy.data.objects.get(object_name)
        if obj is None:
            issues.append(f"{asset_id} component {component} missing object {object_name}")
        elif object_name not in tracked:
            issues.append(f"{asset_id} component {component} is not inventory-tracked: {object_name}")
        elif obj.type != "MESH" or obj.hide_render:
            issues.append(f"{asset_id} component {component} is not renderable: {object_name}")
        else:
            meshes.append(obj)
    return meshes


def horizontal_contains(container_min, container_max, item_min, item_max, tolerance):
    return all(
        item_min[index] >= container_min[index] - tolerance
        and item_max[index] <= container_max[index] + tolerance
        for index in (0, 1)
    )


def horizontal_overlaps(first_min, first_max, second_min, second_max):
    return all(
        min(first_max[index], second_max[index])
        > max(first_min[index], second_min[index])
        for index in (0, 1)
    )


def overlap_dimensions(first_min, first_max, second_min, second_max):
    return Vector(
        (
            min(first_max[index], second_max[index])
            - max(first_min[index], second_min[index])
            for index in range(3)
        )
    )


def check_hidden_replacements(asset_id, record, expected_names, issues):
    replaced = record.get("replaced_objects", [])
    if not isinstance(replaced, list):
        issues.append(f"{asset_id} replacement metadata is not a list")
        replaced = []
    missing_metadata = sorted(expected_names.difference(replaced))
    if missing_metadata:
        issues.append(
            f"{asset_id} replacement metadata omits legacy meshes: {missing_metadata}"
        )
    renderable = sorted(
        name
        for name in expected_names
        if bpy.data.objects.get(name) is not None
        and not bpy.data.objects[name].hide_render
    )
    if renderable:
        issues.append(f"{asset_id} legacy meshes remain renderable: {renderable}")


def check_unique_component(asset_id, expected_meshes, issues, include_hidden=False):
    expected_names = {obj.name for obj in expected_meshes}
    signatures = {mesh_geometry_fingerprint(obj) for obj in expected_meshes}
    matching = {
        obj.name
        for obj in bpy.data.objects
        if obj.type == "MESH"
        and (include_hidden or not obj.hide_render)
        and mesh_geometry_fingerprint(obj) in signatures
    }
    unexpected = sorted(matching.difference(expected_names))
    if unexpected:
        issues.append(
            f"{asset_id} has renderable duplicate component geometry: {unexpected}"
        )


def sha256_file(relative_path):
    digest = hashlib.sha256()
    path = Path(relative_path)
    if not path.is_absolute():
        path = REPO_ROOT / path
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def expected_build_inputs():
    paths = {
        Path("scripts/build-master-scene.py"),
        Path("assets/master/credits.json"),
        Path("assets/master/camera-contract.json"),
        Path("docs/progress/0108-scene.glb"),
    }
    scan_root = REPO_ROOT / "assets/master/scans"
    paths.update(
        path.relative_to(REPO_ROOT)
        for path in scan_root.rglob("*")
        if path.is_file() and path.name != ".DS_Store"
    )
    brand_root = REPO_ROOT / "assets/master/brand"
    paths.update(
        path.relative_to(REPO_ROOT)
        for path in brand_root.rglob("*")
        if path.is_file() and path.name != ".DS_Store"
    )
    return sorted(path.as_posix() for path in paths)


def mesh_geometry_fingerprint(obj):
    coordinates = [vertex.co.copy() for vertex in obj.data.vertices]
    minimum = Vector(
        min(point[index] for point in coordinates) if coordinates else 0.0
        for index in range(3)
    )
    maximum = Vector(
        max(point[index] for point in coordinates) if coordinates else 0.0
        for index in range(3)
    )
    span = Vector(max(maximum[index] - minimum[index], 1e-8) for index in range(3))
    normalized = [
        tuple(round((point[index] - minimum[index]) / span[index], 6) for index in range(3))
        for point in coordinates
    ]
    topology = [tuple(polygon.vertices) for polygon in obj.data.polygons]
    payload = json.dumps(
        {"vertices": normalized, "polygons": topology},
        separators=(",", ":"),
    ).encode("utf-8")
    return (len(coordinates), len(topology), hashlib.sha256(payload).hexdigest())


def three_to_blender(value):
    return Vector((value[0], -value[2], value[1]))


def project_bounds(objects, pose):
    data = bpy.data.cameras.new("VerificationCameraData")
    data.sensor_fit = "VERTICAL"
    data.sensor_height = 36.0
    data.lens = data.sensor_height / (2.0 * math.tan(math.radians(35.0) / 2.0))
    camera = bpy.data.objects.new("VerificationCamera", data)
    bpy.context.collection.objects.link(camera)
    position = three_to_blender(pose["position"])
    target = three_to_blender(pose["target"])
    camera.location = position
    camera.rotation_euler = (target - position).to_track_quat("-Z", "Y").to_euler()
    previous_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    scene.render.resolution_x, scene.render.resolution_y = pose["viewport"]
    bpy.context.view_layer.update()
    projected = [
        world_to_camera_view(scene, camera, obj.matrix_world @ Vector(corner))
        for obj in objects
        for corner in obj.bound_box
    ]
    visible = [point for point in projected if point.z > 0.0]
    scene.render.resolution_x, scene.render.resolution_y = previous_resolution
    bpy.data.objects.remove(camera, do_unlink=True)
    bpy.data.cameras.remove(data)
    if not visible:
        return None
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
    return {
        "projected_bounds": (min_x, min_y, max_x, max_y),
        "visible_bounds": clipped,
        "visible_fraction": clipped_area / max(full_area, 1e-8),
    }


def render_visible_pixel_bounds(objects, pose, width=320, height=180):
    data = bpy.data.cameras.new("VisibilityCameraData")
    data.sensor_fit = "VERTICAL"
    data.sensor_height = 36.0
    data.lens = data.sensor_height / (2.0 * math.tan(math.radians(35.0) / 2.0))
    camera = bpy.data.objects.new("VisibilityCamera", data)
    bpy.context.collection.objects.link(camera)
    position = three_to_blender(pose["position"])
    target = three_to_blender(pose["target"])
    camera.location = position
    camera.rotation_euler = (target - position).to_track_quat("-Z", "Y").to_euler()

    previous = {
        "engine": scene.render.engine,
        "resolution": (scene.render.resolution_x, scene.render.resolution_y),
        "percentage": scene.render.resolution_percentage,
        "camera": scene.camera,
        "film_transparent": scene.render.film_transparent,
        "filepath": scene.render.filepath,
        "file_format": scene.render.image_settings.file_format,
        "color_mode": scene.render.image_settings.color_mode,
        "light": scene.display.shading.light,
        "color_type": scene.display.shading.color_type,
        "background_type": scene.display.shading.background_type,
        "background_color": tuple(scene.display.shading.background_color),
        "show_shadows": scene.display.shading.show_shadows,
        "show_cavity": scene.display.shading.show_cavity,
        "show_specular_highlight": scene.display.shading.show_specular_highlight,
    }
    colors = {obj.name: tuple(obj.color) for obj in bpy.data.objects if obj.type == "MESH"}
    target_names = {obj.name for obj in objects}
    temporary_fd, temporary_path = tempfile.mkstemp(suffix=".png")
    os.close(temporary_fd)
    try:
        scene.camera = camera
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.resolution_percentage = 100
        scene.render.film_transparent = False
        scene.render.filepath = temporary_path
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        shading = scene.display.shading
        shading.light = "FLAT"
        shading.color_type = "OBJECT"
        shading.background_type = "VIEWPORT"
        shading.background_color = (0.0, 0.0, 0.0)
        shading.show_shadows = False
        shading.show_cavity = False
        shading.show_specular_highlight = False
        for obj in bpy.data.objects:
            if obj.type == "MESH":
                obj.color = (1.0, 1.0, 1.0, 1.0) if obj.name in target_names else (
                    0.0,
                    0.0,
                    0.0,
                    1.0,
                )
        bpy.context.view_layer.update()
        bpy.ops.render.render(write_still=True)
        image = bpy.data.images.load(temporary_path, check_existing=False)
        pixels = list(image.pixels)
        visible = []
        for index in range(0, len(pixels), 4):
            if min(pixels[index : index + 3]) < 0.5:
                continue
            pixel = index // 4
            visible.append((pixel % width, pixel // width))
        if not visible:
            return {"pixel_count": 0, "visible_bounds": None}
        return {
            "pixel_count": len(visible),
            "visible_bounds": (
                min(point[0] for point in visible) / width,
                min(point[1] for point in visible) / height,
                (max(point[0] for point in visible) + 1) / width,
                (max(point[1] for point in visible) + 1) / height,
            ),
        }
    finally:
        for name, color in colors.items():
            obj = bpy.data.objects.get(name)
            if obj is not None:
                obj.color = color
        scene.render.engine = previous["engine"]
        scene.render.resolution_x, scene.render.resolution_y = previous["resolution"]
        scene.render.resolution_percentage = previous["percentage"]
        scene.render.film_transparent = previous["film_transparent"]
        scene.render.filepath = previous["filepath"]
        scene.render.image_settings.file_format = previous["file_format"]
        scene.render.image_settings.color_mode = previous["color_mode"]
        scene.camera = previous["camera"]
        shading = scene.display.shading
        for key in (
            "light",
            "color_type",
            "background_type",
            "background_color",
            "show_shadows",
            "show_cavity",
            "show_specular_highlight",
        ):
            setattr(shading, key, previous[key])
        bpy.data.objects.remove(camera, do_unlink=True)
        bpy.data.cameras.remove(data)
        if "image" in locals() and image is not None:
            bpy.data.images.remove(image)
        if os.path.exists(temporary_path):
            os.remove(temporary_path)


def render_back_pixel_bounds(objects, facing, pose):
    points = mesh_world_points(objects)
    bounds = world_bounds(objects)
    if not points or bounds is None or facing is None:
        return {"pixel_count": 0, "visible_bounds": None}
    minimum_z = min(point.z for point in points)
    height = max(point.z for point in points) - minimum_z
    center = (bounds[0] + bounds[1]) * 0.5
    vertices = []
    faces = []
    for obj in objects:
        for polygon in obj.data.polygons:
            world_center = obj.matrix_world @ polygon.center
            relative = world_center - center
            if not (
                world_center.z >= minimum_z + height * 0.35
                and relative.dot(facing) <= 0.0
            ):
                continue
            start = len(vertices)
            vertices.extend(
                tuple(obj.matrix_world @ obj.data.vertices[index].co)
                for index in polygon.vertices
            )
            faces.append(tuple(range(start, len(vertices))))
    if not faces:
        return {"pixel_count": 0, "visible_bounds": None}
    mesh = bpy.data.meshes.new("VerificationSeatingBackRightMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    region = bpy.data.objects.new("VerificationSeatingBackRight", mesh)
    bpy.context.collection.objects.link(region)
    hidden = {obj.name: obj.hide_render for obj in objects}
    try:
        for obj in objects:
            obj.hide_render = True
        bpy.context.view_layer.update()
        return render_visible_pixel_bounds([region], pose)
    finally:
        for name, hide_render in hidden.items():
            obj = bpy.data.objects.get(name)
            if obj is not None:
                obj.hide_render = hide_render
        bpy.data.objects.remove(region, do_unlink=True)
        bpy.data.meshes.remove(mesh)


def closest_surface_distance(point, objects):
    nearest = math.inf
    for obj in objects:
        local_point = obj.matrix_world.inverted() @ point
        found, location, _normal, _index = obj.closest_point_on_mesh(
            local_point, distance=2.0
        )
        if found:
            nearest = min(nearest, (obj.matrix_world @ location - point).length)
    return nearest


def is_picture_material(material):
    return material is not None and material.name.lower().split(".", 1)[0] == "picture"


scene = bpy.context.scene
issues = []

support_objects = {}
for label, object_name in {
    "desk": "Mesh_26",
    "shelf": "Mesh_112",
}.items():
    obj = bpy.data.objects.get(object_name)
    if obj is None or obj.type != "MESH" or obj.hide_render:
        issues.append(f"{label} support mesh {object_name} is missing or non-renderable")
    else:
        support_objects[label] = obj

desk_bounds = world_bounds([support_objects["desk"]]) if "desk" in support_objects else None
shelf_bounds = world_bounds([support_objects["shelf"]]) if "shelf" in support_objects else None
DESK_MIN, DESK_MAX = desk_bounds or (
    Vector((-math.inf, -math.inf, -math.inf)),
    Vector((math.inf, math.inf, math.inf)),
)
SHELF_MIN, SHELF_MAX = shelf_bounds or (
    Vector((-math.inf, -math.inf, -math.inf)),
    Vector((math.inf, math.inf, math.inf)),
)
DESK_CENTER = (DESK_MIN + DESK_MAX) * 0.5
CONTACT_Z = {
    "floor": 0.0,
    "shelf": SHELF_MAX.z,
    "desk": DESK_MAX.z,
}
inventory = load_json_property(
    scene, "master_asset_inventory", issues, "master_asset_inventory"
)

logo_card = bpy.data.objects.get("Mesh_31")
former_logo_card = bpy.data.objects.get("Mesh_33")
if not (
    logo_card is not None
    and former_logo_card is not None
    and logo_card.get("lazy_a_logo_card_owner") is True
    and former_logo_card.get("lazy_a_logo_card_owner") is False
    and close(float(logo_card.get("lazy_a_card_pair_shift_x", 0.0)), 0.18)
    and close(float(former_logo_card.get("lazy_a_card_pair_shift_x", 0.0)), 0.18)
    and logo_card.matrix_world.translation.x < former_logo_card.matrix_world.translation.x
):
    issues.append("logo ownership must stay on shifted Mesh_31 directly left of Mesh_33")

card_tape = bpy.data.objects.get("Mesh_32")
if (
    card_tape is None
    or card_tape.type != "MESH"
    or card_tape.get("lazy_a_material_role") != "matte-masking-tape-remnant"
    or not card_tape.data.materials
    or card_tape.data.materials[0].name != "CardPairMaskingTape"
    or not close(float(card_tape.get("lazy_a_card_pair_shift_x", 0.0)), 0.18)
    or min(
        (card_tape.matrix_world.translation - card.matrix_world.translation).length
        for card in (logo_card, former_logo_card)
    )
    > 0.35
):
    issues.append("Mesh_32 beside the logo cards must read as matte masking tape, not a dark render artifact")

missing_ids = sorted(EXPECTED_IDS.difference(inventory))
unexpected_ids = sorted(set(inventory).difference(EXPECTED_IDS))
if missing_ids:
    issues.append(f"inventory missing required ids: {missing_ids}")
if unexpected_ids:
    issues.append(f"inventory has unexpected ids: {unexpected_ids}")

seen_roots = set()
asset_bounds = {}
asset_meshes = {}
for asset_id, record in inventory.items():
    if not isinstance(record, dict):
        issues.append(f"{asset_id} inventory record is not structured metadata")
        continue

    objects = get_record_objects(asset_id, record, issues)
    meshes = [obj for obj in objects if obj.type == "MESH" and not obj.hide_render]
    asset_meshes[asset_id] = meshes
    actual_bounds = world_bounds(objects)
    stored_bounds = record.get("world_bounds")
    if actual_bounds is None:
        issues.append(f"{asset_id} has no renderable scene bounds")
    elif not valid_bounds(stored_bounds):
        issues.append(f"{asset_id} has no valid world bounds metadata")
    else:
        stored_min, stored_max = bounds_vectors(stored_bounds)
        actual_min, actual_max = actual_bounds
        asset_bounds[asset_id] = actual_bounds
        if any(
            not close(actual[index], stored[index], BOUNDS_TOLERANCE)
            for actual, stored in ((actual_min, stored_min), (actual_max, stored_max))
            for index in range(3)
        ):
            issues.append(f"{asset_id} saved world bounds do not match scene geometry")

    root_names = record.get("roots", [])
    if not isinstance(root_names, list) or not root_names:
        issues.append(f"{asset_id} has no scene roots")
        root_names = []
    elif len(root_names) != 1:
        issues.append(f"{asset_id} has {len(root_names)} scene roots; expected exactly one")
    for root_name in root_names:
        if root_name in seen_roots:
            issues.append(f"duplicate inventory root {root_name}")
        seen_roots.add(root_name)
        if root_name not in record.get("objects", []):
            issues.append(f"{asset_id} root is not inventory-tracked: {root_name}")

    root = bpy.data.objects.get(root_names[0]) if len(root_names) == 1 else None
    if root is None and len(root_names) == 1:
        issues.append(f"{asset_id} references missing root {root_names[0]}")
    elif root is not None and record.get("source_entry") != root.get(
        "lazy_a_source_entry"
    ):
        issues.append(f"{asset_id} source entry metadata mismatch")

    rule = ASSET_RULES.get(asset_id)
    if rule is None or actual_bounds is None:
        continue
    minimum, maximum = actual_bounds
    dimensions = maximum - minimum
    center = (minimum + maximum) * 0.5
    axis = rule.get("axis")
    if axis == "horizontal":
        actual_size = max(dimensions[:2])
    elif axis == "diameter":
        actual_size = max(dimensions)
    elif axis == "z":
        actual_size = dimensions.z
    else:
        actual_size = None
    if actual_size is not None and not close(
        actual_size,
        rule["size"],
        rule.get("size_tolerance", SIZE_TOLERANCE),
    ):
        issues.append(
            f"{asset_id} {axis} size={actual_size:.4f} expected={rule['size']:.4f}"
        )

    contact = rule.get("contact")
    contact_z = mesh_world_min_z(meshes) if asset_id == "seating" else minimum.z
    if contact in CONTACT_Z and not close(
        contact_z, CONTACT_Z[contact], CONTACT_TOLERANCE
    ):
        issues.append(
            f"{asset_id} contact z={contact_z:.4f} "
            f"expected {contact} z={CONTACT_Z[contact]:.4f}"
        )
    if "center" in rule:
        for axis_name, actual, expected in zip("xy", center[:2], rule["center"]):
            if not close(actual, expected, 0.012):
                issues.append(
                    f"{asset_id} center {axis_name}={actual:.4f} expected={expected:.4f}"
                )
    if "center_bounds" in rule:
        x_bounds, y_bounds = rule["center_bounds"]
        if not (x_bounds[0] <= center.x <= x_bounds[1]):
            issues.append(
                f"{asset_id} center x={center.x:.4f} outside authored zone {x_bounds}"
            )
        if not (y_bounds[0] <= center.y <= y_bounds[1]):
            issues.append(
                f"{asset_id} center y={center.y:.4f} outside authored zone {y_bounds}"
            )
    replaced = record.get("replaced_objects", [])
    if rule.get("replaces") and not replaced:
        issues.append(f"{asset_id} has no replacement relationship")
    if isinstance(replaced, list):
        still_renderable = sorted(
            name
            for name in replaced
            if bpy.data.objects.get(name) is not None
            and not bpy.data.objects[name].hide_render
        )
        if still_renderable:
            issues.append(
                f"{asset_id} replacement objects remain renderable: {still_renderable}"
            )

# Every volume is checked against the saved scene, not trusted only because an
# aggregate inventory bound was stamped by the builder.
books = asset_meshes.get("books", [])
if books:
    unsupported_books = []
    intersecting_books = []
    for book in books:
        bounds = world_bounds([book])
        if bounds is None:
            continue
        minimum, maximum = bounds
        if minimum.z < CONTACT_Z["shelf"] - CONTACT_TOLERANCE:
            intersecting_books.append(book.name)
        elif not close(minimum.z, CONTACT_Z["shelf"], CONTACT_TOLERANCE):
            unsupported_books.append(book.name)
    if unsupported_books or intersecting_books:
        issues.append(
            f"books do not individually rest on shelf top z={CONTACT_Z['shelf']:.4f} "
            f"(unsupported={len(unsupported_books)}, intersecting={len(intersecting_books)})"
        )
    books_min, books_max = asset_bounds.get("books", (None, None))
    if books_min is not None and not horizontal_contains(
        SHELF_MIN, SHELF_MAX, books_min, books_max, CONTACT_TOLERANCE
    ):
        issues.append("books are not fully supported by the saved shelf footprint")
    if (
        books_min is not None
        and books_max.z >= DESK_MIN.z - CONTACT_TOLERANCE
        and horizontal_overlaps(DESK_MIN, DESK_MAX, books_min, books_max)
    ):
        issues.append("books overlap the desk volume instead of occupying the shelf")
    check_hidden_replacements(
        "books", inventory.get("books", {}), LEGACY_BOOK_MESHES, issues
    )

for asset_id in ("pictureFrame", "lamp"):
    bounds = asset_bounds.get(asset_id)
    if bounds is None:
        continue
    minimum, maximum = bounds
    if not horizontal_contains(DESK_MIN, DESK_MAX, minimum, maximum, CONTACT_TOLERANCE):
        issues.append(
            f"{asset_id} is not fully supported by saved desk Mesh_26 "
            f"(xy min={tuple(round(value, 4) for value in minimum[:2])}, "
            f"max={tuple(round(value, 4) for value in maximum[:2])})"
        )

frame_record = inventory.get("pictureFrame")
if isinstance(frame_record, dict) and "pictureFrame" in asset_bounds:
    picture_meshes = [
        obj
        for obj in asset_meshes.get("pictureFrame", [])
        if any(is_picture_material(slot.material) for slot in obj.material_slots)
    ]
    if len(picture_meshes) != 1:
        issues.append(f"pictureFrame picture face count={len(picture_meshes)} expected=1")
    else:
        picture = picture_meshes[0]
        normals = []
        for polygon in picture.data.polygons:
            material = (
                picture.material_slots[polygon.material_index].material
                if polygon.material_index < len(picture.material_slots)
                else None
            )
            if is_picture_material(material):
                normals.append(
                    (picture.matrix_world.to_3x3() @ polygon.normal).normalized()
                    * polygon.area
                )
        if not normals or sum(normals[1:], normals[0]).length == 0:
            issues.append("pictureFrame has no measurable picture-face normal")
        else:
            normal = sum(normals[1:], normals[0]).normalized()
            frame_min, frame_max = asset_bounds["pictureFrame"]
            frame_center = (frame_min + frame_max) * 0.5
            to_desk_center = DESK_CENTER - frame_center
            to_desk_center.z = 0.0
            facing_dot = normal.dot(to_desk_center.normalized())
            if facing_dot < 0.65:
                issues.append(
                    f"pictureFrame face does not point toward desk center "
                    f"(dot={facing_dot:.4f}, expected >=0.65)"
                )

camera_record = inventory.get("camera")
if isinstance(camera_record, dict):
    if not isinstance(camera_record.get("components"), dict):
        issues.append("camera has no component-role metadata for body and strap")
    body_meshes = get_component_meshes("camera", camera_record, "body", issues)
    strap_meshes = get_component_meshes("camera", camera_record, "strap", issues)
    if len(body_meshes) != 1:
        issues.append(f"camera renderable body count={len(body_meshes)} expected=1")
    if len(strap_meshes) != 1:
        issues.append(f"camera renderable strap count={len(strap_meshes)} expected=1")
    role_meshes = {obj.name for obj in [*body_meshes, *strap_meshes]}
    all_camera_meshes = {obj.name for obj in asset_meshes.get("camera", [])}
    if role_meshes and role_meshes != all_camera_meshes:
        issues.append(
            f"camera renderable meshes are not exactly body+strap: {sorted(all_camera_meshes)}"
        )
    check_unique_component("camera", [*body_meshes, *strap_meshes], issues)
    check_hidden_replacements(
        "camera", camera_record, LEGACY_CAMERA_MESHES, issues
    )

lamp_record = inventory.get("lamp")
if isinstance(lamp_record, dict):
    if not isinstance(lamp_record.get("components"), dict):
        issues.append("lamp has no component-role metadata for its single fixture")
    fixture_meshes = get_component_meshes("lamp", lamp_record, "fixture", issues)
    if len(fixture_meshes) != 1:
        issues.append(
            f"desk lamp fixture count={len(fixture_meshes)} expected=1"
        )
    all_lamp_meshes = {obj.name for obj in asset_meshes.get("lamp", [])}
    fixture_names = {obj.name for obj in fixture_meshes}
    if fixture_names and fixture_names != all_lamp_meshes:
        issues.append(
            f"desk lamp renderable meshes are not one fixture: {sorted(all_lamp_meshes)}"
        )
    check_unique_component("lamp", fixture_meshes, issues)
    check_hidden_replacements("lamp", lamp_record, LEGACY_LAMP_MESHES, issues)

blanket_bounds = asset_bounds.get("blanket")
chair_bounds = asset_bounds.get("chair")
chair_record = inventory.get("chair")
blanket_points = [
    obj.matrix_world @ vertex.co
    for obj in asset_meshes.get("blanket", [])
    for vertex in obj.data.vertices
]
if blanket_bounds is not None:
    blanket_min, blanket_max = blanket_bounds
    if blanket_min.z <= 0.0 or blanket_max.z <= 0.0:
        issues.append(
            f"blanket world bounds are not positive: "
            f"z=[{blanket_min.z:.4f}, {blanket_max.z:.4f}]"
        )
    lower_drape = [
        point
        for point in blanket_points
        if blanket_min.z + 0.08 < point.z < blanket_max.z - 0.08
    ]
    fold_depth = (
        max(point.y for point in lower_drape)
        - min(point.y for point in lower_drape)
        if lower_drape
        else 0.0
    )
    hem_count = min(25, len(blanket_points))
    hem = sorted(blanket_points, key=lambda point: point.z)[:hem_count]
    hem_variation = (
        max(point.z for point in hem) - min(point.z for point in hem) if hem else 0.0
    )
    if fold_depth < 0.045:
        issues.append(
            f"blanket drape fold depth={fold_depth:.4f} expected at least 0.045m"
        )
    if hem_variation < 0.015:
        issues.append(
            f"blanket hem variation={hem_variation:.4f} expected at least 0.015m"
        )
    pinned_points = [
        point for point in blanket_points if point.z >= blanket_max.z - 0.12
    ]
    chair_surface_meshes = asset_meshes.get("chair", [])
    support_distances = [
        closest_surface_distance(point, chair_surface_meshes)
        for point in pinned_points
    ]
    supported = [distance for distance in support_distances if distance <= 0.035]
    if (
        not support_distances
        or min(support_distances) > 0.01
        or len(supported) / len(support_distances) < 0.30
    ):
        issues.append(
            "blanket pinned edge is not supported by the actual chair surface "
            f"(nearest={min(support_distances, default=math.inf):.4f}, "
            f"supported={len(supported)}/{len(support_distances)})"
        )
if isinstance(chair_record, dict):
    chair_points = [
        obj.matrix_world @ vertex.co
        for obj in asset_meshes.get("chair", [])
        for vertex in obj.data.vertices
    ]
    actual_back_bounds = None
    if chair_bounds is not None and chair_points:
        chair_min, chair_max = chair_bounds
        actual_back_points = [
            point
            for point in chair_points
            if point.z >= chair_min.z + (chair_max.z - chair_min.z) * 0.50
            and point.y <= chair_min.y + (chair_max.y - chair_min.y) * 0.38
        ]
        if actual_back_points:
            actual_back_bounds = (
                Vector(
                    min(point[index] for point in actual_back_points)
                    for index in range(3)
                ),
                Vector(
                    max(point[index] for point in actual_back_points)
                    for index in range(3)
                ),
            )
    regions = chair_record.get("regions")
    chair_back = regions.get("back") if isinstance(regions, dict) else None
    if not valid_bounds(chair_back):
        issues.append("chair back-region bounds metadata missing")
        if blanket_bounds is not None and chair_bounds is not None:
            overlap = overlap_dimensions(
                blanket_bounds[0], blanket_bounds[1], chair_bounds[0], chair_bounds[1]
            )
            if any(value <= 0.01 for value in overlap):
                issues.append(
                    "blanket does not overlap the chair geometry "
                    f"(overlap={tuple(round(value, 4) for value in overlap)})"
                )
    elif blanket_bounds is not None and chair_bounds is not None:
        back_min, back_max = bounds_vectors(chair_back)
        chair_min, chair_max = chair_bounds
        if any(
            back_min[index] < chair_min[index] - BOUNDS_TOLERANCE
            or back_max[index] > chair_max[index] + BOUNDS_TOLERANCE
            for index in range(3)
        ):
            issues.append("chair back-region bounds fall outside the chair geometry")
        if actual_back_bounds is None or any(
            not close(stored[index], actual[index], BOUNDS_TOLERANCE)
            for stored, actual in (
                (back_min, actual_back_bounds[0] if actual_back_bounds else back_min),
                (back_max, actual_back_bounds[1] if actual_back_bounds else back_max),
            )
            for index in range(3)
        ):
            issues.append("chair back-region metadata does not match actual upper-back geometry")
        overlap = overlap_dimensions(blanket_bounds[0], blanket_bounds[1], back_min, back_max)
        if any(value <= 0.01 for value in overlap):
            issues.append(
                "blanket does not overlap the chair-back region "
                f"(overlap={tuple(round(value, 4) for value in overlap)})"
            )

plant_bounds = asset_bounds.get("plant")
ball_bounds = asset_bounds.get("basketball")
if plant_bounds is not None and ball_bounds is not None:
    plant_center = (plant_bounds[0] + plant_bounds[1]) * 0.5
    ball_center = (ball_bounds[0] + ball_bounds[1]) * 0.5
    if (
        plant_center.x < 1.0
        or plant_bounds[1].y < 0.35
        or plant_bounds[1].y > 0.48
    ):
        issues.append(
            f"plant is not in the right-rear floor zone: "
            f"center=({plant_center.x:.4f}, {plant_center.y:.4f}), "
            f"rear edge={plant_bounds[1].y:.4f}"
        )
    if ball_center.x < 1.0:
        issues.append(f"basketball is not in the right-side vignette: x={ball_center.x:.4f}")
    forward_separation = plant_center.y - ball_center.y
    if abs(plant_center.x - ball_center.x) > 0.15 or not (
        0.10 <= forward_separation <= 0.80
    ):
        issues.append(
            "basketball is not directly in front of plant from the desk camera "
            f"(dx={ball_center.x - plant_center.x:.4f}, "
            f"front separation={forward_separation:.4f})"
        )

renderable_pendants = sorted(
    name
    for name in PENDANT_MESHES
    if bpy.data.objects.get(name) is not None and not bpy.data.objects[name].hide_render
)
if renderable_pendants:
    issues.append(f"pendant meshes remain renderable: {renderable_pendants}")

seating_record = inventory.get("seating")
if isinstance(seating_record, dict):
    if not isinstance(seating_record.get("components"), dict):
        issues.append("seating has no component-role metadata")
    floor_lamp_meshes = get_component_meshes(
        "seating", seating_record, "floor_lamp", issues
    )
    chair_meshes = get_component_meshes("seating", seating_record, "chair", issues)
    coffee_table_meshes = get_component_meshes(
        "seating", seating_record, "coffee_table", issues
    )
    floor_lamp_bounds = mesh_world_bounds(floor_lamp_meshes)
    if floor_lamp_bounds is not None:
        height = floor_lamp_bounds[1].z - floor_lamp_bounds[0].z
        if not close(height, 1.65, SIZE_TOLERANCE):
            issues.append(f"seating floor lamp height={height:.4f} expected=1.6500")
        if not close(
            mesh_world_min_z(floor_lamp_meshes),
            CONTACT_Z["floor"],
            CONTACT_TOLERANCE,
        ):
            issues.append("seating floor lamp does not make actual mesh contact with floor")
    chair_bounds = mesh_world_bounds(chair_meshes)
    if chair_bounds is not None:
        dimensions = oriented_mesh_dimensions(chair_meshes)
        if not (
            dimensions is not None
            and 0.90 <= dimensions[0] <= 1.20
            and 0.90 <= dimensions[1] <= 1.20
            and 1.02 <= dimensions[2] <= 1.20
        ):
            issues.append(
                "seating armchair dimensions are not believable real-world proportions: "
                f"{tuple(round(value, 4) for value in (dimensions or []))}"
            )
        if not close(chair_bounds[0].z, CONTACT_Z["floor"], CONTACT_TOLERANCE):
            issues.append(
                f"seating armchair floats at z={chair_bounds[0].z:.4f}; expected floor contact"
            )
    coffee_table_bounds = mesh_world_bounds(coffee_table_meshes)
    if coffee_table_bounds is not None:
        dimensions = oriented_mesh_dimensions(coffee_table_meshes)
        if not (
            dimensions is not None
            and 0.38 <= dimensions[0] <= 0.48
            and 0.75 <= dimensions[1] <= 1.40
            and 1.30 <= dimensions[2] <= 1.80
        ):
            issues.append(
                "seating coffee-table dimensions are not believable real-world proportions: "
                f"{tuple(round(value, 4) for value in (dimensions or []))}"
            )
        if not close(
            mesh_world_min_z(coffee_table_meshes),
            CONTACT_Z["floor"],
            CONTACT_TOLERANCE,
        ):
            issues.append("seating coffee table does not make actual mesh contact with floor")
    seating_bounds = asset_bounds.get("seating")
    if seating_bounds is not None:
        seating_center_x = (seating_bounds[0].x + seating_bounds[1].x) * 0.5
        if seating_center_x >= -0.9 or seating_bounds[1].x >= 0.0:
            issues.append(
                "seating set does not occupy the authored left-continuation bounds "
                f"(x=[{seating_bounds[0].x:.4f}, {seating_bounds[1].x:.4f}])"
            )
    measured_facing = measured_seating_facing(chair_meshes)
    facing = seating_record.get("facing_vector")
    if measured_facing is None or measured_facing.x > -0.7:
        issues.append(
            "seating chair does not geometrically open toward screen-left: "
            f"measured={measured_facing}"
        )
    if not (
        seating_record.get("facing_measurement")
        == "seat-centroid-minus-high-back-centroid"
        and isinstance(facing, list)
        and len(facing) == 3
        and all(isinstance(value, (int, float)) for value in facing)
        and measured_facing is not None
        and all(close(value, actual, 1e-5) for value, actual in zip(facing, measured_facing))
    ):
        issues.append("seating facing metadata does not match measured chair geometry")

    component_objects = {
        "chair": chair_meshes,
        "floor_lamp": floor_lamp_meshes,
        "coffee_table": coffee_table_meshes,
    }
    measured_centers = {
        role: bounds_center(objects) for role, objects in component_objects.items()
    }
    stored_centers = seating_record.get("component_centers")
    if not isinstance(stored_centers, dict) or any(
        measured_centers[role] is None
        or not isinstance(stored_centers.get(role), list)
        or len(stored_centers[role]) != 3
        or any(
            not close(stored, actual, 1e-5)
            for stored, actual in zip(stored_centers[role], measured_centers[role])
        )
        for role in component_objects
    ):
        issues.append("seating component-center metadata does not match scene geometry")
    distance_limits = {
        "chair_to_floor_lamp": (0.65, 1.50),
        "chair_to_coffee_table": (0.75, 1.50),
        "floor_lamp_to_coffee_table": (0.50, 1.30),
    }
    stored_distances = seating_record.get("component_distances")
    for key, (minimum_distance, maximum_distance) in distance_limits.items():
        left, right = key.split("_to_")
        if measured_centers[left] is None or measured_centers[right] is None:
            continue
        delta = measured_centers[right] - measured_centers[left]
        delta.z = 0.0
        distance = delta.length
        stored = stored_distances.get(key) if isinstance(stored_distances, dict) else None
        if not (
            minimum_distance <= distance <= maximum_distance
            and isinstance(stored, (int, float))
            and close(stored, distance, 1e-5)
        ):
            issues.append(
                f"seating {key} distance={distance:.4f} outside "
                f"[{minimum_distance:.2f}, {maximum_distance:.2f}] or metadata stale"
            )

    bookcase_meshes = [
        bpy.data.objects[name]
        for name in (
            "Mesh_110",
            "Mesh_111",
            "Mesh_112",
            "Mesh_113",
            "Mesh_114",
        )
        if name in bpy.data.objects
    ]
    bookcase_overlaps = bvh_overlap_count(
        [*chair_meshes, *floor_lamp_meshes, *coffee_table_meshes],
        bookcase_meshes,
    )
    if bookcase_overlaps:
        issues.append(
            f"seating vignette intersects bookshelf geometry ({bookcase_overlaps} BVH pairs)"
        )
    for left_role, right_role in (
        ("chair", "floor_lamp"),
        ("chair", "coffee_table"),
        ("floor_lamp", "coffee_table"),
    ):
        overlaps = bvh_overlap_count(
            component_objects[left_role], component_objects[right_role]
        )
        if overlaps:
            issues.append(
                f"seating {left_role}/{right_role} intersect ({overlaps} BVH pairs)"
            )
    visibility = seating_record.get("default_frame_visibility")
    projection = seating_record.get("default_frame_projection")
    if not isinstance(visibility, dict):
        issues.append("seating default-chair visibility metadata missing")
    else:
        opening_camera = {
            "position": (-0.6, 1.6, 4.9),
            "target": (0.05, 0.92, 0.0),
        }
        measured = project_bounds(
            chair_meshes,
            {
                "viewport": (1280, 720),
                **opening_camera,
            },
        )
        rendered_components = {
            role: render_visible_pixel_bounds(objects, opening_camera)
            for role, objects in component_objects.items()
        }
        rendered = rendered_components["chair"]
        rendered_back = render_back_pixel_bounds(
            chair_meshes,
            measured_facing,
            opening_camera,
        )
        if visibility.get("camera") != "opening":
            issues.append("seating visibility metadata is not measured from opening camera")
        if visibility.get("visible_region") != "chair_back_floor_lamp_table_edge":
            issues.append("opening seating visibility does not name all three supplied components")
        if visibility.get("measurement") != "occlusion_aware_component_render_gate":
            issues.append("seating visibility metadata does not name the rendered gate")
        if measured is None:
            issues.append("seating chair is not projected in front of the opening camera")
        else:
            measured_bounds = measured["visible_bounds"]
            measured_fraction = measured["visible_fraction"]
            if not (
                isinstance(projection, dict)
                and projection.get("camera") == "opening"
                and isinstance(projection.get("visible_bounds"), list)
                and len(projection["visible_bounds"]) == 4
                and all(
                    close(stored, actual, 1e-5)
                    for stored, actual in zip(
                        projection["visible_bounds"], measured_bounds
                    )
                )
                and isinstance(projection.get("visible_fraction"), (int, float))
                and close(
                    projection["visible_fraction"], measured_fraction, 1e-5
                )
            ):
                issues.append(
                    "seating projection metadata does not match measured geometry: "
                    f"bounds={tuple(round(value, 4) for value in measured_bounds)}, "
                    f"fraction={measured_fraction:.5f}"
                )
        for role, component_render in rendered_components.items():
            component_bounds = component_render.get("visible_bounds")
            if not (
                component_render.get("pixel_count", 0) >= 20
                and component_bounds is not None
                and 0.0 <= component_bounds[0] <= 0.04
                and 0.01 <= component_bounds[2] <= 0.09
            ):
                issues.append(
                    f"opening seating {role} is not a readable peripheral edge: "
                    f"pixels={component_render.get('pixel_count')}, bounds={component_bounds}"
                )
        back_bounds = rendered_back.get("visible_bounds")
        back_pixels = rendered_back.get("pixel_count", 0)
        if not (
            back_pixels >= 20
            and back_pixels >= rendered.get("pixel_count", 0) * 0.5
            and back_bounds is not None
            and 0.0 <= back_bounds[0] <= 0.04
            and 0.01 <= back_bounds[2] <= 0.09
        ):
            issues.append(
                "opening chair pixels are not dominated by measured back geometry: "
                f"back pixels={back_pixels}, bounds={back_bounds}, "
                f"all-chair pixels={rendered.get('pixel_count')}"
            )
    if not chair_meshes:
        issues.append("seating has no renderable chair component for visibility proof")

for asset_id in sorted(PRESERVED_IDS):
    record = inventory.get(asset_id)
    if not isinstance(record, dict):
        issues.append(f"preserved {asset_id} inventory record missing")
        continue
    roots = record.get("roots", [])
    if not isinstance(roots, list) or len(roots) != 1:
        issues.append(f"preserved {asset_id} logical count is not exactly one")
    meshes = asset_meshes.get(asset_id, [])
    if not meshes:
        issues.append(f"preserved {asset_id} has no renderable geometry")
    else:
        check_unique_component(f"preserved {asset_id}", meshes, issues)

for role, object_names in PRESERVED_BASE_OBJECTS.items():
    present = []
    for object_name in object_names:
        named = [
            obj
            for obj in bpy.data.objects
            if obj.name == object_name or obj.name.startswith(f"{object_name}.")
        ]
        if len(named) != 1:
            issues.append(
                f"preserved {role} mesh count for {object_name}={len(named)} expected exactly one"
            )
        obj = bpy.data.objects.get(object_name)
        if obj is None or obj.type != "MESH":
            issues.append(f"preserved {role} mesh missing: {object_name}")
            continue
        present.append(obj)
        if role not in {"notebook"} and obj.hide_render:
            issues.append(f"preserved {role} mesh is unexpectedly hidden: {object_name}")

navigation_sheet = bpy.data.objects.get("ProductionNavigationSheet")
if navigation_sheet is not None and navigation_sheet.type == "MESH":
    local_bounds = [Vector(corner) for corner in navigation_sheet.bound_box]
    local_dimensions = Vector(
        max(point[index] for point in local_bounds)
        - min(point[index] for point in local_bounds)
        for index in range(3)
    )
    if any(
        not close(actual, expected, 0.001)
        for actual, expected in zip(local_dimensions, (0.30, 0.20, 0.0007))
    ):
        issues.append(
            "navigation sheet dimensions changed: "
            f"{tuple(round(value, 5) for value in local_dimensions)}"
        )
    navigation_bounds = world_bounds([navigation_sheet])
    if navigation_bounds is not None:
        minimum, maximum = navigation_bounds
        if not close(minimum.z, CONTACT_Z["desk"], CONTACT_TOLERANCE):
            issues.append(
                f"navigation sheet floats at z={minimum.z:.4f}; expected desk contact"
            )
        if not horizontal_contains(
            DESK_MIN, DESK_MAX, minimum, maximum, CONTACT_TOLERANCE
        ):
            issues.append("navigation sheet is not fully supported by the desk")

spatial_contracts = load_json_property(
    scene, "master_spatial_contracts", issues, "master_spatial_contracts"
)
left_shell = spatial_contracts.get("left_shell")
if not isinstance(left_shell, dict):
    issues.append("left shell continuation metadata missing")
else:
    original_left_x = left_shell.get("original_left_x")
    boundary_x = left_shell.get("left_boundary_x")
    right_before = left_shell.get("right_edge_before_x")
    right_after = left_shell.get("right_edge_after_x")
    if not (
        isinstance(original_left_x, (int, float))
        and isinstance(boundary_x, (int, float))
        and original_left_x - boundary_x >= 2.0
    ):
        issues.append(
            "left shell extension is less than 2.0m or lacks measured boundary metadata"
        )
    if not (
        isinstance(right_before, (int, float))
        and isinstance(right_after, (int, float))
        and close(right_before, right_after, BOUNDS_TOLERANCE)
    ):
        issues.append("left shell does not preserve the authored right edge")
    if isinstance(boundary_x, (int, float)) and isinstance(right_after, (int, float)):
        surface_bounds = left_shell.get("surface_bounds")
        if not isinstance(surface_bounds, dict):
            issues.append("left shell full surface-bounds metadata missing")
        for surface, object_name in SHELL_OBJECTS.items():
            obj = bpy.data.objects.get(object_name)
            bounds = world_bounds([obj]) if obj is not None else None
            if obj is None or obj.type != "MESH" or obj.hide_render or bounds is None:
                issues.append(f"left shell {surface} mesh {object_name} is missing or hidden")
                continue
            minimum, maximum = bounds
            if minimum.x > boundary_x + BOUNDS_TOLERANCE:
                issues.append(
                    f"left shell {surface} begins at x={minimum.x:.4f}, "
                    f"after boundary x={boundary_x:.4f}"
                )
            if maximum.x < right_after - BOUNDS_TOLERANCE:
                issues.append(
                    f"left shell {surface} ends at x={maximum.x:.4f}, "
                    f"before preserved right edge x={right_after:.4f}"
                )
            bounds_record = (
                surface_bounds.get(surface) if isinstance(surface_bounds, dict) else None
            )
            before = bounds_record.get("before") if isinstance(bounds_record, dict) else None
            after = bounds_record.get("after") if isinstance(bounds_record, dict) else None
            if not valid_bounds(before) or not valid_bounds(after):
                issues.append(f"left shell {surface} before/after bounds metadata missing")
            else:
                before_min, before_max = bounds_vectors(before)
                after_min, after_max = bounds_vectors(after)
                if any(
                    not close(actual[index], stored[index], BOUNDS_TOLERANCE)
                    for actual, stored in ((minimum, after_min), (maximum, after_max))
                    for index in range(3)
                ):
                    issues.append(f"left shell {surface} after-bounds do not match geometry")
                if any(
                    not close(before_value[index], after_value[index], BOUNDS_TOLERANCE)
                    for before_value, after_value in (
                        (before_min, after_min),
                        (before_max, after_max),
                    )
                    for index in (1, 2)
                ):
                    issues.append(
                        f"left shell {surface} changed Y/Z coverage while extending left"
                    )

        actual_shell_bounds = {
            surface: world_bounds([bpy.data.objects[object_name]])
            for surface, object_name in SHELL_OBJECTS.items()
            if bpy.data.objects.get(object_name) is not None
            and not bpy.data.objects[object_name].hide_render
        }
        rear_bounds = actual_shell_bounds.get("rear_wall")
        floor_bounds = actual_shell_bounds.get("floor")
        ceiling_bounds = actual_shell_bounds.get("ceiling")
        baseboard_bounds = actual_shell_bounds.get("baseboard")
        about_camera_depth = min(
            three_to_blender(pose["position"]).y for pose in ABOUT_POSES.values()
        )
        if (
            rear_bounds is None
            or floor_bounds is None
            or ceiling_bounds is None
            or rear_bounds[0].z > floor_bounds[1].z + BOUNDS_TOLERANCE
            or rear_bounds[1].z < ceiling_bounds[0].z - BOUNDS_TOLERANCE
        ):
            issues.append("rear wall does not span continuously from floor to ceiling")
        if rear_bounds is None or (
            floor_bounds is None
            or floor_bounds[0].y > about_camera_depth + BOUNDS_TOLERANCE
            or floor_bounds[1].y < rear_bounds[0].y - BOUNDS_TOLERANCE
        ):
            issues.append("floor does not cover the ABOUT camera-to-rear-wall depth")
        if rear_bounds is None or (
            ceiling_bounds is None
            or ceiling_bounds[0].y > about_camera_depth + BOUNDS_TOLERANCE
            or ceiling_bounds[1].y < rear_bounds[0].y - BOUNDS_TOLERANCE
        ):
            issues.append("ceiling does not cover the ABOUT camera-to-rear-wall depth")
        if rear_bounds is None or floor_bounds is None or (
            baseboard_bounds is None
            or baseboard_bounds[0].z > floor_bounds[1].z + BOUNDS_TOLERANCE
            or baseboard_bounds[1].z < floor_bounds[1].z + 0.05
            or baseboard_bounds[0].y > rear_bounds[0].y + 0.02
            or baseboard_bounds[1].y < rear_bounds[0].y - 0.02
        ):
            issues.append("rear baseboard does not bridge the floor/rear-wall seam")

        boundary_names = left_shell.get("moved_boundary_objects", [])
        boundary_objects = [
            bpy.data.objects[name]
            for name in boundary_names
            if name in bpy.data.objects and not bpy.data.objects[name].hide_render
        ]
        if not boundary_objects:
            issues.append("left boundary assembly has no renderable tracked objects")
        for profile, pose in ABOUT_POSES.items():
            projection = project_bounds(boundary_objects, pose) if boundary_objects else None
            if projection is not None and projection["projected_bounds"][2] > 0.0:
                issues.append(
                    f"ABOUT {profile} still exposes the left boundary assembly: "
                    f"max screen x={projection['projected_bounds'][2]:.4f}"
                )

provenance = load_json_property(
    scene, "master_build_provenance", issues, "master_build_provenance"
)
if not provenance:
    issues.append(
        "build provenance lacks current builder/asset hashes, timestamp, and invocation UUID"
    )
if provenance:
    for key, relative_path in {
        "builder_sha256": "scripts/build-master-scene.py",
        "asset_inventory_sha256": "assets/master/credits.json",
    }.items():
        actual_hash = provenance.get(key)
        expected_hash = sha256_file(relative_path)
        if actual_hash != expected_hash:
            issues.append(
                f"build provenance {key}={actual_hash} expected current {expected_hash}"
            )
    expected_inputs = {
        path: sha256_file(path) for path in expected_build_inputs()
    }
    recorded_inputs = provenance.get("input_files_sha256")
    if not isinstance(recorded_inputs, dict):
        issues.append("build provenance input_files_sha256 manifest is missing")
    else:
        missing_inputs = sorted(set(expected_inputs).difference(recorded_inputs))
        unexpected_inputs = sorted(set(recorded_inputs).difference(expected_inputs))
        stale_inputs = sorted(
            path
            for path in set(expected_inputs).intersection(recorded_inputs)
            if recorded_inputs[path] != expected_inputs[path]
        )
        if missing_inputs or unexpected_inputs or stale_inputs:
            issues.append(
                "build provenance input manifest differs from current build inputs "
                f"(missing={missing_inputs}, unexpected={unexpected_inputs}, stale={stale_inputs})"
            )
    if provenance.get("blender_version") != bpy.app.version_string:
        issues.append(
            f"build provenance blender_version={provenance.get('blender_version')} "
            f"expected {bpy.app.version_string}"
        )
    source_glb = provenance.get("source_glb")
    expected_source = "docs/progress/0108-scene.glb"
    if source_glb != expected_source:
        issues.append(
            f"build provenance source_glb={source_glb} expected {expected_source}"
        )
    elif provenance.get("source_glb_sha256") != sha256_file(expected_source):
        issues.append("build provenance source_glb_sha256 is stale")
    invocation_id = provenance.get("invocation_id")
    try:
        UUID(invocation_id)
    except (ValueError, TypeError, AttributeError):
        issues.append(f"build provenance invocation_id={invocation_id} is not a UUID")
    build_timestamp = provenance.get("build_timestamp")
    try:
        parsed_timestamp = datetime.fromisoformat(build_timestamp.replace("Z", "+00:00"))
        if parsed_timestamp.tzinfo is None:
            raise ValueError("timestamp has no timezone")
        newest_input = max(
            (REPO_ROOT / path).stat().st_mtime for path in expected_inputs
        )
        if parsed_timestamp.timestamp() + 1.0 < newest_input:
            issues.append("build provenance timestamp predates a current build input")
        if parsed_timestamp > datetime.now(timezone.utc):
            issues.append("build provenance timestamp is in the future")
    except (ValueError, TypeError, AttributeError):
        issues.append(
            f"build provenance build_timestamp={build_timestamp} is not timezone-aware ISO-8601"
        )

    sidecar_path = Path(f"{bpy.data.filepath}.provenance.json")
    try:
        sidecar = json.loads(sidecar_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        sidecar = {}
        issues.append(f"build provenance sidecar is missing or invalid: {sidecar_path}")
    if sidecar:
        for key, value in provenance.items():
            if sidecar.get(key) != value:
                issues.append(f"build provenance sidecar mismatch for {key}")
        if sidecar.get("master_sha256") != sha256_file(bpy.data.filepath):
            issues.append("build provenance sidecar master_sha256 is stale")

asset_objects = [
    obj for obj in bpy.data.objects if obj.get("lazy_a_asset_id") in EXPECTED_IDS
]
for obj in asset_objects:
    asset_id = obj.get("lazy_a_asset_id")
    record = inventory.get(asset_id, {})
    if not isinstance(record, dict) or obj.name not in record.get("objects", []):
        issues.append(f"untracked duplicate asset object {obj.name} ({asset_id})")

for obj in bpy.data.objects:
    if obj.hide_render or obj.type != "MESH":
        continue
    materials = {slot.material.name for slot in obj.material_slots if slot.material}
    forbidden = materials.intersection({"Floor", "Khayt"})
    if forbidden:
        issues.append(
            f"basketball display material remains renderable on {obj.name}: {sorted(forbidden)}"
        )

checks = {
    "cycles samples": (scene.cycles.samples, 192),
    "exposure": (scene.view_settings.exposure, 0.25),
    "world strength": (
        scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value,
        0.24,
    ),
}
for label, (actual, expected) in checks.items():
    if not close(actual, expected):
        issues.append(f"{label}={actual} expected={expected}")

energies = sorted(
    object.data.energy for object in bpy.data.objects if object.type == "LIGHT"
)
for expected in (5.5, 23.0, 32.0, 60.0):
    if not any(close(actual, expected) for actual in energies):
        issues.append(f"missing approved light energy {expected}")

seating_practical = bpy.data.objects.get("SeatingFloorLampPractical")
if seating_practical is None or seating_practical.type != "LIGHT":
    issues.append("supplied seating floor lamp has no physical practical light")
elif isinstance(seating_record, dict):
    floor_lamp_names = seating_record.get("components", {}).get("floor_lamp", [])
    floor_lamp_objects = [
        bpy.data.objects[name]
        for name in floor_lamp_names
        if bpy.data.objects.get(name) is not None
    ]
    practical_bounds = mesh_world_bounds(floor_lamp_objects)
    location = seating_practical.matrix_world.translation
    if (
        practical_bounds is None
        or not (
            practical_bounds[0].x <= location.x <= practical_bounds[1].x
            and practical_bounds[0].y <= location.y <= practical_bounds[1].y
            and practical_bounds[0].z + 1.2 <= location.z <= practical_bounds[1].z
        )
        or seating_practical.get("lazy_a_physical_source") not in floor_lamp_names
    ):
        issues.append("seating practical light is not inside the supplied floor-lamp shade")

if scene.render.engine != "CYCLES":
    issues.append(f"render engine={scene.render.engine} expected=CYCLES")
if scene.view_settings.view_transform != "AgX":
    issues.append(
        f"view transform={scene.view_settings.view_transform} expected=AgX"
    )
if not scene.cycles.use_denoising:
    issues.append("Cycles denoising is disabled")

if issues:
    print(f"MASTER BLEND VERIFICATION FAILED ({len(issues)} issues)")
    for issue in issues:
        print(" -", issue)
    raise SystemExit(1)

print(
    "MASTER BLEND VERIFIED:",
    ", ".join(sorted(inventory)),
    "| R3 physical contracts | provenance current | Cycles 192 | AgX 0.25",
)
