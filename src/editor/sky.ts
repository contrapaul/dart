import { EDITOR, GRID, PALETTE, ROTATE_STEP } from "./doc";
import { colourField } from "./inspector";
import { BLASTERS, MELEE, START_LOADOUT } from "./parts";
import type { Level, Sky, StartLoadout } from "../level/format";

/** The loadout a level that says nothing starts with: data/editor.json. */
function startLoadout(level: Level): StartLoadout {
  return level.start ?? START_LOADOUT;
}

// ED-02 stage 4: the level-wide inspector, shown when nothing is selected.
// The name, and the sky: a gradient of three colours from the palette, or an
// uploaded picture scaled down to the editor's cap and kept as a data: URL
// inside the level file (design/EDITOR.md 5).

export const DEFAULT_SKY: Sky = { kind: "gradient", top: "#3a6ff0", horizon: "#bfe3ff", bottom: "#3a3550" };

export interface LevelContext {
  /** One undo step for level fields other than the prims. */
  change(patch: Partial<Level>, text: string): void;
  /** Scales the file down and puts it in the sky; the page has the canvas. */
  uploadSky(file: File): void;
  /** Rebuilds the panel: the sky's fields differ by kind. */
  redraw(): void;
}

export function buildLevelFields(host: HTMLElement, level: Level, ctx: LevelContext) {
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "name";
  const name = document.createElement("input");
  name.type = "text";
  name.value = level.meta.name;
  name.addEventListener("change", () => {
    ctx.change({ meta: { ...level.meta, name: name.value } }, "level name");
  });
  nameLabel.append(name);
  host.append(nameLabel);

  const sky: Sky = level.sky ?? DEFAULT_SKY;
  const kindLabel = document.createElement("label");
  kindLabel.textContent = "sky";
  const kind = document.createElement("select");
  for (const option of ["gradient", "image"]) {
    const el = document.createElement("option");
    el.value = option;
    el.textContent = option;
    kind.append(el);
  }
  kind.value = sky.kind;
  kind.addEventListener("change", () => {
    const next: Sky = kind.value === "image"
      ? { kind: "image", image: sky.kind === "image" ? sky.image : "" }
      : sky.kind === "gradient" ? sky : DEFAULT_SKY;
    ctx.change({ sky: next }, `sky ${next.kind}`);
    ctx.redraw();
  });
  kindLabel.append(kind);
  host.append(kindLabel);

  if (sky.kind === "gradient") {
    for (const key of ["top", "horizon", "bottom"] as const) {
      const field = document.createElement("label");
      field.textContent = key;
      field.append(colourField(sky[key], PALETTE, (c) => {
        ctx.change({ sky: { ...sky, [key]: c } }, `sky ${key}`);
      }));
      host.append(field);
    }
  } else {
    const upload = document.createElement("label");
    upload.textContent = "picture";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) ctx.uploadSky(file);
    });
    upload.append(input);
    host.append(upload);
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = `Scaled down to ${EDITOR.limits.skyImageWidth} by ${EDITOR.limits.skyImageHeight} and kept in the level file.`;
    host.append(note);
  }

  // ED-05 stage 4: the level's own start loadout (design/EDITOR.md 2: a
  // level played on its own starts with what these say). The first blaster
  // ticked is the one held, so the list keeps its order.
  const startHeading = document.createElement("h2");
  startHeading.textContent = "Start";
  host.append(startHeading);
  const start = level.start ?? START_LOADOUT;
  const blasterSet = new Set(start.blasters);
  const blasterLabel = document.createElement("label");
  blasterLabel.textContent = "blasters";
  const blasters = document.createElement("div");
  blasters.className = "ticks";
  for (const blaster of BLASTERS) {
    const tick = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = blasterSet.has(blaster.id);
    input.addEventListener("change", () => {
      const now = startLoadout(level);
      // The first in the list is held: a new tick goes on the end, and the
      // last blaster cannot be unticked (the validator wants one).
      const list = input.checked
        ? [...now.blasters, blaster.id]
        : now.blasters.filter((b) => b !== blaster.id);
      ctx.change({ start: { ...now, blasters: list.length ? list : [blaster.id] } }, `start ${blaster.id}`);
      ctx.redraw();
    });
    tick.append(input, document.createTextNode(`${blaster.id} ${blaster.name}`));
    blasters.append(tick);
  }
  blasterLabel.append(blasters);
  host.append(blasterLabel);

  const meleeSet = new Set(start.melee ?? []);
  const meleeLabel = document.createElement("label");
  meleeLabel.textContent = "hand weapons";
  const melee = document.createElement("div");
  melee.className = "ticks";
  for (const weapon of MELEE) {
    const tick = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = meleeSet.has(weapon.id);
    input.addEventListener("change", () => {
      const now = startLoadout(level);
      const list = input.checked
        ? [...(now.melee ?? []), weapon.id]
        : (now.melee ?? []).filter((m) => m !== weapon.id);
      ctx.change({ start: { ...now, melee: list } }, `start ${weapon.id}`);
      ctx.redraw();
    });
    tick.append(input, document.createTextNode(`${weapon.id} ${weapon.name}`));
    melee.append(tick);
  }
  meleeLabel.append(melee);
  host.append(meleeLabel);

  const healthLabel = document.createElement("label");
  healthLabel.textContent = "health";
  const health = document.createElement("input");
  health.type = "number";
  health.step = "10";
  health.min = "1";
  health.value = String(start.health ?? 100);
  health.addEventListener("change", () => {
    const n = Number(health.value);
    if (!Number.isFinite(n) || n <= 0) return;
    ctx.change({ start: { ...startLoadout(level), health: Math.round(n) } }, "start health");
  });
  healthLabel.append(health);
  host.append(healthLabel);

  const facts = document.createElement("p");
  facts.className = "hint";
  const prims = (level.prims ?? []).length;
  facts.textContent = `Grid ${GRID} m, rotation ${ROTATE_STEP} degrees. ${prims} of ${EDITOR.limits.prims} prims.`;
  host.append(facts);
}
