"""Build B03 from the approved brief, export GLB, and render seven views."""
from pathlib import Path
import json
import math
import struct
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "public" / "models" / "blasters"
RENDER_DIR = ROOT / "art" / "blasters" / "B03" / "renders"
GLB_PATH = OUT_DIR / "B03.glb"

PURPLE = "#9b5cff"
CHARCOAL = "#2b2b33"
YELLOW = "#ffd23f"
ORANGE = "#ff7a1a"
PINK = "#ff4fa3"
BLUE = "#2ec4ff"
BACKGROUND = (0.72, 0.72, 0.72, 1.0)
ROUGHNESS = 0.4
SHELL_ALPHA = 0.5
BEVEL = 0.003
SMALL_BEVEL = 0.001

BODY_L, BODY_H, BODY_W = 0.14, 0.07, 0.055
BODY_Y, BODY_Z = 0.04, 0.07
PANEL_L, PANEL_H, PANEL_DEPTH = 0.085, 0.034, 0.003
HINGE_ORIGIN = (0.0, 0.105, 0.04)
HINGE_RADIUS, HINGE_W = 0.009, 0.065

STOCK_BACK, STOCK_FRONT = -0.34, -0.018
STOCK_TOP, STOCK_BOTTOM, STOCK_W = 0.07, -0.07, 0.045
BUTT_L, BUTT_H, BUTT_W = 0.022, 0.145, 0.052
GRIP_H, GRIP_D, GRIP_W = 0.10, 0.045, 0.035
GRIP_TOP, GRIP_ANGLE = 0.04, math.radians(15)
GRIP_CORNER = 0.010
GRIP_TEX_SIZE, GRIP_TEX_RIBS = 128, 8
GUARD_W = 0.024
TRIGGER_H, TRIGGER_D, TRIGGER_W = 0.025, 0.012, 0.008
TRIGGER_ORIGIN = (0.0, 0.014, 0.037)

BARREL_BACK, BARREL_FRONT = 0.04, 0.46
BARREL_L = BARREL_FRONT - BARREL_BACK
BARREL_Y = (BARREL_FRONT + BARREL_BACK) / 2
BARREL_Z, BARREL_X = 0.09, 0.018
BARREL_OUTER, BARREL_INNER = 0.017, 0.0153
TIP_L, TIP_OUTER = 0.02, 0.019
RIB_W, RIB_H = 0.012, 0.004
FORE_L, FORE_H, FORE_W = 0.16, 0.04, 0.06
FORE_Y, FORE_Z = 0.24, 0.052
QUAD_Z = BARREL_Z - 0.038

SHELL_L, SHELL_OUTER, SHELL_INNER = 0.07, 0.0148, 0.0132
SHELL_Y = BARREL_BACK + SHELL_L / 2
DART_R, DART_L = 0.0027, 0.049
LATCH_L, LATCH_H, LATCH_W = 0.05, 0.012, 0.02
LATCH_ORIGIN = (0.0, 0.015, BODY_Z + BODY_H / 2)

RESOLUTION = (1024, 768)
ORTHO_SCALE = 0.90
EYE_CAMERA_LOC = (-0.28, -0.68, 0.17)
EYE_CAMERA_LENS = 40
LIGHT_ENERGY = (25.0, 18.0, 22.0)
LIGHT_SIZE = 0.8


def rgba(hex_colour, alpha=1.0):
    h = hex_colour.lstrip("#")
    srgb = tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    linear = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
                   for c in srgb)
    return linear + (alpha,)


