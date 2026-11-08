import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Blaster, resolveSpec } from "../../src/weapons/blaster";
import type { DartFiring } from "../../src/weapons/blaster";
import type { DartTypeName } from "../../src/weapons/darts";
import { Loadout, modIds } from "../../src/weapons/loadout";
import { RangeMenu } from "../../src/range/menu";
import blastersJson from "../../data/blasters.json";

// PT-01 stage 3: the menu's model. The card: a mod toggle from the menu
// changes `loadout.modsOf`, a second toggles it back. No DOM here: the panel
// class only draws what this model reports, and the reviewer checks the click
// in the browser.

const ORDER = (blastersJson as unknown as { order: string[] }).order;

class FakeDarts implements DartFiring {
  fire(_o: THREE.Vector3, _d: THREE.Vector3, _t: DartTypeName): void {}
}

class FakeVM {
  visible = false;
  setVisible(on: boolean): void { this.visible = on; }
  setMods(_show: string[], _hide: string[]): void {}
  muzzleCameraPoint(_i: number, out: THREE.Vector3): THREE.Vector3 { return out.set(0, 0, -1); }
  onShot = (_m: number): void => {};
}

/** The range's loadout: every blaster in the data, in data order, with fake
 *  viewmodels (no GLTF load in Node). */
function makeMenu(): { menu: RangeMenu; lo: Loadout } {
  const darts = new FakeDarts();
  const out = new THREE.Vector3();
  const parts = ORDER.map((id) => ({
    id,
    blaster: new Blaster(resolveSpec(id), darts, () => out),
    viewmodel: new FakeVM(),
  }));
  const lo = new Loadout(parts, darts, 0.35);
  return { menu: new RangeMenu(lo), lo };
}

describe("PT-01 stage 3: the menu's mod toggles", () => {
  it("lists the active blaster's mods from the data, all off to start", () => {
    const { menu, lo } = makeMenu();
    const list = menu.modButtons();
    expect(list.map((b) => b.mod)).toEqual(modIds(lo.activeId()));
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((b) => !b.on)).toBe(true);
  });

  it("a click puts the mod on and a second click takes it back off", () => {
    const { menu, lo } = makeMenu();
    const mod = menu.modButtons()[0]!.mod;
    const i = lo.activeIndex;
    menu.toggleMod(mod);
    expect(lo.modsOf(i)).toContain(mod);
    expect(menu.modButtons().find((b) => b.mod === mod)!.on).toBe(true);
    menu.toggleMod(mod);
    expect(lo.modsOf(i)).not.toContain(mod);
    expect(menu.modButtons().find((b) => b.mod === mod)!.on).toBe(false);
  });

  it("two mods can be on at once, and each click only moves its own", () => {
    const { menu, lo } = makeMenu();
    const [a, b] = menu.modButtons();
    menu.toggleMod(a!.mod);
    menu.toggleMod(b!.mod);
    expect(lo.modsOf(lo.activeIndex)).toEqual([a!.mod, b!.mod]);
    menu.toggleMod(a!.mod);
    expect(lo.modsOf(lo.activeIndex)).toEqual([b!.mod]);
  });

  it("a mod the active blaster does not have changes nothing", () => {
    const { menu, lo } = makeMenu();
    // A mod belonging to another blaster in the loadout.
    const other = lo.ids
      .filter((id) => id !== lo.activeId())
      .flatMap((id) => modIds(id))
      .find((m) => !modIds(lo.activeId()).includes(m));
    if (other === undefined) return; // every blaster shares every mod
    menu.toggleMod(other);
    expect(lo.modsOf(lo.activeIndex)).toEqual([]);
  });

  it("the name shown is the blaster's id and its name from the data", () => {
    const { menu, lo } = makeMenu();
    const spec = (blastersJson as unknown as Record<string, { name: string }>)[lo.activeId()];
    expect(menu.blasterLabel()).toBe(`${lo.activeId()} ${spec.name}`);
  });

  it("the panel is told to redraw after a toggle, so a click shows at once", () => {
    const { menu } = makeMenu();
    let redraws = 0;
    menu.onChanged = () => redraws++;
    menu.toggleMod(menu.modButtons()[0]!.mod);
    expect(redraws).toBe(1);
    menu.blasterChanged(); // the page calls it when keys or the wheel switched
    expect(redraws).toBe(2);
  });

  it("the mod row follows the blaster chosen by key or wheel", () => {
    const { menu, lo } = makeMenu();
    const first = menu.modButtons().map((b) => b.mod);
    const firstId = lo.activeId();
    // The switch runs through the loadout's fixed step; the menu reads the
    // loadout, so what it shows is whatever the loadout has now.
    for (let i = 0; i < 60 && lo.activeId() === firstId; i++) {
      lo.select(2);
      lo.update(1 / 60, { fireHeld: false, firePressed: false, reloadPressed: false }, new THREE.Vector3(0, 0, -1));
    }
    expect(lo.activeId()).toBe(lo.ids[2]);
    expect(menu.modButtons().map((b) => b.mod)).toEqual(modIds(lo.activeId()));
    if (lo.activeId() !== firstId) expect(menu.modButtons().map((b) => b.mod)).not.toEqual(first);
  });
});
