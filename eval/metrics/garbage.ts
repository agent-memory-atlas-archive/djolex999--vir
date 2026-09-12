// "Returned anything" for a query the vault cannot answer, split by how: a
// hit that passed the embedding floor is a threshold failure; a hit served by
// the TF-IDF fallback (retriever.ts: embedding found nothing above the floor,
// so lexical overlap was tried) is a different failure with a different fix.
export interface GarbageRates {
  n: number;
  anyHit: number;
  viaEmbedding: number;
  viaFallback: number;
}

export function garbageRates(
  results: ReadonlyArray<{ method: "embedding" | "tfidf"; hits: number }>,
): GarbageRates {
  const n = results.length;
  if (n === 0) return { n: 0, anyHit: 0, viaEmbedding: 0, viaFallback: 0 };
  const withHits = results.filter((r) => r.hits > 0);
  return {
    n,
    anyHit: withHits.length / n,
    viaEmbedding: withHits.filter((r) => r.method === "embedding").length / n,
    viaFallback: withHits.filter((r) => r.method === "tfidf").length / n,
  };
}
