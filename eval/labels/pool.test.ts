import { describe, expect, it } from "vitest";
import { buildPool, type ArmRun } from "./pool.js";

const runs: ArmRun[] = [
  {
    armId: "tfidf",
    results: [
      { queryId: "q1", hits: [{ slug: "a" }, { slug: "b" }, { slug: "c" }] },
      { queryId: "q2", hits: [] },
    ],
  },
  {
    armId: "nomic",
    results: [
      { queryId: "q1", hits: [{ slug: "b" }, { slug: "d" }] },
      { queryId: "q2", hits: [{ slug: "e" }] },
    ],
  },
];

describe("buildPool", () => {
  it("unions top-k slugs per query and records which arm ranked each where", () => {
    const pool = buildPool(runs, 20);
    expect(pool).toEqual([
      {
        queryId: "q1",
        candidates: [
          { slug: "a", seenIn: [{ arm: "tfidf", rank: 1 }] },
          { slug: "b", seenIn: [{ arm: "tfidf", rank: 2 }, { arm: "nomic", rank: 1 }] },
          { slug: "c", seenIn: [{ arm: "tfidf", rank: 3 }] },
          { slug: "d", seenIn: [{ arm: "nomic", rank: 2 }] },
        ],
      },
      { queryId: "q2", candidates: [{ slug: "e", seenIn: [{ arm: "nomic", rank: 1 }] }] },
    ]);
  });

  it("truncates each arm's contribution to k", () => {
    const pool = buildPool(runs, 1);
    expect(pool[0]?.candidates.map((c) => c.slug)).toEqual(["a", "b"]);
  });
});
