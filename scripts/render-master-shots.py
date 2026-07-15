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
import base64
import json
import math
import os
import sys
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
ENDPOINT_IDS = ("opening", "desk", "films", "journal", "contact", "about")
DESTINATION_IDS = ("films", "journal", "contact", "about")
PROFILE_IDS = ("wide", "portrait")
LENS_FOV = {
    "wide": float(CAMERA_CONTRACT["desktop"]["fov"]),
    "portrait": float(CAMERA_CONTRACT["phone"]["fov"]),
}
RESOLUTION = {"wide": (1280, 720), "portrait": (375, 812)}

LOGO_OBJECT = "Mesh_33"
OBSOLETE_PINNED_LOGO = "Mesh_173"
CONTACT_PAPER = "Mesh_56"
HERO_OBJECT = "Mesh_170"
HERO_OCCLUDER_OBJECTS = (
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
HERO_OCCLUDER_ROUND_DIGITS = 6
HERO_OCCLUDER_SIMPLIFY_TOLERANCE = 0.0001
HERO_OCCLUSION_MASK_SIZE = 256
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
CONTACT_BULB = "ContactEmissiveBulb"

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
HANDWRITING_FONT_PATH = Path("/System/Library/Fonts/Noteworthy.ttc")
CONTACT_FONT_PATH = Path("/System/Library/Fonts/Supplemental/Arial Narrow.ttf")
NAV_LABEL_WIDTHS = (0.113, 0.145, 0.155, 0.110)
CONTACT_PAPER_POSITION = (-0.35, -0.04)
CONTACT_PAPER_YAW = math.radians(4.5)
CONTACT_INDENT_DEPTH = 0.00008
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


def rounded_occluder_vector(values) -> list[float]:
    result = []
    for value in values:
        item = round(float(value), HERO_OCCLUDER_ROUND_DIGITS)
        result.append(0.0 if item == -0.0 else item)
    return result


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


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
        NAV_SHEET,
        CONTACT_CUTTER,
        CONTACT_RECESS,
        CONTACT_LIGHT,
        CONTACT_BULB,
        "AuthoredPlateCamera",
    }
    for obj in list(bpy.data.objects):
        if (
            obj.name in exact_names
            or obj.name.startswith(NAV_PREFIX)
            or obj.name.startswith(NAV_GLYPH_PREFIX)
            or obj.name.startswith(JOURNAL_PREFIX)
            or obj.name.startswith("LogoProof")
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
    logo_path = REPO_ROOT / "public" / "brand" / "logo-note.png"
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
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(NAV_CENTER_X, NAV_CENTER_Y, DESK_HEIGHT + near_edge_drop + NAV_THICKNESS / 2.0),
        rotation=(NAV_INCLINE, 0.0, NAV_YAW),
    )
    sheet = bpy.context.active_object
    sheet.name = NAV_SHEET
    sheet.dimensions = (NAV_WIDTH, NAV_HEIGHT, NAV_THICKNESS)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
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
    lines = (
        (CONTACT_COPY[0], 0.155, 0.055),
        (CONTACT_COPY[1], 0.185, 0.000),
        (CONTACT_COPY[2], 0.145, -0.055),
    )
    font = contact_font()
    for index, (body, target_width, local_y) in enumerate(lines):
        part = create_text_mesh(
            f"{CONTACT_CUTTER}_{index + 1}",
            body,
            0.030,
            0.00020,
            font=font,
            bevel=False,
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
    base_input = groove_bsdf.inputs["Base Color"]
    base_link = base_input.links[0] if base_input.is_linked else None
    reveal_mix = groove_material.node_tree.nodes.new("ShaderNodeMixRGB")
    reveal_mix.name = "ContactRevealMix"
    reveal_mix.label = "Paper texture to illuminated indentation"
    reveal_mix.blend_type = "MIX"
    reveal_mix.inputs[0].default_value = 0.0
    reveal_mix.inputs[2].default_value = (0.24, 0.19, 0.14, 1.0)
    if base_link is not None:
        source_socket = base_link.from_socket
        groove_material.node_tree.links.remove(base_link)
        groove_material.node_tree.links.new(source_socket, reveal_mix.inputs[1])
    else:
        reveal_mix.inputs[1].default_value = base_input.default_value
    groove_material.node_tree.links.new(reveal_mix.outputs["Color"], base_input)
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
    # Place the cutter by measured overlap, not an assumed font origin. It
    # crosses Mesh_56's top face by exactly 0.08 mm and stops above the bottom,
    # leaving a shallow paper-floored pressure indentation.
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


def add_lamp_bulb_and_raking_light(contact_sheet: bpy.types.Object) -> tuple[bpy.types.Object, bpy.types.Object]:
    lamp = require_object(LAMP_ROOT)
    bulb_material = make_principled_material(
        "ContactBulbGlass",
        (0.72, 0.52, 0.27, 1.0),
        0.22,
        emission=(1.0, 0.47, 0.16, 1.0),
    )

    bulb_location = Vector((-0.615, 0.24, 1.205))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.018, location=bulb_location)
    bulb = bpy.context.active_object
    bulb.name = CONTACT_BULB
    bulb.scale = (1.0, 0.78, 1.1)
    bulb.data.materials.append(bulb_material)
    bulb.hide_render = True
    bulb["lazy_a_authored_role"] = "lamp-emissive-bulb"
    parent_keep_world(bulb, lamp)

    light_data = bpy.data.lights.new(CONTACT_LIGHT, "SPOT")
    light_data.energy = 0.0
    light_data.color = (1.0, 0.58, 0.30)
    light_data.spot_size = math.radians(70.0)
    light_data.spot_blend = 0.94
    light_data.shadow_soft_size = 0.008
    light = bpy.data.objects.new(CONTACT_LIGHT, light_data)
    bpy.context.collection.objects.link(light)
    # The visible bulb remains inside the shade; the photometric source sits
    # just below its lip so light grazes the paper instead of making a white
    # spotlight over the address.
    light.location = Vector((-0.60, 0.10, 0.955))
    target = normalized_surface_matrix(contact_sheet, 0.0, 0.0, 0.0).translation
    light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()
    light["lazy_a_authored_role"] = "fixed-transform-raking-light"
    light["lazy_a_contact_energy"] = 45.0
    parent_keep_world(light, lamp)
    return bulb, light


