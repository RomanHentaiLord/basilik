import Link from "next/link";
import type { ReactNode } from "react";

/** A name on another page: opens that wallet's page at the end of the book. */
export function JudgeEntryLink({
  address,
  label,
  children,
}: {
  address: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      className="ledger-name codex-focus"
      href={`/?wallet=${address}#judgment`}
      aria-label={label}
      title={address}
    >
      {children}
    </Link>
  );
}
