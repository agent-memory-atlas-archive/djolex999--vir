import { describe, expect, it } from "vitest";
import { dcg, mrr, ndcgAtK, recallAtK, unjudgedAtK } from "./rank.js";

// grades: the judged pool for one query. Anything ranked but absent is 0.
const grades = new Map<string, 0 | 1 | 2>([
  ["a", 2],
  ["b", 1],
  ["c", 2],
  ["d", 0],
  ["e", 1],
]);

describe("dcg", () => {
  it("hand-computed: gains (2^g - 1) discounted by log2(rank+1)", () => {
    // ranked [b(1), a(2), x(unjudged→0), c(2)]
    // gains: 1, 3, 0, 3; discounts: log2(2)=1, log2(3), log2(4)=2, log2(5)
    const expected = 1 / 1 + 3 / Math.log2(3) + 0 + 3 / Math.log2(5);
    expect(dcg(["b", "a", "x", "c"], grades)).toBeCloseTo(expected, 10);
  });
});

describe("ndcgAtK", () => {
  it("ideal ordering scores 1", () => {
    expect(ndcgAtK(["a", "c", "b", "e", "d"], grades, 5)).toBeCloseTo(1, 10);
  });
  it("hand-computed against the ideal DCG at k=3", () => {
    // ideal top-3: a(2), c(2), b(1) → 3/1 + 3/log2(3) + 1/2
    const ideal = 3 + 3 / Math.log2(3) + 0.5;
    // ranked top-3: [d(0), b(1), a(2)] → 0 + 1/log2(3) + 3/2
    const got = 1 / Math.log2(3) + 1.5;
    expect(ndcgAtK(["d", "b", "a", "c"], grades, 3)).toBeCloseTo(got / ideal, 10);
  });
  it("returns null when the query has no relevant judged doc (undefined, not 0)", () => {
    expect(ndcgAtK(["d"], new Map([["d", 0]]), 8)).toBeNull();
  });
  it("only the first k ranks count", () => {
    expect(ndcgAtK(["d", "d2", "a"], grades, 2)).toBe(0);
  });
});

describe("recallAtK", () => {
  it("share of relevant (≥1) judged docs that appear in the top k", () => {
    // relevant: a, b, c, e (4). top-3 [b, x, c] finds 2.
    expect(recallAtK(["b", "x", "c", "a"], grades, 3)).toBeCloseTo(0.5, 10);
  });
  it("null when nothing is relevant", () => {
    expect(recallAtK(["d"], new Map([["d", 0]]), 8)).toBeNull();
  });
});

describe("mrr", () => {
  it("1/rank of the first relevant hit within k, else 0", () => {
    expect(mrr(["d", "x", "b"], grades, 8)).toBeCloseTo(1 / 3, 10);
    expect(mrr(["d", "x", "b"], grades, 2)).toBe(0);
    expect(mrr([], grades, 8)).toBe(0);
  });
  it("null when nothing is relevant", () => {
    expect(mrr(["d"], new Map([["d", 0]]), 8)).toBeNull();
  });
});

describe("unjudgedAtK", () => {
  it("share of the top-k hits that carry no label at all", () => {
    expect(unjudgedAtK(["a", "x", "y", "b"], grades, 4)).toBeCloseTo(0.5, 10);
    expect(unjudgedAtK([], grades, 4)).toBe(0);
  });
});