def material(name, colour, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba(colour, alpha)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba(colour, alpha)
    bsdf.inputs["Roughness"].default_value = ROUGHNESS
    bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1.0:
        mat.surface_render_method = "DITHERED"
    return mat


def grip_material():
    mat = material("Grip charcoal", CHARCOAL)
    size = GRIP_TEX_SIZE
    image = bpy.data.images.new("Grip horizontal ribs", width=size, height=size,
                                alpha=False)
    image.colorspace_settings.name = "Non-Color"
    pixels = []
    for y in range(size):
        slope = 2.0 * math.cos(math.tau * GRIP_TEX_RIBS * (y + 0.5) / size)
        normal_y = -slope / math.sqrt(1 + slope * slope)
        normal_z = 1 / math.sqrt(1 + slope * slope)
        for _ in range(size):
            pixels.extend((0.5, 0.5 + normal_y * 0.5,
                           0.5 + normal_z * 0.5, 1.0))
    image.pixels.foreach_set(pixels)
    image.pack()
    nodes = mat.node_tree.nodes
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    normal = nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.18
    mat.node_tree.links.new(texture.outputs["Color"], normal.inputs["Color"])
    mat.node_tree.links.new(normal.outputs["Normal"],
                            nodes["Principled BSDF"].inputs["Normal"])
    return mat


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_modifier(obj, mod):
    activate(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def bevel(obj, width=BEVEL, segments=2):
    if width:
        mod = obj.modifiers.new("Soft toy edges", "BEVEL")
        mod.width = width
        mod.segments = segments
        apply_modifier(obj, mod)
        normal = obj.modifiers.new("Face normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
        apply_modifier(obj, normal)
    return obj


def mesh_object(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def box(name, loc, dims, mat, edge=BEVEL, segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return bevel(obj, edge, segments)


def profile(name, points, width, mat, edge=BEVEL):
    count = len(points)
    vertices = [(x, y, z) for x in (-width / 2, width / 2) for y, z in points]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count)
              for i in range(count)]
    return bevel(mesh_object(name, vertices, faces, mat), edge)


def cylinder(name, loc, radius, depth, mat, vertices=20, edge=SMALL_BEVEL,
             axis="Y"):
    rotations = {"X": (0, math.pi / 2, 0), "Y": (math.pi / 2, 0, 0),
                 "Z": (0, 0, 0)}
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                      location=loc, rotation=rotations[axis])
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return bevel(obj, edge, 1)


def tube(name, loc, outer, inner, depth, mat, segments=24):
    vertices = []
    for y, radius in ((-depth / 2, outer), (depth / 2, outer),
                      (-depth / 2, inner), (depth / 2, inner)):
        vertices += [(radius * math.cos(i * math.tau / segments), y,
                      radius * math.sin(i * math.tau / segments)) for i in range(segments)]
    faces = []
    for i in range(segments):
        j = (i + 1) % segments
        faces += [(i, j, segments + j, segments + i),
                  (2 * segments + j, 2 * segments + i, 3 * segments + i, 3 * segments + j),
                  (j, i, 2 * segments + i, 2 * segments + j),
                  (segments + i, segments + j, 3 * segments + j, 3 * segments + i)]
    obj = mesh_object(name, vertices, faces, mat)
    obj.location = loc
    for face in obj.data.polygons:
        face.use_smooth = face.index % 4 < 2
    return bevel(obj, SMALL_BEVEL, 2)


def rounded_grip(mat):
    ring_specs = [
        (0.040, 0.78), (0.038, 0.93), (0.035, 1.0),
        (0.027, 1.0), (0.015, 1.025), (0.0, 1.055),
        (-0.015, 1.06), (-0.030, 1.03), (-0.045, 1.0),
        (-0.054, 1.08), (-0.057, 1.04), (GRIP_TOP - GRIP_H, 0.82),
    ]
    corner_segments = 8
    count = corner_segments * 4
    vertices = []
    ring_scales = []
    for z, scale in ring_specs:
        half_x = GRIP_W * scale / 2
        half_y = GRIP_D * scale / 2
        radius = GRIP_CORNER * scale
        centre_y = -GRIP_D / 2 - math.tan(GRIP_ANGLE) * (GRIP_TOP - z)
        corners = [
            (half_x - radius, half_y - radius, 0),
            (-half_x + radius, half_y - radius, 90),
            (-half_x + radius, -half_y + radius, 180),
            (half_x - radius, -half_y + radius, 270),
        ]
        for cx, cy, start in corners:
            for i in range(corner_segments):
                angle = math.radians(start + 90 * i / corner_segments)
                vertices.append((cx + radius * math.cos(angle),
                                 centre_y + cy + radius * math.sin(angle), z))
        ring_scales.append(scale)

    faces = []
    face_uvs = []

    def cap_uv(indices, scale):
        return [(vertices[index][0] / (GRIP_W * scale) + 0.5,
                 (vertices[index][1] + GRIP_D / 2
                  + math.tan(GRIP_ANGLE) * (GRIP_TOP - vertices[index][2]))
                 / (GRIP_D * scale) + 0.5) for index in indices]

    top = tuple(range(count))
    faces.append(top)
    face_uvs.append(cap_uv(top, ring_scales[0]))
    for ring in range(len(ring_specs) - 1):
        upper = ring * count
        lower = (ring + 1) * count
        v_top = ring / (len(ring_specs) - 1)
        v_bottom = (ring + 1) / (len(ring_specs) - 1)
        for i in range(count):
            j = (i + 1) % count
            faces.append((upper + i, lower + i, lower + j, upper + j))
            face_uvs.append(((i / count, v_top), (i / count, v_bottom),
                             ((i + 1) / count, v_bottom),
                             ((i + 1) / count, v_top)))
    bottom = tuple(reversed(range((len(ring_specs) - 1) * count,
                                  len(ring_specs) * count)))
    faces.append(bottom)
    face_uvs.append(cap_uv(bottom, ring_scales[-1]))

    obj = mesh_object("Smooth pistol wrist", vertices, faces, mat)
    uv = obj.data.uv_layers.new(name="UV" + "Map")
    for polygon, coordinates in zip(obj.data.polygons, face_uvs):
        for loop, coordinate in zip(polygon.loop_indices, coordinates):
            uv.data[loop].uv = coordinate
        polygon.use_smooth = True
    return obj


def rounded_foreend(mat, name="Smooth chunky fore-end", z=FORE_Z):
    ring_specs = [(-0.080, 0.70), (-0.078, 0.88), (-0.072, 0.97),
                  (-0.062, 1.0), (-0.035, 1.02), (0.0, 1.025),
                  (0.035, 1.02), (0.062, 1.0), (0.072, 0.97),
                  (0.078, 0.88), (0.080, 0.70)]
    corner_segments = 8
    count = corner_segments * 4
    vertices = []
    for y, scale in ring_specs:
        half_x = FORE_W * scale / 2
        half_z = FORE_H * scale / 2
        radius = 0.012 * scale
        corners = [
            (half_x - radius, half_z - radius, 0),
            (-half_x + radius, half_z - radius, 90),
            (-half_x + radius, -half_z + radius, 180),
            (half_x - radius, -half_z + radius, 270),
        ]
        for cx, cz, start in corners:
            for i in range(corner_segments):
                angle = math.radians(start + 90 * i / corner_segments)
                vertices.append((cx + radius * math.cos(angle), FORE_Y + y,
                                 z + cz + radius * math.sin(angle)))
    faces = [tuple(reversed(range(count)))]
    face_uvs = [[(vertices[i][0] / FORE_W + 0.5,
                  vertices[i][2] / FORE_H + 0.5) for i in reversed(range(count))]]
    for ring in range(len(ring_specs) - 1):
        for i in range(count):
            j = (i + 1) % count
            a = ring * count
            b = (ring + 1) * count
            faces.append((a + i, a + j, b + j, b + i))
            u0, u1 = i / count, (i + 1) / count
            v0 = ring / (len(ring_specs) - 1) * 3
            v1 = (ring + 1) / (len(ring_specs) - 1) * 3
            face_uvs.append(((u0, v0), (u1, v0), (u1, v1), (u0, v1)))
    last = tuple(range((len(ring_specs) - 1) * count, len(ring_specs) * count))
    faces.append(last)
    face_uvs.append([(vertices[i][0] / FORE_W + 0.5,
                      vertices[i][2] / FORE_H + 0.5) for i in last])
    obj = mesh_object(name, vertices, faces, mat)
    uv = obj.data.uv_layers.new(name="UV" + "Map")
    for polygon, coordinates in zip(obj.data.polygons, face_uvs):
        for loop, coordinate in zip(polygon.loop_indices, coordinates):
            uv.data[loop].uv = coordinate
        polygon.use_smooth = True
    return obj


def join_at(objects, name, origin):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = origin
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return obj


def parent_keep_world(obj, parent):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def oval_panel(name, loc, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1,
                                       location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (PANEL_DEPTH, PANEL_L / 2, PANEL_H / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def build_static(purple, charcoal, grip_charcoal, yellow):
    static = []
    receiver = box("Rounded action", (0, BODY_Y, BODY_Z),
                   (BODY_W, BODY_L, BODY_H), purple, 0.006, 3)
    cutters = [cylinder("Chamber channel " + str(index),
                        (side * BARREL_X, 0.07, z),
                        BARREL_OUTER + 0.0008, 0.10, purple, 24, 0)
               for index, (side, z) in enumerate(
                   ((x, z) for x in (-1, 1) for z in (BARREL_Z, QUAD_Z)), 1)]
    cutter = join_at(cutters, "Chamber channel cutters", (0, 0, 0))
    mod = receiver.modifiers.new("Open chamber channels", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    apply_modifier(receiver, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)
    bevel(receiver, 0.0008, 2)
    static.append(receiver)
    for side in (-1, 1):
        static.append(oval_panel("Raised oval side panel",
                                 (side * (BODY_W / 2 + 0.0005), 0.035, 0.073),
                                 yellow))
    static.append(cylinder("Action hinge pin", HINGE_ORIGIN, HINGE_RADIUS,
                           HINGE_W, purple, 24, SMALL_BEVEL, "X"))
    static.append(box("Standing breech face", (0, 0.034, 0.080),
                      (0.068, 0.012, 0.070), purple, 0.003))

    stock_points = [
        (-0.318, 0.060), (-0.250, 0.055), (-0.120, 0.035),
        (-0.055, 0.035), (STOCK_FRONT, 0.040), (STOCK_FRONT, -0.025),
        (-0.050, -0.040), (-0.090, -0.020), (-0.150, -0.025),
        (-0.250, -0.045), (-0.318, -0.060),
    ]
    static.append(profile("Solid shoulder stock", stock_points, STOCK_W,
                          charcoal, 0.006))
    static.append(box("Rounded rubber butt pad",
                      (0, STOCK_BACK + BUTT_L / 2, 0),
                      (BUTT_W, BUTT_L, BUTT_H), charcoal, 0.008, 4))
    static.append(rounded_grip(grip_charcoal))

    guard_outer = [(-0.006, 0.015), (0.006, 0.005), (0.050, 0.005),
                   (0.065, 0.018), (0.063, 0.037), (0.055, 0.043),
                   (-0.002, 0.043)]
    guard_inner = [(0.006, 0.017), (0.014, 0.012), (0.049, 0.012),
                   (0.057, 0.019), (0.055, 0.032), (0.050, 0.037),
                   (0.007, 0.037)]
    guard = profile("Normal trigger guard", guard_outer, GUARD_W, charcoal)
    cutter = profile("Guard opening", guard_inner, GUARD_W + 0.02, charcoal, 0)
    mod = guard.modifiers.new("Open guard", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    apply_modifier(guard, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)
    bevel(guard, 0.0008, 2)
    static.append(guard)

    for obj in static:
        if obj.name != "Smooth pistol wrist":
            while obj.data.uv_layers:
                obj.data.uv_layers.remove(obj.data.uv_layers[0])
    body = join_at(static, "body", (0, 0, 0))

    trigger_points = []
    for i in range(9):
        t = i / 8
        front_y = 0.005 - 0.020 * t * (1 - t) + 0.001 * t ** 3
        trigger_points.append((front_y, TRIGGER_H * t))
    for i in reversed(range(9)):
        t = i / 8
        front_y = 0.005 - 0.020 * t * (1 - t) + 0.001 * t ** 3
        trigger_points.append((front_y - TRIGGER_D / 2, TRIGGER_H * t))
    trigger = profile("trigger", trigger_points, TRIGGER_W, yellow, SMALL_BEVEL)
    trigger.location = TRIGGER_ORIGIN
    trigger.rotation_euler.y = math.pi

    latch_parts = [box("Top latch lever",
                       (0, LATCH_ORIGIN[1] - LATCH_L / 2,
                        LATCH_ORIGIN[2] + LATCH_H / 2),
                       (LATCH_W, LATCH_L, LATCH_H), yellow, 0.003, 3),
                   cylinder("Latch vertical pivot",
                            (0, LATCH_ORIGIN[1], LATCH_ORIGIN[2] + LATCH_H / 2),
                            0.008, LATCH_H, yellow, 20, SMALL_BEVEL, "Z")]
    latch = join_at(latch_parts, "latch", LATCH_ORIGIN)
    return body, trigger, latch


def make_shell(name, x, z, pink, yellow, blue, orange):
    parts = [tube(name + " clear tube", (x, SHELL_Y, z), SHELL_OUTER,
                  SHELL_INNER, SHELL_L, pink, 20),
             cylinder(name + " yellow base", (x, BARREL_BACK + SHELL_L - 0.004, z),
                      SHELL_OUTER - 0.0003, 0.008, yellow, 20, SMALL_BEVEL)]
    dart_positions = [(0.0, 0.0)] + [
        (0.0085 * math.cos(i * math.tau / 7),
         0.0085 * math.sin(i * math.tau / 7)) for i in range(7)]
    for dx, dz in dart_positions:
        parts.append(cylinder(name + " blue dart",
                              (x + dx, BARREL_BACK + 0.0265, z + dz),
                              DART_R, DART_L - 0.006, blue, 10, 0))
        parts.append(cylinder(name + " orange dart end",
                              (x + dx, BARREL_BACK + 0.002, z + dz),
                              DART_R, 0.006, orange, 10, 0))
    for obj in parts:
        while obj.data.uv_layers:
            obj.data.uv_layers.remove(obj.data.uv_layers[0])
    return join_at(parts, name, (x, SHELL_Y, z))


def add_muzzle(name, x, z, parent):
    muzzle = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(muzzle)
    muzzle.location = (x, BARREL_FRONT, z)
    muzzle.empty_display_size = 0.01
    parent_keep_world(muzzle, parent)
    return muzzle


def build_model():
    purple = material("Foam purple", PURPLE)
    charcoal = material("Charcoal", CHARCOAL)
    grip_charcoal = grip_material()
    yellow = material("Foam yellow", YELLOW)
    orange = material("Safety orange", ORANGE)
    pink = material("Clear pink", PINK, SHELL_ALPHA)
    blue = material("Dart blue", BLUE)
    body, trigger, latch = build_static(purple, charcoal, grip_charcoal, yellow)

    moving = []
    for side in (-1, 1):
        moving.append(tube("Fat barrel", (side * BARREL_X, BARREL_Y, BARREL_Z),
                           BARREL_OUTER, BARREL_INNER, BARREL_L, purple, 24))
        moving.append(tube("Orange muzzle ring",
                           (side * BARREL_X, BARREL_FRONT - TIP_L / 2, BARREL_Z),
                           TIP_OUTER, BARREL_INNER, TIP_L, orange, 24))
    moving.append(box("Flat top rib", (0, BARREL_Y, BARREL_Z + 0.019),
                      (RIB_W, BARREL_L - 0.02, RIB_H), purple, SMALL_BEVEL))
    moving.append(cylinder("Yellow bead front sight",
                           (0, BARREL_FRONT - 0.025, BARREL_Z + 0.024),
                           0.0035, 0.006, yellow, 16, SMALL_BEVEL, "Z"))
    for obj in moving:
        while obj.data.uv_layers:
            obj.data.uv_layers.remove(obj.data.uv_layers[0])
    breach = join_at(moving, "breach", HINGE_ORIGIN)
    fore_end = rounded_foreend(grip_charcoal)
    fore_end.name = "fore-end"
    parent_keep_world(fore_end, breach)

    shells = []
    for index, side in enumerate((-1, 1), 1):
        shell = make_shell("shell_" + str(index), side * BARREL_X, BARREL_Z,
                           pink, yellow, blue, orange)
        parent_keep_world(shell, breach)
        shells.append(shell)
        add_muzzle("muzzle_" + str(index), side * BARREL_X, BARREL_Z, breach)

    mod_parts = []
    for side in (-1, 1):
        mod_parts.append(tube("Quad barrel", (side * BARREL_X, BARREL_Y, QUAD_Z),
                              BARREL_OUTER, BARREL_INNER, BARREL_L, purple, 24))
        mod_parts.append(tube("Quad orange muzzle",
                              (side * BARREL_X, BARREL_FRONT - TIP_L / 2, QUAD_Z),
                              TIP_OUTER, BARREL_INNER, TIP_L, orange, 24))
    mod_parts.append(box("Quad top rib", (0, BARREL_Y, QUAD_Z + 0.019),
                         (RIB_W, BARREL_L - 0.02, RIB_H), purple, SMALL_BEVEL))
    mod_parts.append(rounded_foreend(
        grip_charcoal, "Quad smooth fore-end",
        QUAD_Z - FORE_H / 2 - BARREL_OUTER - 0.001))
    for obj in mod_parts:
        if obj.name != "Quad smooth fore-end":
            while obj.data.uv_layers:
                obj.data.uv_layers.remove(obj.data.uv_layers[0])
    mod_quad = join_at(mod_parts, "mod_quad", (0, BARREL_Y, QUAD_Z))
    mod_quad["hidden"] = True
    parent_keep_world(mod_quad, breach)
    for index, side in enumerate((-1, 1), 3):
        shell = make_shell("shell_" + str(index), side * BARREL_X, QUAD_Z,
                           pink, yellow, blue, orange)
        parent_keep_world(shell, mod_quad)
        shells.append(shell)
        add_muzzle("muzzle_" + str(index), side * BARREL_X, QUAD_Z, mod_quad)
    for obj in [mod_quad] + [o for o in bpy.data.objects if o.parent == mod_quad]:
        obj.hide_render = True
        obj.hide_set(True)
    return body, breach, trigger, latch, mod_quad


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera(name, loc, target=None, ortho=True):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    if target is None:
        obj.rotation_euler = (0, 0, 0)
    else:
        point_at(obj, target)
    data.clip_start = 0.005
    data.clip_end = 100
    if ortho:
        data.type = "ORTHO"
        data.ortho_scale = ORTHO_SCALE
    else:
        data.lens = EYE_CAMERA_LENS
    return obj


def area_light(name, loc, energy, target):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = LIGHT_SIZE
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    point_at(obj, target)


def render_views(breach, latch):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    world = bpy.data.worlds.new("Light grey studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = BACKGROUND
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
    scene.world = world
    target = (0, 0.06, 0.02)
    area_light("Key softbox", (0.65, 0.45, 1.1), LIGHT_ENERGY[0], target)
    area_light("Fill softbox", (-0.7, 0.1, 0.5), LIGHT_ENERGY[1], target)
    area_light("Rear softbox", (0.1, -0.8, 0.8), LIGHT_ENERGY[2], target)

    views = [
        ("side", add_camera("Side camera", (1.2, 0.06, 0.02), target)),
        ("three-quarter", add_camera("Three quarter camera",
                                    (0.95, 1.0, 0.65), target)),
        ("top", add_camera("Top camera", (0, 0.06, 1.3))),
    ]
    views[2][1].rotation_euler.z = math.pi / 2
    eye = add_camera("First person camera", EYE_CAMERA_LOC, ortho=False)
    point_at(eye, (-0.04, 0.55, 0.16))
    views.append(("first-person", eye))
    for name, camera in views:
        scene.camera = camera
        scene.render.filepath = str(RENDER_DIR / (name + ".png"))
        bpy.ops.render.render(write_still=True)
        print("Rendered", scene.render.filepath)

    closeup = add_camera("Trigger closeup camera", (1.2, 0.03, 0.023),
                         (0, 0.03, 0.023))
    closeup.data.ortho_scale = 0.11
    scene.camera = closeup
    scene.render.resolution_x, scene.render.resolution_y = (512, 512)
    scene.render.filepath = str(RENDER_DIR / "trigger-closeup.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered", scene.render.filepath)

    breach.rotation_euler.x = math.radians(-40)
    latch.rotation_euler.z = math.radians(30)
    bpy.context.view_layer.update()
    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
    open_target = (0, 0.07, -0.035)
    open_views = [
        ("open-side", add_camera("Open side camera", (1.2, -0.28, 0.18),
                                open_target)),
        ("open-three-quarter", add_camera("Open three quarter camera",
                                         (0.85, -0.75, 0.55), open_target)),
    ]
    for name, camera in open_views:
        scene.camera = camera
        scene.render.filepath = str(RENDER_DIR / (name + ".png"))
        bpy.ops.render.render(write_still=True)
        print("Rendered", scene.render.filepath)


def canonicalise_glb(path):
    """Stable triangle order and one material for identical exporter copies."""
    data = bytearray(path.read_bytes())
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + json_length])
    bin_start = 20 + json_length + 8
    formats = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4)}
    processed = set()
    for mesh in document["meshes"]:
        for primitive in mesh["primitives"]:
            if primitive.get("mode", 4) != 4:
                continue
            accessor_index = primitive["indices"]
            if accessor_index in processed:
                continue
            processed.add(accessor_index)
            accessor = document["accessors"][accessor_index]
            view = document["bufferViews"][accessor["bufferView"]]
            fmt, unit = formats[accessor["componentType"]]
            offset = (bin_start + view.get("byteOffset", 0)
                      + accessor.get("byteOffset", 0))
            triangles = []
            for index in range(0, accessor["count"], 3):
                triangle = struct.unpack_from("<" + fmt * 3, data,
                                              offset + index * unit)
                rotations = (triangle, triangle[1:] + triangle[:1],
                             triangle[2:] + triangle[:2])
                triangles.append(min(rotations))
            triangles.sort()
            for index, triangle in enumerate(triangles):
                struct.pack_into("<" + fmt * 3, data, offset + index * 3 * unit,
                                 *triangle)

    materials = []
    material_remap = {}
    seen = {}
    for index, mat in enumerate(document["materials"]):
        if "normalTexture" in mat:
            mat["normalTexture"]["texCoord"] = 0
        key = json.dumps(mat, sort_keys=True)
        if key in seen:
            material_remap[index] = seen[key]
        else:
            material_remap[index] = len(materials)
            seen[key] = len(materials)
            materials.append(mat)
    document["materials"] = materials
    for mesh in document["meshes"]:
        for primitive in mesh["primitives"]:
            if "material" in primitive:
                primitive["material"] = material_remap[primitive["material"]]

    json_bytes = json.dumps(document, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * (-len(json_bytes) % 4)
    bin_data = bytes(data[bin_start:])
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_data)
    path.write_bytes(
        struct.pack("<III", 0x46546C67, 2, total)
        + struct.pack("<II", len(json_bytes), 0x4E4F534A) + json_bytes
        + struct.pack("<II", len(bin_data), 0x004E4942) + bin_data)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    objects = build_model()
    print("Built", ", ".join(obj.name for obj in objects))
    unapplied = [obj.name for obj in bpy.data.objects if obj.modifiers]
    if unapplied:
        raise RuntimeError("Unapplied modifiers: " + ", ".join(unapplied))
    textured_meshes = {mesh for mesh in bpy.data.meshes
                       if any(mat and mat.name == "Grip charcoal"
                              for mat in mesh.materials)}
    for mesh in bpy.data.meshes:
        if mesh not in textured_meshes:
            while mesh.uv_layers:
                mesh.uv_layers.remove(mesh.uv_layers[0])
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_extras=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        use_visible=False,
        use_renderable=False,
    )
    canonicalise_glb(GLB_PATH)
    print("Exported", GLB_PATH)
    render_views(objects[1], objects[3])


if __name__ == "__main__":
    main()
