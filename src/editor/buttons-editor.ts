import * as THREE from "three";
import buttonData from "../../data/buttons.json";
import { material, materialId } from "../voxel/materials";
import type { Button, Level, Vec3 } from "../level/format";
import { GRID } from "./doc";
import { checkField, label, renameField, selectField, vecField, type PartContext } from "./inspector-parts";

// ED-31: the editor's Button tool. A button is placed on the surface that
// was clicked: its `pos` is the hit point and its `facing` the face's
// normal, so it mounts on a floor, a wall or a slope. `on` is the id of the
// thing clicked, or absent when the floor of the level itself was hit.

const T = buttonData as unknown as {
  plate: { size: [number, number, number]; material: string };
  cap: { diameter: number; height: number; material: string };
};

function colourOf(name: string): number {
  return material(materialId(name))?.color ?? 0xbdb5cf;
}

/** The plate's colour, for the toolbar button that places one. */
export const BUTTON_COLOUR = `#${colourOf(T.plate.material).toString(16).padStart(6, "0")}`;

/** A button at the click point, facing out along the hit normal, mounted on
 *  `on` when a thing was clicked. */
export function makeButton(id: string, point: Vec3, normal: Vec3, on?: string): Button {
  const len = Math.hypot(normal[0], normal[1], normal[2]) || 1;
  const facing: Vec3 = [normal[0] / len, normal[1] / len, normal[2] / len];
  return { id, pos: [...point] as Vec3, facing, on };
}

/** The real button look (data/buttons.json): the plate with its thin axis
 *  turned onto `facing`, and the cap standing proud of it. */
export function buttonMarker(b: Button): THREE.Group {
  const group = new THREE.Group();
  const facing = new THREE.Vector3(...b.facing).normalize();
  const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), facing);
  const [w, h, d] = T.plate.size;
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: colourOf(T.plate.material), roughness: 0.9 }),
  );
  plate.quaternion.copy(rot);
  const r = T.cap.diameter / 2;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, T.cap.height, 20),
    new THREE.MeshStandardMaterial({ color: colourOf(T.cap.material), roughness: 0.7 }),
  );
  cap.quaternion.copy(rot);
  cap.position.copy(facing).multiplyScalar(h / 2 + T.cap.height / 2);
  group.add(plate, cap);
  group.position.set(b.pos[0], b.pos[1], b.pos[2]);
  return group;
}

/** What a button may be mounted on: a prim, a model or a physics object.
 *  The floor of the level itself is the empty choice. */
export function buttonOnChoices(level: Level): { value: string; label: string }[] {
  return [
    { value: "", label: "the level's own floor" },
    ...(level.prims ?? []).map((p) => ({ value: p.id, label: `${p.id} (prim)` })),
    ...(level.props ?? []).map((p) => ({ value: p.id, label: `${p.id} (prop)` })),
    ...(level.models ?? []).map((m) => ({ value: m.id, label: `${m.id} (model)` })),
    ...(level.physics ?? []).map((o) => ({ value: o.id, label: `${o.id} (physics object)` })),
  ];
}

/** The inspector's fields for one placed button: where it is, the face it is
 *  mounted on (read only: it is placed by clicking the face), what it is
 *  mounted on, and whether a press needs the use key. */
export function buildButtonFields(host: HTMLElement, b: Button, level: Level, ctx: PartContext) {
  renameField(host, b.id, (v) => ctx.rename(v));
  host.append(label("position", vecField(b.pos, GRID, GRID, (v) => ctx.change({ pos: v }, "move the button"))));
  const facing = document.createElement("span");
  facing.className = "hint";
  facing.textContent = b.facing.map((n) => n.toFixed(2)).join(", ");
  host.append(label("facing", facing));
  host.append(label("on", selectField(
    buttonOnChoices(level), b.on ?? "",
    (v) => ctx.change({ on: v === "" ? undefined : v }, v === "" ? "mount on the floor" : `mount on ${v}`),
  )));
  host.append(label("use", checkField("needs the use key", b.use === true,
    (on) => ctx.change({ use: on || undefined }, on ? "needs the use key" : "a press is a step or a dart"))));
  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "A press fires the trigger whose when is this button. Nothing else is needed.";
  host.append(hint);
}
