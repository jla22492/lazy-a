import bpy
import json
import math


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
}

ASSET_RULES = {
    "mug": {"axis": "z", "size": 0.095, "contact": "desk", "replaces": True, "center": (-0.55, -0.19)},
    "lamp": {"axis": "z", "size": 0.48, "contact": "desk", "replaces": True, "center": (-0.94, 0.27), "yaw": 0.0},
    "plant": {"axis": "z", "size": 0.75, "contact": "floor", "replaces": True, "center": (-1.95, -0.12)},
    "headphones": {"axis": "horizontal", "size": 0.19, "contact": "desk", "replaces": True, "center": (-0.70, -0.05)},
    "pictureFrame": {"axis": "z", "size": 0.20, "contact": "desk", "replaces": False, "center": (-0.83, 0.08), "faces_camera": True},
    "trashCan": {"axis": "z", "size": 0.27, "contact": "floor", "replaces": True, "center": (-1.06, -0.52)},
    "basketball": {"axis": "diameter", "size": 0.24, "contact": "floor", "replaces": False, "center": (1.95, -0.72)},
}

CONTACT_Z = {"floor": 0.0, "desk": 0.9}
SIZE_TOLERANCE = 0.012
CONTACT_TOLERANCE = 0.012


def close(actual, expected, tolerance=1e-6):
    return math.isclose(actual, expected, abs_tol=tolerance)


scene = bpy.context.scene
issues = []

try:
    inventory = json.loads(scene.get("master_asset_inventory", "{}"))
except json.JSONDecodeError:
    inventory = {}
    issues.append("master_asset_inventory is not valid JSON")

if set(inventory) != EXPECTED_IDS:
    issues.append(
        f"inventory ids={sorted(inventory)} expected={sorted(EXPECTED_IDS)}"
    )

seen_roots = set()
for asset_id, record in inventory.items():
    if not isinstance(record, dict):
        issues.append(f"{asset_id} inventory record is not structured metadata")
        continue
    object_names = record.get("objects", [])
    root_names = record.get("roots", [])
    if not object_names:
        issues.append(f"{asset_id} has no scene objects")
    if not root_names:
        issues.append(f"{asset_id} has no scene roots")
    elif len(root_names) != 1:
        issues.append(f"{asset_id} has {len(root_names)} scene roots; expected exactly one")
    for root_name in root_names:
        if root_name in seen_roots:
            issues.append(f"duplicate inventory root {root_name}")
        seen_roots.add(root_name)
    for object_name in object_names:
        if object_name not in bpy.data.objects:
            issues.append(f"{asset_id} references missing object {object_name}")
            continue
        obj = bpy.data.objects[object_name]
        if obj.get("lazy_a_asset_id") != asset_id:
            issues.append(
                f"{object_name} lazy_a_asset_id={obj.get('lazy_a_asset_id')} expected={asset_id}"
            )

    if asset_id not in ASSET_RULES:
        continue
    rule = ASSET_RULES[asset_id]
    bounds = record.get("world_bounds", {})
    minimum = bounds.get("min")
    maximum = bounds.get("max")
    if not (
        isinstance(minimum, list)
        and isinstance(maximum, list)
        and len(minimum) == 3
        and len(maximum) == 3
    ):
        issues.append(f"{asset_id} has no valid world bounds")
        continue
    dimensions = [maximum[i] - minimum[i] for i in range(3)]
    center = [(minimum[i] + maximum[i]) / 2 for i in range(3)]
    if rule["axis"] == "horizontal":
        actual_size = max(dimensions[:2])
    elif rule["axis"] == "diameter":
        actual_size = max(dimensions)
    else:
        actual_size = dimensions[2]
    if not close(actual_size, rule["size"], SIZE_TOLERANCE):
        issues.append(
            f"{asset_id} {rule['axis']} size={actual_size:.4f} expected={rule['size']:.4f}"
        )
    expected_contact = CONTACT_Z[rule["contact"]]
    if not close(minimum[2], expected_contact, CONTACT_TOLERANCE):
        issues.append(
            f"{asset_id} contact z={minimum[2]:.4f} expected={expected_contact:.4f}"
        )
    for axis, actual, expected in zip("xy", center[:2], rule["center"]):
        if not close(actual, expected, 0.012):
            issues.append(
                f"{asset_id} center {axis}={actual:.4f} expected={expected:.4f}"
            )
    if "yaw" in rule:
        root = bpy.data.objects[root_names[0]]
        if not close(root.rotation_euler.z, rule["yaw"], 1e-4):
            issues.append(
                f"{asset_id} yaw={root.rotation_euler.z:.4f} expected={rule['yaw']:.4f}"
            )
    if rule.get("faces_camera"):
        picture_meshes = [
            bpy.data.objects[name]
            for name in object_names
            if bpy.data.objects[name].type == "MESH"
            and any(
                slot.material and slot.material.name.startswith("picture")
                for slot in bpy.data.objects[name].material_slots
            )
        ]
        if len(picture_meshes) != 1:
            issues.append(f"{asset_id} picture face count={len(picture_meshes)} expected=1")
        else:
            picture = picture_meshes[0]
            normals = [
                picture.matrix_world.to_3x3() @ polygon.normal
                for polygon in picture.data.polygons
            ]
            normal = sum(normals[1:], normals[0]).normalized()
            if normal.y > -0.8:
                issues.append(
                    f"{asset_id} picture face normal y={normal.y:.4f} expected <= -0.8"
                )
    if record.get("source_entry") != bpy.data.objects[root_names[0]].get(
        "lazy_a_source_entry"
    ):
        issues.append(f"{asset_id} source entry metadata mismatch")
    replaced = record.get("replaced_objects", [])
    if rule["replaces"] and not replaced:
        issues.append(f"{asset_id} has no replacement relationship")
    for object_name in replaced:
        if object_name not in bpy.data.objects:
            issues.append(f"{asset_id} replacement object missing: {object_name}")
        elif not bpy.data.objects[object_name].hide_render:
            issues.append(f"{asset_id} replacement remains renderable: {object_name}")

asset_objects = [
    obj for obj in bpy.data.objects if obj.get("lazy_a_asset_id") in EXPECTED_IDS
]
for obj in asset_objects:
    asset_id = obj.get("lazy_a_asset_id")
    if obj.name not in inventory.get(asset_id, {}).get("objects", []):
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
for expected in (5.5, 23.0, 60.0):
    if not any(close(actual, expected) for actual in energies):
        issues.append(f"missing approved light energy {expected}")

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
    "| Cycles 192 | AgX 0.25 | lights 5.5/23/60 | world 0.24",
)
