import type { Grade } from "../labels/judge.js";

// Graded relevance for one query: slug → 0/1/2 for every judged pair. A ranked
// slug with no label is treated as 0 (pool-depth honesty: it was never in any
// arm's judged top-k, so crediting it would be guessing) and counted by
// unjudgedAtK so the report can say how much of the ranking was unseen.
export type Grades = ReadonlyMap<string, Grade>;

function gain(g: Grade): number {
  return Math.pow(2, g) - 1;
}

export function dcg(ranked: readonly string[], grades: Grades): number {
  let sum = 0;
  ranked.forEach((slug, i) => {
    sum += gain(grades.get(slug) ?? 0) / Math.log2(i + 2);
  });
  return sum;
}

function relevantSlugs(grades: Grades): string[] {
  return [...grades.entries()].filter(([, g]) => g >= 1).map(([s]) => s);
}

// null = undefined for this query (no relevant judged doc exists), which the
// aggregator excludes rather than scoring as 0.
export function ndcgAtK(ranked: readonly string[], grades: Grades, k: number): number | null {
  if (relevantSlugs(grades).length === 0) return null;
  const ideal = [...grades.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([s]) => s);
  const idcg = dcg(ideal, grades);
  if (idcg === 0) return null;
  return dcg(ranked.slice(0, k), grades) / idcg;
}

export function recallAtK(ranked: readonly string[], grades: Grades, k: number): number | null {
  const relevant = relevantSlugs(grades);
  if (relevant.length === 0) return null;
  const top = new Set(ranked.slice(0, k));
  return relevant.filter((s) => top.has(s)).length / relevant.length;
}

export function mrr(ranked: readonly string[], grades: Grades, k: number): number | null {
  if (relevantSlugs(grades).length === 0) return null;
  const idx = ranked.slice(0, k).findIndex((s) => (grades.get(s) ?? 0) >= 1);
  return idx === -1 ? 0 : 1 / (idx + 1);
}

export function unjudgedAtK(ranked: readonly string[], grades: Grades, k: number): number {
  const top = ranked.slice(0, k);
  if (top.length === 0) return 0;
  return top.filter((s) => !grades.has(s)).length / top.length;
}
