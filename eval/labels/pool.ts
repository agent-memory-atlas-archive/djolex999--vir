// TREC-style pooling: the candidate set a judge sees for a query is the union
// of every arm's top-k. Labels are then no more biased toward one arm than
// toward another, and a note no arm surfaced is (correctly) never judged —
// it cannot affect any arm's score.

export interface ArmRun {
  armId: string;
  results: ReadonlyArray<{
    queryId: string;
    hits: ReadonlyArray<{ slug: string }>;
  }>;
}

export interface PoolCandidate {
  slug: string;
  seenIn: Array<{ arm: string; rank: number }>;
}

export interface PoolEntry {
  queryId: string;
  candidates: PoolCandidate[];
}

export function buildPool(runs: readonly ArmRun[], k: number): PoolEntry[] {
  const byQuery = new Map<string, Map<string, PoolCandidate>>();
  const order: string[] = [];
  for (const run of runs) {
    for (const r of run.results) {
      let cands = byQuery.get(r.queryId);
      if (!cands) {
        cands = new Map();
        byQuery.set(r.queryId, cands);
        order.push(r.queryId);
      }
      r.hits.slice(0, k).forEach((h, i) => {
        let c = cands!.get(h.slug);
        if (!c) {
          c = { slug: h.slug, seenIn: [] };
          cands!.set(h.slug, c);
        }
        c.seenIn.push({ arm: run.armId, rank: i + 1 });
      });
    }
  }
  return order.map((queryId) => ({
    queryId,
    candidates: [...byQuery.get(queryId)!.values()],
  }));
}
