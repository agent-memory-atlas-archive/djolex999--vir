import { describe, expect, it } from "vitest";
import { buildCalibratedReport } from "./calibratedReport.js";
import type { MappingEntry } from "./gradingSet.js";
import type { GradeRecord } from "./grades.js";

const mapping: MappingEntry[] = [];
for (let i = 1; i <= 3; i += 1) {
  mapping.push({ id: `c${i}000000`, pairIdx: i, arm: "control" });
  mapping.push({ id: `x${i}000000`, pairIdx: i, arm: "challenger" });
}
const g = (id: string, s: number): GradeRecord => ({ id, scores: [s, s, s, s, s] as GradeRecord["scores"], note: null, ts: "" });
const judgeAll = mapping.map((m) => g(m.id, m.arm === "challenger" ? 2 : 1));
const humanSubset = [g("c1000000", 1), g("x1000000", 2)];

describe("buildCalibratedReport", () => {
  const md = buildCalibratedReport({
    mapping,
    human: humanSubset,
    judges: [{ model: "claude-fable-5-1", grades: judgeAll }],
    sampleLabels: { 1: "one", 2: "two", 3: "three" },
  });
  it("labels the headline result as model-judged and human-calibrated, never as verification", () => {
    expect(md).toMatch(/model-judged, human-calibrated/i);
    expect(md).toMatch(/not .*verification|preview/i);
  });
  it("reports the judge over every pair and the human over graded pairs only", () => {
    expect(md).toContain("claude-fable-5-1");
    expect(md).toContain("n = 3");
    expect(md).toMatch(/human.*n = 1/is);
  });
  it("reports note-level and direction agreement between human and judge", () => {
    expect(md).toMatch(/exact/i);
    expect(md).toMatch(/1 of 1 pairs/);
  });
  it("throws when a judge has not scored every note", () => {
    expect(() => buildCalibratedReport({ mapping, human: humanSubset, judges: [{ model: "m", grades: judgeAll.slice(1) }], sampleLabels: {} })).toThrow(/m .*ungraded|ungraded/);
  });
});
