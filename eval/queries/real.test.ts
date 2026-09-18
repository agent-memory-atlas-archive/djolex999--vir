import { describe, expect, it } from "vitest";
import { collapseNearDuplicates, jaccard, selectRealQueries } from "./real.js";

describe("jaccard over retriever tokens", () => {
  it("hand-computed: 7 shared of 9 distinct tokens", () => {
    // a: {vir, review, reject, rejected, notes, excluded, from, retrieval}
    //    → tokenize drops <3-char tokens, keeps all 8 here
    // b: a ∪ {and, read, path} → "and" is 3 chars (kept), so b has 11
    // shared = 8, union = 11 → 8/11
    const a = "vir review reject rejected notes excluded from retrieval";
    const b = a + " and read path";
    expect(jaccard(a, b)).toBeCloseTo(8 / 11, 6);
  });

  it("identical → 1, disjoint → 0, empty → 0", () => {
    expect(jaccard("kie 200 error", "kie 200 error")).toBe(1);
    expect(jaccard("launchd plist", "geofencing memory")).toBe(0);
    expect(jaccard("", "")).toBe(0);
  });
});

describe("collapseNearDuplicates", () => {
  it("keeps the first of each near-duplicate cluster, order preserved", () => {
    const qs = [
      "vir review reject rejected notes excluded from retrieval",
      "launchd daemon plist migration",
      "vir review reject rejected notes excluded from retrieval and read path",
      "kie 200 error handling retry",
    ];
    expect(collapseNearDuplicates(qs, 0.6)).toEqual([
      qs[0],
      qs[1],
      qs[3],
    ]);
  });

  it("threshold 1.0 collapses only exact token matches", () => {
    const qs = ["alpha beta gamma", "gamma beta alpha", "alpha beta delta"];
    expect(collapseNearDuplicates(qs, 1.0)).toEqual([qs[0], qs[2]]);
  });
});

describe("selectRealQueries", () => {
  const records = [
    { ts: "2026-08-13T00:50:08.638Z", query: "kie 200 error handling retry" },
    { ts: "2026-09-11T04:16:33.162Z", query: "vir review reject rejected notes" },
    { ts: "2026-09-11T04:17:45.890Z", query: "vir review reject rejected notes and read path" },
    { ts: "2026-09-11T20:33:03.039Z", query: "07-31 three-arm embedding experiment" },
  ];

  it("drops records at or after the cutoff (timestamp, not text)", () => {
    const out = selectRealQueries(records, "2026-09-11T20:00:00Z", 0.6);
    expect(out.map((q) => q.text)).toEqual([
      "kie 200 error handling retry",
      "vir review reject rejected notes",
    ]);
  });

  it("keeps the first timestamp of a collapsed cluster as provenance", () => {
    const out = selectRealQueries(records, "2026-09-11T20:00:00Z", 0.6);
    expect(out[1]?.firstSeen).toBe("2026-09-11T04:16:33.162Z");
    expect(out[1]?.collapsed).toBe(1);
  });
});
