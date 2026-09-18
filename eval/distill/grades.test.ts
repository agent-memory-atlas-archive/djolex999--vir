import { describe, expect, it } from "vitest";
import { parseScores, upsertGrade, type GradeStore } from "./grades.js";

describe("parseScores", () => {
  it("accepts five space-separated integers in 0..2", () => {
    expect(parseScores("2 1 0 2 1")).toEqual([2, 1, 0, 2, 1]);
  });
  it("accepts five bare digits", () => {
    expect(parseScores("21021")).toEqual([2, 1, 0, 2, 1]);
  });
  it("rejects wrong count and out-of-range values", () => {
    expect(parseScores("2 1 0 2")).toBeNull();
    expect(parseScores("2 1 0 2 3")).toBeNull();
    expect(parseScores("abc")).toBeNull();
    expect(parseScores("")).toBeNull();
  });
});

describe("upsertGrade", () => {
  it("replaces a grade for the same id and keeps others", () => {
    const store: GradeStore = { version: 1, rubricSha256: "r", grades: [
      { id: "a", scores: [0, 0, 0, 0, 0], note: null, ts: "t1" },
    ] };
    const next = upsertGrade(store, { id: "a", scores: [2, 2, 2, 2, 2], note: "x", ts: "t2" });
    expect(next.grades).toEqual([{ id: "a", scores: [2, 2, 2, 2, 2], note: "x", ts: "t2" }]);
    const more = upsertGrade(next, { id: "b", scores: [1, 1, 1, 1, 1], note: null, ts: "t3" });
    expect(more.grades.map((g) => g.id)).toEqual(["a", "b"]);
    expect(store.grades[0]!.scores).toEqual([0, 0, 0, 0, 0]);
  });
});
