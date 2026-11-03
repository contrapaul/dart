import foamerData from "../../data/foamers.json";

// What one Foamer attack costs the player, keyed by the attack id the bonk
// reports. Both game pages read it from data/foamers.json instead of
// carrying their own numbers.

export const ATTACK_DAMAGE = new Map<string, number>(
  (foamerData.test as unknown as { attacks: { id: string; damage: number }[] })
    .attacks.map((a) => [a.id, a.damage]),
);

export function damageOf(attack: string) {
  return ATTACK_DAMAGE.get(attack) ?? 0;
}
