// FX-01: one pooled blast effect per page. spawn(point, radius) shows a core
// flash and a foam puff sized by the explosion's fxRadius. The pool is built
// once: shared geometry, one material per layer per slot, no lights and no
// shadows. When the pool is full the oldest slot is reused.
import * as THREE from "three";
import fxJson from "../../data/explosion.json";
import { sampleCurve, type CurveSample } from "./blast-curve";

const FX = fxJson.fx;

// Review fix: a plain sphere reads as a hard-edged glass ball. This fades a
// layer towards its outline (alpha times |normal . view| to the power
// softEdge), so the blast looks like a soft burst. Same draw calls; the
// cache key lets every slot of a layer share one compiled program.
function softEdge(m: THREE.MeshBasicMaterial, power: number): void {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("void main() {", "varying float vFacing;\nvoid main() {")
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mvPosition.xyz)));",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {", "varying float vFacing;\nvoid main() {")
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>\n  gl_FragColor.a *= pow(vFacing, ${power.toFixed(3)});`,
      );
  };
  m.customProgramCacheKey = () => `blast-soft-${power}`;
}

interface Slot {
  flash: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  puff: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  age: number;
  radius: number;
  active: boolean;
}

export class BlastFx {
  readonly group = new THREE.Group();

  private readonly slots: Slot[] = [];
  private readonly _curve: CurveSample = { scale: 0, opacity: 0 };
  private liveCount = 0;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.SphereGeometry(1, 16, 12);
    for (let i = 0; i < FX.maxLive; i++) {
      const flash = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: FX.flash.color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      softEdge(flash.material, FX.flash.softEdge);
      const puff = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: FX.puff.color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      softEdge(puff.material, FX.puff.softEdge);
      for (const mesh of [flash, puff]) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.visible = false;
      }
      flash.renderOrder = 1;
      puff.renderOrder = 2;
      this.group.add(flash, puff);
      this.slots.push({ flash, puff, age: 0, radius: 0, active: false });
    }
    scene.add(this.group);
  }

  /** Live blasts in the pool. Never more than FX.maxLive. */
  get live(): number {
    return this.liveCount;
  }

  /** Show one blast at a world point, scaled by radius in metres. */
  spawn(point: THREE.Vector3, radius: number): void {
    const slot = this.pickSlot();
    slot.age = 0;
    slot.radius = radius;
    slot.active = true;
    slot.flash.position.copy(point);
    slot.puff.position.copy(point);
    slot.flash.scale.setScalar(radius * FX.flash.scaleStart);
    slot.puff.scale.setScalar(radius * FX.puff.scaleStart);
    slot.flash.material.opacity = FX.flash.opacityStart;
    slot.puff.material.opacity = FX.puff.opacityStart;
    slot.flash.visible = true;
    slot.puff.visible = true;
  }

  /** Advance every live blast by dt seconds. The page calls this from its
   *  render hook, so the effect follows frame time and freezes when paused. */
  update(dt: number): void {
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.age += dt;

      const flash = sampleCurve(FX.flash, slot.age, slot.radius, this._curve);
      if (slot.age >= FX.flash.durationSeconds) {
        slot.flash.visible = false;
      } else {
        slot.flash.visible = true;
        slot.flash.scale.setScalar(flash.scale);
        slot.flash.material.opacity = flash.opacity;
      }

      const puff = sampleCurve(FX.puff, slot.age, slot.radius, this._curve);
      if (slot.age >= FX.puff.durationSeconds) {
        slot.puff.visible = false;
        slot.active = false;
        this.liveCount--;
      } else {
        slot.puff.visible = true;
        slot.puff.scale.setScalar(puff.scale);
        slot.puff.material.opacity = puff.opacity;
      }
    }
  }

  /** The first free slot, or the oldest live slot when the pool is full. */
  private pickSlot(): Slot {
    if (this.liveCount < FX.maxLive) {
      for (const slot of this.slots) {
        if (!slot.active) {
          this.liveCount++;
          return slot;
        }
      }
    }
    let oldest = this.slots[0]!;
    for (const slot of this.slots) {
      if (slot.active && slot.age > oldest.age) oldest = slot;
    }
    return oldest;
  }
}
