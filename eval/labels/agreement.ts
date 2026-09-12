import type { Grade } from "./judge.js";

export interface Agreement {
  n: number;
  // Same grade.
  exact: number;
  // Grades differ by at most one.
  within1: number;
  // Both say relevant (≥1) or both say irrelevant (0).
  binary: number;
  // Cohen's unweighted kappa over the three grades.
  kappa: number;
}

// The spot-check's only output. Model labels agreeing with themselves is
// correlation; this is the number that says whether the labels mean what a
// human means.
export function agreement(pairs: ReadonlyArray<{ human: Grade; model: Grade }>): Agreement {
  const n = pairs.length;
  if (n === 0) return { n: 0, exact: 0, within1: 0, binary: 0, kappa: 0 };
  let exact = 0;
  let within1 = 0;
  let binary = 0;
  const hCount = [0, 0, 0];
  const mCount = [0, 0, 0];
  for (const p of pairs) {
    if (p.human === p.model) exact += 1;
    if (Math.abs(p.human - p.model) <= 1) within1 += 1;
    if (p.human >= 1 === p.model >= 1) binary += 1;
    hCount[p.human] = (hCount[p.human] ?? 0) + 1;
    mCount[p.model] = (mCount[p.model] ?? 0) + 1;
  }
  const po = exact / n;
  let pe = 0;
  for (let g = 0; g < 3; g += 1) pe += (hCount[g]! / n) * (mCount[g]! / n);
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { n, exact: po, within1: within1 / n, binary: binary / n, kappa };
}
