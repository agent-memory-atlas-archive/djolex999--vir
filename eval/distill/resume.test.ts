import { describe, expect, it } from "vitest";
import { pendingEntries } from "./resume.js";

describe("pendingEntries", () => {
  const classified = [
    { idx: 1, skipped: null },
    { idx: 2, skipped: "low-confidence 0.5" },
    { idx: 3, skipped: null },
    { idx: 4, skipped: null },
  ];
  it("drops skipped entries and entries already present in a partial output", () => {
    const done = [{ idx: 1 }, { idx: 4 }];
    expect(pendingEntries(classified, done).map((c) => c.idx)).toEqual([3]);
  });
  it("returns every non-skipped entry when nothing is done yet", () => {
    expect(pendingEntries(classified, []).map((c) => c.idx)).toEqual([1, 3, 4]);
  });
});
