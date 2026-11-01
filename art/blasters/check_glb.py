"""Import a blaster GLB in Blender and report the PLAN 5.2 contract checks."""
from pathlib import Path
import math
import re
import sys
import bpy
from mathutils import Matrix, Vector

MAX_TRIANGLES = 20000
MAX_BYTES = int(1.5 * 1024 * 1024)
MAX_MATERIALS = 8
B01_SIZE = (0.06, 0.62, 0.24)
B01_TOLERANCE = (0.02, 0.04, 0.04)
B01_NODES = {"body", "pump", "trigger", "mag", "mod_double"}
B01_NODES.update("muzzle_" + str(i) for i in range(1, 7))


def has_hidden_ancestor(obj):
    parent = obj.parent
    while parent:
        if parent.get("hidden", False):
            return True
        parent = parent.parent
    return False


def world_bounds(objects):
    points = [obj.matrix_world @ Vector(corner)
              for obj in objects for corner in obj.bound_box]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    return low, high


def centre_error(obj):
    low, high = world_bounds([obj])
    return ((low + high) / 2 - obj.matrix_world.translation).length


def main():
    if "--" not in sys.argv or not sys.argv[sys.argv.index("--") + 1:]:
        raise SystemExit("Usage: Blender --background --python check_glb.py -- model.glb")
    path = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    default_meshes = [obj for obj in meshes if not has_hidden_ancestor(obj)
                      and not obj.get("hidden", False)]
    triangles = sum(sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
                    for obj in meshes)
    materials = {slot.material for obj in meshes for slot in obj.material_slots
                 if slot.material is not None}
    image_nodes = [node for mat in materials if mat.use_nodes
                   for node in mat.node_tree.nodes if node.type == "TEX_IMAGE"]
    low, high = world_bounds(default_meshes)
    size = high - low
    bytes_on_disk = path.stat().st_size

    print("FILE:", path)
    print("SIZE_METRES: X width={:.4f}, Y length={:.4f}, Z height={:.4f}".format(*size))
    print("GLB_SIZE_BYTES:", bytes_on_disk)
    print("TRIANGLES:", triangles)
    print("MATERIALS:", len(materials), ", ".join(sorted(mat.name for mat in materials)))
    print("NODES:")
    for obj in sorted(objects, key=lambda item: item.name):
        origin = obj.matrix_world.translation
        parent = obj.parent.name if obj.parent else "None"
        print("  {} | parent={} | origin=({:.5f}, {:.5f}, {:.5f}) | type={}".format(
            obj.name, parent, origin.x, origin.y, origin.z, obj.type))

    results = []

    def check(name, passed, detail=""):
        results.append((name, passed))
        print("{}: {}{}".format("PASS" if passed else "FAIL", name,
                                ", " + detail if detail else ""))

    check("GLB at most 1.5 MB", bytes_on_disk <= MAX_BYTES)
    check("At most 20000 triangles", triangles <= MAX_TRIANGLES)
    check("At most 8 materials", len(materials) <= MAX_MATERIALS)
    check("No image textures", not image_nodes)
    check("No text nodes", not any(obj.type == "FONT" for obj in objects))
    body = bpy.data.objects.get("body")
    check("Named body node", body is not None and body.type == "MESH")
    if body:
        check("Origin at trigger-hand grip", body.matrix_world.translation.length < 0.0001)
    check("Metres, plausible true size", all(0.005 < value < 2.0 for value in size))
    check("+Y up in glTF (Z up after Blender import)", size.z > size.x)
    muzzles = {obj.name: obj for obj in objects
               if re.fullmatch(r"muzzle_[1-9][0-9]*", obj.name)}
    numbers = sorted(int(name.split("_")[1]) for name in muzzles)
    check("Contiguous muzzle_1 to muzzle_n", bool(numbers)
          and numbers == list(range(1, len(numbers) + 1)))
    if muzzles and body:
        forward = sum(obj.matrix_world.translation.y for obj in muzzles.values()) / len(muzzles)
        check("Muzzles forward along glTF -Z", forward > body.matrix_world.translation.y)
    check("Every modifier applied before export", not any(obj.modifiers for obj in objects))

    pump = bpy.data.objects.get("pump")
    if pump:
        check("Pump origin at rest centre", centre_error(pump) < 0.005)
    mag = bpy.data.objects.get("mag")
    if mag:
        check("Magazine origin at rest centre", centre_error(mag) < 0.005)
    trigger = bpy.data.objects.get("trigger")
    if trigger:
        rest_matrix = trigger.matrix_world.copy()
        _, trigger_high = world_bounds([trigger])
        error = abs(trigger_high.z - rest_matrix.translation.z)
        check("Trigger origin at top pivot", error < 0.006)
        rest_points = [rest_matrix @ vertex.co for vertex in trigger.data.vertices]
        rest_lowest = min(rest_points, key=lambda point: point.z)
        trigger.matrix_world = rest_matrix @ Matrix.Rotation(math.radians(15), 4, "X")
        bpy.context.view_layer.update()
        pulled_points = [trigger.matrix_world @ vertex.co
                         for vertex in trigger.data.vertices]
        pulled_lowest = min(pulled_points, key=lambda point: point.z)
        movement = pulled_lowest.y - rest_lowest.y
        check("Positive local X pulls trigger toward grip", movement < -0.001,
              "lowest point Blender Y change {:.5f} m at +15 degrees".format(movement))
        trigger.matrix_world = rest_matrix
    for obj in objects:
        if obj.name.startswith("mod_"):
            check(obj.name + " hidden by default", obj.get("hidden", False) is True)

    if path.stem == "B01":
        check("B01 required named nodes", B01_NODES.issubset(bpy.data.objects.keys()))
        for axis, label in enumerate(("width", "length", "height")):
            check("B01 approximate " + label,
                  abs(size[axis] - B01_SIZE[axis]) <= B01_TOLERANCE[axis],
                  "expected {:.2f} m".format(B01_SIZE[axis]))
        mod = bpy.data.objects.get("mod_double")
        for i in range(4, 7):
            muzzle = bpy.data.objects.get("muzzle_" + str(i))
            check(muzzle.name + " under mod_double" if muzzle else "muzzle_" + str(i),
                  muzzle is not None and muzzle.parent == mod)

    failed = [name for name, passed in results if not passed]
    print("SUMMARY:", "PASS" if not failed else "FAIL: " + "; ".join(failed))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
