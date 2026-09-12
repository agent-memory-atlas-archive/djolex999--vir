import { describe, expect, it } from "vitest";
import { contaminationAtK, isAgentDerived } from "./contamination.js";

const projectsDir = "/home/u/.claude/projects";

describe("isAgentDerived (transcript-category classification)", () => {
  it("sdk entrypoint → agent-derived", () => {
    expect(
      isAgentDerived({ path: `${projectsDir}/-p/abc.jsonl`, entrypoint: "sdk-ts", isMergeWinner: false }, projectsDir),
    ).toBe(true);
  });
  it("cli entrypoint → human", () => {
    expect(
      isAgentDerived({ path: `${projectsDir}/-p/abc.jsonl`, entrypoint: "cli", isMergeWinner: false }, projectsDir),
    ).toBe(false);
  });
  it("sidechain path with null entrypoint → agent-derived", () => {
    expect(
      isAgentDerived(
        { path: `${projectsDir}/-p/sid/subagents/agent-1.jsonl`, entrypoint: null, isMergeWinner: false },
        projectsDir,
      ),
    ).toBe(true);
  });
  it("merge winner on a sidechain path still counts: the path is the evidence", () => {
    expect(
      isAgentDerived(
        { path: `${projectsDir}/-p/sid/subagents/agent-1.jsonl`, entrypoint: null, isMergeWinner: true },
        projectsDir,
      ),
    ).toBe(true);
  });
  it("plain path, null entrypoint → unclassifiable → not counted", () => {
    expect(
      isAgentDerived({ path: `${projectsDir}/-p/abc.jsonl`, entrypoint: null, isMergeWinner: false }, projectsDir),
    ).toBe(false);
  });
});

describe("contaminationAtK", () => {
  it("share of the top-k hits whose source row is agent-derived; unknown slugs count as clean", () => {
    const agent = new Set(["s2", "s4"]);
    expect(contaminationAtK(["s1", "s2", "s3", "s4", "s5"], (s) => agent.has(s), 4)).toBeCloseTo(0.5, 10);
    expect(contaminationAtK([], (s) => agent.has(s), 4)).toBe(0);
  });
});
