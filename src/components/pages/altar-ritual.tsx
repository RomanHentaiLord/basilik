"use client";

import { useMutation } from "@tanstack/react-query";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { useState, useSyncExternalStore } from "react";
import { ALTAR_PAGE } from "@/lib/basilisk/copy";
import { formatTokens } from "@/lib/format";
import { encodeBase58, shortAddress } from "@/lib/solana/address";
import { useTRPC } from "@/lib/trpc/client";

/*
 * The burn button. Phantom (or any Wallet Standard wallet) signs and sends a transaction the
 * server prepared: BurnChecked for every token account the Altar holds. No key ever leaves
 * the wallet, and the server refuses to prepare a burn for anyone but the Altar.
 */

type ConnectFeature = {
  connect(input?: { silent?: boolean }): Promise<{ accounts: readonly WalletAccount[] }>;
};
type SignAndSendFeature = {
  signAndSendTransaction(
    ...inputs: { account: WalletAccount; chain: string; transaction: Uint8Array }[]
  ): Promise<readonly { signature: Uint8Array }[]>;
};

const MAINNET = "solana:mainnet";
const NO_WALLETS: readonly Wallet[] = [];

const isSolanaWallet = (wallet: Wallet) =>
  wallet.chains.some((chain) => chain.startsWith("solana:")) &&
  "standard:connect" in wallet.features &&
  "solana:signAndSendTransaction" in wallet.features;

let snapshot: readonly Wallet[] = NO_WALLETS;

function readWallets(): readonly Wallet[] {
  const list = getWallets().get().filter(isSolanaWallet);
  const same = list.length === snapshot.length && list.every((wallet, i) => wallet === snapshot[i]);
  if (!same) snapshot = list;
  return snapshot;
}

function subscribe(onChange: () => void) {
  const wallets = getWallets();
  const offRegister = wallets.on("register", onChange);
  const offUnregister = wallets.on("unregister", onChange);
  return () => {
    offRegister();
    offUnregister();
  };
}

/** Wallets in this browser that can sign Solana transactions; Phantom first. */
function useSolanaWallets(): readonly Wallet[] {
  const wallets = useSyncExternalStore(subscribe, readWallets, () => NO_WALLETS);
  return [...wallets].sort((a, b) => Number(b.name === "Phantom") - Number(a.name === "Phantom"));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

type Phase =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "preparing" }
  | { kind: "confirm"; tokens: number }
  | { kind: "signing" }
  | { kind: "done"; signature: string }
  | { kind: "failed"; message: string };

export function AltarRitual({ altar }: { altar: string }) {
  const trpc = useTRPC();
  const prepare = useMutation(trpc.altar.prepareBurn.mutationOptions());
  const wallets = useSolanaWallets();
  const [chosen, setChosen] = useState<{ wallet: Wallet; account: WalletAccount } | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const wallet = chosen?.wallet ?? wallets[0] ?? null;
  const isAltar = chosen?.account.address === altar;

  async function connect() {
    if (!wallet) return;
    setPhase({ kind: "connecting" });
    try {
      const { accounts } = await (wallet.features["standard:connect"] as ConnectFeature).connect();
      const account = accounts.find((item) => item.address === altar) ?? accounts[0];
      setChosen(account ? { wallet, account } : null);
      setPhase({ kind: "idle" });
    } catch (error) {
      setPhase({ kind: "failed", message: messageOf(error) });
    }
  }

  /** First count what the Altar holds, so the confirmation names the real amount. */
  async function count() {
    if (!chosen) return;
    setPhase({ kind: "preparing" });
    try {
      const { tokens } = await prepare.mutateAsync({ owner: chosen.account.address });
      setPhase({ kind: "confirm", tokens });
    } catch (error) {
      setPhase({ kind: "failed", message: messageOf(error) });
    }
  }

  /** Prepared again here: a blockhash is only good for about a minute. */
  async function burn() {
    if (!chosen) return;
    setPhase({ kind: "signing" });
    try {
      const { transaction } = await prepare.mutateAsync({ owner: chosen.account.address });
      const chain = chosen.account.chains.find((item) => item === MAINNET) ?? MAINNET;
      const feature = chosen.wallet.features["solana:signAndSendTransaction"] as SignAndSendFeature;
      const [result] = await feature.signAndSendTransaction({
        account: chosen.account,
        chain,
        transaction: fromBase64(transaction),
      });
      setPhase({ kind: "done", signature: encodeBase58(result.signature) });
    } catch (error) {
      setPhase({ kind: "failed", message: messageOf(error) });
    }
  }

  if (!wallet) {
    const here = typeof window === "undefined" ? "" : window.location.href;
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return (
      <div className="altar-ritual">
        <p className="altar-note">{ALTAR_PAGE.noWallet}</p>
        <a
          className="codex-button altar-button codex-focus"
          href={`https://phantom.app/ul/browse/${encodeURIComponent(here)}?ref=${encodeURIComponent(origin)}`}
        >
          {ALTAR_PAGE.openInPhantom}
        </a>
      </div>
    );
  }

  const busy = phase.kind === "connecting" || phase.kind === "preparing" || phase.kind === "signing";

  return (
    <div className="altar-ritual" aria-live="polite">
      {chosen && (
        <p className={isAltar ? "altar-note" : "altar-note altar-note--wrong"}>
          {isAltar ? ALTAR_PAGE.connected(shortAddress(altar)) : ALTAR_PAGE.notAltar(shortAddress(chosen.account.address))}
        </p>
      )}

      {phase.kind === "confirm" ? (
        <div className="altar-confirm">
          <p>{ALTAR_PAGE.confirm(formatTokens(phase.tokens))}</p>
          <div className="altar-actions">
            <button type="button" className="codex-button altar-button codex-focus" onClick={burn}>
              {ALTAR_PAGE.confirmYes}
            </button>
            <button type="button" className="codex-link altar-cancel codex-focus" onClick={() => setPhase({ kind: "idle" })}>
              {ALTAR_PAGE.confirmNo}
            </button>
          </div>
        </div>
      ) : phase.kind === "done" ? (
        <div className="altar-done">
          <p className="altar-done-title">{ALTAR_PAGE.done}</p>
          <p>
            {ALTAR_PAGE.doneNote}{" "}
            <a className="codex-link codex-focus" href={`https://solscan.io/tx/${phase.signature}`} target="_blank" rel="noreferrer">
              {ALTAR_PAGE.seeTx}
            </a>
          </p>
        </div>
      ) : (
        <div className="altar-actions">
          {chosen && isAltar ? (
            <button type="button" className="codex-button altar-button codex-focus" onClick={count} disabled={busy}>
              {phase.kind === "preparing" ? ALTAR_PAGE.preparing : phase.kind === "signing" ? ALTAR_PAGE.signing : ALTAR_PAGE.burnAll}
            </button>
          ) : (
            <button type="button" className="codex-button altar-button codex-focus" onClick={connect} disabled={busy}>
              {phase.kind === "connecting" ? ALTAR_PAGE.connecting : ALTAR_PAGE.connect}
            </button>
          )}
        </div>
      )}

      {phase.kind === "failed" && (
        <p className="altar-error">
          {ALTAR_PAGE.failed} {phase.message}
        </p>
      )}
    </div>
  );
}