def reveal_level(value: float) -> None:
    value = max(0.0, min(1.0, value))
    light = require_object(CONTACT_LIGHT, "LIGHT")
    light.data.energy = float(light["lazy_a_contact_energy"]) * value
    bulb = require_object(CONTACT_BULB, "MESH")
    material = bulb.data.materials[0]
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Emission Strength"].default_value = 18.0 * value
    groove_material = bpy.data.materials.get("ContactPressureGroove")
    reveal_mix = (
        groove_material.node_tree.nodes.get("ContactRevealMix")
        if groove_material and groove_material.node_tree
        else None
    )
    paper = require_object(CONTACT_PAPER, "MESH")
    depth_level = smoothstep(value)
    for vertex_index in CONTACT_INDENT_VERTEX_INDICES:
        paper.data.vertices[vertex_index].co.z = (
            CONTACT_INDENT_TOP_Z - CONTACT_INDENT_DEPTH * depth_level
        )
    paper.data.update()
    if reveal_mix is not None:
        reveal_mix.inputs[0].default_value = depth_level


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
        "JournalPlaceholderGraphite", (0.43, 0.41, 0.385, 1.0), 0.98
    )
    font = handwriting_font()
    lines: list[bpy.types.Object] = []
    first_y = -0.024
    line_step = 0.0135
    line_offsets = (0.0, 0.0008, -0.0004, 0.0005, -0.0002)
    for index, body in enumerate(JOURNAL_COPY):
        line = create_text_mesh(
            f"{JOURNAL_PREFIX}{index + 1}",
            body,
            0.0061,
            0.000014,
            material=ink,
            align_x="LEFT",
            font=font,
        )
        normalize_mesh_left_edge(line)
        if line.dimensions.x > 0.108:
            factor = 0.108 / line.dimensions.x
            line.scale.x *= factor
            line.scale.y *= factor
        line.matrix_world = normalized_surface_matrix(
            cover,
            -0.058 + line_offsets[index],
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
    nav_sheet, nav_labels = create_production_sheet()
    contact_sheet = author_contact_indentation()
    contact_cutter = require_object(CONTACT_CUTTER, "MESH")
    bulb, light = add_lamp_bulb_and_raking_light(contact_sheet)
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
        "navigation": nav_sheet,
        "navigationLabels": nav_labels,
        "navigationFontFamily": "Noteworthy",
        "contact": contact_sheet,
        "contactCutter": contact_cutter,
        "contactPaperMovedOnce": contact_sheet.get("lazy_a_contact_positioned_once") is True,
        "contactStats": contact_stats,
        "bulb": bulb,
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
        "films": {"position": (0.05, 1.6, 1.45), "target": (0.55, 1.27, -0.45)},
        "journal": {"position": (0.31, 1.06, 0.35), "target": (0.35, 0.91, 0.12)},
        "contact": {"position": (-0.45, 1.58, 0.32), "target": (-0.46, 0.91, -0.01)},
        "about": {"position": (0.02, 1.58, 1.45), "target": (-1.28, 1.22, -0.08)},
    },
    "portrait": {
        "opening": {"position": (-0.6, 1.6, 4.9), "target": (0.05, 0.92, 0.0)},
        "desk": {
            "position": tuple(CAMERA_CONTRACT["phone"]["position"]),
            "target": tuple(CAMERA_CONTRACT["phone"]["target"]),
        },
        "films": {"position": (0.05, 1.70, 1.75), "target": (0.55, 1.27, -0.45)},
        "journal": {"position": (0.30, 1.075, 0.44), "target": (0.30, 0.91, 0.12)},
        "contact": {"position": (-0.40, 2.25, 0.85), "target": (-0.4415, 0.91, -0.02)},
        "about": {"position": (0.22, 1.58, 2.27), "target": (-1.52, 0.92, -0.08)},
    },
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
    return project_world_points(scene, camera, local_face_points(hero, 1, "min"))


