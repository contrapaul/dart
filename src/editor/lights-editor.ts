// ED-32: the Light tool. The factory for the lights the palette places, and
// the inspector's fields for one placed light and for the level's own light
// (ambient and sun). Pure data: no DOM and no Three.js, so it is tested
// headless.

import type { Level, LevelLight, LevelLighting, Vec3 } from "../level/format";
import { GRID, PALETTE, snapAxis } from "./doc";
import { colourField } from "./inspector";
import { label, numberInput, renameField, selectField } from "./inspector-parts";
import { lookDefaults, TONE_MAPPING_NAMES, type ToneMappingName } from "../render/look";

/** The defaults a click places, from data/editor.json: white, intensity 20,
 *  range 8, angle 45 and softness 0.3. [Paul] owns colours. */
export const LIGHT_DEFAULTS = {
  colour: "#fff6e8",
  intensity: 20,
  range: 8,
  angle: 45,
  softness: 0.3,
} as const;

export type LightKindChoice = "point" | "spot";

/** A light at a point, off the surface by `lift` metres along the normal. */
export function makeLight(id: string, pos: Vec3, kind: LightKindChoice, lift = 0.5, normal: Vec3 = [0, 1, 0]): LevelLight {
  const p: Vec3 = [
    pos[0] + normal[0] * lift,
    pos[1] + normal[1] * lift,
    pos[2] + normal[2] * lift,
  ];
  const made: LevelLight = {
    id, kind, pos: p, colour: LIGHT_DEFAULTS.colour,
    intensity: LIGHT_DEFAULTS.intensity, range: LIGHT_DEFAULTS.range,
  };
  if (kind === "spot") {
    made.angle = LIGHT_DEFAULTS.angle;
    made.softness = LIGHT_DEFAULTS.softness;
  }
  return made;
}

export interface LightFieldsContext {
  change(patch: Record<string, unknown>, text: string): void;
  redraw(): void;
  /** Renames this entry, as one undo step; refuses with a status message. */
  rename(v: string): void;
  /** Puts a refusal in the status line (over the shadow cap). */
  refused(text: string): void;
  /** The shadow cap, from data/editor.json. */
  maxShadows: number;
  /** How many lights in the level cast shadows. */
  shadows: number;
}

/** The inspector's fields for one placed light. */
export function buildLightFields(host: HTMLElement, light: LevelLight, ctx: LightFieldsContext) {
  renameField(host, light.id, (v) => ctx.rename(v));
  // The position field commits one step per axis, as the prims' do.
  const posField = (() => {
    const host2 = document.createElement("div");
    host2.className = "vec";
    let value: Vec3 = [...light.pos] as Vec3;
    (["x", "y", "z"] as const).forEach((axis, i) => {
      const input = numberInput(light.pos[i]!, GRID, (n) => {
        value = snapAxis(value, i as 0 | 1 | 2, n, GRID);
        ctx.change({ pos: [...value] as Vec3 }, "move");
      });
      input.title = axis;
      host2.append(input);
    });
    return host2;
  })();
  host.append(label("kind", selectField(
    [{ value: "point", label: "point" }, { value: "spot", label: "spot" }],
    light.kind,
    (v) => {
      const patch: Record<string, unknown> = { kind: v };
      if (v === "spot" && light.kind !== "spot") {
        patch.angle = light.angle ?? LIGHT_DEFAULTS.angle;
        patch.softness = light.softness ?? LIGHT_DEFAULTS.softness;
      }
      if (v === "point") {
        patch.angle = undefined;
        patch.softness = undefined;
      }
      ctx.change(patch, `kind ${v}`);
      ctx.redraw();
    },
  )));
  host.append(label("position", posField));
  host.append(label("colour", colourField(light.colour, PALETTE, (c) => ctx.change({ colour: c }, "colour"))));
  host.append(label("intensity", numberInput(light.intensity, 1, (n) => ctx.change({ intensity: Math.max(0, n) }, "intensity"))));
  host.append(label("range", numberInput(light.range, 1, (n) => ctx.change({ range: Math.max(0.1, n) }, "range"))));
  if (light.kind === "spot") {
    host.append(label("angle", numberInput(light.angle ?? LIGHT_DEFAULTS.angle, 5, (n) => ctx.change({ angle: Math.max(1, Math.min(179, n)) }, "angle"))));
    host.append(label("softness", numberInput(light.softness ?? LIGHT_DEFAULTS.softness, 0.1, (n) => ctx.change({ softness: Math.max(0, Math.min(1, n)) }, "softness"))));
    // The XYZ turn the handles move, shown read only.
    const r = light.rot ?? [0, 0, 0];
    const rot = document.createElement("p");
    rot.className = "hint";
    rot.textContent = `aim ${r.map((n) => Math.round(n * 10) / 10).join(", ")} (rotate handle)`;
    host.append(rot);
  }
  const shadowLabel = document.createElement("label");
  const shadow = document.createElement("input");
  shadow.type = "checkbox";
  shadow.checked = light.castShadow === true;
  shadow.addEventListener("change", () => {
    if (shadow.checked && ctx.shadows >= ctx.maxShadows && light.castShadow !== true) {
      shadow.checked = false;
      ctx.refused(`Shadow cap: ${ctx.maxShadows}. ${ctx.shadows} already cast.`);
      return;
    }
    ctx.change({ castShadow: shadow.checked ? true : undefined }, shadow.checked ? "cast shadow" : "no shadow");
  });
  shadowLabel.append(document.createTextNode("casts a shadow"), shadow);
  host.append(shadowLabel);
  const hiddenLabel = document.createElement("label");
  const hidden = document.createElement("input");
  hidden.type = "checkbox";
  hidden.checked = light.hidden === true;
  hidden.addEventListener("change", () => ctx.change({ hidden: hidden.checked ? true : undefined }, hidden.checked ? "hide" : "show"));
  hiddenLabel.append(document.createTextNode("starts hidden"), hidden);
  host.append(hiddenLabel);
}

