import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DistillPromptBuilder } from "../../src/pipeline/distiller.js";
import { REPO_ROOT } from "../repo.js";

// The control template is the production prompt with its three slots spelled
// exactly as distiller.ts spells them; prompts.test.ts proves the rendered
// output is byte-identical to buildDistillPrompt, so a drift in either place
// fails the build rather than the experiment.
export const CONTROL_TEMPLATE = `Extract durable knowledge from this Claude Code session.

Output a markdown page with these sections (no preamble, start with '## Summary'):
- ## Summary (2-3 sentences)
- ## What Was Learned
- ## Context (project: \${cls.project}, category: \${cls.category}, date: \${session.startedAt ?? "unknown"})

Be concise. Only include information a future developer would reuse.
Omit implementation details that won't generalize.

Session:
\${scrubbedContent}`;

export const CHALLENGER_MD_PATH = join(REPO_ROOT, "eval", "distill", "CHALLENGER.md");

// The first fenced block in CHALLENGER.md is the prompt. Anything else in the
// file is documentation.
export function extractPromptTemplate(md: string): string {
  const m = /```\n([\s\S]*?)\n```/.exec(md);
  if (!m) throw new Error("no fenced prompt block found in challenger file");
  return m[1]!;
}

export function readChallengerTemplate(): string {
  return extractPromptTemplate(readFileSync(CHALLENGER_MD_PATH, "utf8"));
}

export function makeBuilder(template: string): DistillPromptBuilder {
  return (session, cls, scrubbedContent) =>
    template
      .split("${cls.project}").join(cls.project)
      .split("${cls.category}").join(cls.category)
      .split('${session.startedAt ?? "unknown"}').join(session.startedAt ?? "unknown")
      .split("${scrubbedContent}").join(scrubbedContent);
}

export function promptHash(template: string): string {
  return createHash("sha256").update(template, "utf8").digest("hex").slice(0, 12);
}
