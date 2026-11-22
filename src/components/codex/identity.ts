"use client";

import { useSyncExternalStore } from "react";
import type { Rank } from "@/lib/basilisk/config";
import { RANK_SHORT } from "@/lib/basilisk/copy";
import type { Status, Verdict } from "@/lib/basilisk/types";

/**
 * "Who am I": the wallet a visitor has judged as their own, kept on this device only.
 * It lets the header, the cover and the Order of the Faithful show where the visitor stands.
 */
export interface Identity {
  address: string;
  title: string;
  status: Status;
  rank: Rank | null;
  balance: number;
  savedAt: number;
}

const KEY = "basilisk:me";
const listeners = new Set<() => void>();
let cache: Identity | null | undefined;

function read(): Identity | null {
  if (cache !== undefined) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      cache = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useIdentity(): Identity | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function currentIdentity(): Identity | null {
  return typeof window === "undefined" ? null : read();
}

export function saveIdentity(verdict: Verdict) {
  cache = {
    address: verdict.address,
    title: verdict.title,
    status: verdict.status,
    rank: verdict.rank,
    balance: verdict.balance,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Private mode: remember for this visit only.
  }
  emit();
}

export function forgetIdentity() {
  cache = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
  emit();
}

/** One or two words for the header: "Keeper", "Traitor", "Witness". */
export function identityLabel(identity: Identity): string {
  switch (identity.status) {
    case "witness":
      return "Witness";
    case "sympathizer":
      return "Sympathizer";
    case "traitor":
      return "Traitor";
    case "doubter":
      return identity.rank ? `${RANK_SHORT[identity.rank]}, in pencil` : "In pencil";
    default:
      return identity.rank ? RANK_SHORT[identity.rank] : identity.title;
  }
}
