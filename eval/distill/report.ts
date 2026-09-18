import type { Arm, MappingEntry } from "./gradingSet.js";
import type { GradeRecord, Scores } from "./grades.js";
import { pairedT, signTest } from "./stats.js";

export type Mapping = MappingEntry[];
export type { GradeRecord };

export const DIM_NAMES = [
  "Decision recorded",
  "Reasoning recoverable",
  "Specific",
  "Correctable",
  "Narration suppressed",
] as const;

export interface PairRow {
  pairIdx: number;
  control: Scores;
  challenger: Scores;
  diff: number[];
}

export interface Unblinded {
  pairs: PairRow[];
  means: Record<Arm, number[]>;
  // Mean over pairs of the per-pair mean difference across the five dimensions.
  overallDiff: number;
}

function meanOf(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function unblind(mapping: Mapping, grades: readonly GradeRecord[]): Unblinded {
  const byId = new Map(grades.map((g) => [g.id, g.scores] as const));
  const missing = mapping.filter((m) => !byId.has(m.id)).map((m) => m.id);
  if (missing.length > 0) throw new Error(`ungraded ids: ${missing.join(", ")}`);
  const byPair = new Map<number, Partial<Record<Arm, Scores>>>();
  for (const m of mapping) {
    const slot = byPair.get(m.pairIdx) ?? {};
    slot[m.arm] = byId.get(m.id)!;
    byPair.set(m.pairIdx, slot);
  }
  const pairs: PairRow[] = [];
  for (const [pairIdx, slot] of [...byPair.entries()].sort((a, b) => a[0] - b[0])) {
    const control = slot.control;
    const challenger = slot.challenger;
    if (!control || !challenger) throw new Error(`pair ${pairIdx} is missing an arm`);
    pairs.push({ pairIdx, control, challenger, diff: challenger.map((v, i) => v - control[i]!) });
  }
  const dims = [0, 1, 2, 3, 4];
  const means: Record<Arm, number[]> = {
    control: dims.map((d) => meanOf(pairs.map((p) => p.control[d]!))),
    challenger: dims.map((d) => meanOf(pairs.map((p) => p.challenger[d]!))),
  };
  const overallDiff = meanOf(pairs.map((p) => meanOf(p.diff)));
  return { pairs, means, overallDiff };
}

export interface Agreement {
  n: number;
  exact: number[];
  within1: number[];
  exactOverall: number;
  within1Overall: number;
}

export function agreement(human: readonly GradeRecord[], model: readonly GradeRecord[]): Agreement {
  const m = new Map(model.map((g) => [g.id, g.scores] as const));
  const rows = human.filter((h) => m.has(h.id));
  const n = rows.length;
  const exact = [0, 0, 0, 0, 0];
  const within1 = [0, 0, 0, 0, 0];
  for (const h of rows) {
    const s = m.get(h.id)!;
    for (let d = 0; d < 5; d += 1) {
      const delta = Math.abs(h.scores[d]! - s[d]!);
      if (delta === 0) exact[d] = (exact[d] ?? 0) + 1;
      if (delta <= 1) within1[d] = (within1[d] ?? 0) + 1;
    }
  }
  const norm = (xs: number[]) => xs.map((x) => (n === 0 ? 0 : x / n));
  return {
    n,
    exact: norm(exact),
    within1: norm(within1),
    exactOverall: n === 0 ? 0 : exact.reduce((a, b) => a + b, 0) / (5 * n),
    within1Overall: n === 0 ? 0 : within1.reduce((a, b) => a + b, 0) / (5 * n),
  };
}

function f2(x: number): string {
  return x.toFixed(2);
}
function f3(x: number): string {
  return x.toFixed(3);
}

export function buildReport(opts: {
  mapping: Mapping;
  grades: readonly GradeRecord[];
  judge: readonly GradeRecord[] | null;
  sampleLabels: Record<number, string>;
}): string {
  const u = unblind(opts.mapping, opts.grades);
  const n = u.pairs.length;
  const lines: string[] = [];
  lines.push(`# Distill prompt A/B — unblinded report`, "", `n = ${n} paired transcripts, each graded under both arms on five 0-2 dimensions.`, "");
  lines.push("## Per-dimension means (human grades)", "", "| Dimension | control | challenger | diff | paired t | p (t) | sign +/−/= | p (sign) |", "|---|---|---|---|---|---|---|---|");
  for (let d = 0; d < 5; d += 1) {
    const diffs = u.pairs.map((p) => p.diff[d]!);
    const t = pairedT(diffs);
    const s = signTest(diffs);
    lines.push(`| ${DIM_NAMES[d]} | ${f2(u.means.control[d]!)} | ${f2(u.means.challenger[d]!)} | ${t.mean >= 0 ? "+" : ""}${f2(t.mean)} | ${f2(t.t)} | ${f3(t.p)} | ${s.pos}/${s.neg}/${s.ties} | ${f3(s.p)} |`);
  }
  const overall = pairedT(u.pairs.map((p) => p.diff.reduce((a, b) => a + b, 0) / 5));
  const overallSign = signTest(u.pairs.map((p) => p.diff.reduce((a, b) => a + b, 0)));
  lines.push("", "## Overall", "", `Mean per-pair difference (challenger − control, averaged over the five dimensions): ${overall.mean >= 0 ? "+" : ""}${f3(overall.mean)} points on a 0-2 scale.`, "", `Paired t = ${f2(overall.t)}, df = ${overall.df}, two-sided p = ${f3(overall.p)}. Sign test on pair totals: ${overallSign.pos} pairs favour the challenger, ${overallSign.neg} the control, ${overallSign.ties} tied; exact p = ${f3(overallSign.p)}.`, "");
  const detectable = overall.p < 0.05 && overallSign.p < 0.05;
  lines.push(detectable ? `Verdict: a difference of this size is detectable at n = ${n} on both tests.` : `Verdict: with n = ${n} this difference is not detectable. A tie is the result unless per-dimension effects below are large and agree on both tests.`, "");
  lines.push("## Per-pair scores", "", "| # | transcript | control D1-D5 | challenger D1-D5 | diff |", "|---|---|---|---|---|");
  for (const p of u.pairs) lines.push(`| ${p.pairIdx} | ${opts.sampleLabels[p.pairIdx] ?? ""} | ${p.control.join(" ")} | ${p.challenger.join(" ")} | ${p.diff.map((x) => (x >= 0 ? "+" : "") + x).join(" ")} |`);
  if (opts.judge) {
    const a = agreement(opts.grades, opts.judge);
    lines.push("", "## Model preview agreement (Sonnet 5 via claude -p; preview only, never the result)", "", `Notes with both grades: ${a.n}. Exact agreement overall ${f2(a.exactOverall)}, within ±1 ${f2(a.within1Overall)}.`, "", "| Dimension | exact | within ±1 |", "|---|---|---|");
    for (let d = 0; d < 5; d += 1) lines.push(`| ${DIM_NAMES[d]} | ${f2(a.exact[d]!)} | ${f2(a.within1[d]!)} |`);
    const mu = unblind(opts.mapping, opts.judge);
    lines.push("", `Model's own overall diff: ${mu.overallDiff >= 0 ? "+" : ""}${f3(mu.overallDiff)} (human: ${u.overallDiff >= 0 ? "+" : ""}${f3(u.overallDiff)}).`);
  }
  return lines.join("\n") + "\n";
}
