import type { PhysicsObject, Vec3 } from "../level/format";
import { SURFACE_NAMES } from "../render/surfaces";
import { GRID, PALETTE } from "./doc";
import { colourField } from "./inspector";
import {
  checkField, label, numberInput, renameField, selectField, vecField, type PartContext,
} from "./inspector-parts";
import physicsData from "../../data/physics.json";

// ED-33: the editor side of a physics object. The game side is
// src/level/physics-objects.ts; this file is the tool's factory and the
// inspector's fields, so main.ts only adds one button and one case.
//
// The editor never simulates: a placed object stands where it is put. Play
// the level to watch it fall (the Help row says so).

const D = (physicsData as unknown as {
  defaults: { shape: PhysicsObject["shape"]; size: Vec3; mass: number; damage: number; hitPoints: number };
  bounce: number;
}).defaults;
const B = physicsData as unknown as { bounce: number };

/** The shapes the tool offers, in data/format names. */
export const PHYSICS_SHAPES: { value: PhysicsObject["shape"]; label: string }[] = [
  { value: "box", label: "Box" },
  { value: "cylinder", label: "Cylinder" },
  { value: "sphere", label: "Ball" },
];

/** A new physics object of a shape, standing on the surface it was clicked:
 *  its centre half a size along the normal, as a prim's is. */
export function makePhysicsObject(
  id: string, shape: PhysicsObject["shape"], colour: string,
  point: Vec3, normal: Vec3,
): PhysicsObject {
  const size = [...D.size] as Vec3;
  const pos: Vec3 = [
    point[0] + normal[0] * size[0] / 2,
    point[1] + normal[1] * size[1] / 2,
    point[2] + normal[2] * size[2] / 2,
  ];
  return { id, shape, pos, size, colour, mass: D.mass, damage: D.damage };
}

/** The inspector's fields for one physics object. */
export function buildPhysicsFields(host: HTMLElement, o: PhysicsObject, ctx: PartContext) {
  renameField(host, o.id, (v) => ctx.rename(v));
  host.append(label("shape", selectField(PHYSICS_SHAPES, o.shape, (v) => {
    ctx.change({ shape: v }, `make it a ${v}`);
    ctx.redraw();
  })));
  host.append(label("position", vecField(o.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move"))));
  host.append(label("size", vecField(o.size, GRID, GRID, (v) => {
    ctx.change({ size: v.map((n) => Math.max(GRID, n)) as Vec3 }, "size");
  })));
  host.append(label("colour", colourField(o.colour, PALETTE, (c) => ctx.change({ colour: c }, "colour"))));
  host.append(label("surface", selectField(
    SURFACE_NAMES.map((s) => ({ value: s, label: s })),
    o.surface ?? "plain",
    (v) => ctx.change({ surface: v === "plain" ? undefined : v }, "surface"),
  )));
  host.append(label("mass kg", numberInput(o.mass, 1, (n) => ctx.change({ mass: Math.max(0.1, n) }, "mass"))));
  host.append(label("damage", numberInput(o.damage, 0.5, (n) => ctx.change({ damage: Math.max(0, n) }, "damage"))));
  host.append(label("bounce", numberInput(o.bounce ?? B.bounce, 0.05, (n) => {
    ctx.change({ bounce: Math.min(1, Math.max(0, n)) }, "bounce");
  })));
  host.append(checkField("asleep", o.asleep === true, (on) => ctx.change({ asleep: on }, on ? "starts asleep" : "starts awake")));
  host.append(checkField("hidden", o.hidden === true, (on) => ctx.change({ hidden: on }, on ? "hide" : "show")));
  // The breakable switch is last: ticking it writes the hit points too, so
  // the number field below it always has a value to show.
  host.append(checkField("breakable", o.breakable === true, (on) => {
    ctx.change(on ? { breakable: true, hitPoints: o.hitPoints ?? D.hitPoints } : { breakable: false }, on ? "make breakable" : "make unbreakable");
    ctx.redraw();
  }));
  if (o.breakable) {
    host.append(label("hit points", numberInput(o.hitPoints ?? D.hitPoints, 1, (n) => {
      ctx.change({ hitPoints: Math.max(1, n) }, "hit points");
    })));
  }
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "A physics object falls and rests in play. A dart or a blast shoves it; a fast one that hits the player or a Foamer hurts it.";
  host.append(hint);
}
