import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { REPO_ROOT } from "../repo.js";
import { extractPromptTemplate, makeBuilder } from "./prompts.js";
import { pairwisePath, quickPaths } from "./paths.js";

describe("tagged test paths", () => {
  const root = join(homedir(), ".vir", "eval", "distill");
  it("keeps the first test's files where they were when no tag is given", () => {
    expect(quickPaths("").set).toBe(join(root, "quick", "set.json"));
    expect(pairwisePath("claude-fable-5-1", "top", "")).toBe(join(root, "pairwise-claude-fable-5-1-top.json"));
  });
  it("separates a tagged test completely", () => {
    const q = quickPaths("v2");
    expect(q.set).toBe(join(root, "quick-v2", "set.json"));
    expect(q.sides).toBe(join(root, "quick-v2", "sides.json"));
    expect(q.answers).toBe(join(root, "quick-v2", "answers.json"));
    expect(pairwisePath("claude-fable-5-1", "full", "v2")).toBe(join(root, "pairwise-claude-fable-5-1-full-v2.json"));
  });
  it("rejects a tag that could escape the directory", () => {
    expect(() => quickPaths("../x")).toThrow(/tag/);
  });
});

describe("COMBINED.md", () => {
  it("extracts to a prompt with every slot substituted and the orient-then-claim summary", () => {
    const tpl = extractPromptTemplate(readFileSync(join(REPO_ROOT, "eval", "distill", "COMBINED.md"), "utf8"));
    expect(tpl).toMatch(/first sentence/i);
    expect(tpl).toMatch(/second sentence/i);
    const out = makeBuilder(tpl)(
      { path: "", hash: "", sessionId: "s", projectSlug: "p", startedAt: null, endedAt: null, lineCount: 0, toolCallCount: 0, filesTouched: [], assistantText: "", userText: "", rawSummary: "", transcriptText: "", isSidechain: false, entrypoint: null, branches: [] },
      { category: "tool", topic: "t", project: "vir", confidence: 1, themes: [] },
      "BODY",
    );
    expect(out).not.toContain("${");
    expect(out).toContain("date: unknown)");
    expect(out.endsWith("Session:\nBODY")).toBe(true);
  });
});
