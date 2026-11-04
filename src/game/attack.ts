import foamerData from "../../data/foamers.json";

// What one Foamer attack costs the player, keyed by the attack id the bonk
// reports. Both game pages read it from data/foamers.json instead of
// carrying their own numbers. GAME-10a: an attack may live on a type's
// override (the F02's throw) as well as the base spec, so both are read.

export const ATTACK_DAMAGE = new Map<string, number>(
  [
    // The types first, so the base spec wins an id both have: the map is
    // only the fallback for a hit with no Foamer to ask.
    ...Object.values(foamerData.types as Record<string, { attacks?: { id: string; damage: number }[] }>)
      .flatMap((t) => t.attacks ?? []),
    ...(foamerData.test as unknown as { attacks: { id: string; damage: number }[] })
      .attacks,
  ].map((a) => [a.id, a.damage]),
);

/** The damage of an attack. Pass the attacking Foamer's spec: two types
 *  can share an attack id with different damage (F01 and F02 both bonk). */
export function damageOf(attack: string, spec?: { attacks: { id: string; damage: number }[] }) {
  const own = spec?.attacks.find((a) => a.id === attack);
  return own ? own.damage : ATTACK_DAMAGE.get(attack) ?? 0;
}
