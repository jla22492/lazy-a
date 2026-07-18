#!/usr/bin/env python3
"""Author and render the WO 0117-R perspective-plate contract.

Blender usage:
  Blender -b build/wo-0117-r/master.blend -P scripts/render-master-shots.py -- --validate
  Blender -b build/wo-0117-r/master.blend -P scripts/render-master-shots.py -- --proof --samples 8
  Blender -b build/wo-0117-r/master.blend -P scripts/render-master-shots.py -- --render-stills
  Blender -b build/wo-0117-r/master.blend -P scripts/render-master-shots.py -- --render-transitions

The script mutates the loaded scene in memory. It never saves over the shared
master blend. Metadata is generated from the same cameras and geometry used by
the renderer, and the TypeScript manifest is generated from that JSON.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import bpy
import bmesh
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Quaternion, Vector


REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_ROOT = REPO_ROOT / "public" / "room"
MANIFEST_PATH = PUBLIC_ROOT / "manifest.json"
TYPESCRIPT_PATH = REPO_ROOT / "three" / "scene" / "plateManifest.ts"
SOURCE_BLEND = "build/wo-0117-r/master.blend"

FPS = 30
CAMERA_CONTRACT = json.loads(
    (REPO_ROOT / "assets" / "master" / "camera-contract.json").read_text()
)
OPENING_BEAT_SECONDS = CAMERA_CONTRACT["arrival"]["openingSeconds"]
WALK_SECONDS = CAMERA_CONTRACT["arrival"]["walkSeconds"]
SETTLE_SECONDS = CAMERA_CONTRACT["arrival"]["settleSeconds"]
GAZE_LAG_SECONDS = CAMERA_CONTRACT["arrival"]["gazeLagSeconds"]
BOB_HZ = CAMERA_CONTRACT["arrival"]["bobHz"]
BOB_AMPLITUDE = CAMERA_CONTRACT["arrival"]["bobAmplitude"]
SWAY_AMPLITUDE = CAMERA_CONTRACT["arrival"]["swayAmplitude"]
OVERSHOOT = CAMERA_CONTRACT["arrival"]["overshoot"]
SETTLE_HZ = CAMERA_CONTRACT["arrival"]["settleHz"]
OPENING_SECONDS = OPENING_BEAT_SECONDS + WALK_SECONDS + SETTLE_SECONDS
DESTINATION_SECONDS = 0.9
CONTACT_ACTIVATION_SECONDS = 1.0
CONTACT_MOVE_SECONDS = 0.9
CONTACT_SECONDS = CONTACT_ACTIVATION_SECONDS + CONTACT_MOVE_SECONDS
ENDPOINT_IDS = ("opening", "desk", "films", "journal", "contact", "about")
DESTINATION_IDS = ("films", "journal", "contact", "about")
PROFILE_IDS = ("wide", "portrait")
LENS_FOV = {
    "wide": float(CAMERA_CONTRACT["desktop"]["fov"]),
    "portrait": float(CAMERA_CONTRACT["phone"]["fov"]),
}
RESOLUTION = {"wide": (2560, 1440), "portrait": (750, 1624)}
PROOF_RESOLUTION = {"wide": (1280, 720), "portrait": (375, 812)}
MOTION_RESOLUTION = {"wide": (1920, 1080), "portrait": (750, 1624)}

LOGO_OBJECT = "Mesh_31"
OBSOLETE_PINNED_LOGO = "Mesh_173"
CONTACT_PAPER = "Mesh_56"
HERO_OBJECT = "Mesh_170"
HERO_OCCLUDER_OBJECTS = (
    "Mesh_31",
    "Mesh_33",
    "ceramic_vase_02",
    "Mesh_38",
    "Mesh_39",
    "Mesh_40",
    "Mesh_41",
    "Mesh_42",
    "Mesh_43",
    "ProductionNavigationSheet",
    "Camera_01",
    "Camera_01_strap",
)
HERO_FIRST_FRAME_SOURCE = "assets/master/hero/hero-print-first-frame.png"
HERO_SURFACE = "HeroLiveSurface"
HERO_PROXY_PREFIX = "HeroOccluder_"
HERO_ROOT = PUBLIC_ROOT / "hero"
HERO_COMPOSITOR_PATH = HERO_ROOT / "hero-compositor.glb"
HERO_TREATED_SOURCE_PATH = REPO_ROOT / "build" / "wo-0117-r" / "hero-treated-first-frame.png"
HERO_TREATMENT_PATH = HERO_ROOT / "hero-room-treatment.png"
HERO_AUTHORING_MANIFEST_PATH = HERO_ROOT / "hero-presented-authoring-manifest.json"
HERO_PRESENTED_REFERENCES = "/room/hero/hero-presented-pixel-references.json"
HERO_AUTHORING_MANIFEST = "/room/hero/hero-presented-authoring-manifest.json"
HERO_PRESENTATION_EVENT = "lazy-a:compositor-frame-presented"
HERO_REFERENCE_KIND = "authored-presented-pixels-v1"
HERO_REGION_ENCODING = "rgb-poster-foreground-treatment"
LAMP_ROOT = "scan_lamp"
NAV_SHEET = "ProductionNavigationSheet"
NAV_PREFIX = "ProductionNavigationRow_"
NAV_GLYPH_PREFIX = "ProductionNavigationGlyph_"
JOURNAL_PREFIX = "JournalPlaceholderLine_"
JOURNAL_PENCIL = "Mesh_53"
CONTACT_CUTTER = "ContactIndentationCutter"
CONTACT_RECESS = "ContactIndentationRecess"
CONTACT_NODE_GROUP = "CONTACT_INDENTATION_GEOMETRY_NODES"
CONTACT_MODIFIER = "CONTACT_INDENTATION_GEOMETRY_NODES"
CONTACT_LIGHT = "ContactRakingLight"
CONTACT_BULB = "ContactPracticalBulb"
CONTACT_SHADE = "ContactPracticalShadeInterior"
CONTACT_LIGHT_ENERGY = 240.0
CONTACT_ROOT = PUBLIC_ROOT / "contact"
CONTACT_AUTHORING_MANIFEST_PATH = (
    CONTACT_ROOT / "practical-light-authoring-manifest.json"
)
CONTACT_AUTHORING_MANIFEST = "/room/contact/practical-light-authoring-manifest.json"
CONTACT_MASK_VIEWPORTS = {
    "wide": (1280, 720),
    "portrait": (375, 812),
}
WIDE_PRACTICAL_RELATIONSHIP = "visible-practical-source-v1"
PORTRAIT_PRACTICAL_RELATIONSHIP = "offscreen-practical-light-pool-v1"
PORTRAIT_POOL_DERIVATION = "blender-shade-cone-receiver-render-v1"

NAV_WIDTH = 0.30
NAV_HEIGHT = 0.20
NAV_THICKNESS = 0.0007
NAV_INCLINE = math.radians(7.0)
NAV_INCLINE_PORTRAIT = math.radians(34.0)
NAV_YAW = math.radians(-5.0)
NAV_CENTER_X = -0.115
NAV_CENTER_X_PORTRAIT = 0.58
NAV_CENTER_Y = -0.265
NAV_CENTER_Y_PORTRAIT = 0.15
DESK_HEIGHT = 0.9
JOURNAL_DESK_FOOTPRINT = (-0.8, 0.8, -0.8, 0.8)
HANDWRITING_FONT_PATH = Path("/System/Library/Fonts/Noteworthy.ttc")
CONTACT_FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf")
NAV_LABEL_WIDTHS = (0.113, 0.145, 0.155, 0.110)
CONTACT_PAPER_POSITION = (-0.35, -0.04)
CONTACT_PAPER_YAW = math.radians(4.5)
# Mesh_56 retains its authored stock. A shallow 0.30 mm blind deboss remains
# physically applied; a Cycles bevel normal lets raking light resolve its edge.
CONTACT_INDENT_DEPTH = 0.00030
CONTACT_FIBER_RESPONSE_PEAK = 1.00
CONTACT_FIBER_FLOOR_RESPONSE_PEAK = 0.15
CONTACT_FIBER_COLOR = (0.02, 0.01, 0.005, 1.0)
CONTACT_IDLE_FILL_STRENGTH = 0.15
CONTACT_INDENT_VERTEX_INDICES: tuple[int, ...] = ()
CONTACT_INDENT_TOP_Z = 0.0
NAV_ROWS = (
    {"id": "films", "label": "FILMS", "rect": {"x": 0.015, "y": 0.018, "width": 0.27, "height": 0.026}},
    {"id": "journal", "label": "JOURNAL", "rect": {"x": 0.015, "y": 0.062, "width": 0.27, "height": 0.026}},
    {"id": "contact", "label": "CONTACT", "rect": {"x": 0.015, "y": 0.106, "width": 0.27, "height": 0.026}},
    {"id": "about", "label": "ABOUT", "rect": {"x": 0.015, "y": 0.150, "width": 0.27, "height": 0.026}},
)
CONTACT_COPY = (
    "Jonathan Adelson",
    "JonathanAdelson1@gmail.com",
    "1-310-709-9283",
)
CONTACT_COPY_TEXT = "\n".join(CONTACT_COPY)


def three_to_blender(value: tuple[float, float, float]) -> Vector:
    return Vector((value[0], -value[2], value[1]))


def blender_to_three(value: Vector) -> list[float]:
    return rounded_vector((value.x, value.z, -value.y))


def rounded(value: float) -> float:
    result = round(float(value), 12)
    return 0.0 if result == -0.0 else result


def rounded_vector(values) -> list[float]:
    return [rounded(value) for value in values]


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def smootherstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * value * (value * (value * 6.0 - 15.0) + 10.0)


def quadratic_bezier(start: Vector, control: Vector, end: Vector, value: float) -> Vector:
    inverse = 1.0 - value
    return inverse * inverse * start + 2.0 * inverse * value * control + value * value * end


def upright_track_quaternion(position: Vector, target: Vector) -> Quaternion:
    direction = target - position
    if direction.length <= 1e-8:
        raise RuntimeError("Camera point of regard must differ from its position")
    return direction.to_track_quat("-Z", "Y")


def ease_in_out_cubic(value: float) -> float:
    value = max(0.0, min(1.0, value))
    if value < 0.5:
        return 4.0 * value ** 3
    return 1.0 - (-2.0 * value + 2.0) ** 3 / 2.0


def cubic_out(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return 1.0 - (1.0 - value) ** 3


def require_object(name: str, object_type: str | None = None) -> bpy.types.Object:
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise RuntimeError(f'Required master object "{name}" is missing')
    if object_type is not None and obj.type != object_type:
        raise RuntimeError(f'Required master object "{name}" must be {object_type}, got {obj.type}')
    return obj


def remove_object(obj: bpy.types.Object) -> None:
    data = obj.data
    bpy.data.objects.remove(obj, do_unlink=True)
    if data and getattr(data, "users", 1) == 0:
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
        elif isinstance(data, bpy.types.Curve):
            bpy.data.curves.remove(data)


def remove_authored_objects() -> None:
    exact_names = {
        CONTACT_CUTTER,
        CONTACT_RECESS,
        CONTACT_LIGHT,
        CONTACT_BULB,
        CONTACT_SHADE,
        "AuthoredPlateCamera",
        HERO_SURFACE,
    }
    for obj in list(bpy.data.objects):
        if (
            obj.name in exact_names
            or obj.name.startswith(NAV_PREFIX)
            or obj.name.startswith(NAV_GLYPH_PREFIX)
            or obj.name.startswith(JOURNAL_PREFIX)
            or obj.name.startswith("LogoProof")
            or obj.name.startswith(HERO_PROXY_PREFIX)
        ):
            remove_object(obj)
    for group in list(bpy.data.node_groups):
        if group.name.startswith(CONTACT_NODE_GROUP):
            bpy.data.node_groups.remove(group)


def make_principled_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    emission: tuple[float, float, float, float] | None = None,
) -> bpy.types.Material:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = 0.0
    return material


def apply_logo_to_existing_card() -> bpy.types.Object:
    card = require_object(LOGO_OBJECT, "MESH")
    original_matrix = card.matrix_world.copy()
    bpy.context.view_layer.update()
    logo_path = REPO_ROOT / "assets" / "master" / "brand" / "lazy-a-logo-letterpress.png"
    if not logo_path.is_file():
        raise RuntimeError(f"Lazy A logo texture is missing: {logo_path}")

    uv_layer = ensure_upright_card_uv(card)
    material = bpy.data.materials.get("LazyAExistingCardLogo") or bpy.data.materials.new(
        "LazyAExistingCardLogo"
    )
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    image_node = nodes.new("ShaderNodeTexImage")
    uv_node = nodes.new("ShaderNodeUVMap")
    uv_node.uv_map = uv_layer.name
    image = bpy.data.images.load(str(logo_path), check_existing=True)
    image.colorspace_settings.name = "sRGB"
    image_node.image = image
    bsdf.inputs["Roughness"].default_value = 0.86
    links.new(uv_node.outputs["UV"], image_node.inputs["Vector"])
    links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(image_node.outputs["Alpha"], bsdf.inputs["Alpha"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    card.data.materials.clear()
    card.data.materials.append(material)
    card["lazy_a_authored_role"] = "existing-logo-card"
    card["lazy_a_logo_geometry_created"] = False
    card["lazy_a_logo_orientation"] = "upright-local-xz"
    card["lazy_a_logo_uv_binding"] = "explicit-uv-map"
    card["lazy_a_logo_source"] = "assets/master/brand/lazy-a-logo-letterpress.png"
    card["lazy_a_logo_source_resolution"] = json.dumps(list(image.size))
    card["lazy_a_logo_transform_preserved"] = card.matrix_world == original_matrix
    old_logo = bpy.data.objects.get(OBSOLETE_PINNED_LOGO)
    if old_logo is not None and old_logo.type == "MESH":
        blank_paper = make_principled_material(
            "RetiredPinnedLogoPaper", (0.71, 0.66, 0.55, 1.0), 0.94
        )
        old_logo.data.materials.clear()
        old_logo.data.materials.append(blank_paper)
        old_logo["lazy_a_authored_role"] = "retired-pinned-logo-paper"
    return card


def apply_hero_first_frame() -> bpy.types.Object:
    poster = require_object(HERO_OBJECT, "MESH")
    source_path = REPO_ROOT / HERO_FIRST_FRAME_SOURCE
    if not source_path.is_file():
        raise RuntimeError(f"Hero first-frame texture is missing: {source_path}")

    uv_layer = ensure_upright_card_uv(poster)
    material = bpy.data.materials.get("LazyAHeroPhysicalPoster") or bpy.data.materials.new(
        "LazyAHeroPhysicalPoster"
    )
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    image_node = nodes.new("ShaderNodeTexImage")
    image_node.interpolation = "Cubic"
    uv_node = nodes.new("ShaderNodeUVMap")
    uv_node.uv_map = uv_layer.name
    image = bpy.data.images.load(str(source_path), check_existing=True)
    image.colorspace_settings.name = "sRGB"
    image_node.image = image
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Specular IOR Level"].default_value = 0.22
    links.new(uv_node.outputs["UV"], image_node.inputs["Vector"])
    links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    poster.data.materials.clear()
    poster.data.materials.append(material)
    poster["lazy_a_hero_first_frame_source"] = HERO_FIRST_FRAME_SOURCE
    poster["lazy_a_hero_resting_mechanism"] = "baked-physical-poster"
    poster["lazy_a_hero_uv_binding"] = "explicit-uv-map"
    return poster


def ensure_upright_card_uv(card: bpy.types.Object) -> bpy.types.MeshUVLoopLayer:
    mesh = card.data
    x_values = [vertex.co.x for vertex in mesh.vertices]
    z_values = [vertex.co.z for vertex in mesh.vertices]
    x_min, x_max = min(x_values), max(x_values)
    z_min, z_max = min(z_values), max(z_values)
    x_span = max(x_max - x_min, 1e-8)
    z_span = max(z_max - z_min, 1e-8)
    uv_layer = mesh.uv_layers.get("LazyALogoUpright") or mesh.uv_layers.new(
        name="LazyALogoUpright"
    )
    mesh.uv_layers.active = uv_layer
    for loop in mesh.loops:
        coordinate = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = (
            (coordinate.x - x_min) / x_span,
            (coordinate.z - z_min) / z_span,
        )
    return uv_layer


def handwriting_font() -> bpy.types.VectorFont:
    if not HANDWRITING_FONT_PATH.is_file():
        raise RuntimeError(f"Noteworthy font is missing: {HANDWRITING_FONT_PATH}")
    existing = bpy.data.fonts.get(HANDWRITING_FONT_PATH.name)
    return existing or bpy.data.fonts.load(str(HANDWRITING_FONT_PATH))


def contact_font() -> bpy.types.VectorFont:
    if not CONTACT_FONT_PATH.is_file():
        raise RuntimeError(f"CONTACT font is missing: {CONTACT_FONT_PATH}")
    existing = bpy.data.fonts.get(CONTACT_FONT_PATH.name)
    return existing or bpy.data.fonts.load(str(CONTACT_FONT_PATH))


def create_text_mesh(
    name: str,
    body: str,
    size: float,
    extrude: float,
    material: bpy.types.Material | None = None,
    align_x: str = "CENTER",
    font: bpy.types.VectorFont | None = None,
    bevel: bool = True,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}Curve", "FONT")
    curve.body = body
    curve.align_x = align_x
    curve.align_y = "CENTER"
    if font is not None:
        curve.font = font
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = min(extrude * 0.25, 0.00003) if bevel else 0.0
    curve.bevel_resolution = 1 if bevel else 0
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    if material is not None:
        obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def normalize_mesh_left_edge(obj: bpy.types.Object) -> None:
    min_x = min(vertex.co.x for vertex in obj.data.vertices)
    for vertex in obj.data.vertices:
        vertex.co.x -= min_x
    obj.data.update()


def normalized_surface_matrix(
    surface: bpy.types.Object,
    local_x: float,
    local_y: float,
    local_z: float,
    rotation_z: float = 0.0,
) -> Matrix:
    rotation = surface.matrix_world.to_quaternion().to_matrix().to_4x4()
    location = surface.matrix_world.translation
    return (
        Matrix.Translation(location)
        @ rotation
        @ Matrix.Translation((local_x, local_y, local_z))
        @ Matrix.Rotation(rotation_z, 4, "Z")
    )


def create_production_sheet() -> tuple[bpy.types.Object, dict[str, list[bpy.types.Object]]]:
    paper = make_principled_material("ProductionSheetPaper", (0.78, 0.735, 0.64, 1.0), 0.94)
    graphite_materials = (
        make_principled_material("ProductionSheetGraphiteSoft", (0.245, 0.23, 0.21, 1.0), 0.99),
        make_principled_material("ProductionSheetGraphiteMid", (0.205, 0.19, 0.175, 1.0), 0.99),
        make_principled_material("ProductionSheetGraphiteFirm", (0.17, 0.158, 0.145, 1.0), 0.99),
    )
    font = handwriting_font()

    near_edge_drop = math.sin(NAV_INCLINE) * NAV_HEIGHT / 2.0
    sheet = require_object(NAV_SHEET, "MESH")
    sheet.location = (
        NAV_CENTER_X,
        NAV_CENTER_Y,
        DESK_HEIGHT + near_edge_drop + NAV_THICKNESS / 2.0,
    )
    sheet.rotation_euler = (NAV_INCLINE, 0.0, NAV_YAW)
    sheet.data.materials.clear()
    sheet.data.materials.append(paper)
    sheet["lazy_a_authored_role"] = "physical-navigation-sheet"
    sheet["lazy_a_row_order"] = json.dumps([row["id"] for row in NAV_ROWS])

    labels: dict[str, list[bpy.types.Object]] = {}
    row_offsets = (-0.0015, 0.001, -0.0005, 0.0015)
    line_baselines = (-0.00055, 0.0003, -0.00015, 0.00045)
    line_rotations = (-0.012, 0.006, -0.004, 0.009)
    for index, row in enumerate(NAV_ROWS):
        rect = row["rect"]
        row_y = NAV_HEIGHT / 2.0 - rect["y"] - rect["height"] / 2.0
        row_marker = bpy.data.objects.new(
            f"{NAV_PREFIX}{index + 1}_{row['label']}", None
        )
        bpy.context.collection.objects.link(row_marker)
        row_marker.parent = sheet
        row_marker.location = (0.0, row_y, NAV_THICKNESS / 2.0)
        row_marker["lazy_a_destination"] = row["id"]
        row_marker["lazy_a_marking"] = "graphite"

        row_start = -NAV_WIDTH / 2.0 + rect["x"] + 0.029 + row_offsets[index]
        word = create_text_mesh(
            f"{NAV_GLYPH_PREFIX}{index + 1}_{row['label']}",
            row["label"],
            size=0.021,
            extrude=0.000012 + index * 0.000002,
            material=graphite_materials[index % len(graphite_materials)],
            align_x="LEFT",
            font=font,
        )
        normalize_mesh_left_edge(word)
        if word.dimensions.x > 0:
            factor = NAV_LABEL_WIDTHS[index] / word.dimensions.x
            word.scale.x *= factor
            word.scale.y *= factor
        word.parent = sheet
        word.location = (
            row_start,
            row_y + line_baselines[index],
            NAV_THICKNESS / 2.0 + 0.000018,
        )
        word.rotation_euler = (0.0, 0.0, line_rotations[index])
        word["lazy_a_destination"] = row["id"]
        word["lazy_a_marking"] = "graphite-pressure-varied"
        word["lazy_a_font_family"] = "Noteworthy"
        labels[row["id"]] = [word]
    return sheet, labels


def position_contact_sheet(sheet: bpy.types.Object) -> None:
    original = rounded_vector(sheet.matrix_world.translation)
    sheet.location.x = CONTACT_PAPER_POSITION[0]
    sheet.location.y = CONTACT_PAPER_POSITION[1]
    sheet.rotation_euler.z = CONTACT_PAPER_YAW
    bpy.context.view_layer.update()
    sheet["lazy_a_contact_original_position"] = json.dumps(original)
    sheet["lazy_a_contact_positioned_once"] = True


def create_contact_cutter(sheet: bpy.types.Object) -> bpy.types.Object:
    parts: list[bpy.types.Object] = []
    # The block sits forward of the picture-frame shadow while retaining the
    # irregular spacing of pressure-set type on a working sheet.
    lines = (
        (CONTACT_COPY[0], 0.155, 0.000),
        (CONTACT_COPY[1], 0.185, -0.045),
        (CONTACT_COPY[2], 0.145, -0.090),
    )
    font = contact_font()
    for index, (body, target_width, local_y) in enumerate(lines):
        part = create_text_mesh(
            f"{CONTACT_CUTTER}_{index + 1}",
            body,
            0.030,
            0.00035,
            font=font,
            bevel=True,
        )
        if part.dimensions.x > 0:
            factor = target_width / part.dimensions.x
            part.scale.x *= factor
            # Bake the fitted glyph width before the parts are joined. Leaving
            # this scale live made the joined cutter render much narrower than
            # its authored bounds.
            part.select_set(True)
            bpy.context.view_layer.objects.active = part
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            part.select_set(False)
        # Keep a hidden source mesh for bounds and metadata. The visible copy
        # is sunk into the paper below so only its beveled face reads.
        part.matrix_world = normalized_surface_matrix(
            sheet, 0.0, local_y, 0.00008
        ) @ part.matrix_world
        parts.append(part)

    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    cutter = bpy.context.active_object
    cutter.name = CONTACT_CUTTER
    cutter.display_type = "WIRE"
    cutter.hide_render = True
    cutter["lazy_a_authored_role"] = "contact-indentation-cutter"
    mesh = cutter.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    top_face = max(
        (polygon for polygon in sheet.data.polygons if polygon.normal.z > 0.7),
        key=lambda polygon: polygon.area,
        default=None,
    )
    if top_face is None:
        raise RuntimeError("CONTACT paper has no upward-facing host surface")
    sheet["lazy_a_contact_host_material_index"] = top_face.material_index
    host_material = sheet.data.materials[top_face.material_index]
    if host_material is None or not host_material.use_nodes:
        raise RuntimeError("CONTACT paper host material must use nodes")
    groove_material = host_material.copy()
    groove_material.name = "ContactPressureGroove"
    groove_bsdf = groove_material.node_tree.nodes.get("Principled BSDF")
    if groove_bsdf is None:
        raise RuntimeError("CONTACT paper host material has no Principled BSDF")
    base_color = groove_bsdf.inputs["Base Color"]
    base_link = next(
        (link for link in groove_material.node_tree.links if link.to_socket == base_color),
        None,
    )
    fiber_response = groove_material.node_tree.nodes.new("ShaderNodeMixRGB")
    fiber_response.name = "ContactLampFiberResponse"
    fiber_response.label = "Lamp-reactive compressed paper fibers"
    fiber_response.blend_type = "MULTIPLY"
    fiber_response.inputs[2].default_value = CONTACT_FIBER_COLOR
    host_color_socket = None
    if base_link is not None:
        host_color_socket = base_link.from_socket
        groove_material.node_tree.links.remove(base_link)
        groove_material.node_tree.links.new(host_color_socket, fiber_response.inputs[1])
    else:
        fiber_response.inputs[1].default_value = base_color.default_value
    geometry = groove_material.node_tree.nodes.new("ShaderNodeNewGeometry")
    geometry.name = "ContactGrooveGeometry"
    separate_normal = groove_material.node_tree.nodes.new("ShaderNodeSeparateXYZ")
    separate_normal.name = "ContactGrooveNormalComponents"
    abs_normal_z = groove_material.node_tree.nodes.new("ShaderNodeMath")
    abs_normal_z.name = "ContactGrooveAbsNormalZ"
    abs_normal_z.operation = "ABSOLUTE"
    normal_scale = groove_material.node_tree.nodes.new("ShaderNodeMath")
    normal_scale.name = "ContactGrooveWallWeight"
    normal_scale.operation = "MULTIPLY_ADD"
    normal_scale.inputs[1].default_value = -(
        CONTACT_FIBER_RESPONSE_PEAK - CONTACT_FIBER_FLOOR_RESPONSE_PEAK
    )
    normal_scale.inputs[2].default_value = CONTACT_FIBER_RESPONSE_PEAK
    lamp_level = groove_material.node_tree.nodes.new("ShaderNodeValue")
    lamp_level.name = "ContactLampLevel"
    lamp_level.outputs["Value"].default_value = 0.0
    idle_fill = groove_material.node_tree.nodes.new("ShaderNodeMath")
    idle_fill.name = "ContactIdleGrooveFill"
    idle_fill.label = "Ambient paper match; disabled by lamp reveal"
    idle_fill.operation = "MULTIPLY_ADD"
    idle_fill.inputs[1].default_value = -CONTACT_IDLE_FILL_STRENGTH
    idle_fill.inputs[2].default_value = CONTACT_IDLE_FILL_STRENGTH
    groove_material.node_tree.links.new(lamp_level.outputs["Value"], idle_fill.inputs[0])
    emission_color = groove_bsdf.inputs.get("Emission Color")
    emission_strength = groove_bsdf.inputs.get("Emission Strength")
    if emission_color is not None and emission_strength is not None:
        if host_color_socket is not None:
            groove_material.node_tree.links.new(host_color_socket, emission_color)
        else:
            emission_color.default_value = base_color.default_value
        groove_material.node_tree.links.new(idle_fill.outputs[0], emission_strength)
    response_factor = groove_material.node_tree.nodes.new("ShaderNodeMath")
    response_factor.name = "ContactNormalWeightedFiberResponse"
    response_factor.operation = "MULTIPLY"
    groove_material.node_tree.links.new(geometry.outputs["Normal"], separate_normal.inputs[0])
    groove_material.node_tree.links.new(separate_normal.outputs["Z"], abs_normal_z.inputs[0])
    groove_material.node_tree.links.new(abs_normal_z.outputs[0], normal_scale.inputs[0])
    groove_material.node_tree.links.new(normal_scale.outputs[0], response_factor.inputs[0])
    groove_material.node_tree.links.new(lamp_level.outputs["Value"], response_factor.inputs[1])
    groove_material.node_tree.links.new(response_factor.outputs[0], fiber_response.inputs["Fac"])
    groove_occlusion = groove_material.node_tree.nodes.new("ShaderNodeAmbientOcclusion")
    groove_occlusion.name = "ContactPhysicalGrooveOcclusion"
    groove_occlusion.samples = 16
    groove_occlusion.inputs["Distance"].default_value = 0.003
    occlusion_response = groove_material.node_tree.nodes.new("ShaderNodeMixRGB")
    occlusion_response.name = "ContactLampGrooveOcclusionResponse"
    occlusion_response.blend_type = "MULTIPLY"
    groove_material.node_tree.links.new(
        fiber_response.outputs["Color"], occlusion_response.inputs[1]
    )
    groove_material.node_tree.links.new(
        groove_occlusion.outputs["Color"], occlusion_response.inputs[2]
    )
    groove_material.node_tree.links.new(
        lamp_level.outputs["Value"], occlusion_response.inputs["Fac"]
    )
    groove_material.node_tree.links.new(occlusion_response.outputs["Color"], base_color)
    # Preserve the host paper network at rest. The lamp response above is
    # confined to the Boolean groove material; it never creates text geometry.
    normal_input = groove_bsdf.inputs["Normal"]
    normal_link = next(
        (link for link in groove_material.node_tree.links if link.to_socket == normal_input),
        None,
    )
    bevel_normal = groove_material.node_tree.nodes.new("ShaderNodeBevel")
    bevel_normal.name = "ContactPressureEdgeBevel"
    bevel_normal.samples = 8
    bevel_normal.inputs["Radius"].default_value = 0.00080
    host_normal_socket = geometry.outputs["Normal"]
    if normal_link is not None:
        host_normal_socket = normal_link.from_socket
        groove_material.node_tree.links.remove(normal_link)
        groove_material.node_tree.links.new(
            host_normal_socket, bevel_normal.inputs["Normal"]
        )
    normal_reveal = groove_material.node_tree.nodes.new("ShaderNodeMixRGB")
    normal_reveal.name = "ContactLampNormalReveal"
    normal_reveal.label = "Host paper at rest; pressure edge under lamp"
    groove_material.node_tree.links.new(
        lamp_level.outputs["Value"], normal_reveal.inputs["Fac"]
    )
    groove_material.node_tree.links.new(host_normal_socket, normal_reveal.inputs[1])
    groove_material.node_tree.links.new(
        bevel_normal.outputs["Normal"], normal_reveal.inputs[2]
    )
    groove_material.node_tree.links.new(normal_reveal.outputs["Color"], normal_input)
    groove_material["lazy_a_contact_color_parity"] = True
    groove_material["lazy_a_contact_normal_response_animated"] = True
    groove_material["lazy_a_contact_fiber_response_peak"] = CONTACT_FIBER_RESPONSE_PEAK
    groove_material["lazy_a_contact_fiber_floor_response_peak"] = (
        CONTACT_FIBER_FLOOR_RESPONSE_PEAK
    )
    groove_material["lazy_a_contact_idle_fill_strength"] = CONTACT_IDLE_FILL_STRENGTH
    groove_index = next(
        (
            index
            for index, material in enumerate(sheet.data.materials)
            if material == groove_material
        ),
        len(sheet.data.materials),
    )
    if groove_index == len(sheet.data.materials):
        sheet.data.materials.append(groove_material)
    cutter.data.materials.clear()
    for material in sheet.data.materials:
        cutter.data.materials.append(material)
    for polygon in cutter.data.polygons:
        polygon.material_index = groove_index
    # Place the cutter by measured overlap, not an assumed font origin. It stops
    # above the bottom of the stock, leaving a continuous paper floor.
    sheet_top = max(Vector(corner).z for corner in sheet.bound_box)
    sheet_inverse = sheet.matrix_world.inverted()
    cutter_bottom = min(
        (sheet_inverse @ (cutter.matrix_world @ vertex.co)).z
        for vertex in cutter.data.vertices
    )
    local_shift = sheet_top - CONTACT_INDENT_DEPTH - cutter_bottom
    cutter.location += sheet.matrix_world.to_quaternion() @ Vector((0.0, 0.0, local_shift))
    cutter["lazy_a_contact_indent_depth"] = CONTACT_INDENT_DEPTH
    bpy.context.view_layer.update()
    return cutter


def author_contact_indentation() -> bpy.types.Object:
    global CONTACT_INDENT_TOP_Z, CONTACT_INDENT_VERTEX_INDICES
    sheet = require_object(CONTACT_PAPER, "MESH")
    position_contact_sheet(sheet)
    for modifier in list(sheet.modifiers):
        if modifier.name.startswith(CONTACT_MODIFIER):
            sheet.modifiers.remove(modifier)
    base_stats = {
        "baseVertices": len(sheet.data.vertices),
        "basePolygons": len(sheet.data.polygons),
    }
    cutter = create_contact_cutter(sheet)
    modifier = sheet.modifiers.new(CONTACT_MODIFIER, "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.material_mode = "TRANSFER"
    modifier.object = cutter
    bpy.context.view_layer.objects.active = sheet
    sheet.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    sheet.select_set(False)
    # Exact Boolean transfer can leave the newly cut floor/wall loops with
    # inconsistent winding. Recalculate the finished paper mesh so the latent
    # grooves shade as paper instead of flashing as bright glyph-shaped faces.
    mesh = sheet.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    groove_index = next(
        (
            index
            for index, material in enumerate(sheet.data.materials)
            if material and material.name == "ContactPressureGroove"
        ),
        -1,
    )
    groove_polygons = [
        polygon for polygon in sheet.data.polygons if polygon.material_index == groove_index
    ]
    if not groove_polygons:
        raise RuntimeError("CONTACT Boolean produced no groove-material faces")
    groove_z = [
        sheet.data.vertices[vertex_index].co.z
        for polygon in groove_polygons
        for vertex_index in polygon.vertices
    ]
    CONTACT_INDENT_TOP_Z = max(vertex.co.z for vertex in sheet.data.vertices)
    CONTACT_INDENT_VERTEX_INDICES = tuple(
        sorted(
            {
                vertex_index
                for polygon in groove_polygons
                for vertex_index in polygon.vertices
                if sheet.data.vertices[vertex_index].co.z
                < CONTACT_INDENT_TOP_Z - CONTACT_INDENT_DEPTH * 0.5
            }
        )
    )
    if not CONTACT_INDENT_VERTEX_INDICES:
        raise RuntimeError("CONTACT Boolean produced no recessed floor vertices")
    print(
        "CONTACT GROOVE GEOMETRY:",
        f"faces={len(groove_polygons)}",
        f"floorVertices={len(CONTACT_INDENT_VERTEX_INDICES)}",
        f"z={min(groove_z):.8f}..{max(groove_z):.8f}",
        f"normals={sorted({tuple(round(value, 3) for value in polygon.normal) for polygon in groove_polygons})[:8]}",
    )
    sheet["lazy_a_contact_geometry_stats"] = json.dumps(
        {
            **base_stats,
            "indentedVertices": len(sheet.data.vertices),
            "indentedPolygons": len(sheet.data.polygons),
        }
    )
    sheet["lazy_a_contact_mechanism"] = "applied-exact-pressure-indentation"
    sheet["lazy_a_contact_copy"] = CONTACT_COPY_TEXT
    return sheet


def contact_indentation_stats(sheet: bpy.types.Object) -> dict[str, int]:
    return json.loads(sheet["lazy_a_contact_geometry_stats"])


def parent_keep_world(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    bpy.context.view_layer.update()
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world
    bpy.context.view_layer.update()


def lamp_vector_property(lamp: bpy.types.Object, key: str) -> Vector:
    raw = lamp.get(key)
    try:
        values = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as error:
        raise RuntimeError(f"{LAMP_ROOT}.{key} is not valid vector metadata") from error
    if not isinstance(values, list) or len(values) != 3:
        raise RuntimeError(f"{LAMP_ROOT}.{key} must contain three coordinates")
    return Vector(values)


def contact_axis_intersection(
    contact_sheet: bpy.types.Object,
    origin: Vector,
    direction: Vector,
) -> Vector:
    inverse = contact_sheet.matrix_world.inverted()
    local_origin = inverse @ origin
    local_direction = inverse.to_3x3() @ direction
    local_direction.normalize()
    paper_top = max(Vector(corner).z for corner in contact_sheet.bound_box)
    if abs(local_direction.z) <= 1e-8:
        raise RuntimeError("CONTACT shade axis is parallel to the contact paper")
    distance = (paper_top - local_origin.z) / local_direction.z
    if distance <= 0.0:
        raise RuntimeError("CONTACT shade axis points away from the contact paper")
    return contact_sheet.matrix_world @ (local_origin + local_direction * distance)


def derived_practical_pose(
    contact_sheet: bpy.types.Object,
    opening_center: Vector,
    opening_radius: float,
    shade_axis: Vector,
) -> tuple[Vector, Vector, Vector]:
    local_bounds = [Vector(corner) for corner in contact_sheet.bound_box]
    min_x = min(point.x for point in local_bounds)
    max_x = max(point.x for point in local_bounds)
    min_y = min(point.y for point in local_bounds)
    max_y = max(point.y for point in local_bounds)
    top = max(point.z for point in local_bounds)
    best = None
    minimum_grazing = math.inf
    radial_u = shade_axis.cross(Vector((0.0, 0.0, 1.0))).normalized()
    radial_v = shade_axis.cross(radial_u).normalized()
    for radial_fraction in (0.0, 0.15, 0.30, 0.45):
        angles = (0.0,) if radial_fraction == 0.0 else tuple(
            index * math.tau / 24.0 for index in range(24)
        )
        for angle in angles:
            origin = (
                opening_center
                - shade_axis * (opening_radius * 0.18)
                + radial_u * math.cos(angle) * opening_radius * radial_fraction
                + radial_v * math.sin(angle) * opening_radius * radial_fraction
            )
            for x_step in range(41):
                local_x = min_x + (max_x - min_x) * x_step / 40.0
                for y_step in range(61):
                    local_y = min_y + (max_y - min_y) * y_step / 60.0
                    target = contact_sheet.matrix_world @ Vector(
                        (local_x, local_y, top)
                    )
                    direction = (target - origin).normalized()
                    local_direction = (
                        contact_sheet.matrix_world.inverted().to_3x3()
                        @ direction
                    )
                    local_direction.normalize()
                    grazing = math.degrees(
                        math.asin(min(1.0, abs(local_direction.z)))
                    )
                    minimum_grazing = min(minimum_grazing, grazing)
                    if grazing > 35.0:
                        continue
                    axis_error = math.degrees(shade_axis.angle(direction))
                    score = axis_error + radial_fraction * 0.5
                    if best is None or score < best[0]:
                        best = (score, axis_error, origin, direction, target)
    if best is None:
        raise RuntimeError(
            "No shade-derived CONTACT ray intersects paper at <=35 degrees "
            f"(minimum {minimum_grazing:.3f})"
        )
    if best[1] > 12.0:
        raise RuntimeError(
            f"Shade-derived CONTACT ray departs the fixture axis by {best[1]:.3f} degrees"
        )
    return best[2], best[3], best[4]


def add_lamp_bulb_and_raking_light(
    contact_sheet: bpy.types.Object,
) -> tuple[bpy.types.Object, bpy.types.Object, bpy.types.Object]:
    lamp = require_object(LAMP_ROOT)
    shade_axis = lamp_vector_property(lamp, "lazy_a_contact_shade_axis").normalized()
    opening_center = lamp_vector_property(
        lamp, "lazy_a_contact_shade_opening_center"
    )
    opening_radius = float(lamp["lazy_a_contact_shade_opening_radius"])
    bulb_material = make_principled_material(
        "ContactBulbGlass",
        (0.72, 0.52, 0.27, 1.0),
        0.22,
        emission=(1.0, 0.47, 0.16, 1.0),
    )

    shade_material = make_principled_material(
        "ContactShadeInteriorEmission",
        (0.31, 0.21, 0.12, 1.0),
        0.62,
        emission=(1.0, 0.43, 0.16, 1.0),
    )

    bulb_location, raking_direction, target = derived_practical_pose(
        contact_sheet, opening_center, opening_radius, shade_axis
    )
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=32,
        ring_count=16,
        radius=opening_radius * 0.22,
        location=bulb_location,
    )
    bulb = bpy.context.active_object
    bulb.name = CONTACT_BULB
    bulb.scale = (1.0, 0.84, 1.08)
    bulb.data.materials.append(bulb_material)
    bulb.hide_render = False
    bulb.visible_shadow = False
    bulb["lazy_a_authored_role"] = "lamp-emissive-bulb"
    bulb["lazy_a_legacy_source_name"] = "ContactEmissiveBulb"
    parent_keep_world(bulb, lamp)

    shade_location = opening_center - shade_axis * 0.004
    shade_mesh = bpy.data.meshes.new(f"{CONTACT_SHADE}Mesh")
    shade_vertices = []
    shade_faces = []
    shade_segments = 64
    inner_radius = opening_radius * 0.42
    outer_radius = opening_radius * 0.88
    for index in range(shade_segments):
        angle = math.tau * index / shade_segments
        cosine = math.cos(angle)
        sine = math.sin(angle)
        shade_vertices.extend(
            (
                (inner_radius * cosine, inner_radius * sine, 0.0),
                (outer_radius * cosine, outer_radius * sine, 0.0),
            )
        )
    for index in range(shade_segments):
        next_index = (index + 1) % shade_segments
        shade_faces.append(
            (index * 2, next_index * 2, next_index * 2 + 1, index * 2 + 1)
        )
    shade_mesh.from_pydata(shade_vertices, [], shade_faces)
    shade_mesh.update()
    shade = bpy.data.objects.new(CONTACT_SHADE, shade_mesh)
    bpy.context.collection.objects.link(shade)
    shade.location = shade_location
    shade.rotation_mode = "QUATERNION"
    shade.rotation_quaternion = shade_axis.to_track_quat("Z", "Y")
    shade.data.materials.append(shade_material)
    shade.hide_render = False
    shade["lazy_a_authored_role"] = "lamp-visible-shade-interior"
    parent_keep_world(shade, lamp)

    light_data = bpy.data.lights.new(CONTACT_LIGHT, "SPOT")
    light_data.energy = 0.0
    light_data.color = (1.0, 0.58, 0.30)
    light_data.spot_size = math.radians(48.0)
    light_data.spot_blend = 0.85
    light_data.shadow_soft_size = 0.04
    light = bpy.data.objects.new(CONTACT_LIGHT, light_data)
    bpy.context.collection.objects.link(light)
    # Keep the photometric source at the bulb inside the visible shade. The
    # shade, not an off-fixture helper light, is now the physical source.
    light.location = bulb_location.copy()
    light.rotation_mode = "QUATERNION"
    light.rotation_quaternion = raking_direction.to_track_quat("-Z", "Y")
    light["lazy_a_authored_role"] = "fixed-transform-raking-light"
    light["lazy_a_contact_energy"] = CONTACT_LIGHT_ENERGY
    light["lazy_a_contact_target"] = json.dumps(rounded_vector(target))
    light["lazy_a_contact_shade_axis"] = json.dumps(rounded_vector(shade_axis))
    light["lazy_a_contact_axis_offset_degrees"] = round(
        math.degrees(shade_axis.angle(raking_direction)), 12
    )
    parent_keep_world(light, lamp)
    return bulb, shade, light


def reveal_level(value: float) -> None:
    value = max(0.0, min(1.0, value))
    light = require_object(CONTACT_LIGHT, "LIGHT")
    light.data.energy = float(light["lazy_a_contact_energy"]) * value
    bulb = require_object(CONTACT_BULB, "MESH")
    material = bulb.data.materials[0]
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Emission Strength"].default_value = 18.0 * value
    shade = require_object(CONTACT_SHADE, "MESH")
    shade_material = shade.data.materials[0]
    shade_bsdf = shade_material.node_tree.nodes.get("Principled BSDF")
    if shade_bsdf is not None:
        shade_bsdf.inputs["Emission Strength"].default_value = 4.0 * value
    groove_material = bpy.data.materials.get("ContactPressureGroove")
    lamp_level = (
        groove_material.node_tree.nodes.get("ContactLampLevel")
        if groove_material is not None and groove_material.node_tree is not None
        else None
    )
    if lamp_level is not None:
        lamp_level.outputs["Value"].default_value = value
    # CONTACT geometry remains fixed. The lamp both lights the paper and reveals
    # density in the compressed fibers on the recessed faces themselves.


def unhide_notebook() -> list[bpy.types.Object]:
    result = []
    for obj in bpy.data.objects:
        location = obj.matrix_world.translation
        horizontal = math.hypot(location.x - 0.35, location.y + 0.12)
        if obj.type == "MESH" and horizontal < 0.13 and 0.905 < location.z < 0.99:
            obj.hide_render = False
            result.append(obj)
    return result


JOURNAL_COPY = (
    "Lazy A is a small production company.",
    "We make films slowly, by hand,",
    "with more taken away than added.",
    "The name is honest - one true thing",
    "beats ten loud ones.",
)


def reposition_journal_pencil() -> bpy.types.Object:
    pencil = require_object(JOURNAL_PENCIL, "MESH")
    world = pencil.matrix_world.copy()
    world.translation += Vector((0.006, 0.047, 0.001))
    pencil.matrix_world = world
    pencil["lazy_a_repositioned_once"] = True
    bpy.context.view_layer.update()
    return pencil


def author_journal_copy() -> list[bpy.types.Object]:
    cover = require_object("Mesh_185", "MESH")
    ink = make_principled_material(
        "JournalPlaceholderGraphite", (0.58, 0.555, 0.52, 1.0), 0.98
    )
    font = handwriting_font()
    lines: list[bpy.types.Object] = []
    first_y = 0.014
    line_step = 0.019
    line_offsets = (0.0, 0.0008, -0.0004, 0.0005, -0.0002)
    for index, body in enumerate(JOURNAL_COPY):
        line = create_text_mesh(
            f"{JOURNAL_PREFIX}{index + 1}",
            body,
            0.0092,
            0.000014,
            material=ink,
            align_x="LEFT",
            font=font,
        )
        normalize_mesh_left_edge(line)
        if line.dimensions.x > 0.165:
            factor = 0.165 / line.dimensions.x
            line.scale.x *= factor
            line.scale.y *= factor
        line.matrix_world = normalized_surface_matrix(
            cover,
            -0.065 + line_offsets[index],
            first_y - index * line_step,
            0.0017,
            rotation_z=0.0,
        ) @ line.matrix_world
        line["lazy_a_authored_role"] = "physical-journal-placeholder-copy"
        line["lazy_a_copy_index"] = index
        lines.append(line)
    cover["lazy_a_journal_copy"] = json.dumps(JOURNAL_COPY)
    return lines


def author_physical_scene() -> dict[str, Any]:
    remove_authored_objects()
    lamp = require_object(LAMP_ROOT)
    lamp_matrix_before = [rounded(value) for row in lamp.matrix_world for value in row]
    card = apply_logo_to_existing_card()
    hero_poster = apply_hero_first_frame()
    nav_sheet, nav_labels = create_production_sheet()
    contact_sheet = author_contact_indentation()
    contact_cutter = require_object(CONTACT_CUTTER, "MESH")
    bulb, shade, light = add_lamp_bulb_and_raking_light(contact_sheet)
    lamp_meshes = [
        obj
        for obj in (lamp, *lamp.children_recursive)
        if obj.type == "MESH" and not obj.hide_render
    ]
    notebook = unhide_notebook()
    journal_pencil = reposition_journal_pencil()
    journal_copy = author_journal_copy()
    bpy.context.view_layer.update()
    contact_stats = contact_indentation_stats(contact_sheet)
    lamp_matrix_after = [rounded(value) for row in lamp.matrix_world for value in row]
    return {
        "card": card,
        "heroPoster": hero_poster,
        "navigation": nav_sheet,
        "navigationLabels": nav_labels,
        "navigationFontFamily": "Noteworthy",
        "contact": contact_sheet,
        "contactCutter": contact_cutter,
        "contactPaperMovedOnce": contact_sheet.get("lazy_a_contact_positioned_once") is True,
        "contactStats": contact_stats,
        "bulb": bulb,
        "shadeInterior": shade,
        "light": light,
        "lampMeshes": lamp_meshes,
        "notebook": notebook,
        "journalCopy": journal_copy,
        "journalPencil": journal_pencil,
        "journalLayout": {
            "fontFamily": "Noteworthy",
            "alignment": "left",
            "marking": "thin-graphite",
            "pencilClearance": "clear",
        },
        "lampMatrixBefore": lamp_matrix_before,
        "lampMatrixAfter": lamp_matrix_after,
    }


PROFILE_POSES = {
    "wide": {
        "opening": {"position": (-0.6, 1.6, 4.9), "target": (0.05, 0.92, 0.0)},
        "desk": {
            "position": tuple(CAMERA_CONTRACT["desktop"]["position"]),
            "target": tuple(CAMERA_CONTRACT["desktop"]["target"]),
        },
        "films": {
            "position": tuple(CAMERA_CONTRACT["desktop"]["position"]),
            "target": (0.55, 1.27, -0.45),
        },
        "journal": {"position": (0.35, 1.08, 0.30), "target": (0.40, 0.92, 0.12)},
        "contact": {"position": (-0.45, 1.58, 0.32), "target": (-0.46, 0.91, -0.01)},
        "about": {"position": (0.02, 1.58, 1.45), "target": (-1.28, 1.22, -0.08)},
    },
    "portrait": {
        "opening": {"position": (-0.6, 1.6, 4.9), "target": (0.05, 0.92, 0.0)},
        "desk": {
            "position": tuple(CAMERA_CONTRACT["phone"]["position"]),
            "target": tuple(CAMERA_CONTRACT["phone"]["target"]),
        },
        "films": {
            "position": tuple(CAMERA_CONTRACT["phone"]["position"]),
            "target": (0.55, 1.27, -0.45),
        },
        "journal": {"position": (0.35, 1.30, 0.44), "target": (0.35, 0.92, 0.02)},
        "contact": {"position": (-0.40, 2.25, 0.85), "target": (-0.4415, 0.91, -0.02)},
        "about": {"position": (0.22, 1.58, 2.27), "target": (-1.52, 0.92, -0.08)},
    },
}

JOURNAL_HIP_CONTROLS = {
    "wide": (0.13, 1.57, 0.83),
    "portrait": (0.30, 1.57, 1.29),
}
JOURNAL_TARGET_LEAD_POWERS = {
    "wide": 1.8,
    "portrait": 3.2,
}


def create_camera() -> bpy.types.Object:
    data = bpy.data.cameras.new("AuthoredPlateCameraData")
    data.sensor_fit = "VERTICAL"
    data.sensor_height = 36.0
    set_vertical_fov(data, LENS_FOV["wide"])
    data.dof.use_dof = False
    camera = bpy.data.objects.new("AuthoredPlateCamera", data)
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    return camera


def set_vertical_fov(data: bpy.types.Camera, fov_degrees: float) -> None:
    data.lens = data.sensor_height / (2.0 * math.tan(math.radians(fov_degrees) / 2.0))


def pose_transform(profile: str, endpoint: str) -> tuple[Vector, Quaternion]:
    pose = PROFILE_POSES[profile][endpoint]
    position = three_to_blender(pose["position"])
    target = three_to_blender(pose["target"])
    quaternion = (target - position).to_track_quat("-Z", "Y")
    return position, quaternion


def set_camera_transform(camera: bpy.types.Object, position: Vector, quaternion: Quaternion) -> None:
    camera.location = position
    camera.rotation_mode = "QUATERNION"
    camera.rotation_quaternion = quaternion
    bpy.context.view_layer.update()


THREE_TO_BLENDER_BASIS = Matrix(((1.0, 0.0, 0.0), (0.0, 0.0, -1.0), (0.0, 1.0, 0.0)))
BLENDER_TO_THREE_BASIS = THREE_TO_BLENDER_BASIS.inverted()


def camera_rotation_to_three(camera: bpy.types.Object) -> Matrix:
    blender_rotation = camera.matrix_world.to_3x3()
    basis_similarity = (
        BLENDER_TO_THREE_BASIS
        @ blender_rotation
        @ THREE_TO_BLENDER_BASIS
    )
    # Similarity changes both sides of the operator. Three and Blender cameras
    # share native +X right, +Y up, -Z forward local axes, so restore that local
    # camera convention after changing the world basis.
    return basis_similarity @ BLENDER_TO_THREE_BASIS


def camera_sample(camera: bpy.types.Object, fov: float) -> dict[str, Any]:
    three_rotation = camera_rotation_to_three(camera)
    quaternion = three_rotation.to_quaternion()
    return {
        "position": blender_to_three(camera.matrix_world.translation),
        "quaternion": rounded_vector((quaternion.x, quaternion.y, quaternion.z, quaternion.w)),
        "fov": rounded(fov),
    }


def local_face_points(
    obj: bpy.types.Object,
    thin_axis: int,
    side: str,
) -> list[Vector]:
    bounds = [Vector(corner) for corner in obj.bound_box]
    axis_value = min(point[thin_axis] for point in bounds) if side == "min" else max(
        point[thin_axis] for point in bounds
    )
    selected = [point for point in bounds if abs(point[thin_axis] - axis_value) < 1e-7]
    return [obj.matrix_world @ point for point in selected]


def project_world_points(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    points: list[Vector],
) -> list[float] | None:
    projected = [world_to_camera_view(scene, camera, point) for point in points]
    if not projected or all(point.z <= 0.0 for point in projected):
        return None
    screen = [(point.x, 1.0 - point.y) for point in projected]
    center_x = sum(point[0] for point in screen) / len(screen)
    center_y = sum(point[1] for point in screen) / len(screen)
    screen.sort(key=lambda point: math.atan2(point[1] - center_y, point[0] - center_x))
    start = min(range(len(screen)), key=lambda index: screen[index][0] + screen[index][1])
    screen = screen[start:] + screen[:start]
    if len(screen) == 4 and screen[1][0] < screen[-1][0]:
        screen = [screen[0], screen[-1], screen[-2], screen[1]]
    return rounded_vector(value for point in screen for value in point)


def project_ordered_world_points(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    points: list[Vector],
) -> list[float] | None:
    projected = [world_to_camera_view(scene, camera, point) for point in points]
    if not projected or all(point.z <= 0.0 for point in projected):
        return None
    return rounded_vector(
        value
        for point in projected
        for value in (point.x, 1.0 - point.y)
    )


def project_object_bounds(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    objects: list[bpy.types.Object],
) -> list[float] | None:
    projected = [
        world_to_camera_view(scene, camera, obj.matrix_world @ Vector(corner))
        for obj in objects
        for corner in obj.bound_box
    ]
    visible = [point for point in projected if point.z > 0.0]
    if not visible:
        return None
    min_x = min(point.x for point in visible)
    max_x = max(point.x for point in visible)
    min_y = 1.0 - max(point.y for point in visible)
    max_y = 1.0 - min(point.y for point in visible)
    return rounded_vector((min_x, min_y, max_x, min_y, max_x, max_y, min_x, max_y))


def quad_pixel_width(quad: list[float] | None, width: int) -> float:
    if quad is None or len(quad) != 8:
        return 0.0
    return (max(quad[0::2]) - min(quad[0::2])) * width


def quad_pixel_height(quad: list[float] | None, height: int) -> float:
    if quad is None or len(quad) != 8:
        return 0.0
    return (max(quad[1::2]) - min(quad[1::2])) * height


def quad_inside_frame(quad: list[float] | None, inset: float = 0.0) -> bool:
    return quad is not None and len(quad) == 8 and all(
        inset <= value <= 1.0 - inset for value in quad
    )


def quad_intersects_frame(quad: list[float] | None) -> bool:
    if quad is None or len(quad) != 8:
        return False
    xs = quad[0::2]
    ys = quad[1::2]
    return max(xs) > 0.0 and min(xs) < 1.0 and max(ys) > 0.0 and min(ys) < 1.0


def projected_bounds_area(scene: bpy.types.Scene, camera: bpy.types.Object, obj: bpy.types.Object) -> float:
    projected = [world_to_camera_view(scene, camera, obj.matrix_world @ Vector(corner)) for corner in obj.bound_box]
    visible = [point for point in projected if point.z > 0.0]
    if not visible:
        return 0.0
    min_x = max(0.0, min(point.x for point in visible))
    max_x = min(1.0, max(point.x for point in visible))
    min_y = max(0.0, min(point.y for point in visible))
    max_y = min(1.0, max(point.y for point in visible))
    return rounded(max(0.0, max_x - min_x) * max(0.0, max_y - min_y))


def projected_region_area(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    center: tuple[float, float, float],
    size: tuple[float, float, float],
) -> float:
    center_b = three_to_blender(center)
    size_b = Vector((size[0], size[2], size[1]))
    points = []
    for x in (-0.5, 0.5):
        for y in (-0.5, 0.5):
            for z in (-0.5, 0.5):
                points.append(center_b + Vector((x * size_b.x, y * size_b.y, z * size_b.z)))
    projected = [world_to_camera_view(scene, camera, point) for point in points]
    visible = [point for point in projected if point.z > 0.0]
    if not visible:
        return 0.0
    min_x = max(0.0, min(point.x for point in visible))
    max_x = min(1.0, max(point.x for point in visible))
    min_y = max(0.0, min(point.y for point in visible))
    max_y = min(1.0, max(point.y for point in visible))
    return rounded(max(0.0, max_x - min_x) * max(0.0, max_y - min_y))


def endpoint_framing(scene: bpy.types.Scene, camera: bpy.types.Object, authored: dict[str, Any]) -> dict[str, Any]:
    notebook_areas = [projected_bounds_area(scene, camera, obj) for obj in authored["notebook"]]
    return {
        "coverage": {
            "notebook": rounded(max(notebook_areas, default=0.0)),
            "contactPaper": projected_bounds_area(scene, camera, authored["contact"]),
            "charger": projected_region_area(scene, camera, (0.74, 0.94, 0.12), (0.26, 0.08, 0.22)),
            "leftHistory": projected_region_area(scene, camera, (-1.25, 1.25, -0.32), (1.2, 1.35, 0.18)),
        }
    }


def hero_projection(scene: bpy.types.Scene, camera: bpy.types.Object) -> list[float] | None:
    hero = require_object(HERO_OBJECT, "MESH")
    points = local_face_points(hero, 1, "min")
    if any((camera.matrix_world.inverted() @ point).z >= -1e-8 for point in points):
        return None
    return project_world_points(scene, camera, points)


def hero_reciprocal_w(camera: bpy.types.Object) -> list[float] | None:
    camera_inverse = camera.matrix_world.inverted()
    values = []
    for point in hero_world_quad():
        camera_point = camera_inverse @ point
        clip_w = -camera_point.z
        if clip_w <= 1e-8:
            return None
        values.append(rounded(1.0 / clip_w))
    return values


def hero_world_quad() -> list[Vector]:
    return local_face_points(require_object(HERO_OBJECT, "MESH"), 1, "min")


def contact_projection(scene: bpy.types.Scene, camera: bpy.types.Object, contact: bpy.types.Object) -> list[float] | None:
    return project_world_points(scene, camera, local_face_points(contact, 2, "max"))


def navigation_geometry(nav_sheet: bpy.types.Object) -> dict[str, Any]:
    top = NAV_THICKNESS / 2.0
    top_left = nav_sheet.matrix_world @ Vector((-NAV_WIDTH / 2.0, NAV_HEIGHT / 2.0, top))
    top_right = nav_sheet.matrix_world @ Vector((NAV_WIDTH / 2.0, NAV_HEIGHT / 2.0, top))
    bottom_left = nav_sheet.matrix_world @ Vector((-NAV_WIDTH / 2.0, -NAV_HEIGHT / 2.0, top))
    u_axis = (top_right - top_left).normalized()
    v_axis = (bottom_left - top_left).normalized()
    normal = u_axis.cross(v_axis).normalized()
    return {
        "bounds": {"x": 0.0, "y": 0.0, "width": NAV_WIDTH, "height": NAV_HEIGHT},
        "plane": {
            "origin": blender_to_three(top_left),
            "uAxis": blender_to_three(u_axis),
            "vAxis": blender_to_three(v_axis),
            "normal": blender_to_three(normal),
            "width": NAV_WIDTH,
            "height": NAV_HEIGHT,
        },
        "rows": list(NAV_ROWS),
        "containment": "half-open",
    }


def set_profile_dressing(authored: dict[str, Any], profile: str) -> None:
    navigation = authored["navigation"]
    navigation.location.x = (
        NAV_CENTER_X_PORTRAIT if profile == "portrait" else NAV_CENTER_X
    )
    navigation.location.y = (
        NAV_CENTER_Y_PORTRAIT if profile == "portrait" else NAV_CENTER_Y
    )
    incline = NAV_INCLINE_PORTRAIT if profile == "portrait" else NAV_INCLINE
    navigation.rotation_euler.x = incline
    navigation.location.z = (
        DESK_HEIGHT
        + math.sin(incline) * NAV_HEIGHT / 2.0
        + NAV_THICKNESS / 2.0
    )
    bpy.context.view_layer.update()


def transition_sample(
    profile: str,
    destination: str,
    frame_index: int,
    frame_count: int,
) -> tuple[Vector, Quaternion, float]:
    if destination == "desk":
        start_pose = PROFILE_POSES[profile]["opening"]
        end_pose = PROFILE_POSES[profile]["desk"]
        start = Vector(start_pose["position"])
        end = Vector(end_pose["position"])
        start_gaze = Vector(start_pose["target"])
        end_gaze = Vector(end_pose["target"])
        forward = end - start
        forward.y = 0.0
        forward.normalize()
        lateral = Vector((-forward.z, 0.0, forward.x))
        elapsed = frame_index / FPS

        if elapsed < OPENING_BEAT_SECONDS:
            position_three = start.copy()
            gaze_three = start_gaze.copy()
        else:
            walk_t = min(
                (elapsed - OPENING_BEAT_SECONDS) / WALK_SECONDS,
                1.0,
            )
            position_three = start.lerp(end, ease_in_out_cubic(walk_t))
            envelope = math.sin(math.pi * walk_t)
            stride = elapsed * BOB_HZ * math.tau
            position_three.y -= (
                BOB_AMPLITUDE
                * (0.5 + 0.5 * math.sin(stride))
                * envelope
            )
            position_three += (
                lateral
                * SWAY_AMPLITUDE
                * math.sin(stride / 2.0)
                * envelope
            )
            if walk_t >= 1.0:
                settle_t = min(
                    (
                        elapsed
                        - OPENING_BEAT_SECONDS
                        - WALK_SECONDS
                    )
                    / SETTLE_SECONDS,
                    1.0,
                )
                decay = math.exp(-3.2 * settle_t)
                position_three += (
                    forward
                    * OVERSHOOT
                    * math.cos(settle_t * SETTLE_HZ * math.tau)
                    * decay
                )
            gaze_t = cubic_out(
                elapsed
                / (
                    OPENING_BEAT_SECONDS
                    + WALK_SECONDS
                    + GAZE_LAG_SECONDS
                )
            )
            gaze_three = start_gaze.lerp(end_gaze, gaze_t)

        if frame_index == frame_count - 1:
            position_three = end.copy()
            gaze_three = end_gaze.copy()
        position = three_to_blender(tuple(position_three))
        target = three_to_blender(tuple(gaze_three))
        quaternion = (target - position).to_track_quat("-Z", "Y")
        return position, quaternion, 0.0

    start_name = "desk"
    start_position, start_quaternion = pose_transform(profile, start_name)
    end_position, end_quaternion = pose_transform(profile, destination)
    raw_t = frame_index / max(frame_count - 1, 1)

    if destination == "journal":
        start_target = three_to_blender(
            tuple(PROFILE_POSES[profile][start_name]["target"])
        )
        notebook_reading_anchor = three_to_blender(
            tuple(PROFILE_POSES[profile][destination]["target"])
        )
        hip_control = three_to_blender(JOURNAL_HIP_CONTROLS[profile])
        eased = smootherstep(raw_t)
        position = quadratic_bezier(
            start_position, hip_control, end_position, eased
        )
        target_raw_t = 1.0 - (1.0 - raw_t) ** JOURNAL_TARGET_LEAD_POWERS[
            profile
        ]
        target = start_target.lerp(
            notebook_reading_anchor, smootherstep(target_raw_t)
        )
        quaternion = upright_track_quaternion(position, target)
    elif destination == "contact":
        elapsed = frame_index / FPS
        if elapsed <= CONTACT_ACTIVATION_SECONDS:
            position = start_position.copy()
            quaternion = start_quaternion.copy()
            lamp_level = smoothstep(elapsed / CONTACT_ACTIVATION_SECONDS)
            return position, quaternion, lamp_level
        move_t = (elapsed - CONTACT_ACTIVATION_SECONDS) / CONTACT_MOVE_SECONDS
        eased = smoothstep(move_t)
        position = start_position.lerp(end_position, eased)
        quaternion = start_quaternion.slerp(end_quaternion, eased)
        return position, quaternion, 1.0
    else:
        eased = smoothstep(raw_t)
        position = start_position.lerp(end_position, eased)
        quaternion = start_quaternion.slerp(end_quaternion, eased)

    return position, quaternion, 0.0


def frame_metadata(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    profile: str,
    lamp_level: float,
) -> dict[str, Any]:
    return {
        "camera": camera_sample(camera, LENS_FOV[profile]),
        "hero": hero_projection(scene, camera),
        "heroReciprocalW": hero_reciprocal_w(camera),
        "lampLevel": rounded(lamp_level),
        "visibleBulbLevel": rounded(lamp_level),
        "revealLevel": rounded(lamp_level),
        "contactIndentDepth": CONTACT_INDENT_DEPTH,
    }


def notebook_world_quad(notebook: bpy.types.Object) -> list[Vector]:
    bounds = [Vector(corner) for corner in notebook.bound_box]
    min_x = min(point.x for point in bounds)
    max_x = max(point.x for point in bounds)
    min_y = min(point.y for point in bounds)
    max_y = max(point.y for point in bounds)
    top = max(point.z for point in bounds)
    return [
        notebook.matrix_world @ Vector((min_x, min_y, top)),
        notebook.matrix_world @ Vector((max_x, min_y, top)),
        notebook.matrix_world @ Vector((max_x, max_y, top)),
        notebook.matrix_world @ Vector((min_x, max_y, top)),
    ]


def polygon_area(points: list[tuple[float, float]]) -> float:
    if len(points) < 3:
        return 0.0
    return abs(
        sum(
            first[0] * second[1] - second[0] * first[1]
            for first, second in zip(points, points[1:] + points[:1])
        )
        / 2.0
    )


def clip_polygon_to_viewport(
    points: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    def clip(polygon, inside, intersection):
        result = []
        for index, current in enumerate(polygon):
            previous = polygon[index - 1]
            current_inside = inside(current)
            previous_inside = inside(previous)
            if current_inside != previous_inside:
                result.append(intersection(previous, current))
            if current_inside:
                result.append(current)
        return result

    def at_x(first, second, value):
        amount = (value - first[0]) / (second[0] - first[0])
        return (value, first[1] + (second[1] - first[1]) * amount)

    def at_y(first, second, value):
        amount = (value - first[1]) / (second[1] - first[1])
        return (first[0] + (second[0] - first[0]) * amount, value)

    polygon = points
    operations = (
        (lambda point: point[0] >= 0.0, lambda a, b: at_x(a, b, 0.0)),
        (lambda point: point[0] <= 1.0, lambda a, b: at_x(a, b, 1.0)),
        (lambda point: point[1] >= 0.0, lambda a, b: at_y(a, b, 0.0)),
        (lambda point: point[1] <= 1.0, lambda a, b: at_y(a, b, 1.0)),
    )
    for inside, intersection in operations:
        if not polygon:
            break
        polygon = clip(polygon, inside, intersection)
    return polygon


def journal_endpoint_metrics(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    notebook_quad: list[Vector],
    fov: float,
) -> dict[str, float]:
    sample = camera_sample(camera, fov)
    points = [
        project_with_exported_three_camera(
            sample,
            scene.render.resolution_x,
            scene.render.resolution_y,
            blender_to_three(point),
        )
        for point in notebook_quad
    ]
    first, second = points[:2]
    angle = abs(math.degrees(math.atan2(second[1] - first[1], second[0] - first[0])))
    return {
        "endpointBaselineRotationDegrees": rounded(min(angle, 180.0 - angle)),
        "endpointCoverage": rounded(
            polygon_area(clip_polygon_to_viewport(points))
        ),
    }


def camera_angular_step_degrees(first: dict[str, Any], second: dict[str, Any]) -> float:
    left = first["quaternion"]
    right = second["quaternion"]
    left_length = math.sqrt(sum(value * value for value in left))
    right_length = math.sqrt(sum(value * value for value in right))
    dot = abs(
        sum(
            left[index] / left_length * right[index] / right_length
            for index in range(4)
        )
    )
    return math.degrees(2.0 * math.acos(min(1.0, dot)))


def journal_motion_metrics(frames: list[dict[str, Any]]) -> dict[str, float]:
    translation_frame = next(
        (
            index
            for index in range(1, len(frames))
            if math.dist(
                frames[index - 1]["camera"]["position"],
                frames[index]["camera"]["position"],
            )
            > 1e-7
        ),
        math.inf,
    )
    angular_steps = [
        camera_angular_step_degrees(
            frames[index - 1]["camera"], frames[index]["camera"]
        )
        for index in range(1, len(frames))
    ]
    return {
        "translationStartsAtSeconds": rounded(translation_frame / FPS),
        "maxAngularStepDegrees": rounded(max(angular_steps)),
    }


def media_path(path: Path) -> str:
    return "/" + path.relative_to(REPO_ROOT / "public").as_posix()


def configure_render(
    scene: bpy.types.Scene,
    profile: str,
    samples: int,
    *,
    proof: bool = False,
    motion: bool = False,
) -> None:
    resolution = (
        PROOF_RESOLUTION if proof else MOTION_RESOLUTION if motion else RESOLUTION
    )
    width, height = resolution[profile]
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.025
    scene.cycles.adaptive_min_samples = min(4, samples)
    scene.cycles.use_denoising = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90
    scene.render.film_transparent = False
    scene.render.use_persistent_data = motion


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        for corner in obj.bound_box
    ]
    return (
        Vector(min(point[axis] for point in points) for axis in range(3)),
        Vector(max(point[axis] for point in points) for axis in range(3)),
    )


def canonical_json(value: Any) -> str:
    if isinstance(value, dict):
        return "{" + ",".join(
            f"{json.dumps(key)}:{canonical_json(value[key])}"
            for key in sorted(value)
        ) + "}"
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical_json(item) for item in value) + "]"
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return json.dumps(value, separators=(",", ":"))
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("Canonical JSON cannot encode non-finite numbers")
        if value.is_integer():
            return str(int(value))
        return json.dumps(value, separators=(",", ":"))
    raise TypeError(f"Unsupported canonical JSON value: {type(value).__name__}")


def sha256_canonical(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, sort_keys=True, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )


def mesh_geometry_sha256(obj: bpy.types.Object) -> str:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        triangles = []
        for triangle in mesh.loop_triangles:
            points = [
                tuple(
                    round(float(value), 9)
                    for value in (
                        evaluated.matrix_world @ mesh.vertices[index].co
                    )
                )
                for index in triangle.vertices
            ]
            triangles.append(sorted(points))
        payload = json.dumps(
            sorted(triangles), separators=(",", ":"), ensure_ascii=True
        ).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()
    finally:
        evaluated.to_mesh_clear()


def create_hero_live_surface(poster: bpy.types.Object) -> bpy.types.Object:
    bounds = [Vector(corner) for corner in poster.bound_box]
    min_x = min(point.x for point in bounds) + 0.001
    max_x = max(point.x for point in bounds) - 0.001
    min_z = min(point.z for point in bounds) + 0.001
    max_z = max(point.z for point in bounds) - 0.001
    front_y = min(point.y for point in bounds) - 0.00025
    mesh = bpy.data.meshes.new(f"{HERO_SURFACE}Mesh")
    mesh.from_pydata(
        [
            (min_x, front_y, max_z),
            (min_x, front_y, min_z),
            (max_x, front_y, min_z),
            (max_x, front_y, max_z),
        ],
        [],
        [(0, 1, 2, 3)],
    )
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="HeroLiveUV")
    uv_by_vertex = {
        0: (0.0, 1.0),
        1: (0.0, 0.0),
        2: (1.0, 0.0),
        3: (1.0, 1.0),
    }
    for loop in mesh.loops:
        uv_layer.data[loop.index].uv = uv_by_vertex[loop.vertex_index]
    surface = bpy.data.objects.new(HERO_SURFACE, mesh)
    bpy.context.collection.objects.link(surface)
    surface.matrix_world = poster.matrix_world.copy()
    surface["lazy_a_source_object"] = HERO_OBJECT
    surface["lazy_a_authored_role"] = "physical-hero-live-surface"
    return surface


def evaluated_geometry_proxy(source: bpy.types.Object) -> bpy.types.Object:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = source.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(
        evaluated, preserve_all_data_layers=True, depsgraph=depsgraph
    )
    mesh.materials.clear()
    proxy = bpy.data.objects.new(f"{HERO_PROXY_PREFIX}{source.name}", mesh)
    bpy.context.collection.objects.link(proxy)
    proxy.matrix_world = evaluated.matrix_world.copy()
    proxy["lazy_a_source_object"] = source.name
    proxy["lazy_a_authored_role"] = "hero-foreground-depth"
    return proxy


def export_hero_compositor_geometry(
    authored: dict[str, Any],
) -> dict[str, Any]:
    HERO_ROOT.mkdir(parents=True, exist_ok=True)
    surface = create_hero_live_surface(authored["heroPoster"])
    occluders = [
        evaluated_geometry_proxy(require_object(name, "MESH"))
        for name in HERO_OCCLUDER_OBJECTS
    ]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [surface, *occluders]:
        obj.hide_render = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = surface
    bpy.ops.export_scene.gltf(
        filepath=str(HERO_COMPOSITOR_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="NONE",
        export_yup=True,
    )
    return {
        "surface": surface,
        "occluders": occluders,
        "geometry": {
            "heroLiveSurface": {
                "object": HERO_SURFACE,
                "geometrySha256": mesh_geometry_sha256(surface),
            },
            "heroOccluders": [
                {
                    "object": proxy.name,
                    "sourceObject": proxy["lazy_a_source_object"],
                    "geometrySha256": mesh_geometry_sha256(proxy),
                }
                for proxy in occluders
            ],
        },
    }


def bake_hero_treated_source(
    scene: bpy.types.Scene,
    hero: bpy.types.Object,
    samples: int,
) -> None:
    source_image = next(
        (
            node.image
            for node in hero.data.materials[0].node_tree.nodes
            if node.bl_idname == "ShaderNodeTexImage" and node.image is not None
        ),
        None,
    )
    if source_image is None:
        raise RuntimeError("Hero poster material has no first-frame image")
    width, height = source_image.size
    baked = bpy.data.images.get("HeroTreatedFirstFrame") or bpy.data.images.new(
        "HeroTreatedFirstFrame", width=width, height=height, alpha=True
    )
    baked.generated_color = (0.0, 0.0, 0.0, 1.0)
    material = hero.data.materials[0]
    target = material.node_tree.nodes.new("ShaderNodeTexImage")
    target.name = "HeroTreatedBakeTarget"
    target.image = baked
    material.node_tree.nodes.active = target

    bpy.ops.object.select_all(action="DESELECT")
    hero.hide_render = False
    hero.select_set(True)
    bpy.context.view_layer.objects.active = hero
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.bake.use_clear = True
    scene.render.bake.margin = 2
    bpy.ops.object.bake(type="COMBINED")
    HERO_TREATED_SOURCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    baked.save_render(str(HERO_TREATED_SOURCE_PATH), scene=scene)
    material.node_tree.nodes.remove(target)


def padded_projection_quad(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    obj: bpy.types.Object,
    width: int,
    height: int,
) -> list[float]:
    quad = project_object_bounds(scene, camera, [obj])
    if quad is None:
        raise RuntimeError(f"{obj.name} does not project into the practical viewport")
    min_x = max(0.0, min(quad[0::2]) - 2.0 / width)
    max_x = min(1.0, max(quad[0::2]) + 2.0 / width)
    min_y = max(0.0, min(quad[1::2]) - 2.0 / height)
    max_y = min(1.0, max(quad[1::2]) + 2.0 / height)
    return rounded_vector((min_x, min_y, max_x, min_y, max_x, max_y, min_x, max_y))


def render_practical_mask(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    profile: str,
    target: bpy.types.Object,
    path: Path,
) -> list[float]:
    width, height = CONTACT_MASK_VIEWPORTS[profile]
    position, quaternion = pose_transform(profile, "desk")
    set_camera_transform(camera, position, quaternion)
    set_vertical_fov(camera.data, LENS_FOV[profile])
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    quad = padded_projection_quad(scene, camera, target, width, height)

    mesh_visibility = {
        obj.name: obj.hide_render for obj in bpy.data.objects if obj.type == "MESH"
    }
    original_materials = list(target.data.materials)
    original_engine = scene.render.engine
    original_transparent = scene.render.film_transparent
    original_format = scene.render.image_settings.file_format
    original_mode = scene.render.image_settings.color_mode
    original_depth = scene.render.image_settings.color_depth
    world = scene.world
    background = (
        world.node_tree.nodes.get("Background")
        if world is not None and world.use_nodes
        else None
    )
    background_strength = (
        background.inputs["Strength"].default_value if background is not None else None
    )
    mask_material = make_principled_material(
        "PracticalGeometryMask",
        (0.0, 0.0, 0.0, 1.0),
        1.0,
        emission=(1.0, 1.0, 1.0, 1.0),
    )
    mask_bsdf = mask_material.node_tree.nodes.get("Principled BSDF")
    mask_bsdf.inputs["Emission Strength"].default_value = 1.0
    try:
        for obj in bpy.data.objects:
            if obj.type == "MESH":
                obj.hide_render = obj != target
        target.data.materials.clear()
        target.data.materials.append(mask_material)
        if background is not None:
            background.inputs["Strength"].default_value = 0.0
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.film_transparent = False
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "BW"
        scene.render.image_settings.color_depth = "8"
        path.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
    finally:
        for obj in bpy.data.objects:
            if obj.name in mesh_visibility:
                obj.hide_render = mesh_visibility[obj.name]
        target.data.materials.clear()
        for material in original_materials:
            target.data.materials.append(material)
        if background is not None:
            background.inputs["Strength"].default_value = background_strength
        scene.render.engine = original_engine
        scene.render.film_transparent = original_transparent
        scene.render.image_settings.file_format = original_format
        scene.render.image_settings.color_mode = original_mode
        scene.render.image_settings.color_depth = original_depth
    return quad


def receiver_world_quad(obj: bpy.types.Object) -> list[Vector]:
    points = local_face_points(obj, 2, "max")
    center = sum(points, Vector()) / len(points)
    points.sort(key=lambda point: math.atan2(point.y - center.y, point.x - center.x))
    start = min(
        range(len(points)),
        key=lambda index: points[index].x + points[index].y,
    )
    return points[start:] + points[:start]


def ray_intersects_receiver(
    origin: Vector,
    direction: Vector,
    receiver: bpy.types.Object,
) -> tuple[bool, Vector | None]:
    inverse = receiver.matrix_world.inverted()
    local_origin = inverse @ origin
    local_direction = inverse.to_3x3() @ direction
    local_direction.normalize()
    local_bounds = [Vector(corner) for corner in receiver.bound_box]
    top = max(point.z for point in local_bounds)
    if abs(local_direction.z) <= 1e-8:
        return False, None
    distance = (top - local_origin.z) / local_direction.z
    if distance <= 0.0:
        return False, None
    hit = local_origin + local_direction * distance
    min_x = min(point.x for point in local_bounds)
    max_x = max(point.x for point in local_bounds)
    min_y = min(point.y for point in local_bounds)
    max_y = max(point.y for point in local_bounds)
    tolerance = 1e-6
    intersects = (
        min_x - tolerance <= hit.x <= max_x + tolerance
        and min_y - tolerance <= hit.y <= max_y + tolerance
    )
    return intersects, receiver.matrix_world @ hit


def padded_projection_quad_for_objects(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    objects: list[bpy.types.Object],
    width: int,
    height: int,
) -> list[float]:
    quad = project_object_bounds(scene, camera, objects)
    if quad is None:
        raise RuntimeError("CONTACT light-pool receivers do not project into portrait")
    min_x = max(0.0, min(quad[0::2]) - 2.0 / width)
    max_x = min(1.0, max(quad[0::2]) + 2.0 / width)
    min_y = max(0.0, min(quad[1::2]) - 2.0 / height)
    max_y = min(1.0, max(quad[1::2]) + 2.0 / height)
    return rounded_vector((min_x, min_y, max_x, min_y, max_x, max_y, min_x, max_y))


def make_light_pool_mask_material(
    origin: Vector,
    direction: Vector,
    spot_size: float,
) -> bpy.types.Material:
    material = bpy.data.materials.new("ContactPortraitLightPoolMask")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Emission Color"].default_value = (1.0, 1.0, 1.0, 1.0)

    geometry = nodes.new("ShaderNodeNewGeometry")
    subtract = nodes.new("ShaderNodeVectorMath")
    subtract.operation = "SUBTRACT"
    subtract.inputs[1].default_value = origin
    normalize = nodes.new("ShaderNodeVectorMath")
    normalize.operation = "NORMALIZE"
    dot_product = nodes.new("ShaderNodeVectorMath")
    dot_product.operation = "DOT_PRODUCT"
    dot_product.inputs[1].default_value = direction.normalized()
    threshold = nodes.new("ShaderNodeMath")
    threshold.operation = "GREATER_THAN"
    threshold.inputs[1].default_value = math.cos(spot_size * 0.5)
    links.new(geometry.outputs["Position"], subtract.inputs[0])
    links.new(subtract.outputs["Vector"], normalize.inputs[0])
    links.new(normalize.outputs["Vector"], dot_product.inputs[0])
    links.new(dot_product.outputs["Value"], threshold.inputs[0])
    links.new(threshold.outputs["Value"], bsdf.inputs["Emission Strength"])
    return material


def render_portrait_light_pool_mask(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    authored: dict[str, Any],
    path: Path,
) -> list[float]:
    profile = "portrait"
    width, height = CONTACT_MASK_VIEWPORTS[profile]
    position, quaternion = pose_transform(profile, "desk")
    set_camera_transform(camera, position, quaternion)
    set_vertical_fov(camera.data, LENS_FOV[profile])
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    receivers = [require_object("Mesh_26", "MESH"), authored["contact"]]
    quad = padded_projection_quad_for_objects(
        scene, camera, receivers, width, height
    )
    light = require_object(CONTACT_LIGHT, "LIGHT")
    origin = light.matrix_world.translation.copy()
    direction = light.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
    direction.normalize()
    material = make_light_pool_mask_material(
        origin, direction, light.data.spot_size
    )

    mesh_visibility = {
        obj.name: obj.hide_render for obj in bpy.data.objects if obj.type == "MESH"
    }
    light_visibility = {
        obj.name: obj.hide_render for obj in bpy.data.objects if obj.type == "LIGHT"
    }
    original_materials = {
        obj.name: list(obj.data.materials) for obj in receivers
    }
    original_engine = scene.render.engine
    original_transparent = scene.render.film_transparent
    original_format = scene.render.image_settings.file_format
    original_mode = scene.render.image_settings.color_mode
    original_depth = scene.render.image_settings.color_depth
    world = scene.world
    background = (
        world.node_tree.nodes.get("Background")
        if world is not None and world.use_nodes
        else None
    )
    background_strength = (
        background.inputs["Strength"].default_value if background is not None else None
    )
    try:
        for obj in bpy.data.objects:
            if obj.type == "MESH":
                obj.hide_render = obj not in receivers
            elif obj.type == "LIGHT":
                obj.hide_render = True
        for receiver in receivers:
            receiver.data.materials.clear()
            receiver.data.materials.append(material)
        if background is not None:
            background.inputs["Strength"].default_value = 0.0
        scene.render.engine = "BLENDER_EEVEE"
        scene.render.film_transparent = False
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "BW"
        scene.render.image_settings.color_depth = "8"
        path.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
    finally:
        for obj in bpy.data.objects:
            if obj.name in mesh_visibility:
                obj.hide_render = mesh_visibility[obj.name]
            elif obj.name in light_visibility:
                obj.hide_render = light_visibility[obj.name]
        for receiver in receivers:
            receiver.data.materials.clear()
            for original_material in original_materials[receiver.name]:
                receiver.data.materials.append(original_material)
        if background is not None:
            background.inputs["Strength"].default_value = background_strength
        scene.render.engine = original_engine
        scene.render.film_transparent = original_transparent
        scene.render.image_settings.file_format = original_format
        scene.render.image_settings.color_mode = original_mode
        scene.render.image_settings.color_depth = original_depth
        bpy.data.materials.remove(material)
    return quad


def build_practical_authoring_manifest(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    authored: dict[str, Any],
) -> dict[str, Any]:
    CONTACT_ROOT.mkdir(parents=True, exist_ok=True)
    desk = require_object("Mesh_26", "MESH")
    paper = authored["contact"]
    geometry = {
        "bulb": {
            "object": CONTACT_BULB,
            "geometrySha256": mesh_geometry_sha256(authored["bulb"]),
        },
        "shadeInterior": {
            "object": CONTACT_SHADE,
            "geometrySha256": mesh_geometry_sha256(authored["shadeInterior"]),
        },
        "desk": {
            "object": desk.name,
            "geometrySha256": mesh_geometry_sha256(desk),
            "worldQuad": [
                rounded_vector(point) for point in receiver_world_quad(desk)
            ],
        },
        "contactPaper": {
            "object": paper.name,
            "geometrySha256": mesh_geometry_sha256(paper),
            "worldQuad": [
                rounded_vector(point) for point in receiver_world_quad(paper)
            ],
        },
    }
    sources = {
        "masterBlend": {
            "path": SOURCE_BLEND,
            "sha256": sha256_file(REPO_ROOT / SOURCE_BLEND),
        },
        "renderScript": {
            "path": "scripts/render-master-shots.py",
            "sha256": sha256_file(Path(__file__).resolve()),
        },
    }
    lamp = require_object(LAMP_ROOT)
    light = require_object(CONTACT_LIGHT, "LIGHT")
    origin = light.matrix_world.translation.copy()
    direction = light.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
    direction.normalize()
    light_source_payload = {
        "relationship": "shade-origin-ray-v1",
        "lampObject": LAMP_ROOT,
        "shadeOpening": rounded_vector(
            lamp_vector_property(lamp, "lazy_a_contact_shade_opening_center")
        ),
        "shadeOpeningRadius": rounded(
            float(lamp["lazy_a_contact_shade_opening_radius"])
        ),
        "shadeAxis": rounded_vector(
            lamp_vector_property(lamp, "lazy_a_contact_shade_axis")
        ),
        "origin": rounded_vector(origin),
        "direction": rounded_vector(direction),
        "target": json.loads(light["lazy_a_contact_target"]),
        "axisErrorDegrees": rounded(
            float(light["lazy_a_contact_axis_offset_degrees"])
        ),
        "spotAngleDegrees": rounded(math.degrees(light.data.spot_size)),
        "energy": rounded(float(light["lazy_a_contact_energy"])),
        "spotBlend": rounded(light.data.spot_blend),
        "shadowSoftSize": rounded(light.data.shadow_soft_size),
    }
    relationship_payload = {
        "sources": sources,
        "receiverGeometry": {
            "desk": geometry["desk"],
            "contactPaper": geometry["contactPaper"],
        },
        "lightSource": light_source_payload,
    }
    light_source = {
        **light_source_payload,
        "relationshipSha256": sha256_canonical(relationship_payload),
    }

    position, quaternion = pose_transform("wide", "desk")
    set_camera_transform(camera, position, quaternion)
    wide_camera = camera_sample(camera, LENS_FOV["wide"])
    wide_projection = {
        "kind": WIDE_PRACTICAL_RELATIONSHIP,
        "viewport": list(CONTACT_MASK_VIEWPORTS["wide"]),
        "deskCameraSha256": sha256_canonical(wide_camera),
        "lightSourceRelationshipSha256": light_source["relationshipSha256"],
    }
    for key, obj in (
        ("bulb", authored["bulb"]),
        ("shadeInterior", authored["shadeInterior"]),
    ):
        filename = f"wide-{key.replace('Interior', '-interior').lower()}-mask.png"
        path = CONTACT_ROOT / filename
        wide_projection[key] = {
            **geometry[key],
            "quad": render_practical_mask(
                scene, camera, "wide", obj, path
            ),
            "mask": {"path": filename, "sha256": sha256_file(path)},
        }
    wide_projection["projectionSha256"] = sha256_canonical(wide_projection)

    position, quaternion = pose_transform("portrait", "desk")
    set_camera_transform(camera, position, quaternion)
    portrait_camera = camera_sample(camera, LENS_FOV["portrait"])
    receiver_sha256 = sha256_canonical(
        {
            "desk": geometry["desk"]["geometrySha256"],
            "contactPaper": geometry["contactPaper"]["geometrySha256"],
        }
    )
    pool_filename = "portrait-desk-paper-light-pool-mask.png"
    pool_path = CONTACT_ROOT / pool_filename
    portrait_projection = {
        "kind": PORTRAIT_PRACTICAL_RELATIONSHIP,
        "viewport": list(CONTACT_MASK_VIEWPORTS["portrait"]),
        "deskCameraSha256": sha256_canonical(portrait_camera),
        "lightSourceRelationshipSha256": light_source["relationshipSha256"],
        "receivers": {
            "deskGeometrySha256": geometry["desk"]["geometrySha256"],
            "contactPaperGeometrySha256": geometry["contactPaper"]["geometrySha256"],
            "receiverGeometrySha256": receiver_sha256,
        },
        "lightPool": {
            "derivation": PORTRAIT_POOL_DERIVATION,
            "runtimeAuthored": False,
            "lightSourceRelationshipSha256": light_source["relationshipSha256"],
            "receiverGeometrySha256": receiver_sha256,
            "quad": render_portrait_light_pool_mask(
                scene, camera, authored, pool_path
            ),
            "mask": {
                "path": pool_filename,
                "sha256": sha256_file(pool_path),
            },
        },
    }
    portrait_projection["projectionSha256"] = sha256_canonical(
        portrait_projection
    )
    return {
        "version": 2,
        "immutable": True,
        "generator": {
            "identity": "blender-background-python",
            "browserRuntime": False,
        },
        "sources": sources,
        "geometry": geometry,
        "lightSource": light_source,
        "profiles": {
            "wide": wide_projection,
            "portrait": portrait_projection,
        },
    }


def build_hero_authoring_manifest(geometry: dict[str, Any]) -> dict[str, Any]:
    return {
        "version": 1,
        "immutable": True,
        "generator": {
            "identity": "blender-background-python",
            "browserRuntime": False,
        },
        "sources": {
            "masterBlend": {
                "path": SOURCE_BLEND,
                "sha256": sha256_file(REPO_ROOT / SOURCE_BLEND),
            },
            "renderScript": {
                "path": "scripts/render-master-shots.py",
                "sha256": sha256_file(Path(__file__).resolve()),
            },
            "compositorGlb": {
                "path": "public/room/hero/hero-compositor.glb",
                "sha256": sha256_file(HERO_COMPOSITOR_PATH),
            },
        },
        "geometry": geometry,
        "regionSemantics": {
            "red": "projected-HeroLiveSurface-boundary",
            "green": "projected-named-HeroOccluder-boundaries",
            "blue": "HeroLiveSurface-treatment-interior",
        },
        "referenceGeneration": {
            "kind": HERO_REFERENCE_KIND,
            "regionEncoding": HERO_REGION_ENCODING,
            "projectionSource": "evaluated-world-space-triangles",
            "catalog": HERO_PRESENTED_REFERENCES,
            "requiredViewports": [
                "1280x720",
                "1316x1329",
                "1024x768",
                "768x1024",
                "375x812",
            ],
        },
        "references": {},
    }


def build_authored_source_assets(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    authored: dict[str, Any],
    samples: int,
) -> None:
    exported = export_hero_compositor_geometry(authored)
    bake_hero_treated_source(scene, authored["heroPoster"], samples)
    practical = build_practical_authoring_manifest(scene, camera, authored)
    write_json(CONTACT_AUTHORING_MANIFEST_PATH, practical)
    hero = build_hero_authoring_manifest(exported["geometry"])
    write_json(HERO_AUTHORING_MANIFEST_PATH, hero)
    print(
        "AUTHORED SOURCE ASSETS:",
        HERO_COMPOSITOR_PATH,
        HERO_TREATED_SOURCE_PATH,
        CONTACT_AUTHORING_MANIFEST_PATH,
        HERO_AUTHORING_MANIFEST_PATH,
    )


def contact_light_contract(authored: dict[str, Any]) -> dict[str, Any]:
    light = require_object(CONTACT_LIGHT, "LIGHT")
    bulb = require_object(CONTACT_BULB, "MESH")
    paper = authored["contact"]
    origin = light.matrix_world.translation.copy()
    direction = light.matrix_world.to_quaternion() @ Vector((0.0, 0.0, -1.0))
    direction.normalize()

    lamp_min, lamp_max = world_bounds(authored["lampMeshes"])
    lamp_height = lamp_max.z - lamp_min.z
    inside_lamp_bounds = all(
        lamp_min[axis] <= origin[axis] <= lamp_max[axis] for axis in range(3)
    )
    inside_shade = (
        inside_lamp_bounds
        and origin.z >= lamp_min.z + lamp_height * 0.45
        and (origin - bulb.matrix_world.translation).length <= 1e-6
    )

    inverse = paper.matrix_world.inverted()
    local_direction = inverse.to_3x3() @ direction
    local_direction.normalize()
    grazing_angle = math.degrees(
        math.asin(max(0.0, min(1.0, abs(local_direction.z))))
    )
    intersects_paper, paper_hit_world = ray_intersects_receiver(
        origin, direction, paper
    )
    intersects_desk, desk_hit_world = ray_intersects_receiver(
        origin, direction, require_object("Mesh_26", "MESH")
    )
    return {
        "lightOrigin": blender_to_three(origin),
        "lightTarget": (
            blender_to_three(paper_hit_world)
            if paper_hit_world is not None
            else None
        ),
        "deskLightTarget": (
            blender_to_three(desk_hit_world)
            if desk_hit_world is not None
            else None
        ),
        "lightInsideShade": inside_shade,
        "lightIntersectsPaper": intersects_paper,
        "lightIntersectsDesk": intersects_desk,
        "grazingAngleDegrees": rounded(grazing_angle),
    }


def build_manifest(scene: bpy.types.Scene, camera: bpy.types.Object, authored: dict[str, Any]) -> dict[str, Any]:
    variants: dict[str, Any] = {}
    light_contract = contact_light_contract(authored)
    notebook_quad = notebook_world_quad(require_object("Mesh_185", "MESH"))
    notebook_three_quad = [blender_to_three(point) for point in notebook_quad]
    contact_world = [
        blender_to_three(point)
        for point in local_face_points(authored["contact"], 2, "max")
    ]

    for profile in PROFILE_IDS:
        print(f"MANIFEST: {profile} endpoints", flush=True)
        set_profile_dressing(authored, profile)
        width, height = RESOLUTION[profile]
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.resolution_percentage = 100
        set_vertical_fov(camera.data, LENS_FOV[profile])
        endpoints: dict[str, Any] = {}
        for endpoint in ENDPOINT_IDS:
            position, quaternion = pose_transform(profile, endpoint)
            set_camera_transform(camera, position, quaternion)
            level = 1.0 if endpoint == "contact" else 0.0
            endpoints[endpoint] = {
                "id": endpoint,
                "still": f"/room/{profile}/stills/{endpoint}.jpg",
                "projection": frame_metadata(scene, camera, profile, level),
                "framing": endpoint_framing(scene, camera, authored),
            }
            print(f"MANIFEST: {profile}/{endpoint}", flush=True)

        transitions: dict[str, Any] = {}
        destinations = (("desk", OPENING_SECONDS),) + tuple(
            (
                destination,
                CONTACT_SECONDS if destination == "contact" else DESTINATION_SECONDS,
            )
            for destination in DESTINATION_IDS
        )
        for destination, duration in destinations:
            source = "opening" if destination == "desk" else "desk"
            transition_id = f"{source}-{destination}"
            frame_count = round(duration * FPS) + 1
            frames = []
            for frame_index in range(frame_count):
                position, quaternion, lamp_level = transition_sample(
                    profile, destination, frame_index, frame_count
                )
                set_camera_transform(camera, position, quaternion)
                frames.append(frame_metadata(scene, camera, profile, lamp_level))
                if (frame_index + 1) % 30 == 0 or frame_index == frame_count - 1:
                    print(
                        f"MANIFEST: {profile}/{transition_id} "
                        f"{frame_index + 1}/{frame_count}",
                        flush=True,
                    )
            forward_path = f"/room/{profile}/transitions/{transition_id}.mp4"
            reverse_path = f"/room/{profile}/transitions/{destination}-{source}.mp4"
            transition = {
                "id": transition_id,
                "from": source,
                "to": destination,
                "duration": duration,
                "fps": FPS,
                "frameCount": frame_count,
                "forward": forward_path,
                "framesDirectory": f"/room/_frames/{profile}/{transition_id}",
                "reverse": {
                    "source": reverse_path,
                    "playbackRate": 1,
                    "from": destination,
                    "to": source,
                },
                "frames": frames,
            }
            if destination == "journal":
                motion_metrics = journal_motion_metrics(frames)
                journal_position, journal_quaternion = pose_transform(
                    profile, destination
                )
                set_camera_transform(camera, journal_position, journal_quaternion)
                endpoint_metrics = journal_endpoint_metrics(
                    scene, camera, notebook_quad, LENS_FOV[profile]
                )
                transition.update(
                    {
                        "journalHeadLeadSeconds": 0,
                        "translationStartsAtSeconds": motion_metrics[
                            "translationStartsAtSeconds"
                        ],
                        "motionModel": "coupled-hip-pivot",
                        "maxAngularStepDegrees": motion_metrics[
                            "maxAngularStepDegrees"
                        ],
                        "endpointBaselineRotationDegrees": endpoint_metrics[
                            "endpointBaselineRotationDegrees"
                        ],
                        "endpointCoverage": endpoint_metrics["endpointCoverage"],
                        "notebookWorldQuad": notebook_three_quad,
                    }
                )
            else:
                transition.update(
                    {
                        "journalHeadLeadSeconds": None,
                        "translationStartsAtSeconds": 0.0,
                    }
                )
            transitions[transition_id] = transition

        nav_points = [
            authored["navigation"].matrix_world @ Vector((-NAV_WIDTH / 2, NAV_HEIGHT / 2, NAV_THICKNESS / 2)),
            authored["navigation"].matrix_world @ Vector((NAV_WIDTH / 2, NAV_HEIGHT / 2, NAV_THICKNESS / 2)),
            authored["navigation"].matrix_world @ Vector((NAV_WIDTH / 2, -NAV_HEIGHT / 2, NAV_THICKNESS / 2)),
            authored["navigation"].matrix_world @ Vector((-NAV_WIDTH / 2, -NAV_HEIGHT / 2, NAV_THICKNESS / 2)),
        ]
        profile_navigation = navigation_geometry(authored["navigation"])
        screen_quads = {}
        label_screen_quads: dict[str, dict[str, list[float] | None]] = {}
        logo_screen_quads: dict[str, list[float] | None] = {}
        address_screen_quads: dict[str, list[float] | None] = {}
        paper_screen_quads: dict[str, list[float] | None] = {}
        lamp_screen_quads: dict[str, list[float] | None] = {}
        for endpoint in ENDPOINT_IDS:
            endpoint_position, endpoint_quaternion = pose_transform(profile, endpoint)
            set_camera_transform(camera, endpoint_position, endpoint_quaternion)
            screen_quads[endpoint] = project_ordered_world_points(scene, camera, nav_points)
            label_screen_quads[endpoint] = {
                destination: project_object_bounds(scene, camera, glyphs)
                for destination, glyphs in authored["navigationLabels"].items()
            }
            logo_screen_quads[endpoint] = project_object_bounds(
                scene, camera, [authored["card"]]
            )
            address_screen_quads[endpoint] = project_object_bounds(
                scene, camera, [authored["contactCutter"]]
            )
            paper_screen_quads[endpoint] = project_object_bounds(
                scene, camera, [authored["contact"]]
            )
            lamp_screen_quads[endpoint] = project_object_bounds(
                scene, camera, authored["lampMeshes"]
            )
        profile_navigation["screenQuad"] = screen_quads["desk"]
        profile_navigation["screenQuads"] = screen_quads
        profile_navigation["labelScreenQuads"] = label_screen_quads
        profile_navigation["fontFamily"] = "Noteworthy"
        profile_navigation["marking"] = "thin-graphite"
        profile_navigation["alignment"] = "left"
        profile_navigation["rowHeight"] = 0.026
        profile_navigation["rowPitch"] = 0.044
        desk_position, desk_quaternion = pose_transform(profile, "desk")
        set_camera_transform(camera, desk_position, desk_quaternion)
        variants[profile] = {
            "id": profile,
            "width": width,
            "height": height,
            "fov": LENS_FOV[profile],
            "endpoints": endpoints,
            "transitions": transitions,
            "navigation": profile_navigation,
            "logo": {
                "object": LOGO_OBJECT,
                "geometryCreated": False,
                "source": authored["card"].get("lazy_a_logo_source"),
                "sourceResolution": json.loads(
                    authored["card"].get("lazy_a_logo_source_resolution", "[]")
                ),
                "uvLayer": authored["card"].data.uv_layers.active.name,
                "uvBinding": authored["card"].get("lazy_a_logo_uv_binding"),
                "screenQuads": logo_screen_quads,
            },
            "contact": {
                "mechanism": "applied-exact-pressure-indentation",
                "materialMechanism": "lamp-reactive-compressed-fiber-groove",
                "coloredRevealMixCount": 1,
                "fiberResponseAnimated": True,
                "fiberResponseNormalWeighted": True,
                "normalResponseAnimated": True,
                "physicalOcclusionResponse": True,
                "fiberResponseFloorPeak": CONTACT_FIBER_FLOOR_RESPONSE_PEAK,
                "fiberResponseWallPeak": CONTACT_FIBER_RESPONSE_PEAK,
                "idleFillStrength": CONTACT_IDLE_FILL_STRENGTH,
                "geometryAnimated": False,
                "paperObject": CONTACT_PAPER,
                "paperWorldQuad": contact_world,
                "paperScreenQuad": contact_projection(scene, camera, authored["contact"]),
                "paperOpacity": 1.0,
                "standalonePlaneCount": 0,
                "lampObject": CONTACT_LIGHT,
                "lampRoot": LAMP_ROOT,
                "lampTransform": authored["lampMatrixAfter"],
                "paperTransform": [
                    rounded(value)
                    for row in authored["contact"].matrix_world
                    for value in row
                ],
                "paperMovedOnce": authored["contactPaperMovedOnce"],
                "indentDepth": CONTACT_INDENT_DEPTH,
                "geometryStats": authored["contactStats"],
                "addressCopy": CONTACT_COPY_TEXT,
                "addressScreenQuads": address_screen_quads,
                "paperScreenQuads": paper_screen_quads,
                "lampScreenQuads": lamp_screen_quads,
                "activationHoldSeconds": CONTACT_ACTIVATION_SECONDS,
                "practicalRelationship": (
                    WIDE_PRACTICAL_RELATIONSHIP
                    if profile == "wide"
                    else PORTRAIT_PRACTICAL_RELATIONSHIP
                ),
                "visibleBulb": profile == "wide",
                "visibleShadeInterior": profile == "wide",
                "shadeAxisErrorDegrees": rounded(
                    float(
                        require_object(LAMP_ROOT).get(
                            "lazy_a_contact_shade_axis_error_degrees", math.inf
                        )
                    )
                ),
                **light_contract,
            },
            "journal": {
                "mechanism": "physical-text-geometry",
                "surfaceObject": "Mesh_185",
                "copy": list(JOURNAL_COPY),
                "lineObjects": [obj.name for obj in authored["journalCopy"]],
                "pencilObject": JOURNAL_PENCIL,
                "pencilMovedOnce": authored["journalPencil"].get("lazy_a_repositioned_once") is True,
                "notebookWorldQuad": notebook_three_quad,
                **authored["journalLayout"],
            },
        }

    hero_authoring_hash = sha256_file(HERO_AUTHORING_MANIFEST_PATH)
    practical_authoring_hash = sha256_file(CONTACT_AUTHORING_MANIFEST_PATH)
    return {
        "version": 1,
        "generatedBy": "scripts/render-master-shots.py",
        "sourceBlend": SOURCE_BLEND,
        "coordinateSystem": "three-y-up",
        "cameraRotationConversion": "basis-similarity-with-camera-local-basis",
        "fps": FPS,
        "endpointIds": list(ENDPOINT_IDS),
        "destinationIds": list(DESTINATION_IDS),
        "hero": {
            "object": HERO_OBJECT,
            "firstFrameSource": HERO_FIRST_FRAME_SOURCE,
            "restingMechanism": "baked-physical-poster",
            "liveProjection": "camera-reciprocal-depth-projective",
            "compositor": "single-webgl-pass",
            "occlusion": "authored-depth-geometry",
            "treatment": {
                "kind": "calibrated-room-transfer",
                "source": "/room/hero/hero-room-treatment.png",
            },
            "geometry": {
                "source": "/room/hero/hero-compositor.glb",
                "surface": HERO_SURFACE,
                "occluders": list(HERO_OCCLUDER_OBJECTS),
            },
            "verification": {
                "presentationEvent": HERO_PRESENTATION_EVENT,
                "presentedPixelReferences": HERO_PRESENTED_REFERENCES,
                "presentedPixelAuthoringManifest": HERO_AUTHORING_MANIFEST,
                "presentedPixelAuthoringManifestSha256": hero_authoring_hash,
                "referenceKind": HERO_REFERENCE_KIND,
                "regionEncoding": HERO_REGION_ENCODING,
            },
        },
        "verification": {
            "contactPracticalAuthoringManifest": CONTACT_AUTHORING_MANIFEST,
            "contactPracticalAuthoringManifestSha256": practical_authoring_hash,
        },
        "variants": variants,
    }


TYPESCRIPT_HEADER = """/* AUTO-GENERATED by scripts/render-master-shots.py. Do not hand-edit camera data. */
export type Variant = \"wide\" | \"portrait\";
export type EndpointId = \"opening\" | \"desk\" | \"films\" | \"journal\" | \"contact\" | \"about\";
export type DestinationId = Exclude<EndpointId, \"opening\" | \"desk\">;
export interface CameraSample {
  position: readonly [number, number, number];
  quaternion: readonly [number, number, number, number];
  fov: number;
}
export interface Rect { x: number; y: number; width: number; height: number }
export interface ProjectionFrame {
  camera: CameraSample;
  hero: readonly [number, number, number, number, number, number, number, number] | null;
  heroReciprocalW: readonly [number, number, number, number] | null;
  lampLevel: number;
  visibleBulbLevel: number;
  revealLevel: number;
  contactIndentDepth: number;
}
export interface PlateEndpoint {
  id: EndpointId;
  still: string;
  projection: ProjectionFrame;
  framing: { coverage: { notebook: number; contactPaper: number; charger: number; leftHistory: number } };
}
export interface PlateTransition {
  id: string;
  from: EndpointId;
  to: EndpointId;
  duration: number;
  fps: number;
  frameCount: number;
  forward: string;
  framesDirectory: string;
  reverse: { source: string; playbackRate: 1; from: EndpointId; to: EndpointId };
  journalHeadLeadSeconds: number | null;
  translationStartsAtSeconds: number;
  motionModel?: "coupled-hip-pivot";
  maxAngularStepDegrees?: number;
  endpointBaselineRotationDegrees?: number;
  endpointCoverage?: number;
  notebookWorldQuad?: readonly (readonly [number, number, number])[];
  frames: readonly ProjectionFrame[];
}
export interface PlateVariant {
  id: Variant;
  width: number;
  height: number;
  fov: number;
  endpoints: Record<EndpointId, PlateEndpoint>;
  transitions: Record<string, PlateTransition>;
  navigation: {
    bounds: Rect;
    plane: { origin: readonly number[]; uAxis: readonly number[]; vAxis: readonly number[]; normal: readonly number[]; width: number; height: number };
    rows: readonly { id: DestinationId; label: string; rect: Rect }[];
    containment: "half-open";
    screenQuad: readonly number[] | null;
    screenQuads: Record<EndpointId, readonly number[] | null>;
    labelScreenQuads: Record<EndpointId, Record<DestinationId, readonly number[] | null>>;
    fontFamily: "Noteworthy";
    marking: "thin-graphite";
    alignment: "left";
    rowHeight: 0.026;
    rowPitch: 0.044;
  };
  logo: {
    object: "Mesh_31";
    geometryCreated: false;
    source: "assets/master/brand/lazy-a-logo-letterpress.png";
    sourceResolution: readonly [2000, 1588];
    uvLayer: string;
    uvBinding: "explicit-uv-map";
    screenQuads: Record<EndpointId, readonly number[] | null>;
  };
  contact: {
    mechanism: \"applied-exact-pressure-indentation\";
    materialMechanism: "lamp-reactive-compressed-fiber-groove";
    coloredRevealMixCount: 1;
    fiberResponseAnimated: true;
    fiberResponseNormalWeighted: true;
    normalResponseAnimated: true;
    physicalOcclusionResponse: true;
    fiberResponseFloorPeak: number;
    fiberResponseWallPeak: number;
    idleFillStrength: number;
    geometryAnimated: false;
    paperObject: string;
    paperWorldQuad: readonly (readonly number[])[];
    paperScreenQuad: readonly number[] | null;
    paperOpacity: 1;
    standalonePlaneCount: 0;
    lampObject: string;
    lampRoot: string;
    lampTransform: readonly number[];
    paperTransform: readonly number[];
    paperMovedOnce: true;
    indentDepth: number;
    geometryStats: { baseVertices: number; indentedVertices: number; basePolygons: number; indentedPolygons: number };
    addressCopy: string;
    addressScreenQuads: Record<EndpointId, readonly number[] | null>;
    paperScreenQuads: Record<EndpointId, readonly number[] | null>;
    lampScreenQuads: Record<EndpointId, readonly number[] | null>;
    lightOrigin: readonly [number, number, number];
    lightTarget: readonly [number, number, number];
    deskLightTarget: readonly [number, number, number];
    lightInsideShade: true;
    lightIntersectsPaper: true;
    lightIntersectsDesk: true;
    grazingAngleDegrees: number;
    activationHoldSeconds: 1;
    practicalRelationship: "visible-practical-source-v1" | "offscreen-practical-light-pool-v1";
    visibleBulb: boolean;
    visibleShadeInterior: boolean;
    shadeAxisErrorDegrees: number;
  };
  journal: {
    mechanism: "physical-text-geometry";
    surfaceObject: "Mesh_185";
    copy: readonly string[];
    lineObjects: readonly string[];
    pencilObject: "Mesh_53";
    pencilMovedOnce: true;
    fontFamily: "Noteworthy";
    alignment: "left";
    marking: "thin-graphite";
    pencilClearance: "clear";
    notebookWorldQuad: readonly (readonly [number, number, number])[];
  };
}
export interface PlateManifest {
  version: 1;
  generatedBy: string;
  sourceBlend: string;
  coordinateSystem: \"three-y-up\";
  cameraRotationConversion: "basis-similarity-with-camera-local-basis";
  fps: number;
  endpointIds: readonly EndpointId[];
  destinationIds: readonly DestinationId[];
  hero: {
    object: "Mesh_170";
    firstFrameSource: "assets/master/hero/hero-print-first-frame.png";
    restingMechanism: "baked-physical-poster";
    liveProjection: "camera-reciprocal-depth-projective";
    compositor: "single-webgl-pass";
    occlusion: "authored-depth-geometry";
    treatment: { kind: "calibrated-room-transfer"; source: string };
    geometry: { source: string; surface: "HeroLiveSurface"; occluders: readonly string[] };
    verification: {
      presentationEvent: "lazy-a:compositor-frame-presented";
      presentedPixelReferences: string;
      presentedPixelAuthoringManifest: string;
      presentedPixelAuthoringManifestSha256: string;
      referenceKind: "authored-presented-pixels-v1";
      regionEncoding: "rgb-poster-foreground-treatment";
    };
  };
  verification: {
    contactPracticalAuthoringManifest: string;
    contactPracticalAuthoringManifestSha256: string;
  };
  variants: Record<Variant, PlateVariant>;
}

