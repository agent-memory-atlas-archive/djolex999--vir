import { sample, type Rng } from "../rng.js";
import type { MappingEntry } from "./gradingSet.js";
import type { GradeRecord } from "./grades.js";

// Human calibration subset: both notes of k seeded pairs, shown in the
// grading set's own shuffled order so a pair is never adjacent by design.
// Reads the sealed mapping in code only; nothing about arms is printed.
export function pickPairSubset(
  mapping: readonly MappingEntry[],
  order: readonly string[],
  k: number,
  rng: Rng,
): string[] {
  const pairIdxs = [...new Set(mapping.map((m) => m.pairIdx))].sort((a, b) => a - b);
  const chosen = new Set(sample(pairIdxs, k, rng));
  const ids = new Set(mapping.filter((m) => chosen.has(m.pairIdx)).map((m) => m.id));
  return order.filter((id) => ids.has(id));
}

export function judgeFileName(model: string): string {
  return model === "claude-sonnet-5" ? "judge.json" : `judge-${model}.json`;
}

export function completePairs(mapping: readonly MappingEntry[], grades: readonly GradeRecord[]): MappingEntry[] {
  const graded = new Set(grades.map((g) => g.id));
  const byPair = new Map<number, MappingEntry[]>();
  for (const m of mapping) byPair.set(m.pairIdx, [...(byPair.get(m.pairIdx) ?? []), m]);
  const out: MappingEntry[] = [];
  for (const entries of byPair.values()) {
    if (entries.length === 2 && entries.every((e) => graded.has(e.id))) out.push(...entries);
  }
  return out;
}

function total(g: GradeRecord | undefined): number {
  return g ? g.scores.reduce((a: number, b: number) => a + b, 0) : 0;
}

// On pairs both graders scored: do they agree on which arm got the higher
// total (or that it was a tie)?
export function directionAgreement(
  mapping: readonly MappingEntry[],
  human: readonly GradeRecord[],
  judge: readonly GradeRecord[],
): { pairs: number; agree: number } {
  const h = new Map(human.map((g) => [g.id, g] as const));
  const j = new Map(judge.map((g) => [g.id, g] as const));
  const both = completePairs(completePairs(mapping, human), judge);
  const byPair = new Map<number, MappingEntry[]>();
  for (const m of both) byPair.set(m.pairIdx, [...(byPair.get(m.pairIdx) ?? []), m]);
  let agree = 0;
  for (const entries of byPair.values()) {
    const c = entries.find((e) => e.arm === "control")!;
    const x = entries.find((e) => e.arm === "challenger")!;
    const hs = Math.sign(total(h.get(x.id)) - total(h.get(c.id)));
    const js = Math.sign(total(j.get(x.id)) - total(j.get(c.id)));
    if (hs === js) agree += 1;
  }
  return { pairs: byPair.size, agree };
}
