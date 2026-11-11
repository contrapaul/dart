"""Build B08 Firehose (pi's take): a toy six-barrel minigun that spins,
side magazine feed, top handle over the body, Twin mod adds a whole
second six-barrel assembly. Exports GLB, renders views.

Paul's directive (2026-11-10): no hopper on top; side magazine fed; the
handle is over the body; the Twin mod adds the entire 6 barrel assembly
and both spin on individual axes when fired.

Blender axes: +Y forward (muzzle), +Z up, +X to the player's right.
Origin at the top handle where the hand holds it. Metres, true size.
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "public" / "models" / "blasters"
RENDER_DIR = ROOT / "art" / "blasters" / "B08" / "renders"
GLB_PATH = OUT_DIR / "B08.glb"

# Colours: toy plastic (palette carried from the B08 brief proposal).
WHITE = "#f2f2ee"
CHARCOAL = "#2b2b33"
YELLOW = "#ffd23f"
ORANGE = "#ff7a1a"
BACKGROUND = (0.72, 0.72, 0.72, 1.0)
ROUGHNESS = 0.4
BEVEL = 0.003
SMALL_BEVEL = 0.0015

# Layout. Bore line of the main cluster at Z = BORE_Z.
BORE_Z = -0.02
BODY_L, BODY_H, BODY_W = 0.30, 0.13, 0.10
BODY_Y, BODY_Z = -0.05, BORE_Z
MOTOR_L, MOTOR_H, MOTOR_W = 0.11, 0.14, 0.12
MOTOR_Y, MOTOR_Z = -0.235, BORE_Z - 0.005

HANDLE_LEN = 0.13          # across X
HANDLE_R = 0.021           # grip bar radius
HANDLE_Y = -0.055
HANDLE_Z = 0.105           # grip centre height above the origin

CLUSTER_R = 0.040          # barrel ring radius
BARREL_R = 0.0125
BARREL_L = 0.27
BARREL_FRONT = 0.375       # Y of barrel muzzle ends
BARREL_BACK = BARREL_FRONT - BARREL_L
HUB_R = 0.017
PLATE_R = 0.058
DRIVE_L = 0.024
DRIVE_Y = BARREL_BACK + DRIVE_L / 2 - 0.006
FRONT_PLATE_T = 0.009
FRONT_PLATE_Y = BARREL_FRONT - 0.012
BUMPER_T, BUMPER_OR, BUMPER_IR = 0.016, 0.062, 0.056
BUMPER_Y = BARREL_FRONT + BUMPER_T / 2 - 0.004
MUZZLE_Y = BARREL_FRONT + 0.014

TWIN_X = -0.145            # axis of the second assembly

MAG_L, MAG_H, MAG_W = 0.055, 0.16, 0.095
MAG_X, MAG_Y, MAG_Z = BODY_W / 2 + MAG_L / 2 - 0.012, -0.075, -0.075
MAG_ANGLE = -8             # degrees, tilted back


def rgba(hex_colour, alpha=1.0):
    h = hex_colour.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (alpha,)


def material(name, colour, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba(colour)
    bsdf.inputs["Roughness"].default_value = ROUGHNESS
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = "BLEND"
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


def box(name, loc, dims, mat, edge=BEVEL, rot_z=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc,
                                    rotation=(0, 0, math.radians(rot_z)))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    return bevel(obj, edge)


def cylinder(name, loc, radius, depth, mat, segments=20, edge=SMALL_BEVEL):
    """Cylinder with its axis along Y (the bore axis)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=radius,
                                        depth=depth, location=loc,
                                        rotation=(math.pi / 2, 0, 0))
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
                  (2 * segments + j, 2 * segments + i, 3 * segments + i,
                   3 * segments + j),
                  (j, i, 2 * segments + i, 2 * segments + j),
                  (segments + i, segments + j, 3 * segments + j,
                   3 * segments + i)]
    obj = bpy.data.meshes.new(name + " mesh")
    obj.from_pydata(vertices, [], faces)
    obj.update()
    mesh_obj = bpy.data.objects.new(name, obj)
    bpy.context.collection.objects.link(mesh_obj)
    mesh_obj.data.materials.append(mat)
    mesh_obj.location = loc
    for i, face in enumerate(mesh_obj.data.polygons):
        face.use_smooth = i % 4 < 2
    return bevel(mesh_obj, SMALL_BEVEL, 2)


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


