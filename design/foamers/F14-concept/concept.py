"""Build the F14 elite Foamer concept (BENCH-01), render front/side/back/three-quarter.

Concept model, not a game asset: rounded voxel-like blocks, the Foamer palette,
cream eyes. Not voxel-rig format; no rig. Not approved for the game.
All output paths are inside benchmarks/inkling/elite/.
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector

OUT_DIR = Path(__file__).resolve().parent
RENDER_DIR = OUT_DIR / "renders"
BACKGROUND = (0.78, 0.78, 0.78, 1.0)
RESOLUTION = (900, 900)
ORTHO_SCALE = 2.25
LIGHT_ENERGY = (20.0, 16.0, 18.0)
LIGHT_SIZE = 0.6

PURPLE = "#5b2fb8"
PURPLE_DEEP = "#3d2470"
LIME = "#b6ff3b"
LIME_DEEP = "#6fae12"
ORANGE = "#ff7a1a"
ORANGE_DEEP = "#c24e00"
INK = "#2a2340"
CREAM = "#fff3d0"
GROUND = "#8b8b99"


def rgba(hex_colour):
    h = hex_colour.lstrip("#")
    srgb = tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    linear = tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
                   for c in srgb)
    return linear + (1.0,)


def material(name, colour):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba(colour)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba(colour)
    bsdf.inputs["Roughness"].default_value = 0.42
    return mat


def bevel(obj, width=0.02, segments=3):
    mod = obj.modifiers.new("Round edges", "BEVEL")
    mod.width = width
    mod.segments = segments
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    normal = obj.modifiers.new("Soft normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    return obj


def box(name, loc, dims, mat, edge=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return bevel(obj, edge)


def cyl(name, loc, radius, depth, mat, rot=(math.pi / 2, 0, 0), vertices=20, edge=0.01):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                        location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    return bevel(obj, edge, 1)


def build_model():
    purple = material("Deep purple", PURPLE)
    purple_deep = material("Deep purple dark", PURPLE_DEEP)
    lime = material("Lime armour", LIME)
    lime_deep = material("Lime deep", LIME_DEEP)
    orange = material("Orange legs", ORANGE)
    ink = material("Ink visor", INK)
    cream = material("Cream eyes", CREAM)
    ground = material("Ground line", GROUND)

    objects = []

    # Ground line
    objects.append(box("Ground line", (0, 0, 0.001), (1.9, 0.006, 0.004), ground, 0.002))

    # Legs (bright orange, the weak point) and feet
    for side, x in (("Left", -0.19), ("Right", 0.19)):
        objects.append(box("Leg " + side, (x, 0.0, 0.34), (0.24, 0.28, 0.45), orange, 0.04))
        objects.append(box("Foot " + side, (x, 0.05, 0.075), (0.28, 0.42, 0.15), orange, 0.04))

    # Torso (deep purple, wide)
    objects.append(box("Body", (0, 0, 1.02), (1.02, 0.46, 0.84), purple, 0.09))

    # Back plate (lime)
    objects.append(box("Back plate", (0, -0.26, 1.14), (0.58, 0.10, 0.36), lime_deep, 0.03))

    # Chest plate (lime)
    objects.append(box("Chest plate", (0, 0.25, 1.06), (0.62, 0.13, 0.42), lime, 0.04))

    # Shoulder plates (lime)
    for side, x in (("Left", -0.56), ("Right", 0.56)):
        objects.append(box("Shoulder " + side, (x, 0.0, 1.34), (0.24, 0.48, 0.26), lime, 0.05))

    # Head (deep purple, flat-topped)
    objects.append(box("Head", (0, 0.04, 1.58), (0.46, 0.42, 0.34), purple, 0.06))

    # Visor band (ink) with cream eyes
    objects.append(box("Visor band", (0, 0.22, 1.58), (0.48, 0.12, 0.11), ink, 0.02))
    for side, x in (("Left", -0.11), ("Right", 0.11)):
        objects.append(cyl("Eye " + side, (x, 0.285, 1.58), 0.045, 0.02, cream,
                            rot=(math.pi / 2, 0, 0), vertices=18, edge=0.006))

    # Arms (deep purple) with lime fists
    for side, x in (("Left", -0.62), ("Right", 0.62)):
        objects.append(box("Arm " + side, (x, 0.0, 0.90), (0.22, 0.28, 0.60), lime_deep, 0.05))
        objects.append(box("Fist " + side, (x, 0.03, 0.60), (0.26, 0.27, 0.27), lime, 0.05))

    # Maul in the right hand: purple handle, lime head
    top = Vector((0.70, 0.03, 0.74))
    bottom = Vector((0.70, 0.28, 0.24))
    axis = bottom - top
    handle_center = (top + bottom) / 2
    handle = cyl("Maul handle", (handle_center[0], handle_center[1], handle_center[2]), 0.048, axis.length, purple_deep,
                 rot=(0, 0, 0), vertices=16, edge=0.016)
    handle.rotation_euler = axis.to_track_quat("Z", "Y").to_euler()
    objects.append(handle)
    objects.append(box("Maul head", (0.70, 0.28, 0.30), (0.38, 0.38, 0.42), lime, 0.08))

    return objects


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_camera(name, loc, target=None):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    if target is None:
        obj.rotation_euler = (0, 0, 0)
    else:
        point_at(obj, target)
    data.type = "ORTHO"
    data.ortho_scale = ORTHO_SCALE
    data.clip_start = 0.01
    data.clip_end = 100
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
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    world = bpy.data.worlds.new("Light grey studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = BACKGROUND
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.75
    scene.world = world
    target = (0, 0, 0.9)
    area_light("Key", (0.9, 0.7, 2.2), LIGHT_ENERGY[0], target)
    area_light("Fill", (-0.9, 0.5, 1.4), LIGHT_ENERGY[1], target)
    area_light("Rear", (0.1, -1.1, 1.6), LIGHT_ENERGY[2], target)

    views = [
        ("front", add_camera("Front camera", (0.0, 2.6, 0.9), target)),
        ("side", add_camera("Side camera", (2.6, 0.0, 0.9), target)),
        ("back", add_camera("Back camera", (0.0, -2.6, 0.9), target)),
        ("three-quarter", add_camera("Three quarter camera", (1.55, 1.85, 1.25), target)),
    ]
    for name, camera in views:
        scene.camera = camera
        scene.render.filepath = str(RENDER_DIR / (name + ".png"))
        bpy.ops.render.render(write_still=True)
        print("Rendered", scene.render.filepath)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    objects = build_model()
    print("Built", len(objects), "objects")
    render_views()


if __name__ == "__main__":
    main()
