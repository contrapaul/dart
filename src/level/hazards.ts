import * as THREE from "three";
import { primContains, primGeometry, primMatrix } from "./prim-geometry";
import type { Prim, PrimHazard } from "./format";
import tuning from "../../data/hazards.json";
import { HazardTickState, type HazardSpec } from "./hazard-rules";

interface HazardLook {
  color: string;
  opacity: number;
  glow: number;
}

interface HazardMesh {
  readonly id: string;
  readonly prim: Prim;
  readonly spec: PrimHazard;
  readonly inverse: THREE.Matrix4;
  readonly mesh: THREE.Mesh;
  readonly material: THREE.MeshStandardMaterial;
  shown: boolean;
}

export interface HazardResult {
  playerDamage: number;
  slow: number;
  /** Keyed by the Foamer object handed to `update`. Only Foamers that
   *  took damage this call are in it. */
  foamerDamage: Map<object, number>;
}

/**
 * Builds a level's hazard prims as see-through, double-sided meshes. The
 * page calls `update` each frame; the returned object is reused, so read it
 * before the next call.
 */
export class Hazards {
  private readonly hazards: HazardMesh[] = [];
  private readonly byId = new Map<string, HazardMesh>();
  private readonly playerTick = new HazardTickState();
  /** Review: keyed by the Foamer itself, so a Foamer that is gone takes
   *  its tick state with it (a string map grew for the whole level). */
  private foamerTicks = new WeakMap<object, HazardTickState>();
  private readonly point = new THREE.Vector3();
  private readonly inside: HazardSpec[] = [];
  private readonly result: HazardResult = {
    playerDamage: 0,
    slow: 1,
    foamerDamage: new Map(),
  };
  private time = 0;

  constructor(prims: Prim[], parent: THREE.Object3D) {
    const looks = tuning.looks as Record<string, HazardLook>;
    for (const prim of prims) {
      if (prim.behaviour !== "hazard" || !prim.hazard) continue;
      const spec = prim.hazard;
      const look = looks[spec.look] ?? { color: "#8cff3a", opacity: 0.55, glow: 0.6 };
      const material = this.makeMaterial(look);
      const mesh = new THREE.Mesh(primGeometry(prim), material);
      mesh.applyMatrix4(primMatrix(prim));
      mesh.visible = !prim.hidden;
      parent.add(mesh);

      const hazard: HazardMesh = {
        id: prim.id,
        prim,
        spec,
        inverse: primMatrix(prim).invert(),
        mesh,
        material,
        shown: !prim.hidden,
      };
      this.hazards.push(hazard);
      this.byId.set(prim.id, hazard);
    }
  }

  private makeMaterial(look: HazardLook): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.color),
      transparent: true,
      opacity: look.opacity,
      emissive: new THREE.Color(look.color),
      emissiveIntensity: look.glow,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.55,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      material.userData.uTime = shader.uniforms.uTime;
      shader.fragmentShader = `uniform float uTime;\n${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n totalEmissiveRadiance *= 0.86 + 0.14 * sin(uTime * 1.7);",
      );
    };
    return material;
  }

  setShown(id: string, shown: boolean): void {
    const hazard = this.byId.get(id);
    if (!hazard) return;
    hazard.shown = shown;
    hazard.mesh.visible = shown;
  }

  update(
    dt: number,
    player: THREE.Vector3,
    foamers: readonly { readonly centre: THREE.Vector3 }[],
  ): HazardResult {
    this.time += dt;
    for (const hazard of this.hazards) {
      const uniform = hazard.material.userData.uTime as { value: number } | undefined;
      if (uniform) uniform.value = this.time;
    }

    this.point.copy(player);
    this.point.y += 0.3;
    this.fill(this.point, false);
    this.playerTick.step(dt, this.inside);

    const out = this.result;
    out.playerDamage = this.playerTick.damage;
    out.slow = this.playerTick.slow;
    out.foamerDamage.clear();

    for (const foamer of foamers) {
      this.point.copy(foamer.centre);
      this.point.y += 0.3;
      this.fill(this.point, true);

      if (this.inside.length === 0 && !this.foamerTicks.has(foamer)) continue;
      let tick = this.foamerTicks.get(foamer);
      if (!tick) {
        tick = new HazardTickState();
        this.foamerTicks.set(foamer, tick);
      }
      tick.step(dt, this.inside);
      if (tick.damage > 0) out.foamerDamage.set(foamer, tick.damage);
    }
    return out;
  }

  private fill(point: THREE.Vector3, forFoamer: boolean): void {
    this.inside.length = 0;
    for (const hazard of this.hazards) {
      if (!hazard.shown) continue;
      if (forFoamer && hazard.spec.hurtsFoamers === false) continue;
      if (primContains(hazard.prim, hazard.inverse, point)) {
        this.inside.push(hazard.spec);
      }
    }
  }

  dispose(): void {
    for (const hazard of this.hazards) {
      hazard.mesh.geometry.dispose();
      hazard.material.dispose();
      hazard.mesh.parent?.remove(hazard.mesh);
    }
    this.hazards.length = 0;
    this.byId.clear();
    this.foamerTicks = new WeakMap();
    this.result.foamerDamage.clear();
  }
}
