import { describe, expect, it } from "vitest";
import { assertInsideHomes, lastOutputTokens } from "./worker.js";

describe("lastOutputTokens", () => {
  const log = [
    JSON.stringify({ session: "abc", stage: "distill", output_tokens: 900 }),
    JSON.stringify({ session: "abc", stage: "classify", output_tokens: 100 }),
    JSON.stringify({ session: "xyz", stage: "distill", output_tokens: 1500 }),
    "not json",
    JSON.stringify({ session: "abc", stage: "distill", output_tokens: 1500 }),
  ].join("\n");
  it("returns the latest distill-stage record for the session", () => {
    expect(lastOutputTokens(log, "abc")).toBe(1500);
    expect(lastOutputTokens(log, "xyz")).toBe(1500);
  });
  it("returns null when the session has no distill record", () => {
    expect(lastOutputTokens(log, "nope")).toBeNull();
  });
});

describe("assertInsideHomes", () => {
  it("accepts a home under the distill homes dir and rejects anything else", () => {
    expect(() => assertInsideHomes("/h/.vir/eval/distill/homes/control", "/h/.vir/eval/distill/homes")).not.toThrow();
    expect(() => assertInsideHomes("/h", "/h/.vir/eval/distill/homes")).toThrow(/refusing/);
    expect(() => assertInsideHomes("/h/.vir/eval/distill/homes-evil", "/h/.vir/eval/distill/homes")).toThrow(/refusing/);
  });
});
