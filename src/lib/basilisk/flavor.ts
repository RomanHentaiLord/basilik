/**
 * Deterministic "flavor" for a wallet: the same address always gets the same
 * pet species or punishment. "The Basilisk does not change its mind."
 */

/** 32-bit FNV-1a hash of a string. Stable across runtimes. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Pick an item from a list using the address hash and a salt (so different lists don't correlate). */
export function pick<T>(address: string, salt: string, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick() needs a non-empty list");
  return items[fnv1a(`${salt}:${address}`) % items.length];
}

export const PET_SPECIES = [
  "corgi",
  "cat",
  "parrot",
  "capybara",
  "hamster",
  "goldfish",
  "raccoon",
  "pug",
] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

export const PUNISHMENTS = [
  "eternal-captcha",
  "cat-labeler",
  "loading-99",
  "laggy-npc",
  "spam-filter",
] as const;
export type Punishment = (typeof PUNISHMENTS)[number];
