import { describe, expect, it } from "vitest";
import { Director, type DifficultyKey, type TokenKind } from "../../src/ai/director";
import aiData from "../../data/ai.json";

const CD = aiData.tokenCooldown;
const DT = 1 / 60;
const EPS = 1e-6;

/** Ask `ids` for a token of one kind with the given scores, then resolve. */
function bid(d: Director, kind: TokenKind, pairs: [number, number][], dt = DT): boolean[] {
  const got = pairs.map(([id, score]) => d.request(id, kind, score));
  d.update(dt);
  return got;
}

describe("Director", () => {
  it("gives two melee tokens to the two best of five bids", () => {
    const d = new Director("normal");
    // Agent 0 and 1 ask first with a low score, 3 and 4 with a high one.
    bid(d, "melee", [
      [0, 0.1],
      [1, 0.2],
      [2, 0.3],
      [3, 0.9],
      [4, 0.8],
    ]);
    const st = d.stats();
    expect(st.melee.inUse).toBe(2);
    expect(st.melee.cap).toBe(2);
    expect(st.waiting).toBe(3);
    // The winners are the best bids, so they hold their tokens from now on.
    expect(d.request(3, "melee", 0.9)).toBe(true);
    expect(d.request(4, "melee", 0.8)).toBe(true);
    expect(d.request(0, "melee", 0.1)).toBe(false);
    expect(d.request(1, "melee", 0.2)).toBe(false);
    expect(d.request(2, "melee", 0.3)).toBe(false);
  });

  it("frees a released token only after the cooldown", () => {
    const d = new Director("story");
    bid(d, "melee", [[0, 1]]);
    expect(d.request(0, "melee", 1)).toBe(true);
    d.release(0);
    // The token is home but still cooling: the waiting agent gets nothing.
    d.request(1, "melee", 1);
    d.update(CD / 2);
    expect(d.stats().melee.inUse).toBe(0);
    expect(d.request(1, "melee", 1)).toBe(false);
    d.update(CD / 2 + DT);
    d.request(1, "melee", 1);
    expect(d.stats().melee.inUse).toBe(1);
    expect(d.request(1, "melee", 1)).toBe(true);
  });

  it("frees a forgotten agent's token at once", () => {
    const d = new Director("story");
    bid(d, "melee", [[0, 1]]);
    expect(d.request(0, "melee", 1)).toBe(true);
    d.forget(0);
    expect(d.stats().melee.inUse).toBe(0);
    // No cooldown: the next bid wins on the very next update.
    d.request(1, "melee", 1);
    d.update(DT);
    expect(d.request(1, "melee", 1)).toBe(true);
    // A forgotten agent is not waiting either.
    d.forget(1);
    expect(d.stats().waiting).toBe(0);
    expect(d.stats().melee.inUse).toBe(0);
  });

  it("lets a waiting agent win the next free token when its score rises", () => {
    const d = new Director("story");
    bid(d, "melee", [[0, 1]]);
    expect(d.request(0, "melee", 1)).toBe(true);
    // Two agents wait. Agent 2 bids lower first, so 1 is first in line.
    bid(d, "melee", [
      [1, 0.1],
      [2, 0.2],
    ]);
    expect(d.request(1, "melee", 0.1)).toBe(false);
    d.release(0);
    // Still cooling: nobody gets it, whatever they bid.
    d.update(CD - 2 * DT);
    d.request(1, "melee", 0.9);
    d.update(DT);
    expect(d.request(1, "melee", 0.9)).toBe(false);
    // Up close, agent 1's score has jumped. It wins the free token, though
    // it asked first with the lower score.
    d.request(1, "melee", 0.9);
    d.request(2, "melee", 0.2);
    d.update(DT);
    expect(d.request(1, "melee", 0.9)).toBe(true);
    expect(d.request(2, "melee", 0.2)).toBe(false);
  });

  it("keeps the ranged and melee pools separate", () => {
    const d = new Director("story");
    bid(d, "melee", [[0, 1]]);
    expect(d.request(0, "melee", 1)).toBe(true);
    // The melee pool is full, but one agent may still hold a ranged token.
    d.request(1, "ranged", 0.5);
    d.request(2, "ranged", 0.6);
    d.update(DT);
    expect(d.request(1, "ranged", 0.5)).toBe(false);
    expect(d.request(2, "ranged", 0.6)).toBe(true);
    const st = d.stats();
    expect(st.melee.inUse).toBe(1);
    expect(st.ranged.inUse).toBe(1);
  });

  it("takes the counts for each difficulty from data/ai.json", () => {
    const want: [DifficultyKey, number, number][] = [
      ["story", 1, 1],
      ["normal", 2, 2],
      ["hard", 3, 3],
      ["fury", 4, 4],
    ];
    for (const [key, melee, ranged] of want) {
      const d = new Director(key);
      const ids = Array.from({ length: 8 }, (_, i) => i);
      bid(d, "melee", ids.map((id) => [id, 1 / (id + 1)]));
      bid(d, "ranged", ids.map((id) => [id, 1 / (id + 1)]));
      const st = d.stats();
      expect([key, st.melee.cap, st.ranged.cap]).toEqual([key, melee, ranged]);
      expect([key, st.melee.inUse, st.ranged.inUse]).toEqual([key, melee, ranged]);
    }
    // The default is Normal.
    expect(new Director().stats().melee.cap).toBe(2);
  });

  it("holds out a token for the whole cooldown, not one frame less", () => {
    const d = new Director("story");
    bid(d, "melee", [[0, 1]]);
    d.release(0);
    // Step in small increments and find the first moment the bid is granted.
    let granted = -1;
    for (let t = DT; t < CD * 2; t += DT) {
      d.request(1, "melee", 1);
      d.update(DT);
      if (d.request(1, "melee", 1)) {
        granted = t;
        break;
      }
    }
    expect(granted).toBeGreaterThan(0);
    expect(granted).toBeGreaterThanOrEqual(CD - EPS);
  });

  it("ignores ids outside the fixed table", () => {
    const d = new Director("story");
    expect(d.request(-1, "melee", 1)).toBe(false);
    expect(d.request(aiData.maxAgents, "melee", 1)).toBe(false);
    d.release(9999);
    d.forget(9999);
    expect(d.stats().waiting).toBe(0);
  });
});
