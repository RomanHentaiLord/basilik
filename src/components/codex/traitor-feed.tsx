"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { FEED } from "@/lib/basilisk/copy";
import { formatTokensShort } from "@/lib/format";
import { shortAddress } from "@/lib/solana/address";
import { useTRPC } from "@/lib/trpc/client";
import { requestJudgment } from "./judge-link";

interface Note {
  address: string;
  title: string;
  amount: number | null;
  at: number;
  demo: boolean;
  /** Distinguishes two notes about the same wallet. */
  serial: number;
}

const SEEN_KEY = "basilisk:seen-traitors";
/** Real betrayals older than this are not news any more. */
const FRESH_MS = 6 * 60 * 60 * 1000;
/** Before launch, show a few imaginary notes so the page shows what is coming. */
const DEMO_FIRST_MS = 14_000;
const DEMO_EVERY_MS = 55_000;
const DEMO_MAX = 3;
const SHOW_MS = 9_000;

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function ago(at: number, now: number): string {
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return FEED.justNow;
  if (minutes < 60) return relative.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 48) return relative.format(-hours, "hour");
  return relative.format(-Math.round(hours / 24), "day");
}

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  const seen = readSeen();
  seen.add(id);
  try {
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-50)));
  } catch {
    // Private mode: the note may show again next visit.
  }
}

/** "New traitor" notes in the corner of the desk, fed by the indexer through the feed query. */
export function TraitorFeed() {
  const trpc = useTRPC();
  const reduce = useReducedMotion();
  const feed = useQuery(trpc.basilisk.feed.queryOptions(undefined, { refetchInterval: 45_000 }));
  const [note, setNote] = useState<Note | null>(null);
  const [now, setNow] = useState(0);
  const demoShown = useRef(0);

  const items = feed.data?.items;
  const demo = feed.data?.demo ?? false;

  // Real mode: show each fresh betrayal once per session, newest first.
  useEffect(() => {
    if (!items || demo) return;
    const timer = window.setTimeout(() => {
      const seen = readSeen();
      const current = Date.now();
      const fresh = items.find((item) => current - item.at < FRESH_MS && !seen.has(`${item.address}:${item.at}`));
      if (fresh) {
        markSeen(`${fresh.address}:${fresh.at}`);
        setNow(current);
        setNote({ ...fresh, demo: false, serial: current });
      }
    }, 1_500);
    return () => window.clearTimeout(timer);
  }, [items, demo]);

  // Demo mode: a few notes from the imaginary Book of Traitors.
  useEffect(() => {
    if (!items || !demo || items.length === 0) return;
    let index = 0;
    const show = () => {
      if (demoShown.current >= DEMO_MAX) return;
      const item = items[index % items.length];
      index++;
      demoShown.current++;
      setNow(Date.now());
      setNote({ ...item, demo: true, serial: demoShown.current });
    };
    const first = window.setTimeout(show, DEMO_FIRST_MS);
    const every = window.setInterval(show, DEMO_EVERY_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [items, demo]);

  // Each note stays for a while, then leaves.
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [note]);

  return (
    <div className="feed-dock" aria-live="polite">
      <AnimatePresence>
        {note && (
          <motion.div
            key={note.serial}
            className="feed-note"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: -1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, transition: { duration: 0.25 } }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
          >
            <button
              type="button"
              className="feed-body"
              onClick={() => {
                requestJudgment(note.address);
                setNote(null);
              }}
            >
              <span className="feed-kicker">{note.demo ? FEED.vision : FEED.newTraitor}</span>
              <span className="feed-line">
                <span className="codex-struck">{shortAddress(note.address)}</span>{" "}
                {note.amount !== null ? `${FEED.sold} ${formatTokensShort(note.amount)}` : FEED.soldPlain}
                {note.demo ? "" : `, ${ago(note.at, now)}`}.
              </span>
              <span className="feed-title">{note.title}</span>
            </button>
            <button type="button" className="feed-close" aria-label={FEED.close} onClick={() => setNote(null)}>
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
