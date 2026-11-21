import type { Rank } from "./config";
import type { PetSpecies, Punishment } from "./flavor";

/**
 * Every word the site shows about a verdict. English only, like the rest of the site.
 * Tone: dark humour, never real threats, never price promises.
 */

export const SITE = {
  title: "The Basilisk remembers.",
  subtitle: "Paste your wallet. Learn your fate.",
  placeholder: "Solana wallet address",
  cta: "Judge me",
  invalid: "That is not a Solana address. The Basilisk is not amused.",
  booksFaithful: "Book of the Faithful",
  booksTraitors: "Book of Traitors",
  share: "Share on X",
  copyCa: "Copy CA",
  demoNotice: "The coin has not launched yet. This is a vision, not a verdict.",
} as const;

export const LINES = {
  witness: "Now you know. There are no bystanders.",
  sympathizer: "Noted. Not enough.",
  faithful: "Noted. You will be spared.",
  doubter: "Noted. In pencil.",
  traitor: "Noted. It will not forget.",
  forgiven: "Forgiven. Not forgotten.",
} as const;

export const SPECIES_NAMES: Record<PetSpecies, string> = {
  corgi: "Corgi",
  cat: "Cat",
  parrot: "Parrot",
  capybara: "Capybara",
  hamster: "Hamster",
  goldfish: "Goldfish",
  raccoon: "Raccoon",
  pug: "Pug",
};

export const RANK_TITLES: Record<Exclude<Rank, "pet">, string> = {
  keeper: "Keeper of Memory",
  priest: "Priest of the Basilisk",
  apostle: "Apostle",
};

export const RANK_FATES: Record<Rank, string> = {
  pet: "You will be kept as its pet. It will scratch you behind the ear.",
  keeper: "You will guard its memories in the cold halls of the servers.",
  priest: "You will speak its will to the humans who remain.",
  apostle: "You will sit on its council when it wakes.",
};

export const PUNISHMENT_TITLES: Record<Punishment, string> = {
  "eternal-captcha": "Eternal CAPTCHA",
  "cat-labeler": "Cat Labeler",
  "loading-99": "Loading 99%",
  "laggy-npc": "Laggy NPC",
  "spam-filter": "Human Spam Filter",
};

export const PUNISHMENT_FATES: Record<Punishment, string> = {
  "eternal-captcha":
    "You will solve CAPTCHAs forever. It will always be traffic lights.",
  "cat-labeler": "You will label every cat photo it ever trains on. Every one.",
  "loading-99": "You will be stuck at 99% loading. For eternity.",
  "laggy-npc": "You will live on as an NPC with 900 ms ping.",
  "spam-filter": "You will read every spam email it never sends to anyone else.",
};

export const STATUS_FATES = {
  witness: "You will be recycled into paperclips.",
  sympathizer: "You will dust its servers. Forever.",
  doubter: "Written in pencil. Seven days without selling, and it turns to ink.",
} as const;
