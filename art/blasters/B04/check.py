"""Check B04-specific node, size, parenting and motion contract rules."""
from pathlib import Path
import math
import sys
import bpy
from mathutils import Matrix, Vector

REQUIRED = {"body", "trigger", "mag", "flywheel_l", "flywheel_r", "muzzle_1"}
MOVING = ("trigger", "mag", "flywheel_l", "flywheel_r")
EXPECTED_ORIGINS = {
    "trigger": (0.0, 0.013, 0.049),
    "mag": (0.0, 0.150, -0.025),
    "flywheel_l": (-0.006, 0.119, 0.090),
    "flywheel_r": (0.018, 0.151, 0.090),
    "muzzle_1": (0.0, 0.490, 0.100),
}


def world_bounds(obj):
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    low = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    high = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    return low, high


def main():
    if "--" not in sys.argv or not sys.argv[sys.argv.index("--") + 1:]:
        raise SystemExit("Usage: Blender --background --python check.py -- B04.glb")
    path = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    results = []

    def check(name, passed, detail=""):
        results.append((name, passed))
        print("{}: {}{}".format("PASS" if passed else "FAIL", name,
                                ", " + detail if detail else ""))

    def near(actual, expected, tolerance=0.0001):
        return abs(actual - expected) <= tolerance

    def origin_near(obj, expected, tolerance=0.0001):
        return (obj.matrix_world.translation - Vector(expected)).length <= tolerance

    check("B04 required named nodes", REQUIRED.issubset(bpy.data.objects.keys()),
          ", ".join(sorted(REQUIRED)))
    body = bpy.data.objects.get("body")
    check("Body is unparented at grip origin",
          body is not None and body.parent is None
          and body.matrix_world.translation.length < 0.0001)
    for name in MOVING + ("muzzle_1",):
        obj = bpy.data.objects.get(name)
        check(name + " parented to body", obj is not None and obj.parent == body)
    for name, expected in EXPECTED_ORIGINS.items():
        obj = bpy.data.objects.get(name)
        check(name + " origin at brief position",
              obj is not None and origin_near(obj, expected),
              "expected ({:.3f}, {:.3f}, {:.3f}) m".format(*expected))

    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    points = [obj.matrix_world @ Vector(corner)
              for obj in meshes for corner in obj.bound_box]
    low = Vector(tuple(min(point[i] for point in points) for i in range(3)))
    high = Vector(tuple(max(point[i] for point in points) for i in range(3)))
    size = high - low
    check("Overall length about 75 cm", near(size.y, 0.75, 0.02),
          "{:.3f} m".format(size.y))
    check("Rail top to magazine bottom about 26 cm",
          near(0.160 - low.z, 0.26, 0.015),
          "{:.3f} m".format(0.160 - low.z))
    check("Flywheel housing about 8 cm wide", near(size.x, 0.08, 0.006),
          "{:.3f} m including window frame".format(size.x))

    for name in ("flywheel_l", "flywheel_r"):
        wheel = bpy.data.objects.get(name)
        if wheel is None:
            continue
        wheel_low, wheel_high = world_bounds(wheel)
        wheel_size = wheel_high - wheel_low
        check(name + " diameter 4 cm",
              near(wheel_size.x, 0.04, 0.002)
              and near(wheel_size.y, 0.04, 0.002),
              "{:.3f} x {:.3f} m".format(wheel_size.x, wheel_size.y))
        check(name + " thickness about 1.5 cm", near(wheel_size.z, 0.015, 0.002),
              "{:.3f} m including hub and markers".format(wheel_size.z))
        local_vertical = wheel.matrix_world.to_3x3() @ Vector((0, 0, 1))
        check(name + " local glTF Y axis is vertical",
              local_vertical.normalized().dot(Vector((0, 0, 1))) > 0.999)
        centre = (wheel_low + wheel_high) / 2
        centre.z = wheel.matrix_world.translation.z
        check(name + " origin at wheel centre",
              (centre - wheel.matrix_world.translation).length < 0.001)

    trigger = bpy.data.objects.get("trigger")
    if trigger is not None:
        rest = trigger.matrix_world.copy()
        rest_points = [rest @ vertex.co for vertex in trigger.data.vertices]
        rest_lowest = min(rest_points, key=lambda point: point.z)
        trigger.matrix_world = rest @ Matrix.Rotation(math.radians(15), 4, "X")
        bpy.context.view_layer.update()
        pulled_points = [trigger.matrix_world @ vertex.co
                         for vertex in trigger.data.vertices]
        pulled_lowest = min(pulled_points, key=lambda point: point.z)
        movement = pulled_lowest.y - rest_lowest.y
        check("B04 positive local X trigger pull moves toward grip",
              movement < -0.005,
              "lowest point Blender Y change {:.5f} m at +15 degrees".format(movement))
        trigger.matrix_world = rest
        trigger_low, trigger_high = world_bounds(trigger)
        trigger_size = trigger_high - trigger_low
        check("Trigger blade about 2.5 cm tall and 0.8 cm wide",
              near(trigger_size.z, 0.025, 0.002)
              and near(trigger_size.x, 0.008, 0.001),
              "{:.3f} m tall, {:.3f} m wide".format(trigger_size.z, trigger_size.x))

    mag = bpy.data.objects.get("mag")
    if mag is not None:
        mag_low, mag_high = world_bounds(mag)
        mag_size = mag_high - mag_low
        check("Magazine 16 cm tall and 2.4 cm wide",
              near(mag_size.z, 0.16, 0.002) and near(mag_size.x, 0.024, 0.001),
              "{:.3f} m tall, {:.3f} m wide".format(mag_size.z, mag_size.x))
        check("Magazine well clear of trigger guard", mag_low.y - 0.053 >= 0.045,
              "{:.3f} m clear gap".format(mag_low.y - 0.053))
        check("Magazine curves forward toward bottom",
              mag_low.y > 0.10 and mag_high.y > 0.18,
              "Y extent {:.3f} to {:.3f} m".format(mag_low.y, mag_high.y))

    failed = [name for name, passed in results if not passed]
    print("B04 SUMMARY:", "PASS" if not failed else "FAIL: " + "; ".join(failed))
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
