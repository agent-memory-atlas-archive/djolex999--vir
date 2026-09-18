import { tokenize } from "../../src/search/retriever.js";

// Tokens come from the retriever's own tokenizer so "near-duplicate" means
// the same thing to the harness as to TF-IDF (no second tokenizer to drift).
export function jaccard(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 && tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  const union = ta.size + tb.size - shared;
  return union === 0 ? 0 : shared / union;
}

// Greedy, order-preserving: a query joins the first earlier survivor it is
// near-duplicate to, otherwise it survives itself.
export function collapseNearDuplicates(
  texts: readonly string[],
  threshold: number,
): string[] {
  const survivors: string[] = [];
  for (const t of texts) {
    if (!survivors.some((s) => jaccard(s, t) >= threshold)) survivors.push(t);
  }
  return survivors;
}

export interface RealQuery {
  text: string;
  // Earliest log timestamp in the collapsed cluster.
  firstSeen: string;
  // How many later near-duplicates folded into this one.
  collapsed: number;
}

// Records at or after `cutoffIso` are excluded by TIMESTAMP — the harness
// session's own vir_query calls must not become their own eval queries, and a
// text match would be brittle against the very queries it is meant to drop.
export function selectRealQueries(
  records: ReadonlyArray<{ ts: string; query: string }>,
  cutoffIso: string,
  threshold: number,
): RealQuery[] {
  const cutoff = Date.parse(cutoffIso);
  const kept = records
    .filter((r) => Date.parse(r.ts) < cutoff)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const out: RealQuery[] = [];
  for (const r of kept) {
    const hit = out.find((q) => jaccard(q.text, r.query) >= threshold);
    if (hit) hit.collapsed += 1;
    else out.push({ text: r.query, firstSeen: r.ts, collapsed: 0 });
  }
  return out;
}
