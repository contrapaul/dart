"""Build B02 Musketeer from the approved written brief, export GLB, render views."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "public" / "models" / "blasters"
RENDER_DIR = ROOT / "art" / "blasters" / "B02" / "renders"
GLB_PATH = OUT_DIR / "B02.glb"

# Colours (design/blasters/B02.md): yellow lead, charcoal furniture, purple
# accents, the orange safety bumper, a see-through lime magazine.
YELLOW = "#ffd23f"
YELLOW_DEEP = "#e8b81c"
CHARCOAL = "#2b2b33"
PURPLE = "#9b5cff"
ORANGE = "#ff7a1a"
LIME = "#b6ff3b"
BACKGROUND = (0.72, 0.72, 0.72, 1.0)
ROUGHNESS = 0.4
MAG_ALPHA = 0.5
BEVEL = 0.003
SMALL_BEVEL = 0.001

# Blender axes: +Y forward (the muzzle), +Z up, X across. Origin at the top
# of the grip, where the trigger hand holds it. Metres at true size.
FRAME_BACK, FRAME_FRONT = -0.050, 0.170
FRAME_BOTTOM, FRAME_TOP, FRAME_W = 0.045, 0.085, 0.036
SLIDE_BACK, SLIDE_FRONT = -0.062, 0.170
SLIDE_BOTTOM, SLIDE_TOP, SLIDE_W = 0.084, 0.120, 0.033
SLIDE_GROOVES, GROOVE_L, GROOVE_DEPTH = 5, 0.004, 0.0025
GROOVE_Y0, GROOVE_STEP = -0.052, 0.008
REAR_SIGHT_Y, FRONT_SIGHT_Y = -0.052, 0.158
SIGHT_H = 0.008
BARREL_Y0, BARREL_Y1, BARREL_R, BARREL_Z = 0.165, 0.180, 0.011, 0.068
# A plain round bumper on the barrel tip (Paul, 2026-11-07: no flare).
BUMPER_Y0, BUMPER_Y1 = 0.178, 0.194
BUMPER_R, BUMPER_INNER = 0.017, 0.008
MUZZLE_Y = BUMPER_Y1

GRIP_H, GRIP_D, GRIP_W = 0.10, 0.045, 0.032
GRIP_ANGLE = math.radians(15)
GRIP_CORNER = 0.009
GRIP_TEX_SIZE, GRIP_TEX_RIBS = 128, 8
GUARD_W = 0.022
TRIGGER_H, TRIGGER_D, TRIGGER_W = 0.024, 0.012, 0.008
TRIGGER_ORIGIN = (0.0, 0.013, 0.047)

# The magazine sits in the grip, tilted with it; its lime end and base plate
# show just below the grip's bottom.
MAG_H, MAG_D, MAG_W = 0.090, 0.030, 0.022
MAG_SHOW = 0.016
BASE_H = 0.006

RESOLUTION = (1024, 768)
ORTHO_SCALE = 0.42
EYE_CAMERA_LOC = (-0.16, -0.40, 0.14)
EYE_CAMERA_LENS = 40
LIGHT_ENERGY = (18.0, 13.0, 16.0)
LIGHT_SIZE = 0.6


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


def rounded_grip(mat):
    ring_specs = [
        (0.045, 0.78), (0.043, 0.93), (0.040, 1.0),
        (0.032, 1.0), (0.020, 1.025), (0.005, 1.055),
        (-0.010, 1.06), (-0.025, 1.03), (-0.040, 1.0),
        (-0.049, 1.08), (-0.052, 1.04), (0.045 - GRIP_H, 0.82),
    ]
    corner_segments = 8
    count = corner_segments * 4
    vertices = []
    ring_scales = []
    for z, scale in ring_specs:
        half_x = GRIP_W * scale / 2
        half_y = GRIP_D * scale / 2
        radius = GRIP_CORNER * scale
        centre_y = -GRIP_D / 2 - math.tan(GRIP_ANGLE) * (0.045 - z)
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
                  + math.tan(GRIP_ANGLE) * (0.045 - vertices[index][2]))
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
            u_next = (i + 1) / count
            faces.append((upper + i, lower + i, lower + j, upper + j))
            face_uvs.append(((i / count, v_top), (i / count, v_bottom),
                             (u_next, v_bottom), (u_next, v_top)))
    bottom = tuple(reversed(range((len(ring_specs) - 1) * count,
                                  len(ring_specs) * count)))
    faces.append(bottom)
    face_uvs.append(cap_uv(bottom, ring_scales[-1]))

    obj = mesh_object("Smooth rounded grip", vertices, faces, mat)
    uv = obj.data.uv_layers.new(name="UV" + "Map")
    for polygon, coordinates in zip(obj.data.polygons, face_uvs):
        for loop, coordinate in zip(polygon.loop_indices, coordinates):
            uv.data[loop].uv = coordinate
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


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


def grip_axis_y(z):
    """The grip's centre line: it leans back as it goes down."""
    return -GRIP_D / 2 - math.tan(GRIP_ANGLE) * (0.045 - z)


