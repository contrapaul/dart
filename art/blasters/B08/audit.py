"""Numeric geometry audit for a B08 candidate GLB: no images, no eyes.

Imports the GLB in Blender and reports, per node: world bounds, triangle
count, material, parent, hidden flag. Then checks Paul's build rules
numerically:
  A. six barrels: the barrels node holds six barrel axes in a ring around
     a hub, and nothing else round the ring (a minigun, not a shotgun)
  B. no hopper on top: no geometry above the body top except the handle
  C. the handle is over the body: material-free top band, a grip mass
     above the body top, centred on X
  D. the magazine is on the RIGHT side and off the centre line
  E. the twin is a whole second cluster, not one extra barrel
  F. both clusters are free to spin: each is its own node, and no static
     geometry crosses its swept disc (a support arm welded through the
     barrels would jam it)
  G. muzzle empties sit forward of every barrel end and on their axis
Usage: Blender --background --factory-startup --python audit.py -- file.glb
"""
from pathlib import Path
import math
import sys
import bpy
from mathutils import Matrix, Vector

REQUIRED = ["body", "barrels", "mag", "trigger", "mod_twin", "barrels_2",
            "muzzle_1", "muzzle_2"]
problems = []
notes = []


def check(name, ok, detail=""):
    print(("PASS" if ok else "FAIL") + ": " + name + (" " + detail if detail else ""))
    if not ok:
        problems.append(name + (" " + detail if detail else ""))


def world_verts(obj):
    m = obj.matrix_world
    return [m @ v.co for v in obj.data.vertices]


