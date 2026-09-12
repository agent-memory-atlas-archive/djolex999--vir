import { describe, expect, it } from "vitest";
import { garbageRates } from "./garbage.js";

describe("garbageRates", () => {
  it("splits 'returned anything' into floor-pass (embedding) and lexical fallback", () => {
    const r = garbageRates([
      { method: "embedding", hits: 3 },
      { method: "embedding", hits: 0 },
      { method: "tfidf", hits: 2 },
      { method: "tfidf", hits: 0 },
    ]);
    expect(r.n).toBe(4);
    expect(r.anyHit).toBeCloseTo(0.5, 10);
    expect(r.viaEmbedding).toBeCloseTo(0.25, 10);
    expect(r.viaFallback).toBeCloseTo(0.25, 10);
  });
  it("empty → zeros", () => {
    expect(garbageRates([])).toEqual({ n: 0, anyHit: 0, viaEmbedding: 0, viaFallback: 0 });
  });
});