/** The level's own light: ambient and sun, replaced when set. */
export function buildLightingSection(host: HTMLElement, level: Level, ctx: {
  change(patch: Partial<Level>, text: string): void;
  redraw(): void;
}) {
  const heading = document.createElement("h2");
  heading.textContent = "Lighting";
  host.append(heading);
  const l = level.lighting;
  const ambient = l?.ambient ?? "#fff0e0";
  const sun = l?.sun ?? "#ffffff";
  host.append(label("ambient colour", colourField(ambient, PALETTE, (c) => {
    const cur = level.lighting ?? defaultLighting();
    ctx.change({ lighting: { ...cur, ambient: c } }, "ambient colour");
  })));
  host.append(label("ambient intensity", numberInput(l?.ambientIntensity ?? 1.2, 0.1, (n) => {
    const cur = level.lighting ?? defaultLighting();
    ctx.change({ lighting: { ...cur, ambientIntensity: Math.max(0, n) } }, "ambient intensity");
  })));
  host.append(label("sun colour", colourField(sun, PALETTE, (c) => {
    const cur = level.lighting ?? defaultLighting();
    ctx.change({ lighting: { ...cur, sun: c } }, "sun colour");
  })));
  host.append(label("sun intensity", numberInput(l?.sunIntensity ?? 2, 0.1, (n) => {
    const cur = level.lighting ?? defaultLighting();
    ctx.change({ lighting: { ...cur, sunIntensity: Math.max(0, n) } }, "sun intensity");
  })));
  host.append(label("sun yaw", numberInput(l?.sunYaw ?? 33, 5, (n) => {
    const cur = level.lighting ?? defaultLighting();
    ctx.change({ lighting: { ...cur, sunYaw: n } }, "sun yaw");
  })));
  host.append(label("sun pitch", numberInput(l?.sunPitch ?? 45, 5, (n) => {
    const cur = level.lighting ?? defaultLighting();
    ctx.change({ lighting: { ...cur, sunPitch: Math.max(0, Math.min(90, n)) } }, "sun pitch");
  })));
  // R3-06: global illumination. Omitted gi fields take the data/render.json
  // look defaults; the fields show the resolved values.
  const look = lookDefaults();
  const gi = l?.gi;
  const giPatch = (patch: Record<string, unknown>, text: string) => {
    const cur = level.lighting ?? defaultLighting();
    const nextGi: Record<string, unknown> = { ...cur.gi, ...patch };
    ctx.change({ lighting: { ...cur, gi: nextGi as LevelLighting["gi"] } }, text);
  };
  host.append(label("tone mapping", selectField(
    TONE_MAPPING_NAMES.map((name) => ({ value: name, label: name })),
    gi?.toneMapping ?? look.toneMapping,
    (v) => giPatch({ toneMapping: v as ToneMappingName }, "tone mapping"),
  )));
  host.append(label("exposure", numberInput(gi?.exposure ?? look.exposure, 0.1, (n) => giPatch({ exposure: Math.max(0.01, n) }, "exposure"))));
  host.append(label("sky light", numberInput(gi?.skyLight ?? look.skyLight, 0.1, (n) => giPatch({ skyLight: Math.max(0, n) }, "sky light"))));
  host.append(label("bounce colour", colourField(gi?.bounce ?? look.bounce, PALETTE, (c) => giPatch({ bounce: c }, "bounce colour"))));
  const note = document.createElement("p");
  note.className = "hint";
  note.textContent = l ? "This level's own light, replacing the defaults." : "The arena's defaults (no lighting set).";
  host.append(note);
  const def = document.createElement("button");
  def.type = "button";
  def.textContent = "Default";
  def.disabled = !l;
  def.addEventListener("click", () => {
    ctx.change({ lighting: undefined }, "lighting default");
    ctx.redraw();
  });
  host.append(def);
}

/** The arena's own look, used as the base while the fields are edited. */
function defaultLighting(): LevelLighting {
  return { ambient: "#fff0e0", ambientIntensity: 1.2, sun: "#ffffff", sunIntensity: 2, sunYaw: 33, sunPitch: 45 };
}

