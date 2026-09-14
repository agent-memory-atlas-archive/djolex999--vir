import { afterEach, describe, expect, it } from "vitest";
import { Distiller, buildDistillPrompt } from "./distiller.js";
import type { Config } from "../config.js";
import type { Classification, ParsedSession } from "./types.js";

const session: ParsedSession = {
  path: "/x/abc.jsonl",
  hash: "h",
  sessionId: "abc",
  projectSlug: "proj",
  startedAt: "2026-01-02T03:04:05.000Z",
  endedAt: null,
  lineCount: 0,
  toolCallCount: 0,
  filesTouched: [],
  assistantText: "",
  userText: "",
  rawSummary: "",
  transcriptText: "",
  isSidechain: false,
  entrypoint: null,
};
const cls: Classification = {
  category: "gotcha",
  topic: "t",
  project: "vir",
  confidence: 0.9,
  themes: [],
};

describe("buildDistillPrompt", () => {
  it("renders the production distill prompt byte-for-byte", () => {
    const p = buildDistillPrompt(session, cls, "BODY");
    expect(p).toBe(`Extract durable knowledge from this Claude Code session.

Output a markdown page with these sections (no preamble, start with '## Summary'):
- ## Summary (2-3 sentences)
- ## What Was Learned
- ## Context (project: vir, category: gotcha, date: 2026-01-02T03:04:05.000Z)

Be concise. Only include information a future developer would reuse.
Omit implementation details that won't generalize.

Session:
BODY`);
  });

  it("falls back to 'unknown' when the session has no start time", () => {
    const p = buildDistillPrompt({ ...session, startedAt: null }, cls, "B");
    expect(p).toContain("date: unknown)");
  });
});

describe("Distiller distill prompt seam", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function kieConfig(): Config {
    return {
      vaultPath: "/tmp/v",
      outputDir: "vir",
      topicsDir: "topics",
      claudeProjectsDir: "/tmp/p",
      cadenceHours: 3,
      provider: "kie",
      kieApiKey: "k",
      kieTopUpTier: "standard",
      filterThreshold: 0.4,
      projects: {},
      notifications: false,
      workflowTranscripts: "exclude",
      agentTranscripts: "exclude",
      distillArticles: false,
      distillPdfs: false,
      filterToolCalls: "moderate",
      logQueries: false,
      retrievalDiversity: 0.3,
      models: { classify: "claude-haiku-4-5", distill: "claude-sonnet-4-6" },
    };
  }

  function captureKiePrompt(): { sent: string[] } {
    const sent: string[] = [];
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: string }>;
      };
      sent.push(body.messages[0]!.content);
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: "## Summary\nok" }] }),
        { status: 200 },
      );
    }) as typeof fetch;
    return { sent };
  }

  it("sends the production prompt when no builder is injected", async () => {
    const { sent } = captureKiePrompt();
    const d = new Distiller(kieConfig());
    await d.distill(session, "BODY", cls, "claude-sonnet-4-6");
    expect(sent).toEqual([buildDistillPrompt(session, cls, "BODY")]);
  });

  it("sends the injected builder's prompt instead", async () => {
    const { sent } = captureKiePrompt();
    const d = new Distiller(kieConfig(), {
      distillPrompt: (s, c, content) => `CHALLENGER ${c.project} ${s.sessionId} ${content}`,
    });
    await d.distill(session, "BODY", cls, "claude-sonnet-4-6");
    expect(sent).toEqual(["CHALLENGER vir abc BODY"]);
  });
});
