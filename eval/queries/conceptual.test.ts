import { describe, expect, it } from "vitest";
import {
  buildConceptualPrompt,
  parseQueryCandidates,
  rareTitleTokens,
  sharesRareTitleToken,
} from "./conceptual.js";

// df over a 100-doc corpus: "ollama" appears in 3 docs (rare), "probe" in 2
// (rare), "null" in 40 (common), "breaks" in 30, "inference" in 20.
const df = (t: string): number =>
  ({ ollama: 3, probe: 2, null: 40, breaks: 30, inference: 20, f4c7d393: 1 })[t] ?? 0;
const N = 100;
const title = "gotchas/ollama-probe-null-breaks-inference-f4c7d393";

describe("rareTitleTokens", () => {
  it("flags title tokens with df/N at or below the ratio, session-id included", () => {
    expect(rareTitleTokens(title, df, N, 0.05)).toEqual(["ollama", "probe", "f4c7d393"]);
  });
});

describe("sharesRareTitleToken", () => {
  it("true when the query reuses a rare title token", () => {
    expect(sharesRareTitleToken("why does the ollama check fail", title, df, N, 0.05)).toBe(true);
  });
  it("false when only common title tokens overlap", () => {
    expect(
      sharesRareTitleToken("model returns null but inference still breaks", title, df, N, 0.05),
    ).toBe(false);
  });
});

describe("buildConceptualPrompt", () => {
  it("names the forbidden tokens, the exemplars and asks for a JSON array", () => {
    const p = buildConceptualPrompt({
      title,
      body: "## Summary\nA null model name from the probe was treated as unreachable.",
      exemplars: ["kie 200 error handling retry", "launchd daemon plist migration"],
      forbidden: ["ollama", "probe"],
      count: 3,
    });
    expect(p).toContain("ollama");
    expect(p).toContain("kie 200 error handling retry");
    expect(p).toMatch(/JSON array/);
    expect(p).toContain("3");
  });
});

describe("parseQueryCandidates", () => {
  it("accepts a bare JSON array of strings", () => {
    expect(parseQueryCandidates('["a b", "c d"]')).toEqual(["a b", "c d"]);
  });
  it("tolerates a fenced block around the array", () => {
    expect(parseQueryCandidates('Sure:\n```json\n["x y"]\n```')).toEqual(["x y"]);
  });
  it("throws on anything that is not an array of non-empty strings", () => {
    expect(() => parseQueryCandidates('{"a":1}')).toThrow(/array/);
    expect(() => parseQueryCandidates('["", 3]')).toThrow(/array/);
  });
});
