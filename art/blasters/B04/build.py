"""Build B04 from the approved written brief, export GLB, render six views."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "public" / "models" / "blasters"
RENDER_DIR = ROOT / "art" / "blasters" / "B04" / "renders"
GLB_PATH = OUT_DIR / "B04.glb"

LIME = "#b6ff3b"
CHARCOAL = "#2b2b33"
PURPLE = "#9b5cff"
YELLOW = "#ffd23f"
ORANGE = "#ff7a1a"
DART_BLUE = "#2ec4ff"
BACKGROUND = (0.72, 0.72, 0.72, 1.0)
ROUGHNESS = 0.4
CLEAR_ALPHA = 0.28
BEVEL = 0.003
SMALL_BEVEL = 0.001

BODY_L, BODY_H, BODY_W = 0.30, 0.08, 0.06
BODY_Y, BODY_Z = 0.05, 0.10
HOUSING_L, HOUSING_H, HOUSING_W = 0.10, 0.07, 0.08
HOUSING_Y, HOUSING_Z = 0.135, 0.09
WINDOW_L, WINDOW_H = 0.072, 0.050
WHEEL_R, WHEEL_DEPTH = 0.020, 0.015
WHEEL_Z = HOUSING_Z
WHEEL_CENTRES = {
    "flywheel_l": (-0.006, 0.119, WHEEL_Z),
    "flywheel_r": (0.018, 0.151, WHEEL_Z),
}

RAIL_L, RAIL_H, RAIL_W = 0.34, 0.015, 0.025
RAIL_Y, RAIL_Z, RAIL_RIBS = 0.17, 0.149, 16
HANDGUARD_L, HANDGUARD_H, HANDGUARD_W = 0.22, 0.06, 0.05
HANDGUARD_Y, HANDGUARD_Z = 0.31, 0.10
SLOT_L, SLOT_H = 0.036, 0.013
BARREL_L, BARREL_R, BARREL_INNER = 0.08, 0.012, 0.008
BARREL_Y, BARREL_Z = 0.44, 0.10
BUMPER_L, BUMPER_R = 0.03, 0.018
BUMPER_Y = 0.475
MUZZLE_Y = BUMPER_Y + BUMPER_L / 2

GRIP_H, GRIP_D, GRIP_W = 0.10, 0.045, 0.03
GRIP_TOP_Z, GRIP_ANGLE = 0.06, math.radians(15)
GRIP_CORNER = 0.009
GRIP_TEX_SIZE, GRIP_TEX_RIBS = 128, 8
GUARD_W = 0.024
TRIGGER_H, TRIGGER_D, TRIGGER_W = 0.025, 0.012, 0.008
TRIGGER_ORIGIN = (0.0, 0.013, 0.049)

MAG_H, MAG_D, MAG_W = 0.16, 0.06, 0.024
MAG_ORIGIN = (0.0, 0.15, -0.025)
MAG_TOP_Z = MAG_ORIGIN[2] + MAG_H / 2
DART_COUNT, DART_L, DART_R = 10, 0.050, 0.0035
DART_TIP_L = 0.010

STOCK_L, STOCK_H, STOCK_W = 0.20, 0.12, 0.04
FOREGRIP_H, FOREGRIP_D = 0.09, 0.04
FOREGRIP_TOP = (0.0, 0.29, 0.075)
FOREGRIP_ANGLE = math.radians(30)

RESOLUTION = (1024, 768)
ORTHO_SCALE = 0.82
EYE_CAMERA_LOC = (-0.36, -0.90, 0.20)
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
    normal.inputs["Strength"].default_value = 1.0
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


def box(name, loc, dims, mat, edge=BEVEL):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return bevel(obj, edge)


def profile(name, points, width, mat, edge=BEVEL):
    count = len(points)
    vertices = [(x, y, z) for x in (-width / 2, width / 2) for y, z in points]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count)
              for i in range(count)]
    return bevel(mesh_object(name, vertices, faces, mat), edge)


def rounded_grip(name, mat, height, depth, width, top_z, rake, corner,
                 centre_y=0.0):
    ring_specs = [
        (0.0, 0.78), (-0.002, 0.93), (-0.005, 1.0),
        (-height * 0.18, 1.0), (-height * 0.35, 1.025),
        (-height * 0.55, 1.055), (-height * 0.75, 1.03),
        (-height * 0.90, 1.0), (-height * 0.97, 1.08),
        (-height, 0.82),
    ]
    corner_segments = 8
    count = corner_segments * 4
    vertices = []
    ring_scales = []
    for offset, scale in ring_specs:
        z = top_z + offset
        half_x = width * scale / 2
        half_y = depth * scale / 2
        radius = corner * scale
        ring_y = centre_y + math.tan(rake) * -offset
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
                                 ring_y + cy + radius * math.sin(angle), z))
        ring_scales.append(scale)

    faces = []
    face_uvs = []

    def cap_uv(indices, scale):
        return [(vertices[index][0] / (width * scale) + 0.5,
                 (vertices[index][1] - centre_y
                  - math.tan(rake) * (vertices[index][2] - top_z))
                 / (depth * scale) + 0.5) for index in indices]

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

    obj = mesh_object(name, vertices, faces, mat)
    uv = obj.data.uv_layers.new(name="UV" + "Map")
    for polygon, coordinates in zip(obj.data.polygons, face_uvs):
        for loop, coordinate in zip(polygon.loop_indices, coordinates):
            uv.data[loop].uv = coordinate
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def cylinder(name, loc, radius, depth, mat, vertices=24, edge=SMALL_BEVEL,
             axis="Y"):
    rotation = (math.pi / 2, 0, 0) if axis == "Y" else (0, 0, 0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                      location=loc, rotation=rotation)
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
                      radius * math.sin(i * math.tau / segments))
                     for i in range(segments)]
    faces = []
    for i in range(segments):
        j = (i + 1) % segments
        faces += [(i, j, segments + j, segments + i),
                  (2 * segments + j, 2 * segments + i,
                   3 * segments + i, 3 * segments + j),
                  (j, i, 2 * segments + i, 2 * segments + j),
                  (segments + i, segments + j, 3 * segments + j, 3 * segments + i)]
    obj = mesh_object(name, vertices, faces, mat)
    obj.location = loc
    for face in obj.data.polygons:
        face.use_smooth = face.index % 4 < 2
    return bevel(obj, SMALL_BEVEL, 2)


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


def cut(obj, cutter, name):
    mod = obj.modifiers.new(name, "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    apply_modifier(obj, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)


def build_model():
    lime = material("Foam lime", LIME)
    charcoal = material("Charcoal", CHARCOAL)
    grip_charcoal = grip_material()
    purple = material("Foam purple", PURPLE)
    yellow = material("Foam yellow", YELLOW)
    orange = material("Safety orange", ORANGE)
    clear = material("Clear orange", ORANGE, CLEAR_ALPHA)
    dart_blue = material("Dart blue", DART_BLUE)
    static = []

    receiver = box("Receiver", (0, BODY_Y, BODY_Z),
                   (BODY_W, BODY_L, BODY_H), lime, 0.012)
    static.append(receiver)

    housing = box("Rounded flywheel housing", (0, HOUSING_Y, HOUSING_Z),
                  (HOUSING_W, HOUSING_L, HOUSING_H), lime, 0.015)
    cavity = box("Wheel cavity", (0, HOUSING_Y, HOUSING_Z),
                 (HOUSING_W - 0.012, HOUSING_L - 0.018, HOUSING_H - 0.014),
                 lime, 0.008)
    cut(housing, cavity, "Hollow wheel cavity")
    receiver_cavity = box("Receiver wheel cavity", (0, HOUSING_Y, HOUSING_Z),
                          (HOUSING_W - 0.012, HOUSING_L - 0.018,
                           HOUSING_H - 0.014), lime, 0.008)
    cut(receiver, receiver_cavity, "Open receiver wheel cavity")
    window_cutter = box("Right window cutter",
                        (HOUSING_W / 2, HOUSING_Y, HOUSING_Z),
                        (0.04, WINDOW_L, WINDOW_H), lime, 0.007)
    cut(housing, window_cutter, "Open right window")
    receiver_window = box("Receiver right window",
                          (HOUSING_W / 2, HOUSING_Y, HOUSING_Z),
                          (0.04, WINDOW_L, WINDOW_H), lime, 0.007)
    cut(receiver, receiver_window, "Open receiver right window")
    bevel(housing, 0.0006, 2)
    static.append(housing)

    frame = box("Purple window frame",
                (HOUSING_W / 2 + 0.001, HOUSING_Y, HOUSING_Z),
                (0.004, WINDOW_L + 0.012, WINDOW_H + 0.012), purple, 0.006)
    frame_inner = box("Frame opening",
                      (HOUSING_W / 2 + 0.001, HOUSING_Y, HOUSING_Z),
                      (0.012, WINDOW_L, WINDOW_H), purple, 0.005)
    cut(frame, frame_inner, "Window frame opening")
    static.append(frame)

    wheels = []
    for name, centre in WHEEL_CENTRES.items():
        parts = [cylinder(name + " disc", centre, WHEEL_R, WHEEL_DEPTH,
                          yellow, 32, 0.001, "Z")]
        parts.append(cylinder(name + " hub", centre, 0.005,
                              WHEEL_DEPTH + 0.001, purple, 20, 0.0005, "Z"))
        for i in range(6):
            angle = i * math.tau / 6
            marker = (centre[0] + 0.012 * math.cos(angle),
                      centre[1] + 0.012 * math.sin(angle),
                      centre[2] + WHEEL_DEPTH / 2 + 0.0005)
            parts.append(cylinder(name + " face marker", marker, 0.0022, 0.001,
                                  purple, 12, 0.0002, "Z"))
        wheel = join_at(parts, name, centre)
        wheels.append(wheel)

    static.append(box("Rail base", (0, RAIL_Y, RAIL_Z),
                      (RAIL_W, RAIL_L, RAIL_H - 0.003), charcoal, 0.002))
    for i in range(RAIL_RIBS):
        y = RAIL_Y - RAIL_L / 2 + 0.010 + i * (RAIL_L - 0.020) / (RAIL_RIBS - 1)
        static.append(box("Rail rib", (0, y, RAIL_Z + 0.007),
                          (RAIL_W + 0.004, 0.009, 0.006), charcoal,
                          SMALL_BEVEL))
    rear_y = RAIL_Y - RAIL_L / 2 + 0.008
    for side in (-1, 1):
        static.append(box("Rear notch sight", (side * 0.007, rear_y, 0.169),
                          (0.005, 0.007, 0.018), purple, SMALL_BEVEL))
    static.append(box("Front post sight",
                      (0, RAIL_Y + RAIL_L / 2 - 0.008, 0.166),
                      (0.005, 0.007, 0.018), purple, SMALL_BEVEL))

    handguard = box("Slotted handguard", (0, HANDGUARD_Y, HANDGUARD_Z),
                    (HANDGUARD_W, HANDGUARD_L, HANDGUARD_H), lime, 0.010)
    for i in range(4):
        y = HANDGUARD_Y - 0.078 + i * 0.052
        cutter = box("Long rounded side slot", (0, y, HANDGUARD_Z),
                     (HANDGUARD_W + 0.03, SLOT_L, SLOT_H), lime, 0.005)
        cut(handguard, cutter, "Rounded handguard slot")
    bevel(handguard, 0.0006, 2)
    static.append(handguard)
    static.append(tube("Short barrel", (0, BARREL_Y, BARREL_Z),
                       BARREL_R, BARREL_INNER, BARREL_L, charcoal, 24))
    static.append(tube("Muzzle bumper core", (0, BUMPER_Y, BARREL_Z),
                       BUMPER_R - 0.0015, BARREL_INNER, BUMPER_L, orange, 32))
    for i in range(4):
        y = BUMPER_Y - BUMPER_L / 2 + 0.003 + i * 0.008
        static.append(tube("Muzzle bumper ridge", (0, y, BARREL_Z),
                           BUMPER_R, BARREL_INNER, 0.005, orange, 32))

    pistol = rounded_grip("Smooth pistol grip", grip_charcoal,
                          GRIP_H, GRIP_D, GRIP_W, GRIP_TOP_Z,
                          -GRIP_ANGLE, GRIP_CORNER, -GRIP_D / 2)
    static.append(pistol)
    guard_outer = [(-0.006, 0.018), (0.008, 0.007), (0.038, 0.007),
                   (0.053, 0.018), (0.053, 0.046), (0.047, 0.058),
                   (-0.001, 0.058)]
    guard_inner = [(0.004, 0.023), (0.014, 0.015), (0.041, 0.015),
                   (0.049, 0.023), (0.049, 0.034), (0.047, 0.041),
                   (0.008, 0.041)]
    guard = profile("Trigger guard", guard_outer, GUARD_W, charcoal)
    cutter = profile("Guard opening", guard_inner, GUARD_W + 0.02, charcoal, 0)
    cut(guard, cutter, "Moulded guard opening")
    bevel(guard, 0.0006, 2)
    static.append(guard)

    trigger_points = []
    for i in range(9):
        t = i / 8
        front_y = 0.005 - 0.020 * t * (1 - t) + 0.001 * t ** 3
        trigger_points.append((front_y, TRIGGER_H * t))
    for i in reversed(range(9)):
        t = i / 8
        front_y = 0.005 - 0.020 * t * (1 - t) + 0.001 * t ** 3
        trigger_points.append((front_y - TRIGGER_D / 2, TRIGGER_H * t))
    trigger = profile("trigger", trigger_points, TRIGGER_W, purple, SMALL_BEVEL)
    trigger.location = TRIGGER_ORIGIN
    # Local X points left, so positive glTF local X rotation pulls rearward.
    trigger.rotation_euler.y = math.pi

    mag_parts = []
    ring_count = 13
    corner_segments = 6
    ring_size = corner_segments * 4
    vertices = []

    def mag_y_at(z):
        t = (MAG_TOP_Z - z) / MAG_H
        return 0.135 + 0.030 * t

    for ring in range(ring_count):
        z = MAG_TOP_Z - MAG_H * ring / (ring_count - 1)
        centre_y = mag_y_at(z)
        radius = 0.007
        half_x = MAG_W / 2
        half_y = MAG_D / 2
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
    faces = [tuple(range(ring_size))]
    for ring in range(ring_count - 1):
        upper = ring * ring_size
        lower = (ring + 1) * ring_size
        for i in range(ring_size):
            j = (i + 1) % ring_size
            faces.append((upper + i, lower + i, lower + j, upper + j))
    faces.append(tuple(reversed(range((ring_count - 1) * ring_size,
                                      ring_count * ring_size))))
    shell = mesh_object("Curved clear magazine", vertices, faces, clear)
    for polygon in shell.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    mag_parts.append(shell)
    for i in range(DART_COUNT):
        z = 0.043 - i * 0.010
        y = mag_y_at(z)
        mag_parts.append(cylinder("Magazine dart foam",
                                  (0, y - DART_TIP_L / 2, z), DART_R,
                                  DART_L - DART_TIP_L, dart_blue, 12, 0.0004))
        mag_parts.append(cylinder("Magazine dart tip",
                                  (0, y + (DART_L - DART_TIP_L) / 2, z),
                                  DART_R, DART_TIP_L, orange, 12, 0.0004))
    mag = join_at(mag_parts, "mag", MAG_ORIGIN)

    stock_points = [(-0.260, -0.005), (-0.260, 0.102),
                    (-0.245, 0.115), (-0.060, 0.115),
                    (-0.060, 0.035), (-0.105, 0.015), (-0.225, -0.005)]
    stock = profile("Solid fixed stock", stock_points, STOCK_W, charcoal, 0.008)
    oval = [( -0.170 + 0.065 * math.cos(i * math.tau / 32),
              0.060 + 0.032 * math.sin(i * math.tau / 32)) for i in range(32)]
    cutter = profile("Oval stock opening", oval, STOCK_W + 0.03, charcoal, 0)
    cut(stock, cutter, "Single oval stock cutout")
    bevel(stock, 0.001, 2)
    static.append(stock)
    static.append(box("Rounded rubber butt pad", (0, -0.258, 0.055),
                      (0.048, 0.020, 0.120), charcoal, 0.008))

    foregrip = rounded_grip("Smooth angled foregrip", grip_charcoal,
                            FOREGRIP_H, FOREGRIP_D, FOREGRIP_D, 0.0,
                            FOREGRIP_ANGLE, 0.012)
    foregrip.location = FOREGRIP_TOP
    static.append(foregrip)

    textured_names = {"Smooth pistol grip", "Smooth angled foregrip"}
    for obj in static:
        if obj.name not in textured_names:
            while obj.data.uv_layers:
                obj.data.uv_layers.remove(obj.data.uv_layers[0])
    body = join_at(static, "body", (0, 0, 0))
    for obj in [trigger, mag] + wheels:
        parent_keep_world(obj, body)
    muzzle = bpy.data.objects.new("muzzle_1", None)
    bpy.context.collection.objects.link(muzzle)
    muzzle.location = (0, MUZZLE_Y, BARREL_Z)
    muzzle.empty_display_size = 0.01
    parent_keep_world(muzzle, body)
    return body, trigger, mag, wheels, muzzle


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera(name, loc, target=None, ortho=True):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    if target is not None:
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


def render_views(wheels):
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
    target = (0, 0.11, 0.055)
    area_light("Key softbox", (0.65, 0.45, 1.1), LIGHT_ENERGY[0], target)
    area_light("Fill softbox", (-0.7, 0.1, 0.5), LIGHT_ENERGY[1], target)
    area_light("Rear softbox", (0.1, -0.8, 0.8), LIGHT_ENERGY[2], target)

    views = [
        ("side", add_camera("Side camera", (1.2, 0.11, 0.055), target)),
        ("three-quarter",
         add_camera("Three quarter camera", (0.85, 0.95, 0.60), target)),
        ("top", add_camera("Top camera", (0, 0.11, 1.3))),
    ]
    views[2][1].rotation_euler.z = math.pi / 2
    eye = add_camera("First person camera", EYE_CAMERA_LOC, ortho=False)
    point_at(eye, (-0.04, 0.55, 0.18))
    views.append(("first-person", eye))
    for name, camera in views:
        scene.camera = camera
        scene.render.filepath = str(RENDER_DIR / (name + ".png"))
        bpy.ops.render.render(write_still=True)
        print("Rendered", scene.render.filepath)

    scene.render.resolution_x, scene.render.resolution_y = (512, 512)
    closeup = add_camera("Trigger closeup camera", (1.2, 0.033, 0.033),
                         (0, 0.033, 0.033))
    closeup.data.ortho_scale = 0.105
    scene.camera = closeup
    scene.render.filepath = str(RENDER_DIR / "trigger-closeup.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered", scene.render.filepath)

    for wheel, sign in zip(wheels, (1, -1)):
        wheel.rotation_euler.z = sign * math.radians(45)
    wheel_camera = add_camera("Flywheel closeup camera", (0.65, 0.135, 0.30),
                              (0, HOUSING_Y, HOUSING_Z))
    wheel_camera.data.ortho_scale = 0.125
    scene.camera = wheel_camera
    scene.render.filepath = str(RENDER_DIR / "flywheel-closeup.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered", scene.render.filepath)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    body, trigger, mag, wheels, muzzle = build_model()
    print("Built body, trigger, mag, flywheel_l, flywheel_r and muzzle_1")
    unapplied = [obj.name for obj in bpy.data.objects if obj.modifiers]
    if unapplied:
        raise RuntimeError("Unapplied modifiers: " + ", ".join(unapplied))
    # Only the two hand-held grips use UVs. Other primitive UVs are unnecessary.
    for mesh in bpy.data.meshes:
        if mesh != body.data:
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
    print("Exported", GLB_PATH)
    render_views(wheels)


if __name__ == "__main__":
    main()
