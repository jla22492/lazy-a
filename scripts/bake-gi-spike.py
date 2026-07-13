# The baked-GI spike (WORK ORDER 0096) — Blender headless.
#
# Reconstructs the room's STATIC shell at the project's own dimensions
# (constants.ts is the source of truth; keep in sync by hand) and bakes
# DIFFUSE INDIRECT light only — the bounce the real-time renderer cannot
# transport — into lightmaps for exactly two receivers: the rear wall
# and the bench top. The sun stays live in the browser; only its bounced
# light is frozen here, so the daylight breath survives.
#
#   "/Applications/Blender.app/Contents/MacOS/Blender" -b -P scripts/bake-gi-spike.py -- <outdir>
import bpy
import sys
from mathutils import Vector

outdir = sys.argv[sys.argv.index("--") + 1]

scene = bpy.context.scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

scene.render.engine = "CYCLES"
scene.cycles.samples = 256
scene.cycles.use_denoising = True

WALL = (0.855, 0.816, 0.749)   # #eae5da plaster, linearized-ish
FLOOR = (0.286, 0.247, 0.204)  # warm concrete
WOOD = (0.32, 0.22, 0.13)      # bench stain


def material(name, color, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.9
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def box(name, size, location, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    obj.data.materials.append(mat)
    return obj


plaster = material("plaster", WALL)
concrete = material("concrete", FLOOR)
wood = material("wood", WOOD)
pane = material("pane", (1, 1, 1), emission=(1.0, 0.95, 0.88), strength=14.0)

# Blender Z-up vs three Y-up: (x, z, y) with three-z negated on Y axis.
# three (x, y, z) -> blender (x, -z, y).
box("floor", (12, 12, 0.05), (0, 0, -0.025), concrete)
box("ceiling", (12, 12, 0.05), (0, 0, 2.425), plaster)
box("leftwall", (0.1, 12, 2.4), (-3.25, 0, 1.2), plaster)
# Right wall with the window as a separate emissive pane (sill .9, head 2.0).
box("rightwall_low", (0.1, 12, 0.9), (2.25, 0, 0.45), plaster)
box("rightwall_high", (0.1, 12, 0.4), (2.25, 0, 2.2), plaster)
box("rightwall_rear", (0.1, 2.0, 2.4), (2.25, -0.5 + 1.0 - 1.55, 1.2), plaster)
box("window", (0.02, 1.1, 1.1), (2.24, 0.6, 1.45), pane)
# Bench: one mass at the origin, 0.9 high.
box("bench", (1.8, 0.75, 0.9), (0, 0, 0.45), wood)
# The chair (R-0089 staging), so its occlusion prints into the floor.
box("chair", (0.45, 0.42, 0.45), (0.95, -0.78, 0.225), wood)
box("chairback", (0.45, 0.03, 0.4), (0.95, -0.97, 0.65), wood)

# The rear wall (three z=-0.45 -> blender y=0.45), the bake receiver.
bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.5, 0.449, 1.2))
rear = bpy.context.active_object
rear.name = "rearwall"
rear.rotation_euler = (1.5707963, 0, 3.14159265)  # face -Y (into the room)
rear.scale = (5.4 / 1, 2.4 / 1, 1)
rear.data.materials.append(plaster)

# The bench-top receiver plane, just above the bench mass.
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.901))
bench_top = bpy.context.active_object
bench_top.name = "benchtop"
bench_top.scale = (1.8, 0.75, 1)
bench_top.data.materials.append(wood)

# The sun: LATE AFTERNOON (0100) — three position (5, 2.1, 3), low and warm.
bpy.ops.object.light_add(type="SUN", location=(6.5, -4.5, 1.15))
sun = bpy.context.active_object
direction = Vector((0, 0, 0)) - Vector((6.5, -4.5, 1.15))
sun.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
sun.data.energy = 5.5
sun.data.color = (1.0, 0.85, 0.64)
sun.data.angle = 0.05

# A faint world sky so the bounce never goes dead (the hemisphere's job).
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.18
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.906, 0.922, 0.933, 1)


def bake(obj, filename, size=512):
    image = bpy.data.images.new(f"bake_{obj.name}", size, size, float_buffer=False)
    mat = obj.data.materials[0].copy()
    obj.data.materials[0] = mat
    nodes = mat.node_tree.nodes
    node = nodes.new("ShaderNodeTexImage")
    node.image = image
    nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    scene.cycles.bake_type = "DIFFUSE"
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    bpy.ops.object.bake(type="DIFFUSE")
    image.filepath_raw = f"{outdir}/{filename}"
    image.file_format = "PNG"
    image.save()
    print(f"BAKED {filename}")


# The floor's visible patch (0097): x -3.2..2.2, three-z -0.45..4.5.
bpy.ops.mesh.primitive_plane_add(size=1, location=(-0.5, -2.025 + 0.45, 0.002))
floor_patch = bpy.context.active_object
floor_patch.name = "floorpatch"
floor_patch.scale = (5.4, 4.95, 1)
floor_patch.data.materials.append(concrete)

bake(rear, "gi-rearwall.png")
bake(bench_top, "gi-benchtop.png")
bake(floor_patch, "gi-floor.png")
print("FULL BAKE COMPLETE")
