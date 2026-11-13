import { EDITOR, GRID, PALETTE, ROTATE_STEP } from "./doc";
import { colourField } from "./inspector";
import type { Level, Sky } from "../level/format";

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

  const facts = document.createElement("p");
  facts.className = "hint";
  const prims = (level.prims ?? []).length;
  facts.textContent = `Grid ${GRID} m, rotation ${ROTATE_STEP} degrees. ${prims} of ${EDITOR.limits.prims} prims.`;
  host.append(facts);
}
