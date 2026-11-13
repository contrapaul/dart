import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { applySky, clearSky } from "../../src/render/sky";

function scene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x1b1430);
  return s;
}

describe("applySky", () => {
  it("leaves the scene alone when the level has no sky", () => {
    const s = scene();
    const before = s.children.length;
    applySky(s, undefined);
    expect(s.children.length).toBe(before);
    expect((s.background as THREE.Color).getHex()).toBe(0x1b1430);
  });

  it("draws a gradient as one inside-out sphere with the three colours", () => {
    const s = scene();
    applySky(s, { kind: "gradient", top: "#3a6ff0", horizon: "#bfe3ff", bottom: "#3a3550" });
    const sky = s.getObjectByName("level-sky") as THREE.Mesh;
    expect(sky).toBeTruthy();
    const mat = sky.material as THREE.ShaderMaterial;
    expect(mat.side).toBe(THREE.BackSide);
    expect((mat.uniforms.top.value as THREE.Color).getHex()).toBe(0x3a6ff0);
    expect((mat.uniforms.horizon.value as THREE.Color).getHex()).toBe(0xbfe3ff);
    expect((mat.uniforms.bottom.value as THREE.Color).getHex()).toBe(0x3a3550);
    // Centred on the player's origin and out of the shadow pass.
    expect(sky.position.length()).toBe(0);
    expect(sky.castShadow).toBe(false);
  });

  it("replaces a sky rather than stacking a second one", () => {
    const s = scene();
    applySky(s, { kind: "gradient", top: "#000000", horizon: "#111111", bottom: "#222222" });
    applySky(s, { kind: "gradient", top: "#ffffff", horizon: "#eeeeee", bottom: "#dddddd" });
    expect(s.children.filter((c) => c.name === "level-sky").length).toBe(1);
    const mat = (s.getObjectByName("level-sky") as THREE.Mesh).material as THREE.ShaderMaterial;
    expect((mat.uniforms.top.value as THREE.Color).getHex()).toBe(0xffffff);
  });

  it("takes the sky off again, back to the scene's own background", () => {
    const s = scene();
    applySky(s, { kind: "gradient", top: "#000000", horizon: "#111111", bottom: "#222222" });
    clearSky(s);
    expect(s.getObjectByName("level-sky")).toBeUndefined();
    expect((s.background as THREE.Color).getHex()).toBe(0x1b1430);
  });

  it("asks for an image; with no DOM there is nothing to decode", () => {
    const s = scene();
    applySky(s, { kind: "image", image: "data:image/png;base64,AAAA" });
    // Node has no document: no background was set, and nothing threw.
    expect(s.background instanceof THREE.Color).toBe(true);
    expect(s.getObjectByName("level-sky")).toBeUndefined();
  });
});
