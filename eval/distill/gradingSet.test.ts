import { describe, expect, it } from "vitest";
import { makeRng } from "../rng.js";
import { buildGradingSet, type ArmNote } from "./gradingSet.js";

function notes(n: number): ArmNote[] {
  const out: ArmNote[] = [];
  for (let i = 1; i <= n; i += 1) {
    out.push({ pairIdx: i, arm: "control", body: `c${i}` });
    out.push({ pairIdx: i, arm: "challenger", body: `x${i}` });
  }
  return out;
}

describe("buildGradingSet", () => {
  it("assigns unique opaque ids that carry no arm or pair information", () => {
    const set = buildGradingSet(notes(15), makeRng(7));
    expect(set.items).toHaveLength(30);
    const ids = set.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(30);
    for (const id of ids) expect(id).toMatch(/^[a-f0-9]{8}$/);
    for (const item of set.items) expect(Object.keys(item)).toEqual(["id", "body"]);
  });

  it("shuffles presentation order and records the full mapping", () => {
    const input = notes(15);
    const set = buildGradingSet(input, makeRng(7));
    const bodies = set.items.map((i) => i.body);
    expect(bodies).not.toEqual(input.map((n) => n.body));
    expect(set.mapping).toHaveLength(30);
    for (const m of set.mapping) {
      const item = set.items.find((i) => i.id === m.id)!;
      const src = input.find((n) => n.pairIdx === m.pairIdx && n.arm === m.arm)!;
      expect(item.body).toBe(src.body);
    }
  });

  it("is deterministic for a seed", () => {
    const a = buildGradingSet(notes(15), makeRng(3));
    const b = buildGradingSet(notes(15), makeRng(3));
    expect(a).toEqual(b);
    expect(buildGradingSet(notes(15), makeRng(4)).items.map((i) => i.id)).not.toEqual(a.items.map((i) => i.id));
  });
});
