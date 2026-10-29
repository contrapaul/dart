import config from "../../data/input.json";

// Keyboard, mouse (with Pointer Lock) and gamepad, mapped to named actions.
// Bindings and tuning live in data/input.json.
//
// Timing: button edges (pressed/released) are latched the moment they happen
// and cleared by endStep(), so a tap shorter than a frame is never lost and a
// press is seen by exactly one fixed step. Look is read once per render frame
// with takeLook(), so aiming stays smooth at any frame rate.

export const ACTIONS = [
  "moveForward", "moveBack", "moveLeft", "moveRight",
  "jump", "sprint", "dash",
  "fire", "shield", "melee", "reload", "use",
  "weaponNext", "weaponPrev",
  "weapon1", "weapon2", "weapon3", "weapon4",
  "weapon5", "weapon6", "weapon7", "weapon8",
  "pause",
] as const;
export type Action = (typeof ACTIONS)[number];

type Bindings = Partial<Record<Action, (string | number)[]>>;

export const settings = { ...config.settings };

// Source ids: "key:KeyW", "mouse:0", "wheel:down", "pad:7".
const sourceActions = new Map<string, Action[]>();
function bind(prefix: string, table: Bindings) {
  for (const [action, inputs] of Object.entries(table) as [Action, (string | number)[]][]) {
    for (const input of inputs) {
      const id = `${prefix}:${input}`;
      sourceActions.set(id, [...(sourceActions.get(id) ?? []), action]);
    }
  }
}
bind("key", config.keyboard as Bindings);
bind("mouse", config.mouse as Bindings);
bind("wheel", config.wheel as Bindings);
bind("pad", config.gamepad as Bindings);

export class Input {
  /** True while the mouse is captured. Keyboard and mouse are ignored otherwise. */
  locked = false;
  /** Called when the mouse is captured or released. */
  onLockChange: (locked: boolean) => void = () => {};

  private held = new Map<Action, number>();
  private pressed = new Set<Action>();
  private released = new Set<Action>();
  private down = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private padButtons = new Set<number>();
  private padAxes = [0, 0, 0, 0];

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener("click", () => {
      if (!this.locked) this.requestLock();
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) {
        this.releaseAll("key:");
        this.releaseAll("mouse:");
      }
      this.onLockChange(this.locked);
    });

    window.addEventListener("keydown", (e) => {
      if (!this.locked || e.repeat) return;
      if (sourceActions.has(`key:${e.code}`)) e.preventDefault();
      this.sourceDown(`key:${e.code}`);
    });
    window.addEventListener("keyup", (e) => this.sourceUp(`key:${e.code}`));
    window.addEventListener("mousedown", (e) => {
      if (this.locked) this.sourceDown(`mouse:${e.button}`);
    });
    window.addEventListener("mouseup", (e) => this.sourceUp(`mouse:${e.button}`));
    window.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseX += e.movementX;
      this.mouseY += e.movementY;
    });
    window.addEventListener("wheel", (e) => {
      if (!this.locked || e.deltaY === 0) return;
      const id = `wheel:${e.deltaY > 0 ? "down" : "up"}`;
      this.sourceDown(id);
      this.sourceUp(id);
    }, { passive: true });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", () => {
      this.releaseAll("key:");
      this.releaseAll("mouse:");
    });
  }

  requestLock() {
    // Raw mouse input where supported; some platforms refuse it, so fall back.
    const p = this.canvas.requestPointerLock({ unadjustedMovement: true }) as Promise<void> | undefined;
    p?.catch(() => this.canvas.requestPointerLock());
  }

  /** Call once per render frame, before the fixed steps. Reads the gamepad. */
  poll() {
    const pad = [...navigator.getGamepads()].find((g) => g?.connected && g.mapping === "standard");
    const now = new Set<number>();
    if (pad) {
      pad.buttons.forEach((b, i) => {
        if (b.pressed || b.value > settings.triggerThreshold) now.add(i);
      });
      for (let i = 0; i < 4; i++) this.padAxes[i] = pad.axes[i] ?? 0;
    } else {
      this.padAxes.fill(0);
    }
    for (const i of now) if (!this.padButtons.has(i)) this.sourceDown(`pad:${i}`);
    for (const i of this.padButtons) if (!now.has(i)) this.sourceUp(`pad:${i}`);
    this.padButtons = now;
  }

  /** Call after each fixed step: clears the edges that step has seen. */
  endStep() {
    this.pressed.clear();
    this.released.clear();
  }

  isDown(a: Action) {
    return (this.held.get(a) ?? 0) > 0;
  }
  wasPressed(a: Action) {
    return this.pressed.has(a);
  }
  wasReleased(a: Action) {
    return this.released.has(a);
  }

  /** Movement as x (right) and y (forward), length at most 1. */
  move() {
    let x = (this.isDown("moveRight") ? 1 : 0) - (this.isDown("moveLeft") ? 1 : 0);
    let y = (this.isDown("moveForward") ? 1 : 0) - (this.isDown("moveBack") ? 1 : 0);
    const [sx, sy] = deadzone(this.padAxes[0], -this.padAxes[1], 1);
    x += sx;
    y += sy;
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  /** Look change in radians since the last call. Positive yaw turns right, positive pitch looks up. */
  takeLook(dt: number) {
    const [sx, sy] = deadzone(this.padAxes[2], this.padAxes[3], settings.padLookCurve);
    const yaw = this.mouseX * settings.mouseSensitivity + sx * settings.padLookSpeed * dt;
    let pitch = -(this.mouseY * settings.mouseSensitivity + sy * settings.padLookSpeed * dt);
    if (settings.invertY) pitch = -pitch;
    this.mouseX = this.mouseY = 0;
    return { yaw, pitch };
  }

  private sourceDown(id: string) {
    if (this.down.has(id)) return;
    this.down.add(id);
    for (const a of sourceActions.get(id) ?? []) {
      if ((this.held.get(a) ?? 0) === 0) this.pressed.add(a);
      this.held.set(a, (this.held.get(a) ?? 0) + 1);
    }
  }

  private sourceUp(id: string) {
    if (!this.down.delete(id)) return;
    for (const a of sourceActions.get(id) ?? []) {
      const n = (this.held.get(a) ?? 1) - 1;
      this.held.set(a, n);
      if (n === 0) this.released.add(a);
    }
  }

  private releaseAll(prefix: string) {
    for (const id of [...this.down]) if (id.startsWith(prefix)) this.sourceUp(id);
  }
}

// Radial deadzone, rescaled so the stick still reaches 1, with a response curve.
function deadzone(x: number, y: number, curve: number): [number, number] {
  const len = Math.hypot(x, y);
  if (len < settings.padDeadzone) return [0, 0];
  const scaled = Math.min(1, (len - settings.padDeadzone) / (1 - settings.padDeadzone)) ** curve;
  return [(x / len) * scaled, (y / len) * scaled];
}
