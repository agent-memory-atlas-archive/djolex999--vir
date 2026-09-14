import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDistillPrompt } from "../../src/pipeline/distiller.js";
import type { Classification, ParsedSession } from "../../src/pipeline/types.js";
import { REPO_ROOT } from "../repo.js";
import { extractPromptTemplate, makeBuilder, promptHash, CONTROL_TEMPLATE } from "./prompts.js";

const session = {
  path: "/x/abc.jsonl", hash: "h", sessionId: "abc", projectSlug: "p",
  startedAt: "2026-01-02T03:04:05.000Z", endedAt: null, lineCount: 0, toolCallCount: 0,
  filesTouched: [], assistantText: "", userText: "", rawSummary: "", transcriptText: "",
  isSidechain: false, entrypoint: null,
} satisfies ParsedSession;
const cls: Classification = { category: "gotcha", topic: "t", project: "vir", confidence: 0.9, themes: [] };

describe("prompt templates", () => {
  it("the control template rendered through makeBuilder equals production buildDistillPrompt", () => {
    expect(makeBuilder(CONTROL_TEMPLATE)(session, cls, "BODY")).toBe(buildDistillPrompt(session, cls, "BODY"));
    const noDate = { ...session, startedAt: null };
    expect(makeBuilder(CONTROL_TEMPLATE)(noDate, cls, "B")).toBe(buildDistillPrompt(noDate, cls, "B"));
  });

  it("extracts the fenced prompt from CHALLENGER.md and substitutes every slot", () => {
    const md = readFileSync(join(REPO_ROOT, "eval", "distill", "CHALLENGER.md"), "utf8");
    const tpl = extractPromptTemplate(md);
    expect(tpl.startsWith("Extract durable knowledge")).toBe(true);
    expect(tpl).toContain("Hard limit");
    const out = makeBuilder(tpl)(session, cls, "BODY");
    expect(out).not.toContain("${");
    expect(out).toContain("project: vir, category: gotcha, date: 2026-01-02T03:04:05.000Z");
    expect(out.endsWith("Session:\nBODY")).toBe(true);
  });

  it("extractPromptTemplate refuses a file with no fenced block", () => {
    expect(() => extractPromptTemplate("# nothing here")).toThrow(/fenced/);
  });

  it("promptHash is stable and differs between the arms", () => {
    const md = readFileSync(join(REPO_ROOT, "eval", "distill", "CHALLENGER.md"), "utf8");
    expect(promptHash(CONTROL_TEMPLATE)).toBe(promptHash(CONTROL_TEMPLATE));
    expect(promptHash(CONTROL_TEMPLATE)).not.toBe(promptHash(extractPromptTemplate(md)));
  });
});
