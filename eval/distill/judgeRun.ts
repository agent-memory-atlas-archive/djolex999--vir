import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { REPO_ROOT } from "../repo.js";
import { callJudge, mapLimit } from "../llm.js";
import type { GradeRecord } from "./grades.js";
import { buildNoteJudgePrompt, parseNoteJudge } from "./judge.js";
import { DISTILL_GRADING_DIR, DISTILL_JUDGE_PATH } from "./paths.js";

const RUBRIC_PATH = join(REPO_ROOT, "eval", "distill", "RUBRIC.md");

// Computed, written, never printed. The report reads it only after the human
// grades are complete.
export async function runJudge(): Promise<void> {
  const rubric = readFileSync(RUBRIC_PATH, "utf8");
  const rubricSha256 = createHash("sha256").update(rubric, "utf8").digest("hex");
  const set = JSON.parse(readFileSync(join(DISTILL_GRADING_DIR, "set.json"), "utf8")) as { order: string[] };
  const existing: GradeRecord[] = existsSync(DISTILL_JUDGE_PATH)
    ? (JSON.parse(readFileSync(DISTILL_JUDGE_PATH, "utf8")) as { grades: GradeRecord[] }).grades
    : [];
  const have = new Set(existing.map((g) => g.id));
  const todo = set.order.filter((id) => !have.has(id));
  process.stdout.write(`judge preview: ${todo.length} notes to score (${have.size} cached)\n`);
  const fresh = await mapLimit(todo, 3, async (id) => {
    const body = readFileSync(join(DISTILL_GRADING_DIR, `${id}.md`), "utf8");
    const res = await callJudge("eval-distill-judge", buildNoteJudgePrompt(rubric, body), id);
    const scores = parseNoteJudge(res.text);
    process.stdout.write(`  scored ${id}\n`);
    return { id, scores, note: null, ts: new Date().toISOString() } satisfies GradeRecord;
  });
  writeFileSync(DISTILL_JUDGE_PATH, JSON.stringify({ version: 1, rubricSha256, model: "claude-sonnet-5", grades: [...existing, ...fresh] }, null, 2));
  process.stdout.write(`judge grades sealed → ${DISTILL_JUDGE_PATH} (not displayed)\n`);
}
