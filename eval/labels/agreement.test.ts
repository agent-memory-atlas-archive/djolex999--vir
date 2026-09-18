import { describe, expect, it } from "vitest";
import { agreement } from "./agreement.js";

describe("agreement", () => {
  // Hand-computed on five pairs (human, model):
  //   (2,2) (1,2) (0,0) (0,1) (2,0)
  // exact:     pairs 1,3            → 2/5 = 0.4
  // within 1:  all but (2,0)        → 4/5 = 0.8
  // binary (grade ≥ 1 = relevant): h=[1,1,0,0,1] m=[1,1,0,1,0] → agree on 1,2,3 → 0.6
  // kappa: po = 0.4; marginals human {0:2,1:1,2:2}/5, model {0:2,1:1,2:2}/5
  //        pe = .4*.4 + .2*.2 + .4*.4 = 0.36 → (0.4-0.36)/(1-0.36) = 0.0625
  const pairs = [
    { human: 2, model: 2 },
    { human: 1, model: 2 },
    { human: 0, model: 0 },
    { human: 0, model: 1 },
    { human: 2, model: 0 },
  ] as const;

  it("matches the hand computation", () => {
    const a = agreement([...pairs]);
    expect(a.n).toBe(5);
    expect(a.exact).toBeCloseTo(0.4, 10);
    expect(a.within1).toBeCloseTo(0.8, 10);
    expect(a.binary).toBeCloseTo(0.6, 10);
    expect(a.kappa).toBeCloseTo(0.0625, 10);
  });

  it("perfect agreement → 1 everywhere, kappa 1", () => {
    const a = agreement([
      { human: 0, model: 0 },
      { human: 2, model: 2 },
      { human: 1, model: 1 },
    ]);
    expect(a.exact).toBe(1);
    expect(a.kappa).toBe(1);
  });

  it("empty input → n 0 and NaN-free zeros", () => {
    const a = agreement([]);
    expect(a.n).toBe(0);
    expect(a.exact).toBe(0);
    expect(a.kappa).toBe(0);
  });
});
