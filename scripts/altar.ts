/**
 * The Altar's terminal tool.
 *
 *   npm run altar:new    creates the Altar wallet: prints its address and private key,
 *                        and saves the key file outside the project
 *   npm run altar:burn   burns all of the coin the Altar holds (a real BurnChecked,
 *                        the supply shrinks), after you type BURN
 *
 * The key file lives in your home folder (~/.basilisk/altar.json, or the path in
 * ALTAR_KEYPAIR), never in the project, .env.local, Vercel or git.
 */
import { loadEnvConfig } from "@next/env";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { burnAllTransaction, tokenAccountsFrom, type TokenAccount } from "@/lib/solana/burn";
import { keyFileText, parseSecretKey, privateKeyText } from "@/lib/solana/keys";
import { rpc } from "@/lib/solana/rpc";

loadEnvConfig(process.cwd());

const LAMPORTS = 1e9;
/** Enough for the network fee of one burn, with room to spare. */
const MIN_SOL_FOR_FEE = 0.0001;

class Stop extends Error {}

function keyFilePath(): string {
  const custom = process.env.ALTAR_KEYPAIR?.trim();
  return custom ? resolve(custom) : join(homedir(), ".basilisk", "altar.json");
}

/** True when the path is inside the project folder, where it could end up in git. */
function insideProject(path: string): boolean {
  const rel = relative(process.cwd(), path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

async function create(): Promise<void> {
  const file = keyFilePath();
  if (insideProject(file)) {
    throw new Stop(`The key file would be inside the project (${file}) and could end up in git. Choose a path outside it.`);
  }
  if (existsSync(file)) {
    throw new Stop(
      `A key file already exists: ${file}\n` +
        "The Altar is already born. Nothing was changed. To make a new wallet anyway, move that file somewhere safe first.",
    );
  }

  const keypair = await Keypair.generate();
  await mkdir(dirname(file), { recursive: true });
  // "wx": never overwrite; 0o600: readable by you alone (on macOS and Linux).
  await writeFile(file, keyFileText(keypair.secretKey), { mode: 0o600, flag: "wx" });

  console.log(`
The Altar is born.

Address (public). Put it into ALTAR_WALLET, in .env.local and on Vercel:

  ${keypair.publicKey.toBase58()}

Private key (secret). Import it into your wallet to create the coin on pump.fun:

  ${privateKeyText(keypair.secretKey)}

The key is also saved here; npm run altar:burn reads it from this file:

  ${file}

Never put the private key into .env.local, Vercel, GitHub or a chat.
Whoever has it owns the Altar and its fees. Keep a copy somewhere offline.
`);
}

async function loadAltar(): Promise<Keypair> {
  const file = keyFilePath();
  if (!existsSync(file)) {
    throw new Stop(`No key file at ${file}. Create the Altar with npm run altar:new, or set ALTAR_KEYPAIR to your key file.`);
  }
  const secret = parseSecretKey(await readFile(file, "utf8"));
  if (!secret) throw new Stop(`${file} is not a Solana key file (a JSON array of 64 numbers, or a base58 private key).`);
  return Keypair.fromSecretKey(secret);
}

const tokensIn = (accounts: TokenAccount[]) =>
  accounts.reduce((sum, account) => sum + Number(account.amount) / 10 ** account.decimals, 0);

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function burn(skipQuestion: boolean): Promise<void> {
  const mint = process.env.TOKEN_MINT?.trim();
  if (!mint) throw new Stop("TOKEN_MINT is empty in .env.local: there is no coin to burn yet.");
  if (!process.env.SOLANA_RPC_URL?.trim()) throw new Stop("SOLANA_RPC_URL is empty in .env.local.");

  const keypair = await loadAltar();
  const altar = keypair.publicKey.toBase58();
  const expected = process.env.ALTAR_WALLET?.trim();
  if (expected && expected !== altar) {
    throw new Stop(`The key file belongs to ${altar}, but ALTAR_WALLET is ${expected}. Nothing was burned.`);
  }

  const [owned, balance] = await Promise.all([
    rpc<Parameters<typeof tokenAccountsFrom>[0]>("getTokenAccountsByOwner", [
      altar,
      { mint },
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]),
    rpc<{ value: number }>("getBalance", [altar, { commitment: "confirmed" }]),
  ]);
  const accounts = tokenAccountsFrom(owned);
  const sol = balance.value / LAMPORTS;
  const tokens = tokensIn(accounts);

  console.log(`\nThe Altar ${altar}`);
  console.log(`holds ${tokens.toLocaleString("en-US")} tokens and ${sol.toLocaleString("en-US", { maximumFractionDigits: 6 })} SOL.\n`);
  if (accounts.length === 0) {
    console.log("Nothing to burn. Claim the fees on pump.fun and buy the coin with them first.");
    return;
  }
  if (sol < MIN_SOL_FOR_FEE) throw new Stop("Not enough SOL for the network fee. Leave a little SOL on the Altar.");

  if (!skipQuestion) {
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await terminal.question(`Type BURN to burn all ${tokens.toLocaleString("en-US")} tokens. A burn cannot be undone: `);
    terminal.close();
    if (answer.trim() !== "BURN") {
      console.log("Nothing was burned.");
      return;
    }
  }

  const { value } = await rpc<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }]);
  const transaction = VersionedTransaction.deserialize(burnAllTransaction({ owner: altar, mint, accounts, blockhash: value.blockhash }));
  await transaction.sign([keypair]);
  const signature = await rpc<string>("sendTransaction", [
    Buffer.from(transaction.serialize()).toString("base64"),
    { encoding: "base64", preflightCommitment: "confirmed" },
  ]);
  console.log(`\nSent: https://solscan.io/tx/${signature}`);

  for (let attempt = 0; attempt < 30; attempt++) {
    const statuses = await rpc<{ value: ({ err: unknown; confirmationStatus?: string } | null)[] }>("getSignatureStatuses", [
      [signature],
    ]);
    const status = statuses.value[0];
    if (status?.err) throw new Stop(`The burn failed on chain: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      console.log(`Burned ${tokens.toLocaleString("en-US")} tokens. The offering will appear on /burns within a few minutes.`);
      return;
    }
    await sleep(2_000);
  }
  console.log("Not confirmed yet. Open the link above in a minute to see whether it landed.");
}

async function main() {
  const [command, ...flags] = process.argv.slice(2);
  if (command === "new") return create();
  if (command === "burn") return burn(flags.includes("--yes"));
  console.log("Usage:\n  npm run altar:new     create the Altar wallet\n  npm run altar:burn    burn all of the coin the Altar holds");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Stop ? error.message : error);
  process.exitCode = 1;
});
