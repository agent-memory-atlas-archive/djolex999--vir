import { describe, expect, it } from "vitest";
import { makeRng } from "../rng.js";
import { pickPairSubset, judgeFileName, completePairs, directionAgreement } from "./calibrate.js";
import type { MappingEntry } from "./gradingSet.js";
import type { GradeRecord } from "./grades.js";

function mapping(n: number): MappingEntry[] {
  const out: MappingEntry[] = [];
  for (let i = 1; i <= n; i += 1) {
    out.push({ id: `c${i}`.padEnd(8, "0"), pairIdx: i, arm: "control" });
    out.push({ id: `x${i}`.padEnd(8, "0"), pairIdx: i, arm: "challenger" });
  }
  return out;
}
const g = (id: string, s: number): GradeRecord => ({ id, scores: [s, s, s, s, s] as GradeRecord["scores"], note: null, ts: "" });

describe("pickPairSubset", () => {
  it("returns both notes of k seeded pairs, in the presentation order given", () => {
    const m = mapping(15);
    const order = m.map((e) => e.id).reverse();
    const ids = pickPairSubset(m, order, 5, makeRng(1));
    expect(ids).toHaveLength(10);
    const pairs = new Set(ids.map((id) => m.find((e) => e.id === id)!.pairIdx));
    expect(pairs.size).toBe(5);
    expect(ids).toEqual(order.filter((id) => ids.includes(id)));
    expect(pickPairSubset(m, order, 5, makeRng(1))).toEqual(ids);
  });
});

describe("judgeFileName", () => {
  it("keeps the sonnet preview where it was and names other judges by model", () => {
    expect(judgeFileName("claude-sonnet-5")).toBe("judge.json");
    expect(judgeFileName("claude-fable-5-1")).toBe("judge-claude-fable-5-1.json");
  });
});

describe("completePairs", () => {
  it("keeps only mapping entries whose pair has both notes graded", () => {
    const m = mapping(3);
    const grades = [g("c1000000", 1), g("x1000000", 2), g("c2000000", 1)];
    expect(completePairs(m, grades).map((e) => e.pairIdx)).toEqual([1, 1]);
  });
});

describe("directionAgreement", () => {
  it("counts pairs where human and judge agree on which arm scored higher in total", () => {
    const m = mapping(3);
    const human = [g("c1000000", 1), g("x1000000", 2), g("c2000000", 2), g("x2000000", 1), g("c3000000", 1), g("x3000000", 1)];
    const judge = [g("c1000000", 0), g("x1000000", 2), g("c2000000", 0), g("x2000000", 2), g("c3000000", 1), g("x3000000", 1)];
    expect(directionAgreement(m, human, judge)).toEqual({ pairs: 3, agree: 2 });
  });
});
