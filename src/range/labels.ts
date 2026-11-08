import * as THREE from "three";
import type { Foamer } from "../foamers/foamer";
import type { FoamerSystem } from "../foamers/foamers";
import rigData from "../../data/foamer-rigs.json";

// PT-01 stage 2: the label above each Foamer in the range lineup: its type,
// its name from the data and its health now. Plain HTML, one div each, placed
// by projecting the Foamer's head to the screen once per render frame. Cheap
// by construction: one div per Foamer in the line, no canvas and no text
// texture, and its text is only written when the health number changes.

const LABELS: Record<string, string> = {};
for (const r of rigData.rigs as { id: string; label: string }[]) LABELS[r.id] = r.label;

/** The name a rig carries in data/foamer-rigs.json (`label`), or the type id
 *  when the data has none. */
export function foamerLabel(type: string): string {
  return LABELS[type] ?? type;
}

export class LineupLabels {
  private rows: { foamer: Foamer; el: HTMLDivElement; text: string }[] = [];
  private readonly _v = new THREE.Vector3();

  constructor(
    private host: HTMLElement,
    private camera: THREE.Camera,
    private foamers: FoamerSystem,
    line: { type: string; foamer: Foamer }[],
  ) {
    for (const e of line) {
      const el = document.createElement("div");
      el.className = "tag";
      host.appendChild(el);
      this.rows.push({ foamer: e.foamer, el, text: "" });
    }
  }

  /** The line is rebuilt (Respawn): put the same labels on the new Foamers. */
  retarget(line: { type: string; foamer: Foamer }[]): void {
    this.rows.forEach((r, i) => {
      r.foamer = line[i]!.foamer;
      r.text = ""; // force the text to be written again
    });
  }

  /** Once per render frame, after the systems' syncRender: put each label
   *  above its Foamer and keep its health line current. A Foamer that has
   *  gone (down and dissolved, or popped) hides its own label. */
  update(): void {
    for (const r of this.rows) {
      const f = r.foamer;
      const alive = this.foamers.list.includes(f) || this.foamers.downed.includes(f);
      if (r.el.hidden === alive) r.el.hidden = !alive;
      if (!alive) continue;
      this._v.set(f.centre.x, f.centre.y + f.height + 0.3, f.centre.z);
      this._v.project(this.camera);
      const visible = this._v.z <= 1; // behind the camera: project() flips x and y
      if (r.el.hidden === visible) r.el.hidden = !visible;
      if (!visible) continue;
      const x = (this._v.x * 0.5 + 0.5) * this.host.clientWidth;
      const y = (-this._v.y * 0.5 + 0.5) * this.host.clientHeight;
      r.el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
      const name = foamerLabel(f.rig.id);
      const text = `${name === f.rig.id ? name : `${f.rig.id} ${name}`} ${Math.max(0, Math.ceil(f.health))}/${f.maxHealth}`;
      if (text !== r.text) {
        r.text = text;
        r.el.textContent = text;
      }
    }
  }
}
