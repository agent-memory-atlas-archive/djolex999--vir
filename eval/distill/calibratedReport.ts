import { completePairs, directionAgreement } from "./calibrate.js";
import type { MappingEntry } from "./gradingSet.js";
import type { GradeRecord } from "./grades.js";
import { DIM_NAMES, agreement, unblind } from "./report.js";
import { pairedT, signTest } from "./stats.js";

export interface JudgeGrades {
  model: string;
  grades: readonly GradeRecord[];
}

const f2 = (x: number): string => x.toFixed(2);
const f3 = (x: number): string => x.toFixed(3);
const signed = (x: number, f: (n: number) => string): string => `${x >= 0 ? "+" : ""}${f(x)}`;

function armTable(mapping: readonly MappingEntry[], grades: readonly GradeRecord[]): string[] {
  const u = unblind([...mapping], grades);
  const lines = [
    "| Dimension | control | challenger | diff | paired t | p (t) | sign +/−/= | p (sign) |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (let d = 0; d < 5; d += 1) {
    const diffs = u.pairs.map((p) => p.diff[d]!);
    const t = pairedT(diffs);
    const s = signTest(diffs);
    lines.push(`| ${DIM_NAMES[d]} | ${f2(u.means.control[d]!)} | ${f2(u.means.challenger[d]!)} | ${signed(t.mean, f2)} | ${f2(t.t)} | ${f3(t.p)} | ${s.pos}/${s.neg}/${s.ties} | ${f3(s.p)} |`);
  }
  const totals = u.pairs.map((p) => p.diff.reduce((a, b) => a + b, 0));
  const overall = pairedT(totals.map((x) => x / 5));
  const sign = signTest(totals);
  lines.push(
    "",
    `Overall (challenger − control, mean over five dimensions): ${signed(overall.mean, f3)} on a 0-2 scale; paired t = ${f2(overall.t)}, df = ${overall.df}, p = ${f3(overall.p)}; sign test ${sign.pos}/${sign.neg}/${sign.ties}, p = ${f3(sign.p)}.`,
  );
  return lines;
}

// Model-judged, human-calibrated: the judges score every note; the human
// scores a seeded subset of whole pairs; agreement on that subset says how
// much weight the judged result can carry. Same-family model grades are a
// preview and are never presented as verification.
export function buildCalibratedReport(opts: {
  mapping: readonly MappingEntry[];
  human: readonly GradeRecord[];
  judges: readonly JudgeGrades[];
  sampleLabels: Record<number, string>;
}): string {
  const nPairs = new Set(opts.mapping.map((m) => m.pairIdx)).size;
  const lines: string[] = [
    "# Distill prompt A/B — model-judged, human-calibrated report",
    "",
    "The judges are Claude models grading notes written by Claude models. That is a preview, not verification; the human subset below is the only independent evidence, and its size bounds what this report can claim.",
    "",
  ];
  for (const j of opts.judges) {
    const graded = new Set(j.grades.map((g) => g.id));
    const missing = opts.mapping.filter((m) => !graded.has(m.id)).length;
    if (missing > 0) throw new Error(`${j.model} left ${missing} notes ungraded`);
    lines.push(`## Judge: ${j.model} (n = ${nPairs} pairs)`, "", ...armTable(opts.mapping, j.grades), "");
  }
  if (opts.judges.length === 2) {
    const [a, b] = opts.judges;
    const ag = agreement(a!.grades, b!.grades);
    const dir = directionAgreement(opts.mapping, a!.grades, b!.grades);
    lines.push(`## Judge vs judge (${a!.model} vs ${b!.model}, ${ag.n} notes)`, "", `Exact ${f2(ag.exactOverall)}, within ±1 ${f2(ag.within1Overall)}. Same arm preferred on ${dir.agree} of ${dir.pairs} pairs.`, "");
  }
  const humanMapping = completePairs(opts.mapping, opts.human);
  const hPairs = humanMapping.length / 2;
  lines.push(`## Human calibration subset (n = ${hPairs} pairs, ${humanMapping.length} notes)`, "");
  if (hPairs === 0) {
    lines.push("No complete human-graded pair yet.", "");
  } else {
    const humanGrades = opts.human.filter((g) => humanMapping.some((m) => m.id === g.id));
    lines.push(...armTable(humanMapping, humanGrades), "", `With n = ${hPairs} this subset cannot detect a difference on its own; it exists to check the judges.`, "");
    for (const j of opts.judges) {
      const ag = agreement(humanGrades, j.grades);
      const dir = directionAgreement(opts.mapping, humanGrades, j.grades);
      lines.push(`### Human vs ${j.model}`, "", `Note-level: exact ${f2(ag.exactOverall)}, within ±1 ${f2(ag.within1Overall)} over ${ag.n} notes. Direction: same arm preferred on ${dir.agree} of ${dir.pairs} pairs.`, "", "| Dimension | exact | within ±1 |", "|---|---|---|");
      for (let d = 0; d < 5; d += 1) lines.push(`| ${DIM_NAMES[d]} | ${f2(ag.exact[d]!)} | ${f2(ag.within1[d]!)} |`);
      lines.push("");
    }
  }
  return lines.join("\n") + "\n";
}
