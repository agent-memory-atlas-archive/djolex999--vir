import { describe, expect, it } from "vitest";
import { unblind, agreement, buildReport, type Mapping, type GradeRecord } from "./report.js";

const mapping: Mapping = [
  { id: "aaaaaaaa", pairIdx: 1, arm: "control" },
  { id: "bbbbbbbb", pairIdx: 1, arm: "challenger" },
  { id: "cccccccc", pairIdx: 2, arm: "control" },
  { id: "dddddddd", pairIdx: 2, arm: "challenger" },
];
const grades: GradeRecord[] = [
  { id: "aaaaaaaa", scores: [1, 1, 1, 1, 1], note: null, ts: "" },
  { id: "bbbbbbbb", scores: [2, 2, 2, 2, 2], note: null, ts: "" },
  { id: "cccccccc", scores: [0, 1, 2, 1, 0], note: null, ts: "" },
  { id: "dddddddd", scores: [1, 1, 1, 1, 1], note: null, ts: "" },
];

describe("unblind", () => {
  it("pairs grades by pairIdx with challenger minus control per dimension", () => {
    const u = unblind(mapping, grades);
    expect(u.pairs).toHaveLength(2);
    expect(u.pairs[0]).toEqual({ pairIdx: 1, control: [1, 1, 1, 1, 1], challenger: [2, 2, 2, 2, 2], diff: [1, 1, 1, 1, 1] });
    expect(u.pairs[1]!.diff).toEqual([1, 0, -1, 0, 1]);
    expect(u.means.control).toEqual([0.5, 1, 1.5, 1, 0.5]);
    expect(u.means.challenger).toEqual([1.5, 1.5, 1.5, 1.5, 1.5]);
    expect(u.overallDiff).toBeCloseTo((5 + 1) / 2 / 5, 9);
  });
  it("throws listing the ids that are still ungraded", () => {
    expect(() => unblind(mapping, grades.slice(0, 3))).toThrow(/dddddddd/);
  });
});

describe("agreement", () => {
  it("reports exact and within-one agreement per dimension and overall", () => {
    const model: GradeRecord[] = grades.map((g) => ({ ...g, scores: [g.scores[0], 2, g.scores[2], 0, g.scores[4]] as GradeRecord["scores"] }));
    const a = agreement(grades, model);
    expect(a.n).toBe(4);
    expect(a.exact[0]).toBe(1);
    expect(a.exact[1]).toBeCloseTo(0.25, 9);
    expect(a.within1[3]).toBeCloseTo(0.75, 9);
  });
});

describe("buildReport", () => {
  it("names the arms only after unblinding and states n", () => {
    const md = buildReport({ mapping, grades, judge: null, sampleLabels: { 1: "one", 2: "two" } });
    expect(md).toContain("n = 2");
    expect(md).toContain("challenger");
    expect(md).toContain("control");
    expect(md).toMatch(/not detectable|no detectable/i);
  });
});
