"""Build B01 from the approved written brief, export GLB, render five views."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "public" / "models" / "blasters"
RENDER_DIR = ROOT / "art" / "blasters" / "B01" / "renders"
GLB_PATH = OUT_DIR / "B01.glb"

BLUE = "#2ec4ff"
PANEL_BLUE = "#159bd8"
CHARCOAL = "#2b2b33"
YELLOW = "#ffd23f"
ORANGE = "#ff7a1a"
PINK = "#ff4fa3"
BACKGROUND = (0.72, 0.72, 0.72, 1.0)
ROUGHNESS = 0.4
MAG_ALPHA = 0.45
BEVEL = 0.003
SMALL_BEVEL = 0.001

BODY_L, BODY_H, BODY_W = 0.28, 0.09, 0.055
BODY_Y, BODY_Z = 0.085, 0.09
PANEL_L, PANEL_H, PANEL_DEPTH = 0.18, 0.045, 0.004
RIB_L, RIB_H, RIB_DEPTH = 0.15, 0.004, 0.003
RAIL_L, RAIL_H, RAIL_W = 0.22, 0.015, 0.03
RAIL_Y, RAIL_Z, RAIL_RIBS = BODY_Y, 0.1545, 10
RAIL_RIB_W, RAIL_RIB_L = 0.034, 0.008
RECEIVER_TOP_H, RECEIVER_TOP_W = 0.018, 0.046
RING_OUTER, RING_INNER, RING_DEPTH = 0.015, 0.011, 0.006
RING_Y, RING_Z = -0.005, 0.186
RING_POST_H, RING_POST_W = 0.018, 0.008

SHROUD_L, SHROUD_H, SHROUD_W = 0.20, 0.07, 0.05
SHROUD_NOSE_L, SHROUD_NOSE_TAPER = 0.035, 0.006
SHROUD_Y, SHROUD_Z = 0.305, 0.09
VENT_RADIUS, VENT_DEPTH = 0.004, 0.07
VENT_ROWS, VENT_COLS = 3, 5
VENT_Y0, VENT_Y_STEP = 0.235, 0.035
VENT_Z0, VENT_Z_STEP = 0.07, 0.02
BARREL_L, BARREL_OUTER, BARREL_INNER = 0.09, 0.011, 0.008
BARREL_Y, TIP_L, TIP_OUTER = 0.43, 0.014, 0.0135
BARREL_TRIPLE = ((0.0, 0.105), (-0.013, 0.083), (0.013, 0.083))
MUZZLE_Y = BARREL_Y + BARREL_L / 2
MOD_Z_STEP = 0.032

PUMP_L, PUMP_H, PUMP_W = 0.12, 0.064, 0.062
PUMP_Y, PUMP_Z = 0.295, 0.04
PUMP_GROOVES, PUMP_GROOVE_L, PUMP_GROOVE_DEPTH = 6, 0.006, 0.0035
PUMP_CHANNEL_W = 0.052
GRIP_H, GRIP_W = 0.11, 0.03
GRIP_RIBS = 6
GUARD_W = 0.024
TRIGGER_H, TRIGGER_D, TRIGGER_W = 0.03, 0.012, 0.008
TRIGGER_ORIGIN = (0.0, 0.051, 0.047)

MAG_H, MAG_D, MAG_W = 0.13, 0.06, 0.022
MAG_Y, MAG_Z = 0.140, 0.005
DART_COUNT, DART_L, DART_R = 8, 0.045, 0.004
DART_TIP_L, DART_Z0, DART_Z_STEP = 0.009, -0.043, 0.012

STOCK_L, STOCK_H, STOCK_W = 0.16, 0.09, 0.03
STOCK_Y, STOCK_TOP_Z, STOCK_BOTTOM_Z = -0.095, 0.12, 0.035
STOCK_BAR_H, STOCK_BUTT_L = 0.018, 0.022

RESOLUTION = (1024, 768)
ORTHO_SCALE = 0.76
EYE_CAMERA_LOC = (-0.26, -0.62, 0.16)
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


def cylinder(name, loc, radius, depth, mat, vertices=24, edge=SMALL_BEVEL):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                      location=loc, rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return bevel(obj, edge, 1)


def tube(name, loc, outer, inner, depth, mat, segments=16):
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

def build_model():
    blue = material("Foam blue", BLUE)
    panel_blue = material("Recess blue", PANEL_BLUE)
    charcoal = material("Charcoal", CHARCOAL)
    yellow = material("Foam yellow", YELLOW)
    orange = material("Safety orange", ORANGE)
    pink = material("Clear pink", PINK, MAG_ALPHA)
    static = []

    body_back = BODY_Y - BODY_L / 2
    body_front = BODY_Y + BODY_L / 2
    body_bottom = BODY_Z - BODY_H / 2
    body_top = BODY_Z + BODY_H / 2
    body_points = [
        (body_back, body_bottom + 0.01),
        (body_back + 0.007, body_bottom),
        (0.120, body_bottom),
        (0.130, body_bottom - 0.01),
        (0.160, body_bottom - 0.01),
        (body_front, body_bottom + 0.03),
        (body_front, body_top - 0.025),
        (body_front - 0.03, body_top),
        (body_back + 0.007, body_top),
        (body_back, body_top - 0.007),
    ]
    receiver = profile("Receiver", body_points, BODY_W, blue)
    static.append(receiver)
    static.append(box("Raised receiver top",
                      (0, BODY_Y, body_top + RECEIVER_TOP_H / 2),
                      (RECEIVER_TOP_W, RAIL_L, RECEIVER_TOP_H), blue))
    for side in (-1, 1):
        cutter = box("Panel recess", (side * BODY_W / 2, BODY_Y, BODY_Z),
                     (PANEL_DEPTH * 2, PANEL_L, PANEL_H), blue, 0)
        mod = receiver.modifiers.new("Recessed side panel", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = cutter
        apply_modifier(receiver, mod)
        bpy.data.objects.remove(cutter, do_unlink=True)
        static.append(box("Inset side panel",
                          (side * (BODY_W / 2 - PANEL_DEPTH), BODY_Y, BODY_Z),
                          (0.001, PANEL_L - 0.01, PANEL_H - 0.009), panel_blue,
                          SMALL_BEVEL))
        for z in (BODY_Z - 0.009, BODY_Z + 0.009):
            static.append(box("Raised side rib",
                              (side * (BODY_W / 2 - RIB_DEPTH / 2), BODY_Y, z),
                              (RIB_DEPTH, RIB_L, RIB_H), yellow, SMALL_BEVEL))
    bevel(receiver, 0.0006, 2)

    static.append(box("Rail base", (0, RAIL_Y, RAIL_Z - 0.003),
                      (RAIL_W, RAIL_L, RAIL_H / 2), charcoal))
    for i in range(RAIL_RIBS):
        y = RAIL_Y - RAIL_L / 2 + 0.012 + i * (RAIL_L - 0.024) / (RAIL_RIBS - 1)
        static.append(box("Rail rib", (0, y, RAIL_Z + 0.003),
                          (RAIL_RIB_W, RAIL_RIB_L, RAIL_H / 2), charcoal,
                          SMALL_BEVEL))
    static.append(box("Sight post", (0, RING_Y, RING_Z - RING_POST_H),
                      (RING_POST_W, RING_POST_W, RING_POST_H), yellow,
                      SMALL_BEVEL))
    static.append(tube("Ring sight", (0, RING_Y, RING_Z), RING_OUTER,
                       RING_INNER, RING_DEPTH, yellow))

    shroud_sections = [
        (SHROUD_Y - SHROUD_L / 2, SHROUD_W / 2, SHROUD_H / 2),
        (SHROUD_Y + SHROUD_L / 2 - SHROUD_NOSE_L, SHROUD_W / 2, SHROUD_H / 2),
        (SHROUD_Y + SHROUD_L / 2, SHROUD_W / 2 - SHROUD_NOSE_TAPER,
         SHROUD_H / 2 - SHROUD_NOSE_TAPER),
    ]
    vertices = []
    for y, half_w, half_h in shroud_sections:
        vertices += [(-half_w, y, SHROUD_Z - half_h),
                     (half_w, y, SHROUD_Z - half_h),
                     (half_w, y, SHROUD_Z + half_h),
                     (-half_w, y, SHROUD_Z + half_h)]
    faces = [tuple(range(4))]
    for section in range(2):
        for i in range(4):
            j = (i + 1) % 4
            a = section * 4
            faces.append((a + i, a + i + 4, a + j + 4, a + j))
    faces.append(tuple(reversed(range(8, 12))))
    shroud = bevel(mesh_object("Vented shroud", vertices, faces, blue))
    cutters = []
    for row in range(VENT_ROWS):
        for col in range(VENT_COLS):
            loc = (0, VENT_Y0 + col * VENT_Y_STEP, VENT_Z0 + row * VENT_Z_STEP)
            cutter = cylinder("Vent cutter", loc, VENT_RADIUS, VENT_DEPTH,
                              blue, 16, 0)
            cutter.rotation_euler.z = math.pi / 2
            cutters.append(cutter)
    cutter = join_at(cutters, "Vent cutters", (0, 0, 0))
    mod = shroud.modifiers.new("Round through vents", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    apply_modifier(shroud, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)
    bevel(shroud, 0.0006, 2)
    static.append(shroud)

    for index, (x, z) in enumerate(BARREL_TRIPLE, 1):
        static.append(tube("Barrel " + str(index), (x, BARREL_Y, z),
                           BARREL_OUTER, BARREL_INNER, BARREL_L, blue))
        static.append(tube("Orange tip " + str(index),
                           (x, MUZZLE_Y - TIP_L / 2, z), TIP_OUTER,
                           BARREL_INNER, TIP_L, orange))

    grip_points = [(0.0, 0.045), (-0.025, 0.045),
                   (-0.055, 0.045 - GRIP_H), (-0.015, 0.045 - GRIP_H)]
    static.append(profile("Angled grip", grip_points, GRIP_W, charcoal))
    for i in range(GRIP_RIBS):
        static.append(box("Grip rib", (0, -0.004 - i * 0.005, 0.025 - i * 0.014),
                          (GRIP_W + 0.003, 0.032, 0.003), charcoal, SMALL_BEVEL))
    guard_outer = [(0.006, 0.018), (0.020, 0.002), (0.050, 0.002),
                   (0.063, 0.018), (0.065, 0.039), (0.059, 0.049),
                   (0.011, 0.047)]
    guard_inner = [(0.016, 0.022), (0.026, 0.01), (0.053, 0.01),
                   (0.061, 0.022), (0.061, 0.032), (0.059, 0.041),
                   (0.020, 0.039)]
    guard = profile("Trigger guard", guard_outer, GUARD_W, charcoal)
    cutter = profile("Guard opening", guard_inner, GUARD_W + 0.02, charcoal, 0)
    mod = guard.modifiers.new("Moulded guard opening", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    apply_modifier(guard, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)
    bevel(guard, 0.0006, 2)
    static.append(guard)
    trigger_points = [(-TRIGGER_D / 2, 0), (TRIGGER_D / 2, 0),
                      (TRIGGER_D / 2, TRIGGER_H * 0.65),
                      (TRIGGER_D / 3, TRIGGER_H), (-TRIGGER_D / 3, TRIGGER_H)]
    for i in range(1, 6):
        z = TRIGGER_H * (1 - i / 6)
        y = (-TRIGGER_D / 3 - TRIGGER_D / 6 * z / TRIGGER_H
             + 0.004 * math.sin(math.pi * z / TRIGGER_H))
        trigger_points.append((y, z))
    trigger = profile("trigger", trigger_points, TRIGGER_W, yellow, SMALL_BEVEL)
    trigger.location = TRIGGER_ORIGIN
    # Local X points left, so positive glTF local X rotation pulls rearward.
    trigger.rotation_euler.y = math.pi

    pump = box("Chunky pump forend", (0, PUMP_Y, PUMP_Z),
               (PUMP_W, PUMP_L, PUMP_H), charcoal)
    cutters = [box("Pump wrap channel", (0, PUMP_Y, PUMP_Z + PUMP_H / 2),
                   (PUMP_CHANNEL_W, PUMP_L + 0.02, 0.04), charcoal, 0)]
    for i in range(PUMP_GROOVES):
        y = (PUMP_Y - PUMP_L / 2 + 0.009
             + i * (PUMP_L - 0.018) / (PUMP_GROOVES - 1))
        for side in (-1, 1):
            cutters.append(box(
                "Pump side groove",
                (side * (PUMP_W / 2 - PUMP_GROOVE_DEPTH / 2), y, PUMP_Z - 0.005),
                (PUMP_GROOVE_DEPTH * 2, PUMP_GROOVE_L, PUMP_H - 0.014),
                charcoal, 0))
        cutters.append(box("Pump bottom groove",
                           (0, y, PUMP_Z - PUMP_H / 2),
                           (PUMP_W - 0.008, PUMP_GROOVE_L, PUMP_GROOVE_DEPTH * 2),
                           charcoal, 0))
    cutter = join_at(cutters, "Pump groove cutters", (0, 0, 0))
    mod = pump.modifiers.new("Cut grip grooves", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    apply_modifier(pump, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)
    bevel(pump, 0.0015, 2)
    pump.name = "pump"
    bpy.context.scene.cursor.location = (0, PUMP_Y, PUMP_Z)
    activate(pump)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

    mag_parts = [box("Magazine shell", (0, MAG_Y, MAG_Z),
                     (MAG_W, MAG_D, MAG_H), pink, 0.002)]
    for i in range(DART_COUNT):
        z = DART_Z0 + i * DART_Z_STEP
        mag_parts.append(cylinder("Dart foam", (0, MAG_Y - DART_TIP_L / 2, z),
                                  DART_R, DART_L - DART_TIP_L, blue, 12, 0.0005))
        mag_parts.append(cylinder("Dart tip",
                                  (0, MAG_Y + (DART_L - DART_TIP_L) / 2, z),
                                  DART_R, DART_TIP_L, orange, 12, 0.0005))
    mag = join_at(mag_parts, "mag", (0, MAG_Y, MAG_Z))

    static.append(box("Stock top", (0, STOCK_Y, STOCK_TOP_Z),
                      (STOCK_W, STOCK_L, STOCK_BAR_H), charcoal))
    static.append(box("Stock bottom", (0, STOCK_Y, STOCK_BOTTOM_Z),
                      (STOCK_W, STOCK_L, STOCK_BAR_H), charcoal))
    static.append(box("Rounded stock butt pad",
                      (0, STOCK_Y - STOCK_L / 2 + STOCK_BUTT_L / 2,
                       (STOCK_TOP_Z + STOCK_BOTTOM_Z) / 2),
                      (STOCK_W + 0.008, STOCK_BUTT_L, STOCK_H + 0.006),
                      charcoal, 0.006))
    body = join_at(static, "body", (0, 0, 0))

    for index, (x, z) in enumerate(BARREL_TRIPLE, 1):
        muzzle = bpy.data.objects.new("muzzle_" + str(index), None)
        bpy.context.collection.objects.link(muzzle)
        muzzle.location = (x, MUZZLE_Y, z)
        muzzle.empty_display_size = 0.01
        parent_keep_world(muzzle, body)

    mod_parts = []
    for index, (x, z) in enumerate(BARREL_TRIPLE, 4):
        mod_parts.append(tube("Double barrel " + str(index),
                              (x, BARREL_Y, z + MOD_Z_STEP), BARREL_OUTER,
                              BARREL_INNER, BARREL_L, blue))
        mod_parts.append(tube("Double tip " + str(index),
                              (x, MUZZLE_Y - TIP_L / 2, z + MOD_Z_STEP),
                              TIP_OUTER, BARREL_INNER, TIP_L, orange))
    mod_double = join_at(mod_parts, "mod_double", (0, BARREL_Y, 0.105 + MOD_Z_STEP))
    mod_double["hidden"] = True
    for index, (x, z) in enumerate(BARREL_TRIPLE, 4):
        muzzle = bpy.data.objects.new("muzzle_" + str(index), None)
        bpy.context.collection.objects.link(muzzle)
        muzzle.location = (x, MUZZLE_Y, z + MOD_Z_STEP)
        muzzle.empty_display_size = 0.01
        parent_keep_world(muzzle, mod_double)
    for obj in [mod_double] + [o for o in bpy.data.objects if o.parent == mod_double]:
        obj.hide_render = True
        obj.hide_set(True)
    return body, pump, trigger, mag, mod_double

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


def render_views():
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
    target = (0, 0.14, 0.065)
    area_light("Key softbox", (0.65, 0.45, 1.1), LIGHT_ENERGY[0], target)
    area_light("Fill softbox", (-0.7, 0.1, 0.5), LIGHT_ENERGY[1], target)
    area_light("Rear softbox", (0.1, -0.8, 0.8), LIGHT_ENERGY[2], target)

    views = [
        ("side", add_camera("Side camera", (1.2, 0.14, 0.075), target)),
        ("three-quarter", add_camera("Three quarter camera", (0.85, 0.95, 0.60), target)),
        ("top", add_camera("Top camera", (0, 0.14, 1.3))),
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

    closeup = add_camera("Trigger closeup camera", (1.2, 0.035, 0.025),
                         (0, 0.035, 0.025))
    closeup.data.ortho_scale = 0.105
    scene.camera = closeup
    scene.render.resolution_x, scene.render.resolution_y = (512, 512)
    scene.render.filepath = str(RENDER_DIR / "trigger-closeup.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered", scene.render.filepath)


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
    # Flat materials need no UVs, and generated UVs vary slightly between runs.
    for mesh in bpy.data.meshes:
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
    render_views()


if __name__ == "__main__":
    main()