def cut(obj, cutter):
    mod = obj.modifiers.new("Cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    apply_modifier(obj, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)


def barrel_cluster(axis_x, mats, tag):
    """Six barrels round a hub with a rear drive plate and a front
    retaining plate with six holes. Returns one mesh centred on the
    cluster axis at its Y centre."""
    charcoal, yellow = mats["charcoal"], mats["yellow"]
    parts = []
    hub_y0, hub_y1 = BARREL_BACK + 0.01, BARREL_FRONT - 0.005
    hub_len = hub_y1 - hub_y0
    parts.append(cylinder(tag + " hub",
                          (axis_x, (hub_y0 + hub_y1) / 2, BORE_Z),
                          HUB_R, hub_len, charcoal, 16, 0))
    for i in range(6):
        angle = i * math.tau / 6
        bx = axis_x + CLUSTER_R * math.cos(angle)
        bz = BORE_Z + CLUSTER_R * math.sin(angle)
        b = cylinder(tag + " barrel " + str(i + 1),
                     (bx, (BARREL_BACK + BARREL_FRONT) / 2, bz),
                     BARREL_R, BARREL_L, charcoal, 14, SMALL_BEVEL)
        # A raised ring near the muzzle end reads as a minigun band.
        band = cylinder(tag + " band " + str(i + 1),
                        (bx, BARREL_FRONT - 0.03, bz),
                        BARREL_R + 0.0025, 0.014, yellow, 14, 0)
        parts += [b, band]
    drive = cylinder(tag + " drive plate", (axis_x, DRIVE_Y, BORE_Z),
                     PLATE_R, DRIVE_L, charcoal, 28, SMALL_BEVEL)
    parts.append(drive)
    front = cylinder(tag + " front plate", (axis_x, FRONT_PLATE_Y, BORE_Z),
                     PLATE_R, FRONT_PLATE_T, charcoal, 28, 0)
    for i in range(6):
        angle = i * math.tau / 6
        bx = axis_x + CLUSTER_R * math.cos(angle)
        bz = BORE_Z + CLUSTER_R * math.sin(angle)
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=14, radius=BARREL_R + 0.0025, depth=FRONT_PLATE_T * 3,
            location=(bx, FRONT_PLATE_Y, bz), rotation=(math.pi / 2, 0, 0))
        cutter = bpy.context.object
        cutter.name = "hole cutter"
        cut(front, cutter)
    parts.append(front)
    centre_y = (BARREL_BACK + BARREL_FRONT) / 2
    return join_at(parts, tag.strip(), (axis_x, centre_y, BORE_Z))


def bumper(axis_x, mat):
    return tube("bumper", (axis_x, BUMPER_Y, BORE_Z),
                BUMPER_OR, BUMPER_IR, BUMPER_T, mat, 28)


def top_handle(mat):
    """Over-the-body carry handle: two posts off the body top and a
    crossbar the hand wraps from above. Origin (0,0,0) sits at the
    crossbar centre, where the hand holds it."""
    parts = []
    bar = cylinder("Handle bar", (0, HANDLE_Y, HANDLE_Z), HANDLE_R,
                   HANDLE_LEN, mat, 20, SMALL_BEVEL)
    # The bar runs along X: rotate the Y-axis cylinder about Z.
    bar.rotation_euler = (0, 0, math.pi / 2)
    apply_rotation(bar)
    parts.append(bar)
    for sx in (-1, 1):
        post_x = sx * (HANDLE_LEN / 2 - 0.022)
        post = box("Handle post", (post_x, HANDLE_Y, (HANDLE_Z + BODY_Z
                                                      + BODY_H / 2) / 2),
                   (0.034, 0.048, HANDLE_Z - (BODY_Z + BODY_H / 2) + 0.02),
                   mat)
        parts.append(post)
    # Flared palm swell at each end of the bar.
    for sx in (-1, 1):
        parts.append(cylinder("Handle knob",
                              (sx * (HANDLE_LEN / 2 + 0.004), HANDLE_Y,
                               HANDLE_Z),
                              HANDLE_R + 0.006, 0.018, mat, 16,
                              SMALL_BEVEL))
    # Trigger guard: a small loop under the bar's front.
    guard = tube("Trigger guard", (0, HANDLE_Y + 0.032, HANDLE_Z - 0.055),
                 0.028, 0.020, 0.010, mat, 20)
    guard.rotation_euler = (0, 0, math.pi / 2)
    apply_rotation(guard)
    parts.append(guard)
    return join_at(parts, "handle", (0, HANDLE_Y, HANDLE_Z))


