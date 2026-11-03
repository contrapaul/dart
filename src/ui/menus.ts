import { DIFFICULTIES, SettingsStore, type Settings } from "../core/settings";

// Pause menu and settings panel (UI-01 stage 2), plain DOM, system fonts.
// Keyboard and mouse only in this task; the tab order follows the element
// order. The panel builds its rows once and subscribes to the store, so
// opening it from the pause menu or the title overlay always shows the
// current values, and picking a preset or moving a slider updates the rest
// of the UI live.

export type SettingsRow = { kind: "slider" | "toggle"; key: keyof Settings };

/** One labelled slider: name, the range input, and a value readout. */
function addSlider(
  rows: HTMLElement,
  label: string,
  min: number,
  max: number,
  step: number,
  fmt: (v: number) => string,
): { input: HTMLInputElement; out: HTMLElement; value: () => number; show: (v: number) => void } {
  const row = document.createElement("label");
  row.className = "row";
  const name = document.createElement("span");
  name.textContent = label;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const out = document.createElement("span");
  out.className = "val";
  row.append(name, input, out);
  rows.appendChild(row);
  const show = (v: number) => {
    input.value = String(v);
    out.textContent = fmt(v);
  };
  return { input, out, value: () => Number(input.value), show };
}

/** One labelled switch (checkbox). */
function addToggle(rows: HTMLElement, label: string): { box: HTMLInputElement } {
  const row = document.createElement("label");
  row.className = "row toggle";
  const name = document.createElement("span");
  name.textContent = label;
  const box = document.createElement("input");
  box.type = "checkbox";
  row.append(name, box);
  rows.appendChild(row);
  return { box };
}

export class SettingsPanel {
  private presetButtons = new Map<string, HTMLButtonElement>();
  private difficultyLabel: HTMLElement;
  private damage: ReturnType<typeof addSlider>;
  private sensitivity: ReturnType<typeof addSlider>;
  private invert: ReturnType<typeof addToggle>;
  private fov: ReturnType<typeof addSlider>;
  private volume: ReturnType<typeof addSlider>;
  private mute: ReturnType<typeof addToggle>;
  private shake: ReturnType<typeof addToggle>;
  private flashes: ReturnType<typeof addToggle>;
  private bob: ReturnType<typeof addToggle>;
  private shieldToggle: ReturnType<typeof addToggle>;

  constructor(
    private root: HTMLElement,
    private store: SettingsStore,
    onBack: () => void,
  ) {
    const rows = root.querySelector<HTMLElement>("#settingsRows")!;
    root.querySelector<HTMLButtonElement>("#settingsBack")!.addEventListener("click", onBack);

    // Difficulty: four preset buttons (names from data/difficulty.json,
    // D10) plus a readout that shows "Custom" after a manual slider move.
    const diff = document.createElement("div");
    diff.className = "row presets";
    const dName = document.createElement("span");
    dName.textContent = "Difficulty";
    this.difficultyLabel = document.createElement("span");
    this.difficultyLabel.className = "val";
    diff.appendChild(dName);
    for (const key of Object.keys(DIFFICULTIES)) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = DIFFICULTIES[key].name;
      b.addEventListener("click", () => this.store.setDifficulty(key));
      this.presetButtons.set(key, b);
      diff.appendChild(b);
    }
    diff.appendChild(this.difficultyLabel);
    rows.appendChild(diff);

    this.damage = addSlider(rows, "Damage taken", 25, 200, 5, (v) => `${Math.round(v)}%`);
    this.damage.input.addEventListener("input", () => {
      this.store.set("damageTaken", this.damage.value() / 100);
    });

    this.sensitivity = addSlider(rows, "Mouse sensitivity", 0.0005, 0.006, 0.0001, (v) => {
      const pct = Math.round((v / 0.0022) * 100);
      return `${pct}%`;
    });
    this.sensitivity.input.addEventListener("input", () => {
      this.store.set("mouseSensitivity", this.sensitivity.value());
    });

    this.invert = addToggle(rows, "Invert look");
    this.invert.box.addEventListener("change", () => {
      this.store.set("invertY", this.invert.box.checked);
    });

    this.fov = addSlider(rows, "Field of view", 60, 100, 1, (v) => `${Math.round(v)}°`);
    this.fov.input.addEventListener("input", () => this.store.set("fov", this.fov.value()));

    this.volume = addSlider(rows, "Volume", 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`);
    this.volume.input.addEventListener("input", () => this.store.set("volume", this.volume.value()));

    this.mute = addToggle(rows, "Mute");
    this.mute.box.addEventListener("change", () => this.store.set("muted", this.mute.box.checked));

    // Motion-sickness switches (PLAN.md section 10): head bob and shake are
    // read by later tasks; store them now.
    this.shake = addToggle(rows, "Reduce screen shake");
    this.shake.box.addEventListener("change", () => this.store.set("reduceShake", this.shake.box.checked));
    this.flashes = addToggle(rows, "Reduce flashes");
    this.flashes.box.addEventListener("change", () => this.store.set("reduceFlashes", this.flashes.box.checked));
    this.bob = addToggle(rows, "Reduce head bob");
    this.bob.box.addEventListener("change", () => this.store.set("reduceHeadBob", this.bob.box.checked));

    // GAME-04: accessibility (PLAN.md section 10). Off holds the shield
    // action to keep the disc up; on raises it with one press and lowers
    // it with the next, for players who cannot hold a button.
    this.shieldToggle = addToggle(rows, "Shield: toggle, not hold");
    this.shieldToggle.box.addEventListener("change", () =>
      this.store.set("shieldMode", this.shieldToggle.box.checked));

    store.onChange(() => this.sync());
  }

  /** Mirror the store into every control. */
  private sync(): void {
    const s = this.store.value;
    this.damage.show(s.damageTaken * 100);
    this.sensitivity.show(s.mouseSensitivity);
    this.invert.box.checked = s.invertY;
    this.fov.show(s.fov);
    this.volume.show(s.volume);
    this.mute.box.checked = s.muted;
    this.shake.box.checked = s.reduceShake;
    this.flashes.box.checked = s.reduceFlashes;
    this.bob.box.checked = s.reduceHeadBob;
    this.shieldToggle.box.checked = s.shieldMode;
    const preset = DIFFICULTIES[s.difficulty];
    this.difficultyLabel.textContent = preset ? preset.name : "Custom";
    for (const [key, b] of this.presetButtons) {
      b.classList.toggle("on", key === s.difficulty);
    }
  }

  open(): void {
    this.root.hidden = false;
    this.sync();
    // Put the caret in the panel so Tab walks the controls.
    this.root.querySelector<HTMLElement>("button, input")?.focus();
  }

  close(): void {
    this.root.hidden = true;
  }
}
