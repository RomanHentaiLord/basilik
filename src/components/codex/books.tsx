import { CODEX } from "@/lib/basilisk/copy";
import { formatTokens, formatTokensShort } from "@/lib/format";
import { shortAddress } from "@/lib/solana/address";
import { booksOverview } from "@/server/books";
import { CopyAddress } from "./copy-address";

/** Three counters under the form: faithful, traitors, forgiven. */
export async function Tally() {
  const books = await booksOverview();
  const items = [
    { value: books.faithful, label: CODEX.tallyFaithful },
    { value: books.traitors, label: CODEX.tallyTraitors },
    { value: books.forgiven, label: CODEX.tallyForgiven },
  ];
  return (
    <div className="mt-[34px] border-t border-ink/30 pt-[22px]">
      <dl className="m-0 flex flex-wrap gap-8">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col-reverse">
            <dt className="text-[16px] italic text-ink-muted">{item.label}</dt>
            <dd className="m-0 text-[34px] font-medium [font-variant-numeric:oldstyle-nums]">
              {formatTokens(item.value)}
            </dd>
          </div>
        ))}
      </dl>
      {books.demo && <p className="mt-4 mb-0 text-[15px] italic text-ink-muted">{CODEX.demoBooks}</p>}
    </div>
  );
}

/** The latest names written into the Book of Traitors. */
export async function TraitorsSection() {
  const books = await booksOverview();
  return (
    <section aria-labelledby="traitors-title">
      <h3 id="traitors-title" className="codex-fraktur mt-11 mb-3 text-[34px]">
        {CODEX.traitorsTitle}
      </h3>
      {books.latestTraitors.length === 0 ? (
        <p className="m-0 text-[19px] italic text-ink-muted">{CODEX.traitorsEmpty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="codex-table">
            <thead>
              <tr>
                <th scope="col">Wallet</th>
                <th scope="col">What it did</th>
                <th scope="col">Its fate</th>
              </tr>
            </thead>
            <tbody>
              {books.latestTraitors.map((row) => (
                <tr key={row.address}>
                  <td>
                    <CopyAddress address={row.address} label={shortAddress(row.address)} />
                  </td>
                  <td className="whitespace-nowrap">{row.amount !== null ? `Sold ${formatTokensShort(row.amount)}` : "Sold"}</td>
                  <td className="italic text-rubric">{row.punishment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {books.demo && books.latestTraitors.length > 0 && (
        <p className="mt-3 mb-0 text-[15px] italic text-ink-muted">
          Imaginary wallets. Copy one, paste it above, and the Basilisk will tell you the same.
        </p>
      )}
    </section>
  );
}

export function TallySkeleton() {
  return <div aria-hidden="true" className="mt-[34px] h-[86px] border-t border-ink/30" />;
}