def convex_hull(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    unique = sorted(set(points))
    if len(unique) <= 2:
        return unique

    def cross(
        origin: tuple[float, float],
        first: tuple[float, float],
        second: tuple[float, float],
    ) -> float:
        return (first[0] - origin[0]) * (second[1] - origin[1]) - (
            first[1] - origin[1]
        ) * (second[0] - origin[0])

    lower: list[tuple[float, float]] = []
    for point in unique:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0.0:
            lower.pop()
        lower.append(point)
    upper: list[tuple[float, float]] = []
    for point in reversed(unique):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0.0:
            upper.pop()
        upper.append(point)
    return lower[:-1] + upper[:-1]


def polygon_area(points: list[tuple[float, float]]) -> float:
    return sum(
        first[0] * second[1] - second[0] * first[1]
        for first, second in zip(points, points[1:] + points[:1])
    ) / 2.0


def clip_convex_polygon(
    subject: list[tuple[float, float]],
    clip: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    if len(subject) < 3 or len(clip) < 3:
        return []
    orientation = 1.0 if polygon_area(clip) >= 0.0 else -1.0

    def edge_cross(
        start: tuple[float, float],
        end: tuple[float, float],
        point: tuple[float, float],
    ) -> float:
        return (end[0] - start[0]) * (point[1] - start[1]) - (
            end[1] - start[1]
        ) * (point[0] - start[0])

    def inside(
        point: tuple[float, float],
        start: tuple[float, float],
        end: tuple[float, float],
    ) -> bool:
        return orientation * edge_cross(start, end, point) >= -1e-10

    def intersection(
        first: tuple[float, float],
        second: tuple[float, float],
        clip_start: tuple[float, float],
        clip_end: tuple[float, float],
    ) -> tuple[float, float]:
        direction = (second[0] - first[0], second[1] - first[1])
        edge = (clip_end[0] - clip_start[0], clip_end[1] - clip_start[1])
        denominator = edge[0] * direction[1] - edge[1] * direction[0]
        if abs(denominator) < 1e-12:
            return second
        offset = (first[0] - clip_start[0], first[1] - clip_start[1])
        amount = -(edge[0] * offset[1] - edge[1] * offset[0]) / denominator
        return (
            first[0] + direction[0] * amount,
            first[1] + direction[1] * amount,
        )

    output = subject
    for clip_index, clip_start in enumerate(clip):
        clip_end = clip[(clip_index + 1) % len(clip)]
        source = output
        output = []
        if not source:
            break
        previous = source[-1]
        previous_inside = inside(previous, clip_start, clip_end)
        for current in source:
            current_inside = inside(current, clip_start, clip_end)
            if current_inside:
                if not previous_inside:
                    output.append(
                        intersection(previous, current, clip_start, clip_end)
                    )
                output.append(current)
            elif previous_inside:
                output.append(intersection(previous, current, clip_start, clip_end))
            previous = current
            previous_inside = current_inside
    return output


def point_segment_distance(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length_squared = dx * dx + dy * dy
    if length_squared <= 1e-20:
        return math.dist(point, start)
    amount = max(
        0.0,
        min(1.0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / length_squared),
    )
    closest = (start[0] + amount * dx, start[1] + amount * dy)
    return math.dist(point, closest)


def simplify_path(
    points: list[tuple[float, float]],
    tolerance: float,
) -> list[tuple[float, float]]:
    if len(points) <= 2:
        return points
    distances = [
        point_segment_distance(point, points[0], points[-1])
        for point in points[1:-1]
    ]
    maximum = max(distances, default=0.0)
    if maximum <= tolerance:
        return [points[0], points[-1]]
    split = distances.index(maximum) + 1
    return simplify_path(points[: split + 1], tolerance)[:-1] + simplify_path(
        points[split:], tolerance
    )


def simplify_closed_polygon(
    points: list[tuple[float, float]],
    tolerance: float,
) -> list[tuple[float, float]]:
    if len(points) <= 3:
        return points
    first_index, second_index = max(
        (
            (first, second)
            for first in range(len(points))
            for second in range(first + 1, len(points))
        ),
        key=lambda pair: math.dist(points[pair[0]], points[pair[1]]),
    )
    first_path = points[first_index : second_index + 1]
    second_path = points[second_index:] + points[: first_index + 1]
    return (
        simplify_path(first_path, tolerance)[:-1]
        + simplify_path(second_path, tolerance)[:-1]
    )


def hero_world_quad() -> list[Vector]:
    return local_face_points(require_object(HERO_OBJECT, "MESH"), 1, "min")


def hero_plane(points: list[Vector]) -> tuple[Vector, Vector]:
    origin = points[0]
    for first_index in range(1, len(points)):
        for second_index in range(first_index + 1, len(points)):
            normal = (points[first_index] - origin).cross(
                points[second_index] - origin
            )
            if normal.length_squared > 1e-12:
                return origin, normal.normalized()
    raise RuntimeError("Hero print quad is degenerate")


def hero_occluder_projection(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
) -> list[list[float]]:
    hero_world = hero_world_quad()
    hero_screen_values = project_world_points(scene, camera, hero_world)
    if hero_screen_values is None:
        return [[] for _ in HERO_OCCLUDER_OBJECTS]
    hero_screen = list(zip(hero_screen_values[0::2], hero_screen_values[1::2]))
    viewport = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    origin, normal = hero_plane(hero_world)
    camera_side = (camera.matrix_world.translation - origin).dot(normal)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    polygons: list[list[float]] = []
    for object_name in HERO_OCCLUDER_OBJECTS:
        obj = require_object(object_name, "MESH")
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            projected = []
            for vertex in mesh.vertices:
                world = evaluated.matrix_world @ vertex.co
                if (world - origin).dot(normal) * camera_side < -1e-7:
                    continue
                point = world_to_camera_view(scene, camera, world)
                if point.z > 0.0:
                    projected.append((point.x, 1.0 - point.y))
        finally:
            evaluated.to_mesh_clear()
        polygon = clip_convex_polygon(convex_hull(projected), hero_screen)
        polygon = clip_convex_polygon(polygon, viewport)
        polygon = simplify_closed_polygon(
            polygon, HERO_OCCLUDER_SIMPLIFY_TOLERANCE
        )
        rounded_points = list(
            zip(
                rounded_occluder_vector(point[0] for point in polygon),
                rounded_occluder_vector(point[1] for point in polygon),
            )
        )
        deduplicated = []
        for point in rounded_points:
            if not deduplicated or point != deduplicated[-1]:
                deduplicated.append(point)
        if len(deduplicated) > 1 and deduplicated[0] == deduplicated[-1]:
            deduplicated.pop()
        if len(deduplicated) < 3 or abs(polygon_area(deduplicated)) < 1e-10:
            polygons.append([])
        else:
            polygons.append(
                [value for point in deduplicated for value in point]
            )
    return polygons


def clip_world_polygon_to_hero_front(
    points: list[Vector],
    origin: Vector,
    normal: Vector,
    camera_side: float,
) -> list[Vector]:
    if len(points) < 3:
        return []

    def distance(point: Vector) -> float:
        return (point - origin).dot(normal) * camera_side

    output: list[Vector] = []
    previous = points[-1]
    previous_distance = distance(previous)
    previous_inside = previous_distance >= -1e-7
    for current in points:
        current_distance = distance(current)
        current_inside = current_distance >= -1e-7
        if current_inside != previous_inside:
            denominator = previous_distance - current_distance
            amount = (
                previous_distance / denominator
                if abs(denominator) > 1e-12
                else 0.0
            )
            output.append(previous.lerp(current, amount))
        if current_inside:
            output.append(current)
        previous = current
        previous_distance = current_distance
        previous_inside = current_inside
    return output


def rasterize_mask_polygon(
    mask: bytearray,
    polygon: list[tuple[float, float]],
    hero_bounds: tuple[float, float, float, float],
) -> None:
    if len(polygon) < 3:
        return
    min_x, min_y, max_x, max_y = hero_bounds
    width = max_x - min_x
    height = max_y - min_y
    if width <= 1e-12 or height <= 1e-12:
        return
    size = HERO_OCCLUSION_MASK_SIZE
    local = [
        ((point[0] - min_x) / width * size, (point[1] - min_y) / height * size)
        for point in polygon
    ]
    first_row = max(0, int(math.floor(min(point[1] for point in local))))
    last_row = min(size - 1, int(math.ceil(max(point[1] for point in local))))
    for y in range(first_row, last_row + 1):
        scan_y = y + 0.5
        intersections: list[float] = []
        for first, second in zip(local, local[1:] + local[:1]):
            if (first[1] <= scan_y < second[1]) or (
                second[1] <= scan_y < first[1]
            ):
                amount = (scan_y - first[1]) / (second[1] - first[1])
                intersections.append(first[0] + amount * (second[0] - first[0]))
        intersections.sort()
        for index in range(0, len(intersections) - 1, 2):
            start = max(0, int(math.ceil(intersections[index] - 0.5)))
            end = min(size - 1, int(math.floor(intersections[index + 1] - 0.5)))
            if start <= end:
                offset = y * size
                mask[offset + start : offset + end + 1] = b"\x01" * (
                    end - start + 1
                )


def encode_mask_runs(mask: bytearray) -> str:
    size = HERO_OCCLUSION_MASK_SIZE
    payload = bytearray()
    for y in range(size):
        runs: list[tuple[int, int]] = []
        x = 0
        while x < size:
            if mask[y * size + x] == 0:
                x += 1
                continue
            start = x
            while x + 1 < size and mask[y * size + x + 1] != 0:
                x += 1
            runs.append((start, x))
            x += 1
        if len(runs) > 255:
            raise RuntimeError(f"Hero silhouette row {y} exceeds 255 runs")
        payload.append(len(runs))
        for start, end in runs:
            payload.extend((start, end))
    return base64.b64encode(payload).decode("ascii")


def hero_occlusion_mask(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
) -> dict[str, Any]:
    hero_world = hero_world_quad()
    hero_screen_values = project_world_points(scene, camera, hero_world)
    if hero_screen_values is None:
        return {
            "size": HERO_OCCLUSION_MASK_SIZE,
            "rle": encode_mask_runs(bytearray(HERO_OCCLUSION_MASK_SIZE ** 2)),
        }
    hero_screen = list(zip(hero_screen_values[0::2], hero_screen_values[1::2]))
    hero_bounds = (
        min(point[0] for point in hero_screen),
        min(point[1] for point in hero_screen),
        max(point[0] for point in hero_screen),
        max(point[1] for point in hero_screen),
    )
    viewport = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    origin, normal = hero_plane(hero_world)
    camera_side = (camera.matrix_world.translation - origin).dot(normal)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mask = bytearray(HERO_OCCLUSION_MASK_SIZE ** 2)
    for object_name in HERO_OCCLUDER_OBJECTS:
        obj = require_object(object_name, "MESH")
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            for triangle in mesh.loop_triangles:
                world_polygon = [
                    evaluated.matrix_world @ mesh.vertices[index].co
                    for index in triangle.vertices
                ]
                world_polygon = clip_world_polygon_to_hero_front(
                    world_polygon, origin, normal, camera_side
                )
                if len(world_polygon) < 3:
                    continue
                projected = [
                    world_to_camera_view(scene, camera, point)
                    for point in world_polygon
                ]
                if any(point.z <= 0.0 for point in projected):
                    continue
                screen_polygon = [
                    (point.x, 1.0 - point.y) for point in projected
                ]
                screen_polygon = clip_convex_polygon(screen_polygon, hero_screen)
                screen_polygon = clip_convex_polygon(screen_polygon, viewport)
                rasterize_mask_polygon(mask, screen_polygon, hero_bounds)
        finally:
            evaluated.to_mesh_clear()
    return {
        "size": HERO_OCCLUSION_MASK_SIZE,
        "rle": encode_mask_runs(mask),
    }


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
        head_fraction = 1.0 / 3.0
        if raw_t <= head_fraction:
            position = start_position.copy()
            head_t = smoothstep(raw_t / head_fraction) * 0.72
            quaternion = start_quaternion.slerp(end_quaternion, head_t)
        else:
            body_t = smoothstep((raw_t - head_fraction) / (1.0 - head_fraction))
            position = start_position.lerp(end_position, body_t)
            quaternion = start_quaternion.slerp(end_quaternion, 0.72 + body_t * 0.28)
    else:
        eased = smoothstep(raw_t)
        position = start_position.lerp(end_position, eased)
        quaternion = start_quaternion.slerp(end_quaternion, eased)

    lamp_level = smoothstep(raw_t) if destination == "contact" else 0.0
    return position, quaternion, lamp_level


def frame_metadata(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    profile: str,
    lamp_level: float,
) -> dict[str, Any]:
    return {
        "camera": camera_sample(camera, LENS_FOV[profile]),
        "hero": hero_projection(scene, camera),
        "heroOccluders": hero_occluder_projection(scene, camera),
        "heroOcclusionMask": hero_occlusion_mask(scene, camera),
        "lampLevel": rounded(lamp_level),
        "revealLevel": rounded(lamp_level),
    }


def media_path(path: Path) -> str:
    return "/" + path.relative_to(REPO_ROOT / "public").as_posix()


def configure_render(scene: bpy.types.Scene, profile: str, samples: int) -> None:
    width, height = RESOLUTION[profile]
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90
    scene.render.film_transparent = False


def build_manifest(scene: bpy.types.Scene, camera: bpy.types.Object, authored: dict[str, Any]) -> dict[str, Any]:
    variants: dict[str, Any] = {}
    contact_world = [
        blender_to_three(point)
        for point in local_face_points(authored["contact"], 2, "max")
    ]

    for profile in PROFILE_IDS:
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

        transitions: dict[str, Any] = {}
        destinations = (("desk", OPENING_SECONDS),) + tuple(
            (destination, DESTINATION_SECONDS) for destination in DESTINATION_IDS
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
            forward_path = f"/room/{profile}/transitions/{transition_id}.mp4"
            reverse_path = f"/room/{profile}/transitions/{destination}-{source}.mp4"
            transitions[transition_id] = {
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
                "journalHeadLeadSeconds": 0.3 if destination == "journal" else None,
                "translationStartsAtSeconds": 0.3 if destination == "journal" else 0.0,
                "frames": frames,
            }

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
                "uvLayer": authored["card"].data.uv_layers.active.name,
                "uvBinding": authored["card"].get("lazy_a_logo_uv_binding"),
                "screenQuads": logo_screen_quads,
            },
            "contact": {
                "mechanism": "applied-exact-pressure-indentation",
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
            },
            "journal": {
                "mechanism": "physical-text-geometry",
                "surfaceObject": "Mesh_185",
                "copy": list(JOURNAL_COPY),
                "lineObjects": [obj.name for obj in authored["journalCopy"]],
                "pencilObject": JOURNAL_PENCIL,
                "pencilMovedOnce": authored["journalPencil"].get("lazy_a_repositioned_once") is True,
                **authored["journalLayout"],
            },
        }

    return {
        "version": 1,
        "generatedBy": "scripts/render-master-shots.py",
        "sourceBlend": SOURCE_BLEND,
        "coordinateSystem": "three-y-up",
        "cameraRotationConversion": "basis-similarity-with-camera-local-basis",
        "fps": FPS,
        "endpointIds": list(ENDPOINT_IDS),
        "destinationIds": list(DESTINATION_IDS),
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
  heroOccluders: readonly (readonly number[])[];
  heroOcclusionMask: { size: 256; rle: string };
  lampLevel: number;
  revealLevel: number;
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
    object: "Mesh_33";
    geometryCreated: false;
    uvLayer: string;
    uvBinding: "explicit-uv-map";
    screenQuads: Record<EndpointId, readonly number[] | null>;
  };
  contact: {
    mechanism: \"applied-exact-pressure-indentation\";
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
    indentDepth: 0.00008;
    geometryStats: { baseVertices: number; indentedVertices: number; basePolygons: number; indentedPolygons: number };
    addressCopy: string;
    addressScreenQuads: Record<EndpointId, readonly number[] | null>;
    paperScreenQuads: Record<EndpointId, readonly number[] | null>;
    lampScreenQuads: Record<EndpointId, readonly number[] | null>;
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
    position = Vector(sample["position"])
    x, y, z, w = sample["quaternion"]
    quaternion = Quaternion((w, x, y, z))
    local = quaternion.inverted() @ (Vector(point) - position)
    if local.z >= 0.0:
        raise ValueError("Projected point is behind the exported Three camera")
    tangent = math.tan(math.radians(sample["fov"]) / 2.0)
    aspect = width / height
    ndc_x = (local.x / -local.z) / (tangent * aspect)
    ndc_y = (local.y / -local.z) / tangent
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
    exported = [
        coordinate
        for point in points
        for coordinate in project_with_exported_three_camera(
            sample, variant["width"], variant["height"], list(point)
        )
    ]
    blender = variant["navigation"]["screenQuads"][endpoint]
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
    if authored["lampMatrixBefore"] != authored["lampMatrixAfter"]:
        issues.append(f"{LAMP_ROOT} transform changed while authoring CONTACT light")
    card = authored["card"]
    if card.name != LOGO_OBJECT or card.get("lazy_a_logo_geometry_created") is not False:
        issues.append("Lazy A logo must reuse Mesh_33 without new card geometry")
    if card.get("lazy_a_logo_transform_preserved") is not True:
        issues.append("Mesh_33 logo card must preserve its master-scene transform")
    if card.get("lazy_a_logo_orientation") != "upright-local-xz" or card.data.uv_layers.active is None:
        issues.append("Mesh_33 logo must use an explicit upright local X/Z UV map")
    logo_material = card.data.materials[0] if card.data.materials else None
    logo_nodes = logo_material.node_tree.nodes if logo_material and logo_material.use_nodes else ()
    if not any(node.bl_idname == "ShaderNodeUVMap" for node in logo_nodes):
        issues.append("Mesh_33 logo image must be bound to its explicit upright UV map")
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
        issues.append("CONTACT typography must retain the measured 0.08 mm pressure indentation")
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
        if any(
            len(endpoint.get("projection", {}).get("heroOccluders", []))
            != len(HERO_OCCLUDER_OBJECTS)
            for endpoint in endpoints.values()
        ):
            issues.append(f"{profile}: every endpoint must export all photographic hero occluders")
        transitions = variant.get("transitions", {})
        if set(transitions) != {"opening-desk", "desk-films", "desk-journal", "desk-contact", "desk-about"}:
            issues.append(f"{profile}: transition definitions are incomplete")
            continue
        if transitions["opening-desk"]["duration"] != OPENING_SECONDS:
            issues.append(f"{profile}: opening must be exactly {OPENING_SECONDS}s")
        for destination in DESTINATION_IDS:
            transition = transitions[f"desk-{destination}"]
            if transition["duration"] != DESTINATION_SECONDS:
                issues.append(f"{profile}: {destination} must be exactly {DESTINATION_SECONDS}s")
            if not transition.get("frames") or any(
                set(frame) != {"camera", "hero", "heroOccluders", "heroOcclusionMask", "lampLevel", "revealLevel"}
                or set(frame["camera"]) != {"position", "quaternion", "fov"}
                or len(frame["heroOccluders"]) != len(HERO_OCCLUDER_OBJECTS)
                or frame["heroOcclusionMask"].get("size") != HERO_OCCLUSION_MASK_SIZE
                or not frame["heroOcclusionMask"].get("rle")
                for frame in transition.get("frames", [])
            ):
                issues.append(f"{profile}: {destination} frames lack required projection fields")
        journal = transitions["desk-journal"]
        if journal["translationStartsAtSeconds"] < journal["journalHeadLeadSeconds"]:
            issues.append(f"{profile}: JOURNAL translation begins before the head lead completes")
        contact_transition = transitions["desk-contact"]
        desk_camera = endpoints["desk"]["projection"]["camera"]
        contact_camera = endpoints["contact"]["projection"]["camera"]
        if contact_camera == desk_camera or all(
            frame["camera"] == desk_camera for frame in contact_transition["frames"]
        ):
            issues.append(f"{profile}: CONTACT must use an authored lean/pan away from desk")
        levels = [frame["lampLevel"] for frame in contact_transition["frames"]]
        if not levels or levels[0] != 0.0 or levels[-1] != 1.0:
            issues.append(f"{profile}: CONTACT lamp/reveal must ramp from 0 to 1")
        navigation = variant.get("navigation", {})
        contact_data = variant.get("contact", {})
        journal_data = variant.get("journal", {})
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
            journal_data.get("mechanism") != "physical-text-geometry"
            or tuple(journal_data.get("copy", ())) != JOURNAL_COPY
            or len(journal_data.get("lineObjects", ())) != len(JOURNAL_COPY)
        ):
            issues.append(f"{profile}: physical JOURNAL copy metadata is incomplete")
        journal_coverage = endpoints.get("journal", {}).get("framing", {}).get("coverage", {}).get("notebook", 0.0)
        if not 0.4 <= journal_coverage <= 0.6:
            issues.append(
                f"{profile}: JOURNAL notebook coverage must be 0.4..0.6, got {journal_coverage}"
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
                        f"portrait: full Mesh_33 logo card must remain inside {endpoint} frame; quad={logo_quad}"
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
            lamp_quad = contact_data.get("lampScreenQuads", {}).get("contact")
            paper_quad = contact_data.get("paperScreenQuads", {}).get("contact")
            if not quad_intersects_frame(lamp_quad) or not quad_inside_frame(paper_quad, 0.01):
                issues.append(
                    f"portrait: CONTACT lean/pan must frame the current lamp and full contact paper; lamp={lamp_quad}, paper={paper_quad}"
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
) -> None:
    configure_render(scene, profile, samples)
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
            render_endpoint(scene, camera, profile, endpoint, output, samples)


def render_transition_frames(
    scene: bpy.types.Scene,
    camera: bpy.types.Object,
    authored: dict[str, Any],
    samples: int,
    only: set[str],
) -> None:
    for profile in PROFILE_IDS:
        set_profile_dressing(authored, profile)
        configure_render(scene, profile, samples)
        # configure_render defaults endpoint stills to JPEG. Transition
        # intermediates are lossless PNGs because the encoder reads %04d.png.
        scene.render.image_settings.file_format = "PNG"
        destinations = (("desk", OPENING_SECONDS),) + tuple(
            (destination, DESTINATION_SECONDS) for destination in DESTINATION_IDS
        )
        for destination, duration in destinations:
            source = "opening" if destination == "desk" else "desk"
            transition_id = f"{source}-{destination}"
            selector = f"{profile}:{transition_id}"
            if only and selector not in only:
                continue
            frame_count = round(duration * FPS) + 1
            output_dir = PUBLIC_ROOT / "_frames" / profile / transition_id
            output_dir.mkdir(parents=True, exist_ok=True)
            for frame_index in range(frame_count):
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
    parser.add_argument("--proof", action="store_true")
    parser.add_argument("--render-stills", action="store_true")
    parser.add_argument("--render-transitions", action="store_true")
    parser.add_argument("--samples", type=int)
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
        "destinations 0.9s; constant lens; JOURNAL head-first; CONTACT authored lean/pan."
    )
    only = set(args.only)
    if args.proof:
        render_endpoints(scene, camera, authored, proof=True, samples=args.samples or 8, only=only)
    if args.render_stills:
        render_endpoints(scene, camera, authored, proof=False, samples=args.samples or 192, only=only)
    if args.render_transitions:
        render_transition_frames(scene, camera, authored, samples=args.samples or 192, only=only)


if __name__ == "__main__":
    main()
