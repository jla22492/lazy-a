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
}


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

for asset_id, object_names in inventory.items():
    if not object_names:
        issues.append(f"{asset_id} has no scene objects")
    for object_name in object_names:
        if object_name not in bpy.data.objects:
            issues.append(f"{asset_id} references missing object {object_name}")

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
