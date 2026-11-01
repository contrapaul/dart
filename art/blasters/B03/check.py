"""Check B03-specific names, dimensions, hierarchy, and motion after import."""
from pathlib import Path
import math
import sys
import bpy
from mathutils import Matrix, Vector

EXPECTED_SIZE = (0.07, 0.80, 0.20)
SIZE_TOLERANCE = (0.012, 0.025, 0.02)
REQUIRED = {"body", "breach", "trigger", "latch", "fore-end", "mod_quad"}
REQUIRED.update("shell_" + str(i) for i in range(1, 5))
REQUIRED.update("muzzle_" + str(i) for i in range(1, 5))


def world_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    return low, high


def hidden(obj):
    if obj.get("hidden", False):
        return True
    return hidden(obj.parent) if obj.parent else False


def main():
    if "--" not in sys.argv or not sys.argv[sys.argv.index("--") + 1:]:
        raise SystemExit("Usage: Blender --background --python check.py -- B03.glb")
    path = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    objects = bpy.data.objects
    results = []

    def check(name, passed, detail=""):
        results.append((name, passed))
        print("{}: {}{}".format("PASS" if passed else "FAIL", name,
                                ", " + detail if detail else ""))

    check("B03 required named nodes", REQUIRED.issubset(objects.keys()))
    meshes = [obj for obj in objects if obj.type == "MESH" and not hidden(obj)]
    points = [obj.matrix_world @ Vector(corner)
              for obj in meshes for corner in obj.bound_box]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    size = high - low
    for axis, label in enumerate(("width", "length", "height")):
        check("B03 approximate " + label,
              abs(size[axis] - EXPECTED_SIZE[axis]) <= SIZE_TOLERANCE[axis],
              "{:.4f} m, expected {:.2f} m".format(size[axis], EXPECTED_SIZE[axis]))

    expected_origins = {
        "body": (0, 0, 0), "breach": (0, 0.105, 0.04),
        "trigger": (0, 0.014, 0.037), "latch": (0, 0.015, 0.105),
        "shell_1": (-0.018, 0.075, 0.09), "shell_2": (0.018, 0.075, 0.09),
        "shell_3": (-0.018, 0.075, 0.052), "shell_4": (0.018, 0.075, 0.052),
    }
    for name, expected in expected_origins.items():
        obj = objects.get(name)
        error = (obj.matrix_world.translation - Vector(expected)).length if obj else 1
        check(name + " origin", error < 0.0005, "{:.5f} m error".format(error))

    parents = {
        "shell_1": "breach", "shell_2": "breach",
        "muzzle_1": "breach", "muzzle_2": "breach", "fore-end": "breach",
        "mod_quad": "breach",
        "shell_3": "mod_quad", "shell_4": "mod_quad",
        "muzzle_3": "mod_quad", "muzzle_4": "mod_quad",
    }
    for name, parent in parents.items():
        obj = objects.get(name)
        check(name + " parented to " + parent,
              obj is not None and obj.parent == objects.get(parent))
    breach = objects.get("breach")
    if breach:
        check("Only intended direct breach children",
              {obj.name for obj in breach.children} == set(parents) - {
                  "shell_3", "shell_4", "muzzle_3", "muzzle_4"})

    for i in range(1, 5):
        shell = objects.get("shell_" + str(i))
        if shell:
            shell_low, shell_high = world_bounds(shell)
            shell_size = shell_high - shell_low
            centre = (shell_low + shell_high) / 2
            check(shell.name + " 7 x 3 cm and centred",
                  abs(shell_size.y - 0.07) < 0.004
                  and abs(shell_size.x - 0.03) < 0.003
                  and abs(shell_size.z - 0.03) < 0.003
                  and (centre - shell.matrix_world.translation).length < 0.004)

    trigger = objects.get("trigger")
    if trigger:
        trigger_low, trigger_high = world_bounds(trigger)
        trigger_size = trigger_high - trigger_low
        check("Trigger 2.5 x 1.2 x 0.8 cm",
              abs(trigger_size.z - 0.025) < 0.002
              and abs(trigger_size.y - 0.012) < 0.003
              and abs(trigger_size.x - 0.008) < 0.001)
        check("Trigger near back of guard and ahead of wrist",
              0.010 <= trigger.matrix_world.translation.y <= 0.015)
        rest = trigger.matrix_world.copy()
        rest_points = [rest @ vertex.co for vertex in trigger.data.vertices]
        rest_lowest = min(rest_points, key=lambda point: point.z)
        trigger.matrix_world = rest @ Matrix.Rotation(math.radians(15), 4, "X")
        bpy.context.view_layer.update()
        pulled = [trigger.matrix_world @ vertex.co for vertex in trigger.data.vertices]
        lowest = min(pulled, key=lambda point: point.z)
        movement = lowest.y - rest_lowest.y
        check("B03 positive local X pulls trigger", movement < -0.001,
              "Blender Y change {:.5f} m".format(movement))
        trigger.matrix_world = rest

    latch = objects.get("latch")
    if latch:
        rest = latch.matrix_world.copy()
        rear_local = min(latch.data.vertices,
                         key=lambda vertex: (rest @ vertex.co).y).co.copy()
        rear = rest @ rear_local
        latch.matrix_world = rest @ Matrix.Rotation(math.radians(30), 4, "Z")
        bpy.context.view_layer.update()
        turned = latch.matrix_world @ rear_local
        check("Positive glTF local Y turns latch right", turned.x > rear.x + 0.01,
              "Blender X change {:.5f} m".format(turned.x - rear.x))
        latch.matrix_world = rest

    if breach:
        rest = breach.matrix_world.copy()
        muzzle = objects.get("muzzle_1")
        shell = objects.get("shell_1")
        muzzle_rest = muzzle.matrix_world.translation.copy()
        shell_rest = shell.matrix_world.copy()
        rear_local = min(shell.data.vertices,
                         key=lambda vertex: (shell_rest @ vertex.co).y).co.copy()
        rear = shell_rest @ rear_local
        breach.matrix_world = rest @ Matrix.Rotation(math.radians(-40), 4, "X")
        bpy.context.view_layer.update()
        drop = muzzle.matrix_world.translation.z - muzzle_rest.z
        rise = (shell.matrix_world @ rear_local).z - rear.z
        check("Negative local X opens breach 40 degrees", drop < -0.18,
              "muzzle Blender Z change {:.5f} m".format(drop))
        check("Chamber end rises out of action", rise > 0.03,
              "shell rear Blender Z change {:.5f} m".format(rise))
        breach.matrix_world = rest

    failed = [name for name, passed in results if not passed]
    print("B03 SUMMARY:", "PASS" if not failed else "FAIL: " + "; ".join(failed))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