"""


def write_manifest(manifest: dict[str, Any]) -> None:
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    TYPESCRIPT_PATH.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(
        manifest,
        separators=(",", ":"),
        sort_keys=False,
        ensure_ascii=True,
    )
    MANIFEST_PATH.write_text(serialized + "\n", encoding="utf-8")
    TYPESCRIPT_PATH.write_text(
        TYPESCRIPT_HEADER
        + "const generatedPlateManifest = "
        + serialized
        + " as const;\n\nexport const plateManifest: PlateManifest = generatedPlateManifest;\n",
        encoding="utf-8",
    )


def project_with_exported_three_camera(
    sample: dict[str, Any],
    width: int,
    height: int,
    point: list[float],
) -> tuple[float, float]:
    x, y, z, w = sample["quaternion"]
    delta_x = point[0] - sample["position"][0]
    delta_y = point[1] - sample["position"][1]
    delta_z = point[2] - sample["position"][2]
    x2 = x + x
    y2 = y + y
    z2 = z + z
    xx = x * x2
    xy = x * y2
    xz = x * z2
    yy = y * y2
    yz = y * z2
    zz = z * z2
    wx = w * x2
    wy = w * y2
    wz = w * z2
    local_x = (
        (1.0 - (yy + zz)) * delta_x
        + (xy + wz) * delta_y
        + (xz - wy) * delta_z
    )
    local_y = (
        (xy - wz) * delta_x
        + (1.0 - (xx + zz)) * delta_y
        + (yz + wx) * delta_z
    )
    local_z = (
        (xz + wy) * delta_x
        + (yz - wx) * delta_y
        + (1.0 - (xx + yy)) * delta_z
    )
    if local_z >= 0.0:
        raise ValueError("Projected point is behind the exported Three camera")
    tangent = math.tan(math.radians(sample["fov"]) / 2.0)
    aspect = width / height
    ndc_x = (local_x / -local_z) / (tangent * aspect)
    ndc_y = (local_y / -local_z) / tangent
    return ((ndc_x + 1.0) / 2.0, (1.0 - ndc_y) / 2.0)


def exported_nav_projection_error(variant: dict[str, Any], endpoint: str) -> float:
    plane = variant["navigation"]["plane"]
    origin = Vector(plane["origin"])
    u_axis = Vector(plane["uAxis"])
    v_axis = Vector(plane["vAxis"])
    points = (
        origin,
        origin + u_axis * plane["width"],
        origin + u_axis * plane["width"] + v_axis * plane["height"],
        origin + v_axis * plane["height"],
    )
    sample = variant["endpoints"][endpoint]["projection"]["camera"]
    blender = variant["navigation"]["screenQuads"][endpoint]
    try:
        exported = [
            coordinate
            for point in points
            for coordinate in project_with_exported_three_camera(
                sample, variant["width"], variant["height"], list(point)
            )
        ]
    except ValueError:
        return 0.0
    if blender is None or len(blender) != len(exported):
        return math.inf
    quarter_pixel = 0.25 / min(variant["width"], variant["height"])
    return max(
        abs(left - right) / max(quarter_pixel, abs(right) * 0.00004)
        for left, right in zip(exported, blender)
    )


def surface_writing_faces_viewer(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    surface: bpy.types.Object,
    local_z: float,
) -> bool:
    center = surface.matrix_world @ Vector((0.0, 0.0, local_z))
    writing_right = surface.matrix_world @ Vector((0.04, 0.0, local_z))
    writing_up = surface.matrix_world @ Vector((0.0, 0.04, local_z))
    projected = [
        world_to_camera_view(scene, camera, point)
        for point in (center, writing_right, writing_up)
    ]
    if any(point.z <= 0.0 for point in projected):
        return False
    center_screen = (projected[0].x, 1.0 - projected[0].y)
    right_screen = (projected[1].x, 1.0 - projected[1].y)
    up_screen = (projected[2].x, 1.0 - projected[2].y)
    return (
        right_screen[0] > center_screen[0]
        and up_screen[1] < center_screen[1]
    )


def validate_manifest(manifest: dict[str, Any], authored: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    if tuple(manifest.get("endpointIds", [])) != ENDPOINT_IDS:
        issues.append(f"endpoint ids must be exactly {ENDPOINT_IDS}")
    if tuple(manifest.get("variants", {}).keys()) != PROFILE_IDS:
        issues.append(f"profiles must be exactly {PROFILE_IDS}")
    if manifest.get("cameraRotationConversion") != "basis-similarity-with-camera-local-basis":
        issues.append("camera rotation export must use the verified basis-similarity conversion")
    hero_manifest = manifest.get("hero", {})
    if (
        hero_manifest.get("object") != HERO_OBJECT
        or hero_manifest.get("firstFrameSource") != HERO_FIRST_FRAME_SOURCE
        or hero_manifest.get("restingMechanism") != "baked-physical-poster"
        or hero_manifest.get("liveProjection")
        != "camera-reciprocal-depth-projective"
        or hero_manifest.get("compositor") != "single-webgl-pass"
        or hero_manifest.get("occlusion") != "authored-depth-geometry"
        or hero_manifest.get("treatment", {}).get("kind")
        != "calibrated-room-transfer"
        or hero_manifest.get("geometry", {}).get("source")
        != "/room/hero/hero-compositor.glb"
        or tuple(hero_manifest.get("geometry", {}).get("occluders", ()))
        != HERO_OCCLUDER_OBJECTS
        or "maskResolution" in hero_manifest
    ):
        issues.append(
            "hero must use the calibrated single-pass surface and authored depth geometry"
        )
    for path, label in (
        (HERO_COMPOSITOR_PATH, "hero compositor GLB"),
        (HERO_TREATMENT_PATH, "hero room treatment"),
        (HERO_AUTHORING_MANIFEST_PATH, "hero authoring manifest"),
        (CONTACT_AUTHORING_MANIFEST_PATH, "practical authoring manifest"),
    ):
        if not path.is_file() or path.stat().st_size == 0:
            issues.append(f"{label} is missing: {path}")
    if CONTACT_AUTHORING_MANIFEST_PATH.is_file():
        practical_authoring = json.loads(
            CONTACT_AUTHORING_MANIFEST_PATH.read_text(encoding="utf-8")
        )
        if (
            practical_authoring.get("version") != 2
            or practical_authoring.get("profiles", {}).get("wide", {}).get("kind")
            != WIDE_PRACTICAL_RELATIONSHIP
            or practical_authoring.get("profiles", {}).get("portrait", {}).get("kind")
            != PORTRAIT_PRACTICAL_RELATIONSHIP
            or practical_authoring.get("profiles", {})
            .get("portrait", {})
            .get("lightPool", {})
            .get("runtimeAuthored")
            is not False
        ):
            issues.append(
                "practical authoring must pair a wide visible source with a portrait offscreen receiver pool"
            )
    hero_poster = authored["heroPoster"]
    if (
        hero_poster.name != HERO_OBJECT
        or hero_poster.get("lazy_a_hero_first_frame_source") != HERO_FIRST_FRAME_SOURCE
        or hero_poster.get("lazy_a_hero_resting_mechanism") != "baked-physical-poster"
    ):
        issues.append("Mesh_170 must carry the treated physical hero first frame")
    if authored["lampMatrixBefore"] != authored["lampMatrixAfter"]:
        issues.append(f"{LAMP_ROOT} transform changed while authoring CONTACT light")
    lamp = require_object(LAMP_ROOT)
    if (
        float(lamp.get("lazy_a_contact_shade_axis_error_degrees", math.inf))
        > 12.0
    ):
        issues.append("saved desk-lamp shade axis must land within 12 degrees of CONTACT")
    bulb = authored.get("bulb")
    shade = authored.get("shadeInterior")
    if (
        bulb is None
        or shade is None
        or bulb.name != CONTACT_BULB
        or shade.name != CONTACT_SHADE
        or bulb.hide_render
        or shade.hide_render
    ):
        issues.append("CONTACT bulb and shade interior must be visible authored geometry")
    card = authored["card"]
    if card.name != LOGO_OBJECT or card.get("lazy_a_logo_geometry_created") is not False:
        issues.append("Lazy A logo must reuse Mesh_31 without new card geometry")
    if card.get("lazy_a_logo_transform_preserved") is not True:
        issues.append("Mesh_31 logo card must preserve its master-scene transform")
    if card.get("lazy_a_logo_orientation") != "upright-local-xz" or card.data.uv_layers.active is None:
        issues.append("Mesh_31 logo must use an explicit upright local X/Z UV map")
    if (
        card.get("lazy_a_logo_source")
        != "assets/master/brand/lazy-a-logo-letterpress.png"
        or json.loads(card.get("lazy_a_logo_source_resolution", "[]"))
        != [2000, 1588]
    ):
        issues.append("Mesh_31 logo must use the pinned 2000x1588 letterpress source")
    logo_material = card.data.materials[0] if card.data.materials else None
    logo_nodes = logo_material.node_tree.nodes if logo_material and logo_material.use_nodes else ()
    if not any(node.bl_idname == "ShaderNodeUVMap" for node in logo_nodes):
        issues.append("Mesh_31 logo image must be bound to its explicit upright UV map")
    nav_rows = [obj for obj in bpy.data.objects if obj.name.startswith(NAV_PREFIX)]
    if len(nav_rows) != 4 or [row["id"] for row in NAV_ROWS] != list(DESTINATION_IDS):
        issues.append("production sheet must carry four separated uppercase rows in destination order")
    row_heights = [row["rect"]["height"] for row in NAV_ROWS]
    row_pitches = [NAV_ROWS[index]["rect"]["y"] - NAV_ROWS[index - 1]["rect"]["y"] for index in range(1, len(NAV_ROWS))]
    if any(abs(value - 0.026) > 1e-9 for value in row_heights) or any(
        abs(value - 0.044) > 1e-9 for value in row_pitches
    ):
        issues.append("navigation rows must be exactly 0.026 high on a 0.044 pitch")
    if authored.get("navigationFontFamily") != "Noteworthy":
        issues.append("production-sheet lettering must use Noteworthy")
    contact = authored["contact"]
    if bpy.data.objects.get(CONTACT_RECESS) is not None:
        issues.append("CONTACT must not use a visible imprint object over the paper")
    if contact.modifiers or contact.get("lazy_a_contact_mechanism") != "applied-exact-pressure-indentation":
        issues.append("Mesh_56 must contain the applied exact indentation without modifier residue")
    cutter = authored.get("contactCutter")
    if (
        cutter is None
        or abs(float(cutter.get("lazy_a_contact_indent_depth", 0.0)) - CONTACT_INDENT_DEPTH)
        > 1e-9
    ):
        issues.append("CONTACT typography must retain the authored 0.30 mm blind-deboss indentation")
    groove_material = bpy.data.materials.get("ContactPressureGroove")
    groove_bevel = (
        groove_material.node_tree.nodes.get("ContactPressureEdgeBevel")
        if groove_material is not None and groove_material.node_tree is not None
        else None
    )
    fiber_response = (
        groove_material.node_tree.nodes.get("ContactLampFiberResponse")
        if groove_material is not None and groove_material.node_tree is not None
        else None
    )
    lamp_level_node = (
        groove_material.node_tree.nodes.get("ContactLampLevel")
        if groove_material is not None and groove_material.node_tree is not None
        else None
    )
    normal_weight_node = (
        groove_material.node_tree.nodes.get("ContactNormalWeightedFiberResponse")
        if groove_material is not None and groove_material.node_tree is not None
        else None
    )
    occlusion_response_node = (
        groove_material.node_tree.nodes.get("ContactLampGrooveOcclusionResponse")
        if groove_material is not None and groove_material.node_tree is not None
        else None
    )
    idle_fill_node = (
        groove_material.node_tree.nodes.get("ContactIdleGrooveFill")
        if groove_material is not None and groove_material.node_tree is not None
        else None
    )
    normal_reveal_node = (
        groove_material.node_tree.nodes.get("ContactLampNormalReveal")
        if groove_material is not None and groove_material.node_tree is not None
        else None
    )
    if (
        groove_material is None
        or groove_material.node_tree is None
        or groove_material.node_tree.nodes.get("ContactRevealMix") is not None
        or groove_material.node_tree.nodes.get("ContactCompressedPaperFibers") is not None
        or groove_material.get("lazy_a_contact_color_parity") is not True
        or groove_material.get("lazy_a_contact_normal_response_animated") is not True
        or abs(
            float(groove_material.get("lazy_a_contact_fiber_response_peak", -1.0))
            - CONTACT_FIBER_RESPONSE_PEAK
        )
        > 1e-9
        or abs(
            float(
                groove_material.get(
                    "lazy_a_contact_fiber_floor_response_peak", -1.0
                )
            )
            - CONTACT_FIBER_FLOOR_RESPONSE_PEAK
        )
        > 1e-9
        or abs(
            float(groove_material.get("lazy_a_contact_idle_fill_strength", -1.0))
            - CONTACT_IDLE_FILL_STRENGTH
        )
        > 1e-9
        or fiber_response is None
        or lamp_level_node is None
        or normal_weight_node is None
        or occlusion_response_node is None
        or idle_fill_node is None
        or normal_reveal_node is None
        or groove_bevel is None
        or abs(float(groove_bevel.inputs["Radius"].default_value) - 0.00080) > 1e-9
    ):
        issues.append("CONTACT groove must retain idle paper color, lamp fiber response, and fixed pressure-edge bevel")
    if len(authored.get("journalCopy", [])) != len(JOURNAL_COPY):
        issues.append("notebook must carry every approved physical placeholder line")
    if authored.get("journalPencil", {}).get("lazy_a_repositioned_once") is not True:
        issues.append("existing Mesh_53 pencil must be repositioned once clear of JOURNAL copy")
    if authored.get("journalLayout") != {
        "fontFamily": "Noteworthy",
        "alignment": "left",
        "marking": "thin-graphite",
        "pencilClearance": "clear",
    }:
        issues.append("JOURNAL copy must be small, left-aligned Noteworthy graphite clear of the pencil")
    if authored.get("contactPaperMovedOnce") is not True:
        issues.append("Mesh_56 must be repositioned exactly once before all endpoint sampling")
    contact_stats = authored.get("contactStats", {})
    if (
        contact_stats.get("indentedVertices", 0) <= contact_stats.get("baseVertices", 0)
        or contact_stats.get("indentedPolygons", 0) <= contact_stats.get("basePolygons", 0)
    ):
        issues.append("Mesh_56 applied indentation must contain the complete cut topology")

    scene = bpy.context.scene
    camera = require_object("AuthoredPlateCamera", "CAMERA")
    orientation_checks = (
        ("navigation", authored["navigation"], NAV_THICKNESS / 2.0, "desk"),
        ("CONTACT indentation", contact, 0.0, "contact"),
    )
    for profile in PROFILE_IDS:
        for label, surface, local_z, endpoint in orientation_checks:
            position, quaternion = pose_transform(profile, endpoint)
            set_camera_transform(camera, position, quaternion)
            if not surface_writing_faces_viewer(scene, camera, surface, local_z):
                issues.append(
                    f"{profile}: {label} writing must face the seated visitor"
                )

    for profile in PROFILE_IDS:
        variant = manifest["variants"].get(profile, {})
        endpoints = variant.get("endpoints", {})
        if tuple(endpoints.keys()) != ENDPOINT_IDS:
            issues.append(f"{profile}: endpoint definitions are incomplete")
        fovs = {endpoint.get("projection", {}).get("camera", {}).get("fov") for endpoint in endpoints.values()}
        if fovs != {LENS_FOV[profile]}:
            issues.append(f"{profile}: lens must remain constant at {LENS_FOV[profile]} degrees")
        transitions = variant.get("transitions", {})
        if set(transitions) != {"opening-desk", "desk-films", "desk-journal", "desk-contact", "desk-about"}:
            issues.append(f"{profile}: transition definitions are incomplete")
            continue
        if transitions["opening-desk"]["duration"] != OPENING_SECONDS:
            issues.append(f"{profile}: opening must be exactly {OPENING_SECONDS}s")
        for destination in DESTINATION_IDS:
            transition = transitions[f"desk-{destination}"]
            expected_duration = (
                CONTACT_SECONDS if destination == "contact" else DESTINATION_SECONDS
            )
            if transition["duration"] != expected_duration:
                issues.append(
                    f"{profile}: {destination} must be exactly {expected_duration}s"
                )
            if not transition.get("frames") or any(
                set(frame) != {"camera", "hero", "heroReciprocalW", "lampLevel", "visibleBulbLevel", "revealLevel", "contactIndentDepth"}
                or set(frame["camera"]) != {"position", "quaternion", "fov"}
                or (
                    frame["hero"] is not None
                    and (
                        frame["heroReciprocalW"] is None
                        or len(frame["heroReciprocalW"]) != 4
                    )
                )
                or (frame["hero"] is None and frame["heroReciprocalW"] is not None)
                or frame["contactIndentDepth"] != CONTACT_INDENT_DEPTH
                for frame in transition.get("frames", [])
            ):
                issues.append(f"{profile}: {destination} frames lack required projection fields")
        journal = transitions["desk-journal"]
        journal_frames = journal["frames"]
        desk_camera = endpoints["desk"]["projection"]["camera"]
        journal_camera = endpoints["journal"]["projection"]["camera"]
        first_translation = next(
            (
                index
                for index, frame in enumerate(journal_frames)
                if frame["camera"]["position"] != desk_camera["position"]
            ),
            -1,
        )
        motion_metrics = journal_motion_metrics(journal_frames)
        if (
            first_translation != 1
            or journal.get("journalHeadLeadSeconds") != 0
            or journal.get("translationStartsAtSeconds")
            != motion_metrics["translationStartsAtSeconds"]
            or journal.get("motionModel") != "coupled-hip-pivot"
            or journal.get("maxAngularStepDegrees")
            != motion_metrics["maxAngularStepDegrees"]
            or motion_metrics["maxAngularStepDegrees"] > 3.0
        ):
            issues.append(
                f"{profile}: JOURNAL must begin one coupled hip pivot at frame 1 with <=3 degree steps"
            )
        contact_transition = transitions["desk-contact"]
        contact_camera = endpoints["contact"]["projection"]["camera"]
        if contact_camera == desk_camera or all(
            frame["camera"] == desk_camera for frame in contact_transition["frames"]
        ):
            issues.append(f"{profile}: CONTACT must use an authored lean/pan away from desk")
        contact_frames = contact_transition["frames"]
        activation_frames = contact_frames[:31]
        levels = [frame["lampLevel"] for frame in activation_frames]
        visible_levels = [
            frame["visibleBulbLevel"] for frame in activation_frames
        ]
        if (
            len(activation_frames) != 31
            or any(frame["camera"] != desk_camera for frame in activation_frames)
            or any(
                values[index] < values[index - 1]
                for values in (levels, visible_levels)
                for index in range(1, len(values))
            )
            or levels[-1] <= levels[0]
            or visible_levels[-1] <= visible_levels[0]
            or contact_frames[31]["camera"] == desk_camera
        ):
            issues.append(
                f"{profile}: CONTACT must hold the desk camera for 31 rising practical samples before moving"
            )
        navigation = variant.get("navigation", {})
        contact_data = variant.get("contact", {})
        journal_data = variant.get("journal", {})
        films_camera = endpoints["films"]["projection"]["camera"]
        if (
            films_camera["position"] != desk_camera["position"]
            or films_camera["fov"] != desk_camera["fov"]
            or films_camera["quaternion"] == desk_camera["quaternion"]
        ):
            issues.append(f"{profile}: FILMS must be an exact desk-position head-only turn")
        if not navigation.get("plane") or len(navigation.get("rows", [])) != 4:
            issues.append(f"{profile}: navigation plane and row rectangles are required")
        desk_hero_quad = endpoints.get("desk", {}).get("projection", {}).get("hero")
        if not quad_intersects_frame(desk_hero_quad):
            issues.append(
                f"{profile}: hero print must intersect the settled desk frame"
            )
        if not contact_data.get("paperWorldQuad") or contact_data.get("standalonePlaneCount") != 0:
            issues.append(f"{profile}: CONTACT paper quad is required and standalone planes are forbidden")
        if (
            contact_data.get("materialMechanism") != "lamp-reactive-compressed-fiber-groove"
            or contact_data.get("coloredRevealMixCount") != 1
            or contact_data.get("fiberResponseAnimated") is not True
            or contact_data.get("fiberResponseNormalWeighted") is not True
            or contact_data.get("normalResponseAnimated") is not True
            or contact_data.get("physicalOcclusionResponse") is not True
            or contact_data.get("fiberResponseFloorPeak")
            != CONTACT_FIBER_FLOOR_RESPONSE_PEAK
            or contact_data.get("fiberResponseWallPeak")
            != CONTACT_FIBER_RESPONSE_PEAK
            or contact_data.get("idleFillStrength") != CONTACT_IDLE_FILL_STRENGTH
            or contact_data.get("geometryAnimated") is not False
            or not 0.0 < contact_data.get("grazingAngleDegrees", 90.0) <= 35.0
            or contact_data.get("lightInsideShade") is not True
            or contact_data.get("lightIntersectsPaper") is not True
            or contact_data.get("lightIntersectsDesk") is not True
            or not contact_data.get("lightOrigin")
            or not contact_data.get("lightTarget")
            or not contact_data.get("deskLightTarget")
            or contact_data.get("activationHoldSeconds") != 1.0
            or contact_data.get("practicalRelationship")
            != (
                WIDE_PRACTICAL_RELATIONSHIP
                if profile == "wide"
                else PORTRAIT_PRACTICAL_RELATIONSHIP
            )
            or (
                profile == "wide"
                and (
                    contact_data.get("visibleBulb") is not True
                    or contact_data.get("visibleShadeInterior") is not True
                )
            )
            or contact_data.get("shadeAxisErrorDegrees", math.inf) > 12.0
        ):
            issues.append(f"{profile}: CONTACT must use fixed indentation and shade-origin lamp response")
        if (
            journal_data.get("mechanism") != "physical-text-geometry"
            or tuple(journal_data.get("copy", ())) != JOURNAL_COPY
            or len(journal_data.get("lineObjects", ())) != len(JOURNAL_COPY)
        ):
            issues.append(f"{profile}: physical JOURNAL copy metadata is incomplete")
        if (
            not 0.4 <= journal.get("endpointCoverage", 0.0) <= 0.6
            or journal.get("endpointBaselineRotationDegrees", math.inf) > 12.0
            or journal.get("notebookWorldQuad")
            != journal_data.get("notebookWorldQuad")
        ):
            issues.append(
                f"{profile}: JOURNAL notebook projection must cover 0.4..0.6 with <=12 degree baseline rotation"
            )
        if profile == "portrait":
            portrait_contact_coverage = endpoints["contact"]["framing"]["coverage"]
            if portrait_contact_coverage["contactPaper"] <= portrait_contact_coverage["charger"]:
                issues.append(
                    "portrait: CONTACT must frame contactPaper more strongly than charger"
                )
            for endpoint in ("desk",):
                quad = navigation.get("screenQuads", {}).get(endpoint)
                if quad is None or any(value < 0.02 or value > 0.98 for value in quad):
                    issues.append(
                        f"portrait: full navigation sheet must remain inside {endpoint} frame; quad={quad}"
                    )
                logo_quad = variant.get("logo", {}).get("screenQuads", {}).get(endpoint)
                if not quad_inside_frame(logo_quad):
                    issues.append(
                        f"portrait: full Mesh_31 logo card must remain inside {endpoint} frame; quad={logo_quad}"
                    )
                for row in NAV_ROWS:
                    label_quad = navigation.get("labelScreenQuads", {}).get(endpoint, {}).get(row["id"])
                    label_width = quad_pixel_width(label_quad, variant["width"])
                    if label_width < 55.0:
                        issues.append(
                            f"portrait: {row['label']} must be at least 55px wide at {endpoint}, got {label_width}"
                        )
                    label_height = quad_pixel_height(label_quad, variant["height"])
                    if label_height < 12.0:
                        issues.append(
                            f"portrait: {row['label']} must be at least 12px high at {endpoint}, got {label_height}"
                        )
                if quad_pixel_height(quad, variant["height"]) < 70.0:
                    issues.append("portrait: navigation sheet must project at least 70px high at desk")
            paper_quad = contact_data.get("paperScreenQuads", {}).get("contact")
            if not quad_inside_frame(paper_quad, 0.01):
                issues.append(
                    f"portrait: CONTACT lean/pan must frame the full contact paper; paper={paper_quad}"
                )
        address_quad = contact_data.get("addressScreenQuads", {}).get("contact")
        if not quad_inside_frame(address_quad, 0.02):
            issues.append(
                f"{profile}: CONTACT indentation must be fully visible at CONTACT; quad={address_quad}"
            )
        elif quad_pixel_width(address_quad, variant["width"]) < 100.0:
            issues.append(f"{profile}: CONTACT indentation must project at least 100px wide")
        for endpoint in ENDPOINT_IDS:
            projection_error = exported_nav_projection_error(variant, endpoint)
            if projection_error > 1.0:
                issues.append(
                    f"{profile}: exported Three camera/nav projection differs from Blender "
                    f"at {endpoint} by {projection_error} tolerance units"
                )
    return issues


def render_endpoint(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    profile: str,
    endpoint: str,
    output: Path,
    samples: int,
    proof: bool,
) -> None:
    configure_render(scene, profile, samples, proof=proof)
    position, quaternion = pose_transform(profile, endpoint)
    set_camera_transform(camera, position, quaternion)
    reveal_level(1.0 if endpoint == "contact" else 0.0)
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(f"PROOF ENDPOINT: {profile}/{endpoint} -> {output}")


def render_endpoints(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    authored: dict[str, Any],
    proof: bool,
    samples: int,
    only: set[str],
) -> None:
    for profile in PROFILE_IDS:
        set_profile_dressing(authored, profile)
        for endpoint in ENDPOINT_IDS:
            selector = f"{profile}:{endpoint}"
            if only and selector not in only:
                continue
            if proof:
                output = PUBLIC_ROOT / "proof" / f"{profile}-{endpoint}.jpg"
            else:
                output = PUBLIC_ROOT / profile / "stills" / f"{endpoint}.jpg"
            render_endpoint(scene, camera, profile, endpoint, output, samples, proof)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_proof_provenance(samples: int, only: set[str]) -> None:
    proof_root = PUBLIC_ROOT / "proof"
    rendered = {}
    for path in sorted(proof_root.glob("*.jpg")):
        selector = path.stem.replace("-", ":", 1)
        if only and selector not in only:
            continue
        rendered[path.name] = {
            "sha256": sha256_file(path),
            "bytes": path.stat().st_size,
        }
    source_blend = REPO_ROOT / SOURCE_BLEND
    sidecar_path = Path(f"{source_blend}.provenance.json")
    master_provenance = json.loads(sidecar_path.read_text(encoding="utf-8"))
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "renderer": "scripts/render-master-shots.py",
        "rendererSha256": sha256_file(Path(__file__).resolve()),
        "sourceBlend": SOURCE_BLEND,
        "sourceBlendSha256": sha256_file(source_blend),
        "masterBuildInvocationId": master_provenance.get("invocation_id"),
        "masterBuilderSha256": master_provenance.get("builder_sha256"),
        "samples": samples,
        "selectors": sorted(only),
        "outputs": rendered,
    }
    (proof_root / "provenance.json").write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def render_transition_frames(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    authored: dict[str, Any],
    samples: int,
    only: set[str],
    start_frame: int,
) -> None:
    if start_frame and len(only) != 1:
        raise SystemExit("--start-frame requires exactly one --only transition")
    for profile in PROFILE_IDS:
        set_profile_dressing(authored, profile)
        # Motion plates remain 1080p/full-phone resolution; endpoint handoffs
        # use the higher delivery stills after the sub-second movement ends.
        configure_render(scene, profile, samples, motion=True)
        # configure_render defaults endpoint stills to JPEG. Transition
        # intermediates are lossless PNGs because the encoder reads %04d.png.
        scene.render.image_settings.file_format = "PNG"
        destinations = (("desk", OPENING_SECONDS),) + tuple(
            (
                destination,
                CONTACT_SECONDS if destination == "contact" else DESTINATION_SECONDS,
            )
            for destination in DESTINATION_IDS
        )
        for destination, duration in destinations:
            source = "opening" if destination == "desk" else "desk"
            transition_id = f"{source}-{destination}"
            selector = f"{profile}:{transition_id}"
            if only and selector not in only:
                continue
            frame_count = round(duration * FPS) + 1
            if start_frame >= frame_count:
                raise SystemExit(
                    f"--start-frame {start_frame} is outside {selector}'s "
                    f"0..{frame_count - 1} frame range"
                )
            output_dir = PUBLIC_ROOT / "_frames" / profile / transition_id
            output_dir.mkdir(parents=True, exist_ok=True)
            for frame_index in range(start_frame, frame_count):
                position, quaternion, lamp_level = transition_sample(
                    profile, destination, frame_index, frame_count
                )
                set_camera_transform(camera, position, quaternion)
                reveal_level(lamp_level)
                scene.render.filepath = str(output_dir / f"{frame_index:04d}.png")
                bpy.ops.render.render(write_still=True)
            print(f"TRANSITION FRAMES: {profile}/{transition_id} -> {output_dir}")


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--validate", action="store_true")
    parser.add_argument(
        "--build-authoring",
        action="store_true",
        help="Export immutable hero/practical geometry evidence and the treated hero source",
    )
    parser.add_argument("--proof", action="store_true")
    parser.add_argument("--render-stills", action="store_true")
    parser.add_argument("--render-transitions", action="store_true")
    parser.add_argument(
        "--visual-only",
        action="store_true",
        help="Skip manifest generation for disposable proof or transition renders",
    )
    parser.add_argument("--samples", type=int)
    parser.add_argument(
        "--start-frame",
        type=int,
        default=0,
        help="Resume one selected transition at this zero-based frame index",
    )
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        help="Restrict renders to profile:endpoint or profile:transition (repeatable)",
    )
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    scene = bpy.context.scene
    authored = author_physical_scene()
    camera = create_camera()
    if args.build_authoring:
        build_authored_source_assets(
            scene,
            camera,
            authored,
            samples=args.samples or 32,
        )
    if args.visual_only:
        if not (args.proof or args.render_transitions) or args.render_stills:
            raise SystemExit(
                "--visual-only is restricted to disposable --proof or "
                "--render-transitions renders"
            )
        print("VISUAL ITERATION ONLY: manifest generation and validation skipped")
    else:
        manifest = build_manifest(scene, camera, authored)
        write_manifest(manifest)
        issues = validate_manifest(manifest, authored)
        if issues:
            print(f"SHOT CONTRACT INVALID ({len(issues)} issues):", file=sys.stderr)
            for issue in issues:
                print(f"  - {issue}", file=sys.stderr)
            raise SystemExit(1)

        print(
            "SHOT CONTRACT VALID: 6 endpoints x 2 profiles; opening 2.6s; "
            "JOURNAL coupled hip pivot; CONTACT 1.0s practical hold + 0.9s move."
        )
    only = set(args.only)
    if args.proof:
        proof_samples = args.samples or 8
        render_endpoints(scene, camera, authored, proof=True, samples=proof_samples, only=only)
        write_proof_provenance(proof_samples, only)
    if args.render_stills:
        render_endpoints(scene, camera, authored, proof=False, samples=args.samples or 192, only=only)
    if args.render_transitions:
        render_transition_frames(
            scene,
            camera,
            authored,
            samples=args.samples or 192,
            only=only,
            start_frame=args.start_frame,
        )


if __name__ == "__main__":
    main()
