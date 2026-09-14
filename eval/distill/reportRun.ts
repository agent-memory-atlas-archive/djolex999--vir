import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GradeRecord, GradeStore } from "./grades.js";
import type { MappingEntry } from "./gradingSet.js";
import { DISTILL_GRADES_PATH, DISTILL_JUDGE_PATH, DISTILL_MAPPING_PATH, DISTILL_SAMPLE_PATH } from "./paths.js";
import { buildReport } from "./report.js";

export function writeReport(): string {
  const mapping = (JSON.parse(readFileSync(DISTILL_MAPPING_PATH, "utf8")) as { runDir: string; mapping: MappingEntry[] });
  const grades = (JSON.parse(readFileSync(DISTILL_GRADES_PATH, "utf8")) as GradeStore).grades;
  const graded = new Set(grades.map((g) => g.id));
  const missing = mapping.mapping.filter((m) => !graded.has(m.id)).length;
  if (missing > 0) throw new Error(`${missing} notes still ungraded — finish npm run distill:grade first`);
  const judge = existsSync(DISTILL_JUDGE_PATH)
    ? (JSON.parse(readFileSync(DISTILL_JUDGE_PATH, "utf8")) as { grades: GradeRecord[] }).grades
    : null;
  const sample = JSON.parse(readFileSync(DISTILL_SAMPLE_PATH, "utf8")) as { sample: Array<{ idx: number; project: string; topic: string | null; path: string }> };
  const sampleLabels: Record<number, string> = {};
  for (const s of sample.sample) sampleLabels[s.idx] = `${s.project} ${s.path.split("/").pop()!.slice(0, 8)}${s.topic ? ` ${s.topic}` : ""}`;
  const md = buildReport({ mapping: mapping.mapping, grades, judge, sampleLabels });
  const out = join(mapping.runDir, "report.md");
  writeFileSync(out, md);
  return md;
}
