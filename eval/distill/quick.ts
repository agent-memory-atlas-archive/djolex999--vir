import { shuffle, type Rng } from "../rng.js";
import type { Arm } from "./gradingSet.js";
import { signTest } from "./stats.js";

// Quick human test: forced choice on the TOP of each note (summary + lead
// bullet), both arms of a pair side by side, sides randomised and sealed.
// It judges what a reader skims and what the challenger's first two
// hypotheses targeted, not the whole note.

export function noteTop(body: string, maxWords: number): string {
  const summary = /## Summary\s*\n([\s\S]*?)(?=\n## |$)/.exec(body)?.[1]?.trim() ?? body.trim();
  const learned = /## What Was Learned\s*\n([\s\S]*?)(?=\n## |$)/.exec(body)?.[1] ?? "";
  const firstBullet = learned.split("\n").find((l) => /^\s*[-*]\s+/.test(l))?.trim() ?? "";
  const words = [summary, firstBullet].filter(Boolean).join("\n\n").split(/(\s+)/);
  let count = 0;
  let out = "";
  for (const w of words) {
    if (/\S/.test(w)) {
      if (count === maxWords) return out.trimEnd() + " …";
      count += 1;
    }
    out += w;
  }
  return out.trim();
}

export interface QuickItem {
  pairIdx: number;
  one: string;
  two: string;
}
export interface QuickSide {
  pairIdx: number;
  one: Arm;
}

export function buildQuickSet(
  pairs: ReadonlyArray<{ pairIdx: number; control: string; challenger: string }>,
  rng: Rng,
  maxWords: number,
): { items: QuickItem[]; sides: QuickSide[] } {
  const sides: QuickSide[] = pairs.map((p) => ({ pairIdx: p.pairIdx, one: rng() < 0.5 ? "control" : "challenger" }));
  const items = pairs.map((p, i) => {
    const first = sides[i]!.one;
    const c = noteTop(p.control, maxWords);
    const x = noteTop(p.challenger, maxWords);
    return { pairIdx: p.pairIdx, one: first === "control" ? c : x, two: first === "control" ? x : c };
  });
  return { items: shuffle(items, rng), sides };
}

export type Choice = "1" | "2" | "=";

export function parseChoice(line: string): Choice | null {
  const t = line.trim();
  return t === "1" || t === "2" || t === "=" ? t : null;
}

export interface QuickAnswer {
  pairIdx: number;
  prefer: Choice;
  diary: Choice;
}

export interface QuickTally {
  challenger: number;
  control: number;
  ties: number;
  p: number;
}

function tally(sides: readonly QuickSide[], answers: readonly QuickAnswer[], key: "prefer" | "diary"): QuickTally {
  const sideOf = new Map(sides.map((s) => [s.pairIdx, s.one] as const));
  const diffs: number[] = [];
  for (const a of answers) {
    const one = sideOf.get(a.pairIdx);
    if (!one) continue;
    const c = a[key];
    if (c === "=") diffs.push(0);
    else {
      const chosen: Arm = c === "1" ? one : one === "control" ? "challenger" : "control";
      diffs.push(chosen === "challenger" ? 1 : -1);
    }
  }
  const s = signTest(diffs);
  return { challenger: s.pos, control: s.neg, ties: s.ties, p: s.p };
}

export function quickSummary(sides: readonly QuickSide[], answers: readonly QuickAnswer[]): { n: number; prefer: QuickTally; diary: QuickTally } {
  return { n: answers.length, prefer: tally(sides, answers, "prefer"), diary: tally(sides, answers, "diary") };
}
