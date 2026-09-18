import { describe, expect, it } from "vitest";
import { makeRng, sample, shuffle } from "./rng.js";

describe("seeded rng", () => {
  it("same seed → same sequence; different seed → different sequence", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const c = makeRng(43);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    const seqC = [c(), c(), c(), c()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("shuffle is a deterministic permutation that leaves the input untouched", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out1 = shuffle(input, makeRng(7));
    const out2 = shuffle(input, makeRng(7));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out1).toEqual(out2);
    expect([...out1].sort((x, y) => x - y)).toEqual(input);
    expect(out1).not.toEqual(input);
  });

  it("sample takes n distinct items, or all when n exceeds length", () => {
    const input = ["a", "b", "c", "d", "e"];
    const three = sample(input, 3, makeRng(1));
    expect(three).toHaveLength(3);
    expect(new Set(three).size).toBe(3);
    expect(sample(input, 10, makeRng(1))).toHaveLength(5);
  });
});
