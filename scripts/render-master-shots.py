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
import json
import math
import os
import sys
from pathlib import Path
from typing import Any

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Quaternion, Vector


REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_ROOT = REPO_ROOT / "public" / "room"
MANIFEST_PATH = PUBLIC_ROOT / "manifest.json"
TYPESCRIPT_PATH = REPO_ROOT / "three" / "scene" / "plateManifest.ts"
SOURCE_BLEND = "build/wo-0117-r/master.blend"

FPS = 30
OPENING_SECONDS = 2.6
DESTINATION_SECONDS = 0.9
ENDPOINT_IDS = ("opening", "desk", "films", "journal", "contact", "about")
DESTINATION_IDS = ("films", "journal", "contact", "about")
PROFILE_IDS = ("wide", "portrait")
LENS_FOV = {"wide": 35.0, "portrait": 45.0}
RESOLUTION = {"wide": (1280, 720), "portrait": (375, 812)}

LOGO_OBJECT = "Mesh_33"
OBSOLETE_PINNED_LOGO = "Mesh_173"
CONTACT_PAPER = "Mesh_56"
HERO_OBJECT = "Mesh_170"
LAMP_ROOT = "scan_lamp_0"
NAV_SHEET = "ProductionNavigationSheet"
NAV_PREFIX = "ProductionNavigationRow_"
NAV_GLYPH_PREFIX = "ProductionNavigationGlyph_"
JOURNAL_PREFIX = "JournalPlaceholderLine_"
JOURNAL_PENCIL = "Mesh_53"
CONTACT_CUTTER = "ContactIndentationCutter"
CONTACT_NODE_GROUP = "CONTACT_INDENTATION_GEOMETRY_NODES"
CONTACT_MODIFIER = "CONTACT_INDENTATION_GEOMETRY_NODES"
CONTACT_LIGHT = "ContactRakingLight"
CONTACT_BULB = "ContactEmissiveBulb"

NAV_WIDTH = 0.30
NAV_HEIGHT = 0.20
NAV_THICKNESS = 0.0007
NAV_INCLINE = math.radians(7.0)
NAV_YAW = math.radians(-5.0)
NAV_CENTER_X = -0.115
NAV_CENTER_Y = -0.265
DESK_HEIGHT = 0.9
HANDWRITING_FONT_PATH = Path("/System/Library/Fonts/Noteworthy.ttc")
NAV_LABEL_WIDTH = 0.265
CONTACT_PAPER_POSITION = (-0.35, -0.04)
CONTACT_PAPER_YAW = math.radians(4.5)
NAV_ROWS = (
    {"id": "films", "label": "FILMS", "rect": {"x": 0.015, "y": 0.018, "width": 0.27, "height": 0.026}},
    {"id": "journal", "label": "JOURNAL", "rect": {"x": 0.015, "y": 0.062, "width": 0.27, "height": 0.026}},
    {"id": "contact", "label": "CONTACT", "rect": {"x": 0.015, "y": 0.106, "width": 0.27, "height": 0.026}},
    {"id": "about", "label": "ABOUT", "rect": {"x": 0.015, "y": 0.150, "width": 0.27, "height": 0.026}},
)


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
    exact_names = {NAV_SHEET, CONTACT_CUTTER, CONTACT_LIGHT, CONTACT_BULB, "AuthoredPlateCamera"}
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
    card.location.x = -0.01
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