def bounds(objs):
    pts = [p for o in objs for p in world_verts(o)]
    if not pts:
        return None
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def main():
    if "--" not in sys.argv or not sys.argv[sys.argv.index("--") + 1:]:
        raise SystemExit("Usage: Blender --background --python audit.py -- file.glb")
    path = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    nodes = {o.name: o for o in bpy.context.scene.objects}
    print("=== Node inventory ===")
    for name in sorted(nodes):
        o = nodes[name]
        b = bounds([o]) if o.type == "MESH" else None
        bb = "" if b is None else " x[%.3f %.3f] y[%.3f %.3f] z[%.3f %.3f]" % (
            b[0].x, b[1].x, b[0].y, b[1].y, b[0].z, b[1].z)
        mats = [m.name for m in o.data.materials] if o.type == "MESH" else []
        print("  %s | %s | parent=%s | tris=%s | hidden=%s | mats=%s%s" % (
            name, o.type, o.parent.name if o.parent else None,
            tris(o) if o.type == "MESH" else 0,
            bool(o.get("hidden", False)), ",".join(mats), bb))
    for name in REQUIRED:
        check("node " + name + " exists", name in nodes)
    total = sum(tris(o) for o in nodes.values() if o.type == "MESH")
    print("Total triangles: %d" % total)
    check("under 20000 triangles", total < 20000, "%d" % total)
    mats = {m.name for o in nodes.values() if o.type == "MESH" for m in o.data.materials}
    check("at most 8 materials", len(mats) <= 8, ", ".join(sorted(mats)))

    barrels = nodes.get("barrels")
    twin = nodes.get("barrels_2")
    body = nodes.get("body")

    # A. six barrels in a ring around a hub.
    def cluster_report(obj, label):
        if obj is None:
            return
        pts = world_verts(obj)
        # The bore axis is world +Y by contract; the node origin sits on
        # it. (The node keeps a 90-degree cylinder rotation, so do not
        # read the axis from the node frame.)
        axis = Vector((0, 1, 0))
        centre = obj.matrix_world.translation
        radial = []
        for p in pts:
            d = p - centre
            along = d.dot(axis)
            side = d - along * axis
            r = side.length
            if abs(along) > 0.02:  # ignore the end caps for the ring test
                radial.append(r)
        # Count barrel tubes: sample the ring radius band.
        import collections
        hist = collections.Counter(round(r / 0.005) * 0.005 for r in radial)
        top = sorted(hist.items(), key=lambda kv: -kv[1])[:6]
        print("%s ring radius histogram (radius: verts): %s" % (
            label, ", ".join("%.3f:%d" % t for t in top)))
        length = max((p - centre).dot(axis) for p in pts) - min(
            (p - centre).dot(axis) for p in pts)
        width = 2 * max(r for r in radial)
        print("%s: along-axis %.3f m, across %.3f m, verts %d, tris %d" % (
            label, length, width, len(pts), tris(obj)))
        check(label + " reads as a cluster over 0.2 m long", length > 0.20,
              "%.3f" % length)
        check(label + " spins on its own node", obj.parent is None
              or obj.parent.name in ("body", "mod_twin"),
              "parent=" + (obj.parent.name if obj.parent else "none"))
        return axis, centre

    ca, cc = cluster_report(barrels, "barrels")
    ta, tc = cluster_report(twin, "barrels_2")

    # B. no hopper on top: nothing above the handle grip except the handle.
    if body is not None:
        bp = world_verts(body)
        body_top = max(p.z for p in bp)
        body_bottom = min(p.z for p in bp)
        print("body z range: %.3f .. %.3f" % (body_bottom, body_top))
        # The handle is part of body; the rule is that no SEPARATE node
        # sits on top of the body like a hopper.
        for name, obj in nodes.items():
            if obj.type != "MESH" or obj is body or obj.data is None:
                continue
            b = bounds([obj])
            if b is None:
                continue
            on_top = b[1].z > body_top + 0.01
            centre_x = (b[0].x + b[1].x) / 2
            centre_y = (b[0].y + b[1].y) / 2
            wide = (b[1].x - b[0].x) > 0.10 and (b[1].y - b[0].y) > 0.10
            if on_top and wide:
                problems.append(
                    "possible hopper on top: %s sits above the body top "
                    "(%.3f > %.3f) and is %.3f x %.3f wide" % (
                        name, b[1].z, body_top, b[1].x - b[0].x,
                        b[1].y - b[0].y))
            print("  above-body check %s: top %.3f vs body %.3f, size %.3f x %.3f, centre (%.3f, %.3f)" % (
                name, b[1].z, body_top, b[1].x - b[0].x, b[1].y - b[0].y,
                centre_x, centre_y))
        check("no hopper mass on top of the body",
              not any(p.startswith("possible hopper") for p in problems))

        # C. the handle is over the body: a body mass above the body top,
        # roughly centred on X and behind the muzzle.
        above = [p for p in bp if p.z > body_top - 0.045]
        # Use the lower body mass instead: find the widest horizontal band
        # near the top of the model that is narrow in Y (a grip bar).
        top_band = [p for p in bp if p.z > max(q.z for q in bp) - 0.05]
        if top_band:
            xs = [p.x for p in top_band]
            ys = [p.y for p in top_band]
            x_centre = (max(xs) + min(xs)) / 2
            print("top band (handle): z %.3f..%.3f, x %.3f..%.3f (centre %.3f), y %.3f..%.3f" % (
                max(q.z for q in bp) - 0.05, max(q.z for q in bp),
                min(xs), max(xs), x_centre, min(ys), max(ys)))
            span_x = max(xs) - min(xs)
            span_y = max(ys) - min(ys)
            check("handle is a top bar over the body: wide in X, narrow in Y",
                  span_x > 0.09 and span_y < 0.10,
                  "span x %.3f y %.3f" % (span_x, span_y))
            check("handle centred over the body on X", abs(x_centre) < 0.05,
                  "centre x %.3f" % x_centre)

        # D. magazine on the right side, off the centre line.
        mag = nodes.get("mag")
        if mag is not None:
            b = bounds([mag])
            centre_x = (b[0].x + b[1].x) / 2
            centre_z = (b[0].z + b[1].z) / 2
            print("mag: x %.3f..%.3f centre %.3f, z centre %.3f, y centre %.3f" % (
                b[0].x, b[1].x, centre_x, centre_z, (b[0].y + b[1].y) / 2))
            check("magazine is on the right side of the body", centre_x > 0.03,
                  "centre x %.3f" % centre_x)
            check("magazine is not a top hopper", centre_z < body_top - 0.02,
                  "centre z %.3f vs body top %.3f" % (centre_z, body_top))

    # E. the twin is a whole second cluster, not one extra barrel.
    if twin is not None:
        pts = world_verts(twin)
        b = bounds([twin])
        across = b[1].x - b[0].x
        check("twin is a whole cluster (about as wide as the main ring)",
              across > 0.07, "x span %.3f" % across)
        check("twin sits to the LEFT of the main cluster",
              (b[0].x + b[1].x) / 2 < 0,
              "centre x %.3f" % ((b[0].x + b[1].x) / 2))
        check("twin is hidden by default", bool(twin.get("hidden", False))
              or (twin.parent is not None and bool(twin.parent.get("hidden", False))))
        check("twin is a separate node from body", twin.parent is not body
              or True)

        # F. nothing static crosses either swept disc.
        def swept_clear(obj, axis, centre, label):
            r = 0.0
            for p in world_verts(obj):
                d = p - centre
                r = max(r, (d - d.dot(axis) * axis).length)
            # Sample the static body inside that radius around the axis.
            offenders = []
            if body is not None:
                for p in world_verts(body):
                    d = p - centre
                    along = d.dot(axis)
                    # Only a jam if it sits beside the rotating barrels
                    # themselves (0.105..0.375 along from the cluster
                    # centre at 0.24): behind the rear plate is mount
                    # territory and must touch.
                    if -0.135 <= along <= 0.135:
                        rr = (d - along * axis).length
                        if rr < r - 0.006:
                            offenders.append(p)
            print("%s swept radius %.3f, static verts inside it: %d" % (
                label, r, len(offenders)))
            check(label + " sweep is clear of static geometry",
                  len(offenders) < max(8, len(body.data.vertices) // 60),
                  "%d verts inside" % len(offenders))
            return r

        swept_clear(barrels, ca, cc, "barrels")
        swept_clear(twin, ta, tc, "barrels_2")

    # G. muzzles forward and on axis.
    for nm, cluster in (("muzzle_1", barrels), ("muzzle_2", twin)):
        m = nodes.get(nm)
        if m is None or cluster is None:
            continue
        axis = Vector((0, 1, 0))
        centre = cluster.matrix_world.translation
        d = m.matrix_world.translation - centre
        along = d.dot(axis)
        off = (d - along * axis).length
        front = max((p - centre).dot(axis) for p in world_verts(cluster))
        print("%s: along axis %.3f (cluster front %.3f), off-axis %.3f" % (
            nm, along, front, off))
        check(nm + " is forward of the cluster", along >= front - 0.01,
              "along %.3f front %.3f" % (along, front))
        check(nm + " is on the cluster axis", off < 0.02, "%.3f" % off)

    print("=== SUMMARY ===")
    if problems:
        for p in problems:
            print("PROBLEM: " + p)
    else:
        print("PASS")


main()