def apply_rotation(obj):
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def trigger(mat):
    t = box("trigger", (0, HANDLE_Y + 0.034, HANDLE_Z - 0.052),
            (0.012, 0.02, 0.026), mat, SMALL_BEVEL)
    t.rotation_euler = (math.radians(-14), 0, 0)
    apply_rotation(t)
    # Origin at the top pivot so the game rotates it about its top edge.
    bpy.context.scene.cursor.location = (0, HANDLE_Y + 0.034,
                                         HANDLE_Z - 0.052 + 0.013)
    bpy.ops.object.select_all(action="DESELECT")
    t.select_set(True)
    bpy.context.view_layer.objects.active = t
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    return t


def side_magazine(mats):
    """Boxy drum-free stick magazine on the right side of the body,
    tilted back a few degrees, with a follower ridge and a base plate."""
    charcoal, yellow = mats["charcoal"], mats["yellow"]
    parts = []
    body = box("Mag body", (MAG_X, MAG_Y, MAG_Z), (MAG_L, MAG_W, MAG_H),
               charcoal, BEVEL, rot_z=0)
    body.rotation_euler = (math.radians(MAG_ANGLE), 0, 0)
    apply_rotation(body)
    parts.append(body)
    # Feed lips at the top where the balls enter the body.
    lips = box("Mag lips", (MAG_X - 0.008, MAG_Y, MAG_Z + MAG_H / 2 - 0.005),
               (MAG_L - 0.02, MAG_W - 0.015, 0.02), yellow, SMALL_BEVEL)
    parts.append(lips)
    # Follower ridges down the front face.
    for k in range(3):
        ridge = box("Mag ridge " + str(k + 1),
                    (MAG_X + MAG_L / 2 - 0.004, MAG_Y + MAG_W / 2 - 0.012,
                     MAG_Z - MAG_H / 2 + 0.03 + k * 0.045),
                    (0.008, 0.02, 0.028), yellow, 0)
        parts.append(ridge)
    # Base plate.
    base = box("Mag base", (MAG_X, MAG_Y, MAG_Z - MAG_H / 2 - 0.006),
               (MAG_L + 0.01, MAG_W + 0.01, 0.014), yellow, SMALL_BEVEL)
    parts.append(base)
    centre = (MAG_X, MAG_Y, MAG_Z)
    return join_at(parts, "mag", centre)


