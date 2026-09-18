import { describe, expect, it } from "vitest";
import { makeRng } from "../rng.js";
import { buildQuickSet, noteTop, parseChoice, quickSummary, type QuickAnswer } from "./quick.js";

const body = `## Summary
First sentence. Second sentence.

## What Was Learned
- **Lead bullet** with detail that goes on.
- Second bullet.

## Context
ctx`;

describe("noteTop", () => {
  it("keeps the summary and only the first bullet", () => {
    const t = noteTop(body, 200);
    expect(t).toContain("First sentence. Second sentence.");
    expect(t).toContain("Lead bullet");
    expect(t).not.toContain("Second bullet");
    expect(t).not.toContain("ctx");
  });
  it("caps the word count and marks the cut", () => {
    const t = noteTop(body, 5);
    expect(t.split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(t.endsWith("…")).toBe(true);
  });
});

describe("buildQuickSet", () => {
  const pairs = Array.from({ length: 15 }, (_, i) => ({ pairIdx: i + 1, control: `## Summary\nc${i + 1}`, challenger: `## Summary\nx${i + 1}` }));
  it("randomises which arm is shown as 1, seals the sides, and shuffles pair order", () => {
    const set = buildQuickSet(pairs, makeRng(5), 80);
    expect(set.items).toHaveLength(15);
    expect(set.sides).toHaveLength(15);
    for (const item of set.items) expect(Object.keys(item).sort()).toEqual(["one", "pairIdx", "two"]);
    const firsts = new Set(set.sides.map((s) => s.one));
    expect(firsts).toEqual(new Set(["control", "challenger"]));
    expect(set.items.map((i) => i.pairIdx)).not.toEqual(pairs.map((p) => p.pairIdx));
    for (const s of set.sides) {
      const item = set.items.find((i) => i.pairIdx === s.pairIdx)!;
      expect(item.one).toContain(s.one === "control" ? "c" : "x");
    }
    expect(buildQuickSet(pairs, makeRng(5), 80)).toEqual(set);
  });
});

describe("parseChoice", () => {
  it("accepts 1, 2 and = and nothing else", () => {
    expect(parseChoice("1")).toBe("1");
    expect(parseChoice(" 2 ")).toBe("2");
    expect(parseChoice("=")).toBe("=");
    expect(parseChoice("3")).toBeNull();
    expect(parseChoice("")).toBeNull();
  });
});

describe("quickSummary", () => {
  it("maps choices back to arms and runs an exact sign test per question", () => {
    const sides = [
      { pairIdx: 1, one: "control" as const },
      { pairIdx: 2, one: "challenger" as const },
      { pairIdx: 3, one: "control" as const },
    ];
    const answers: QuickAnswer[] = [
      { pairIdx: 1, prefer: "2", diary: "1" },
      { pairIdx: 2, prefer: "1", diary: "2" },
      { pairIdx: 3, prefer: "=", diary: "=" },
    ];
    const s = quickSummary(sides, answers);
    expect(s.prefer).toMatchObject({ challenger: 2, control: 0, ties: 1 });
    expect(s.diary).toMatchObject({ challenger: 0, control: 2, ties: 1 });
    expect(s.prefer.p).toBeCloseTo(0.5, 6);
    expect(s.n).toBe(3);
  });
});
