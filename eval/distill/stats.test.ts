import { describe, expect, it } from "vitest";
import { pairedT, signTest, tCdf } from "./stats.js";

describe("tCdf", () => {
  it("matches table values", () => {
    expect(tCdf(0, 4)).toBeCloseTo(0.5, 6);
    expect(tCdf(2.776, 4)).toBeCloseTo(0.975, 3);
    expect(tCdf(2.145, 14)).toBeCloseTo(0.975, 3);
  });
});

describe("pairedT", () => {
  it("computes t, df and a two-sided p for a known sample", () => {
    const r = pairedT([1, 2, 3, 4, 5]);
    expect(r.n).toBe(5);
    expect(r.mean).toBeCloseTo(3, 9);
    expect(r.sd).toBeCloseTo(1.5811, 3);
    expect(r.t).toBeCloseTo(4.2426, 3);
    expect(r.df).toBe(4);
    expect(r.p).toBeCloseTo(0.0132, 3);
  });
  it("returns p = 1 when every difference is zero", () => {
    const r = pairedT([0, 0, 0, 0]);
    expect(r.t).toBe(0);
    expect(r.p).toBe(1);
  });
});

describe("signTest", () => {
  it("exact two-sided binomial on non-zero differences", () => {
    const r = signTest([1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 0]);
    expect(r).toEqual({ pos: 8, neg: 2, ties: 1, p: expect.closeTo(0.1094, 3) });
  });
  it("p = 1 when there are no non-zero differences", () => {
    expect(signTest([0, 0]).p).toBe(1);
  });
});