def build_model(mats):
    static = []
    # Body and motor block.
    static.append(box("Body", (0, BODY_Y, BODY_Z), (BODY_W, BODY_L, BODY_H),
                      mats["white"]))
    static.append(box("Motor block", (0, MOTOR_Y, MOTOR_Z),
                      (MOTOR_W, MOTOR_L, MOTOR_H), mats["white"]))
    # Cooling ribs on each side of the motor block.
    for sx in (-1, 1):
        for k in range(5):
            rib_y = MOTOR_Y - MOTOR_L / 2 + 0.018 + k * 0.019
            static.append(box("Cooling rib",
                              (sx * (MOTOR_W / 2 - 0.001), rib_y, MOTOR_Z),
                              (0.006, 0.011, MOTOR_H - 0.03),
                              mats["charcoal"], 0))
    # Yellow belt stripe along the body sides.
    for sx in (-1, 1):
        static.append(box("Side stripe",
                          (sx * (BODY_W / 2 + 0.0005), BODY_Y + 0.05,
                           BODY_Z + 0.03),
                          (0.004, 0.10, 0.018), mats["yellow"], 0))
    # Feed flange behind the drive plate: a ring the balls pass through,
    # clear of the rotating cluster (inner radius over the barrel ring).
    static.append(tube("Feed flange", (0, 0.089, BORE_Z),
                       0.066, 0.056, 0.024, mats["charcoal"], 28))
    static.append(top_handle(mats["white"]))
    # Twin bracket: a saddle plate on the left of the body plus a strut
    # from the saddle to the twin drive plate's rear face. Part of the
    # body so the twin always has something to sit on.
    static.append(box("Twin saddle",
                      (TWIN_X / 2, BODY_Y + 0.02, BORE_Z + 0.01),
                      (abs(TWIN_X) + 0.03, 0.13, 0.05), mats["charcoal"]))
    static.append(box("Twin strut",
                      (TWIN_X, 0.066, BORE_Z - 0.02),
                      (0.035, 0.068, 0.045), mats["charcoal"]))

    barrels = barrel_cluster(0.0, mats, "barrels ")
    barrels.name = "barrels"

    mag = side_magazine(mats)
    trg = trigger(mats["yellow"])

    muzzle_1 = bpy.data.objects.new("muzzle_1", None)
    bpy.context.collection.objects.link(muzzle_1)
    muzzle_1.location = (0, MUZZLE_Y, BORE_Z)
    muzzle_1.empty_display_size = 0.01

    # Muzzle bumper on the static side of the main cluster.
    static.append(bumper(0.0, mats["orange"]))

    body_main = join_at(static, "body", (0, 0, 0))

    parent_keep_world(barrels, body_main)
    parent_keep_world(mag, body_main)
    parent_keep_world(trg, body_main)
    parent_keep_world(muzzle_1, body_main)

    return body_main, barrels, mag, trg, muzzle_1


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


ORTHO_SCALE = 0.95
RESOLUTION = (1280, 960)
LIGHT_ENERGY = (420, 220, 300)
LIGHT_SIZE = 1.2
EYE_CAMERA_LOC = (0.18, -0.22, -0.22)
EYE_CAMERA_LENS = 30


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
    target = (0, 0.18, 0.02)
    area_light("Key softbox", (0.9, 0.5, 1.1), LIGHT_ENERGY[0], target)
    area_light("Fill softbox", (-1.0, 0.2, 0.5), LIGHT_ENERGY[1], target)
    area_light("Rear softbox", (0.1, -0.9, 0.8), LIGHT_ENERGY[2], target)

    views = [
        ("side", add_camera("Side camera", (1.5, 0.15, 0.02), target)),
        ("three-quarter", add_camera("Three quarter camera", (1.0, 0.95, 0.55), target)),
        ("top", add_camera("Top camera", (0, 0.1, 1.5))),
    ]
    views[2][1].rotation_euler.z = math.pi / 2
    eye = add_camera("First person camera", EYE_CAMERA_LOC, ortho=False)
    point_at(eye, (0.0, 0.5, 0.05))
    views.append(("first-person", eye))
    for name, camera in views:
        scene.camera = camera
        scene.render.filepath = str(RENDER_DIR / (name + ".png"))
        bpy.ops.render.render(write_still=True)
        print("Rendered", scene.render.filepath)

    # Barrel cluster from the front.
    cam = add_camera("Barrel front", (0, 0.75, BORE_Z), (0, BARREL_FRONT, BORE_Z),
                     ortho=False)
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = (640, 640)
    scene.render.filepath = str(RENDER_DIR / "barrel-front.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered", scene.render.filepath)

    # Twin mod on: unhide the twin and pull back to see both clusters.
    twin = bpy.data.objects.get("mod_twin")
    if twin:
        twin.hide_set(False)
        twin["hidden"] = False
    cam = add_camera("Twin mod", (-0.7, 0.55, 0.25), (-0.05, 0.2, 0.0),
                     ortho=False)
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = (640, 480)
    scene.render.filepath = str(RENDER_DIR / "twin-mod.png")
    bpy.ops.render.render(write_still=True)
    print("Rendered", scene.render.filepath)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    mats = {
        "white": material("Plastic white", WHITE),
        "charcoal": material("Plastic charcoal", CHARCOAL),
        "yellow": material("Plastic yellow", YELLOW),
        "orange": material("Bumper orange", ORANGE),
    }
    body, barrels, mag, trg, muzzle_1 = build_model(mats)
    twin, barrels_2, muzzle_2 = build_twin(mats)
    print("Built", ", ".join(o.name for o in (body, barrels, mag, trg,
                                              twin, barrels_2, muzzle_2)))
    unapplied = [o.name for o in bpy.data.objects if o.modifiers]
    if unapplied:
        raise RuntimeError("Unapplied modifiers: " + ", ".join(unapplied))
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
    render_views()


