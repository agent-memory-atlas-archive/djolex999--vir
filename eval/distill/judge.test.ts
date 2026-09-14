import { describe, expect, it } from "vitest";
import { buildNoteJudgePrompt, parseNoteJudge } from "./judge.js";

describe("note judge", () => {
  it("prompt carries the rubric and the body and asks for five integers", () => {
    const p = buildNoteJudgePrompt("RUBRIC TEXT", "## Summary\nbody");
    expect(p).toContain("RUBRIC TEXT");
    expect(p).toContain("## Summary\nbody");
    expect(p).toMatch(/D1.*D5/s);
  });
  it("parses a JSON object of D1..D5", () => {
    expect(parseNoteJudge('ok {"D1":2,"D2":1,"D3":0,"D4":2,"D5":1} done')).toEqual([2, 1, 0, 2, 1]);
  });
  it("rejects missing or out-of-range dimensions", () => {
    expect(() => parseNoteJudge('{"D1":2,"D2":1,"D3":0,"D4":2}')).toThrow(/D5/);
    expect(() => parseNoteJudge('{"D1":2,"D2":1,"D3":0,"D4":2,"D5":3}')).toThrow(/D5/);
    expect(() => parseNoteJudge("no json")).toThrow(/JSON/);
  });
});
