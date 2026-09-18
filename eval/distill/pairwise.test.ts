import { describe, expect, it } from "vitest";
import { buildPairwisePrompt, parsePairwise, reconcileOrders } from "./pairwise.js";

describe("buildPairwisePrompt", () => {
  it("shows both texts under neutral labels and asks the human's two questions", () => {
    const p = buildPairwisePrompt("AAA", "BBB");
    expect(p).toContain("[1]");
    expect(p).toContain("AAA");
    expect(p).toContain("[2]");
    expect(p).toContain("BBB");
    expect(p).toMatch(/rather find a month from now/i);
    expect(p).toMatch(/diary of the session/i);
    expect(p).not.toMatch(/control|challenger|prompt/i);
  });
});

describe("parsePairwise", () => {
  it("parses prefer, diary and a reason", () => {
    expect(parsePairwise('{"prefer":"2","diary":"1","reason":"because"}')).toEqual({ prefer: "2", diary: "1", reason: "because" });
  });
  it("rejects anything outside 1, 2, =", () => {
    expect(() => parsePairwise('{"prefer":"3","diary":"1","reason":""}')).toThrow(/prefer/);
    expect(() => parsePairwise("nope")).toThrow(/JSON/);
  });
});

describe("reconcileOrders", () => {
  it("keeps a verdict only when both presentation orders pick the same arm", () => {
    expect(reconcileOrders({ oneIs: "control", choice: "1" }, { oneIs: "challenger", choice: "2" })).toBe("control");
    expect(reconcileOrders({ oneIs: "control", choice: "2" }, { oneIs: "challenger", choice: "1" })).toBe("challenger");
  });
  it("calls it position-driven when the judge just follows the slot", () => {
    expect(reconcileOrders({ oneIs: "control", choice: "1" }, { oneIs: "challenger", choice: "1" })).toBe("inconsistent");
  });
  it("treats a tie in either order as a tie unless the other order is also a tie-compatible pick", () => {
    expect(reconcileOrders({ oneIs: "control", choice: "=" }, { oneIs: "challenger", choice: "=" })).toBe("=");
    expect(reconcileOrders({ oneIs: "control", choice: "=" }, { oneIs: "challenger", choice: "2" })).toBe("=");
  });
});