def build_model():
    yellow = material("Foam yellow", YELLOW)
    yellow_deep = material("Deep yellow", YELLOW_DEEP)
    charcoal = material("Charcoal", CHARCOAL)
    grip_charcoal = grip_material()
    purple = material("Foam purple", PURPLE)
    orange = material("Safety orange", ORANGE)
    lime = material("Clear lime", LIME, MAG_ALPHA)
    static = []

    # Frame: a rounded slab with a sloped nose; the barrel leaves its front.
    frame_points = [
        (FRAME_BACK, FRAME_BOTTOM + 0.006), (FRAME_BACK + 0.006, FRAME_BOTTOM),
        (FRAME_FRONT - 0.012, FRAME_BOTTOM), (FRAME_FRONT, FRAME_BOTTOM + 0.012),
        (FRAME_FRONT, FRAME_TOP), (FRAME_BACK, FRAME_TOP),
    ]
    static.append(profile("Frame", frame_points, FRAME_W, yellow_deep))
    static.append(cylinder("Barrel", (0, (BARREL_Y0 + BARREL_Y1) / 2, BARREL_Z),
                           BARREL_R, BARREL_Y1 - BARREL_Y0, yellow_deep, 24))
    static.append(tube("Round muzzle bumper",
                       (0, (BUMPER_Y0 + BUMPER_Y1) / 2, BARREL_Z),
                       BUMPER_R, BUMPER_INNER, BUMPER_Y1 - BUMPER_Y0, orange, 24))

    static.append(rounded_grip(grip_charcoal))
    guard_outer = [(-0.006, 0.018), (0.008, 0.007), (0.038, 0.007),
                   (0.051, 0.018), (0.053, 0.039), (0.047, 0.049),
                   (-0.001, 0.047)]
    guard_inner = [(0.004, 0.023), (0.014, 0.015), (0.041, 0.015),
                   (0.049, 0.023), (0.049, 0.032), (0.047, 0.040),
                   (0.008, 0.039)]
    guard = profile("Trigger guard", guard_outer, GUARD_W, charcoal)
    cutter = profile("Guard opening", guard_inner, GUARD_W + 0.02, charcoal, 0)
    mod = guard.modifiers.new("Moulded guard opening", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    apply_modifier(guard, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)
    bevel(guard, 0.0006, 2)
    static.append(guard)

    # Slide: moves back along its own Y on each shot. Purple grip grooves at
    # the back, a notch rear sight and a post front sight on top.
    slide_points = [
        (SLIDE_BACK, SLIDE_BOTTOM), (SLIDE_FRONT - 0.006, SLIDE_BOTTOM),
        (SLIDE_FRONT, SLIDE_BOTTOM + 0.008), (SLIDE_FRONT, SLIDE_TOP - 0.010),
        (SLIDE_FRONT - 0.016, SLIDE_TOP), (SLIDE_BACK + 0.004, SLIDE_TOP),
        (SLIDE_BACK, SLIDE_TOP - 0.004),
    ]
    slide_parts = [profile("Slide", slide_points, SLIDE_W, yellow)]
    for i in range(SLIDE_GROOVES):
        y = GROOVE_Y0 + i * GROOVE_STEP
        for side in (-1, 1):
            slide_parts.append(box("Slide groove",
                                   (side * (SLIDE_W / 2 + GROOVE_DEPTH / 2 - 0.0008), y,
                                    (SLIDE_BOTTOM + SLIDE_TOP) / 2 + 0.002),
                                   (GROOVE_DEPTH, GROOVE_L, SLIDE_TOP - SLIDE_BOTTOM - 0.012),
                                   purple, SMALL_BEVEL))
    for x in (-0.007, 0.007):
        slide_parts.append(box("Rear sight ear", (x, REAR_SIGHT_Y, SLIDE_TOP + SIGHT_H / 2),
                               (0.006, 0.008, SIGHT_H), purple, SMALL_BEVEL))
    slide_parts.append(box("Front sight post", (0, FRONT_SIGHT_Y, SLIDE_TOP + SIGHT_H / 2),
                           (0.004, 0.006, SIGHT_H), purple, SMALL_BEVEL))
    slide = join_at(slide_parts, "slide",
                    (0, (SLIDE_BACK + SLIDE_FRONT) / 2, (SLIDE_BOTTOM + SLIDE_TOP) / 2))

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

    # Magazine: a box in the grip, tilted with it, its end showing below.
    grip_bottom = 0.045 - GRIP_H
    mag_bottom = grip_bottom - MAG_SHOW
    mag_centre_z = mag_bottom + BASE_H + MAG_H / 2
    tilt = -GRIP_ANGLE
    mag_shell = box("Magazine shell", (0, grip_axis_y(mag_centre_z), mag_centre_z),
                    (MAG_W, MAG_D, MAG_H), lime, 0.002)
    base_z = mag_bottom + BASE_H / 2
    base = box("Magazine base plate", (0, grip_axis_y(base_z), base_z),
               (MAG_W + 0.006, MAG_D + 0.006, BASE_H), purple, 0.002)
    for part, z in ((mag_shell, mag_centre_z), (base, base_z)):
        pivot = Vector((0, grip_axis_y(z), z))
        part.rotation_euler.x = tilt
        part.location = pivot
    mag = join_at([mag_shell, base], "mag",
                  (0, grip_axis_y(mag_centre_z), mag_centre_z))

    for obj in static:
        if obj.name != "Smooth rounded grip":
            while obj.data.uv_layers:
                obj.data.uv_layers.remove(obj.data.uv_layers[0])
    body = join_at(static, "body", (0, 0, 0))
    for part in (slide, trigger, mag):
        parent_keep_world(part, body)

    muzzle = bpy.data.objects.new("muzzle_1", None)
    bpy.context.collection.objects.link(muzzle)
    muzzle.location = (0, MUZZLE_Y, BARREL_Z)
    muzzle.empty_display_size = 0.01
    parent_keep_world(muzzle, body)
    return body, slide, trigger, mag


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
    target = (0, 0.08, 0.035)
    area_light("Key softbox", (0.55, 0.35, 0.8), LIGHT_ENERGY[0], target)
    area_light("Fill softbox", (-0.6, 0.1, 0.4), LIGHT_ENERGY[1], target)
    area_light("Rear softbox", (0.1, -0.6, 0.6), LIGHT_ENERGY[2], target)

    views = [
        ("side", add_camera("Side camera", (1.0, 0.08, 0.035), target)),
        ("three-quarter", add_camera("Three quarter camera", (0.6, 0.65, 0.42), target)),
        ("top", add_camera("Top camera", (0, 0.08, 1.0))),
        ("front", add_camera("Front camera", (0.0, 1.0, 0.06), (0, 0.08, 0.06))),
    ]
    views[2][1].rotation_euler.z = math.pi / 2
    eye = add_camera("First person camera", EYE_CAMERA_LOC, ortho=False)
    point_at(eye, (-0.03, 0.45, 0.13))
    views.append(("first-person", eye))
    for name, camera in views:
        scene.camera = camera
        scene.render.filepath = str(RENDER_DIR / (name + ".png"))
        bpy.ops.render.render(write_still=True)
        print("Rendered", scene.render.filepath)

    closeup = add_camera("Grip closeup camera", (1.0, 0.0, 0.0), (0, 0.0, 0.0))
    closeup.data.ortho_scale = 0.17
    scene.camera = closeup
    scene.render.resolution_x, scene.render.resolution_y = (512, 512)
    scene.render.filepath = str(RENDER_DIR / "grip-closeup.png")
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
    # Only the grip uses UVs. Primitive UVs vary slightly between runs.
    body = objects[0]
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


if __name__ == "__main__":
    main()