def create_text_mesh(
    name: str,
    body: str,
    size: float,
    extrude: float,
    material: bpy.types.Material | None = None,
    align_x: str = "CENTER",
    font: bpy.types.VectorFont | None = None,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}Curve", "FONT")
    curve.body = body
    curve.align_x = align_x
    curve.align_y = "CENTER"
    if font is not None:
        curve.font = font
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = min(extrude * 0.25, 0.00003)
    curve.bevel_resolution = 1
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
    glyph_baselines = (-0.00055, 0.0003, -0.00015, 0.00045, -0.00035, 0.0001, 0.0004)
    glyph_rotations = (-0.012, 0.006, -0.004, 0.009, -0.007, 0.003, 0.008)
    glyph_scales = (0.98, 1.02, 1.0, 1.015, 0.985, 1.01, 0.995)
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

        row_start = -NAV_WIDTH / 2.0 + rect["x"] + 0.004 + row_offsets[index]
        cursor_x = row_start
        row_glyphs: list[bpy.types.Object] = []
        for glyph_index, character in enumerate(row["label"]):
            variation = index * 3 + glyph_index
            pressure = 0.000012 + (variation % 3) * 0.000004
            glyph = create_text_mesh(
                f"{NAV_GLYPH_PREFIX}{index + 1}_{glyph_index + 1}_{character}",
                character,
                size=0.021,
                extrude=pressure,
                material=graphite_materials[variation % len(graphite_materials)],
                font=font,
            )
            glyph.scale.x *= glyph_scales[variation % len(glyph_scales)]
            glyph.scale.y *= glyph_scales[(variation + 2) % len(glyph_scales)]
            tracking = (-0.0007, 0.00025, -0.00015, 0.00055, -0.00035)[variation % 5]
            advance = max(glyph.dimensions.x * glyph.scale.x, 0.0105) + 0.0014 + tracking
            glyph.parent = sheet
            glyph.location = (
                cursor_x + advance / 2.0,
                row_y + glyph_baselines[variation % len(glyph_baselines)],
                NAV_THICKNESS / 2.0 + 0.000018,
            )
            glyph.rotation_euler = (
                0.0,
                0.0,
                glyph_rotations[variation % len(glyph_rotations)],
            )
            glyph["lazy_a_destination"] = row["id"]
            glyph["lazy_a_marking"] = "graphite-pressure-varied"
            glyph["lazy_a_font_family"] = "Noteworthy"
            row_glyphs.append(glyph)
            cursor_x += advance
        natural_width = max(cursor_x - row_start - 0.0014, 1e-6)
        horizontal_factor = NAV_LABEL_WIDTH / natural_width
        for glyph in row_glyphs:
            glyph.location.x = row_start + (glyph.location.x - row_start) * horizontal_factor
            glyph.scale.x *= horizontal_factor
        labels[row["id"]] = row_glyphs
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
        ("CONTACT@", 0.190, 0.055),
        ("LAZYA", 0.145, 0.000),
        ("PRODUCTIONS.COM", 0.235, -0.055),
    )
    for index, (body, target_width, local_y) in enumerate(lines):
        part = create_text_mesh(
            f"{CONTACT_CUTTER}_{index + 1}",
            body,
            0.021,
            0.00020,
        )
        if part.dimensions.x > 0:
            factor = target_width / part.dimensions.x
            part.scale.x *= factor
            part.scale.y *= factor
            # Bake the fitted glyph width before the parts are joined. Leaving
            # this scale live made the joined cutter render much narrower than
            # its authored bounds.
            part.select_set(True)
            bpy.context.view_layer.objects.active = part
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            part.select_set(False)
        # The cutter overlaps only the upper 0.15 mm of Mesh_56. This leaves a
        # pressure groove instead of punching readable letters through it.
        part.matrix_world = normalized_surface_matrix(
            sheet, 0.0, local_y, 0.00005
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
    return cutter


def add_contact_geometry_nodes(sheet: bpy.types.Object, cutter: bpy.types.Object) -> bpy.types.Modifier:
    for modifier in list(sheet.modifiers):
        if modifier.name.startswith(CONTACT_MODIFIER):
            sheet.modifiers.remove(modifier)

    group = bpy.data.node_groups.new(CONTACT_NODE_GROUP, "GeometryNodeTree")
    group.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    group.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nodes = group.nodes
    links = group.links
    group_input = nodes.new("NodeGroupInput")
    group_output = nodes.new("NodeGroupOutput")
    object_info = nodes.new("GeometryNodeObjectInfo")
    object_info.transform_space = "RELATIVE"
    object_info.inputs["Object"].default_value = cutter
    realize = nodes.new("GeometryNodeRealizeInstances")
    boolean = nodes.new("GeometryNodeMeshBoolean")
    boolean.operation = "DIFFERENCE"
    links.new(group_input.outputs["Geometry"], boolean.inputs["Mesh 1"])
    links.new(object_info.outputs["Geometry"], realize.inputs["Geometry"])
    links.new(realize.outputs["Geometry"], boolean.inputs["Mesh 2"])
    links.new(boolean.outputs["Mesh"], group_output.inputs["Geometry"])

    modifier = sheet.modifiers.new(CONTACT_MODIFIER, "NODES")
    modifier.node_group = group
    sheet["lazy_a_contact_mechanism"] = "geometry-nodes-indentation"
    sheet["lazy_a_contact_copy"] = "CONTACT@LAZYAPRODUCTIONS.COM"
    return modifier


def author_contact_indentation() -> bpy.types.Object:
    sheet = require_object(CONTACT_PAPER, "MESH")
    position_contact_sheet(sheet)
    cutter = create_contact_cutter(sheet)
    add_contact_geometry_nodes(sheet, cutter)
    return sheet


def evaluated_contact_stats(sheet: bpy.types.Object) -> dict[str, int]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = sheet.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        return {
            "baseVertices": len(sheet.data.vertices),
            "evaluatedVertices": len(mesh.vertices),
            "basePolygons": len(sheet.data.polygons),
            "evaluatedPolygons": len(mesh.polygons),
        }
    finally:
        evaluated.to_mesh_clear()


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
    light["lazy_a_contact_energy"] = 75.0
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
        obj for obj in (lamp, *lamp.children_recursive) if obj.type == "MESH"
    ]
    notebook = unhide_notebook()
    journal_pencil = reposition_journal_pencil()
    journal_copy = author_journal_copy()
    bpy.context.view_layer.update()
    contact_stats = evaluated_contact_stats(contact_sheet)
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
        "desk": {"position": (0.05, 1.6, 1.45), "target": (0.02, 1.04, -0.45)},
        "films": {"position": (0.05, 1.6, 1.45), "target": (0.55, 1.27, -0.45)},
        "journal": {"position": (0.31, 1.06, 0.35), "target": (0.35, 0.91, 0.12)},
        "contact": {"position": (-0.38, 1.32, 1.20), "target": (-0.40, 0.91, 0.0)},
        "about": {"position": (0.02, 1.58, 1.45), "target": (-1.28, 1.22, -0.08)},
    },
    "portrait": {
        "opening": {"position": (-0.04, 1.62, 5.15), "target": (0.18, 0.98, -0.02)},
        "desk": {"position": (-0.50, 1.82, 1.72), "target": (0.20, 1.10, -0.18)},
        "films": {"position": (0.05, 1.70, 1.75), "target": (0.55, 1.27, -0.45)},
        "journal": {"position": (0.30, 1.075, 0.44), "target": (0.30, 0.91, 0.12)},
        "contact": {"position": (-0.40, 1.70, 1.55), "target": (-0.40, 0.91, -0.02)},
        "about": {"position": (0.22, 1.58, 2.27), "target": (-1.18, 1.24, -0.08)},
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


def transition_sample(
    profile: str,
    destination: str,
    frame_index: int,
    frame_count: int,
) -> tuple[Vector, Quaternion, float]:
    start_name = "opening" if destination == "desk" else "desk"
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

    if destination == "desk":
        envelope = math.sin(math.pi * raw_t)
        phase = raw_t * OPENING_SECONDS * 1.75 * math.tau
        position.z -= 0.011 * (0.5 + 0.5 * math.sin(phase)) * envelope
        position.x += 0.0055 * math.sin(phase / 2.0) * envelope

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
    navigation = navigation_geometry(authored["navigation"])
    contact_world = [
        blender_to_three(point)
        for point in local_face_points(authored["contact"], 2, "max")
    ]

    for profile in PROFILE_IDS:
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
        profile_navigation = dict(navigation)
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
                "mechanism": "geometry-nodes-indentation",
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
                "geometryStats": authored["contactStats"],
                "addressCopy": "CONTACT@LAZYAPRODUCTIONS.COM",
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
    mechanism: \"geometry-nodes-indentation\";
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
    geometryStats: { baseVertices: number; evaluatedVertices: number; basePolygons: number; evaluatedPolygons: number };
    addressCopy: "CONTACT@LAZYAPRODUCTIONS.COM";
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
    serialized = json.dumps(manifest, indent=2, sort_keys=False, ensure_ascii=True)
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
        issues.append("scan_lamp_0 transform changed while authoring CONTACT light")
    card = authored["card"]
    if card.name != LOGO_OBJECT or card.get("lazy_a_logo_geometry_created") is not False:
        issues.append("Lazy A logo must reuse Mesh_33 without new card geometry")
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
    node_modifiers = [modifier for modifier in contact.modifiers if modifier.type == "NODES"]
    if not node_modifiers or contact.get("lazy_a_contact_mechanism") != "geometry-nodes-indentation":
        issues.append("Mesh_56 must use geometry-nodes indentation")
    if len(authored.get("journalCopy", [])) != len(JOURNAL_COPY):
        issues.append("notebook must carry all eight approved physical placeholder lines")
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
        contact_stats.get("evaluatedVertices", 0) <= contact_stats.get("baseVertices", 0)
        or contact_stats.get("evaluatedPolygons", 0) <= contact_stats.get("basePolygons", 0)
    ):
        issues.append("Mesh_56 evaluated Geometry Nodes output must contain boolean-cut topology")

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
            if transition["duration"] != DESTINATION_SECONDS:
                issues.append(f"{profile}: {destination} must be exactly {DESTINATION_SECONDS}s")
            if not transition.get("frames") or any(
                set(frame) != {"camera", "hero", "lampLevel", "revealLevel"}
                or set(frame["camera"]) != {"position", "quaternion", "fov"}
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
                        f"portrait: full navigation sheet must remain inside {endpoint} frame"
                    )
                logo_quad = variant.get("logo", {}).get("screenQuads", {}).get(endpoint)
                if not quad_inside_frame(logo_quad, 0.02):
                    issues.append(
                        f"portrait: full Mesh_33 logo card must remain inside {endpoint} frame"
                    )
                for row in NAV_ROWS:
                    label_quad = navigation.get("labelScreenQuads", {}).get(endpoint, {}).get(row["id"])
                    label_width = quad_pixel_width(label_quad, variant["width"])
                    if label_width < 135.0:
                        issues.append(
                            f"portrait: {row['label']} must be at least 135px wide at {endpoint}, got {label_width}"
                        )
            lamp_quad = contact_data.get("lampScreenQuads", {}).get("contact")
            paper_quad = contact_data.get("paperScreenQuads", {}).get("contact")
            if not quad_intersects_frame(lamp_quad) or not quad_inside_frame(paper_quad, 0.01):
                issues.append(
                    "portrait: CONTACT lean/pan must frame the current lamp and full contact paper"
                )
        address_quad = contact_data.get("addressScreenQuads", {}).get("contact")
        if not quad_inside_frame(address_quad, 0.02):
            issues.append(f"{profile}: CONTACT indentation must be fully visible at CONTACT")
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
    proof: bool,
    samples: int,
    only: set[str],
) -> None:
    for profile in PROFILE_IDS:
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
    samples: int,
    only: set[str],
) -> None:
    for profile in PROFILE_IDS:
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
        render_endpoints(scene, camera, proof=True, samples=args.samples or 8, only=only)
    if args.render_stills:
        render_endpoints(scene, camera, proof=False, samples=args.samples or 192, only=only)
    if args.render_transitions:
        render_transition_frames(scene, camera, samples=args.samples or 192, only=only)


if __name__ == "__main__":
    main()