def build_twin(mats):
    """The Twin mod assembly: parent mod_twin (empty at its axis
    centre, hidden by default) with children barrels_2 (six barrels,
    hub, plates; spins on its own axis) and a bumper; muzzle_2 a child
    of mod_twin."""
    charcoal = mats["charcoal"]
    yellow = mats["yellow"]
    orange = mats["orange"]
    parts = []
    hub_y0, hub_y1 = BARREL_BACK + 0.01, BARREL_FRONT - 0.005
    hub_len = hub_y1 - hub_y0
    parts.append(cylinder("Twin hub", (TWIN_X, (hub_y0 + hub_y1) / 2, BORE_Z),
                          HUB_R, hub_len, charcoal, 16, 0))
    for i in range(6):
        angle = i * math.tau / 6 + math.pi / 6
        bx = TWIN_X + CLUSTER_R * math.cos(angle)
        bz = BORE_Z + CLUSTER_R * math.sin(angle)
        parts.append(cylinder("Twin barrel " + str(i + 1),
                              (bx, (BARREL_BACK + BARREL_FRONT) / 2, bz),
                              BARREL_R, BARREL_L, charcoal, 14, SMALL_BEVEL))
        parts.append(cylinder("Twin band " + str(i + 1),
                              (bx, BARREL_FRONT - 0.03, bz),
                              BARREL_R + 0.0025, 0.014, yellow, 14, 0))
    parts.append(cylinder("Twin drive plate", (TWIN_X, DRIVE_Y, BORE_Z),
                          PLATE_R, DRIVE_L, charcoal, 28, SMALL_BEVEL))
    front = cylinder("Twin front plate", (TWIN_X, FRONT_PLATE_Y, BORE_Z),
                     PLATE_R, FRONT_PLATE_T, charcoal, 28, 0)
    for i in range(6):
        angle = i * math.tau / 6 + math.pi / 6
        bx = TWIN_X + CLUSTER_R * math.cos(angle)
        bz = BORE_Z + CLUSTER_R * math.sin(angle)
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=14, radius=BARREL_R + 0.0025, depth=FRONT_PLATE_T * 3,
            location=(bx, FRONT_PLATE_Y, bz), rotation=(math.pi / 2, 0, 0))
        cutter = bpy.context.object
        cutter.name = "twin hole cutter"
        cut(front, cutter)
    parts.append(front)
    barrels_2 = join_at(parts, "barrels_2",
                        (TWIN_X, (BARREL_BACK + BARREL_FRONT) / 2, BORE_Z))
    bump = tube("Twin bumper", (TWIN_X, BUMPER_Y, BORE_Z),
                BUMPER_OR, BUMPER_IR, BUMPER_T, orange, 28)
    group = bpy.data.objects.new("mod_twin", None)
    bpy.context.collection.objects.link(group)
    group.location = (TWIN_X, (BARREL_BACK + BARREL_FRONT) / 2, BORE_Z)
    group.empty_display_size = 0.01
    group["hidden"] = True
    parent_keep_world(barrels_2, group)
    parent_keep_world(bump, group)
    muzzle_2 = bpy.data.objects.new("muzzle_2", None)
    bpy.context.collection.objects.link(muzzle_2)
    muzzle_2.location = (TWIN_X, MUZZLE_Y, BORE_Z)
    muzzle_2.empty_display_size = 0.01
    parent_keep_world(muzzle_2, group)
    return group, barrels_2, muzzle_2


main()
