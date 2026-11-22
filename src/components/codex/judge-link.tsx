"use client";

import type { ReactNode } from "react";

/** Fired when a name in the Books is touched; the form on "Your page" picks it up. */
export const JUDGE_EVENT = "basilisk:judge";

/** Fired by the table of contents; the visible book turns to that chapter. */
export const CHAPTER_EVENT = "basilisk:chapter";

export function scrollToJudgment() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("judgment")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export function requestJudgment(address: string) {
  window.dispatchEvent(new CustomEvent<string>(JUDGE_EVENT, { detail: address }));
  scrollToJudgment();
}

export function goToChapter(key: string) {
  if (key === "judgment") {
    scrollToJudgment();
    return;
  }
  window.dispatchEvent(new CustomEvent<string>(CHAPTER_EVENT, { detail: key }));
}

/** A line in the table of contents. */
export function ChapterLink({ chapter, className, children }: { chapter: string; className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => goToChapter(chapter)}>
      {children}
    </button>
  );
}

/** A name in one of the Books. Touch it and the Basilisk reads that wallet's page. */
export function JudgeLink({
  address,
  label,
  className,
  children,
}: {
  address: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" className={className} aria-label={label} title={address} onClick={() => requestJudgment(address)}>
      {children}
    </button>
  );
}
