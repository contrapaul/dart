// ED-07a: the key rules (design/EDITOR.md section 3). A key pickup has a
// colour and a door locked to that colour opens when the player walks up
// to it holding the key. Plain TypeScript, no Three.js, no DOM.

import type { KeyColour, LevelDoor } from "./format";

const ORDER: KeyColour[] = ["red", "blue", "yellow"];

/** The keys the player holds in a level run. Lost at the level exit: the
 *  page calls `clear`. */
export class KeyRing {
  private heldSet = new Set<KeyColour>();

  /** Take a key; holding it again changes nothing. */
  add(colour: KeyColour): void {
    this.heldSet.add(colour);
  }

  has(colour: KeyColour): boolean {
    return this.heldSet.has(colour);
  }

  /** The keys held, in the order red, blue, yellow, for the HUD. */
  held(): KeyColour[] {
    return ORDER.filter((c) => this.heldSet.has(c));
  }

  clear(): void {
    this.heldSet = new Set();
  }
}

/** Can the player open this door with the keys `keys`? A "none" lock is
 *  always open to walk up to; a "trigger" lock never opens by key; a
 *  colour opens when the colour is held. */
export function doorOpensFor(door: LevelDoor, keys: KeyRing): boolean {
  switch (door.lock) {
    case "none":
      return true;
    case "trigger":
      return false;
    default:
      return keys.has(door.lock);
  }
}
