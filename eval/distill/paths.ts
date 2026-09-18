import { join } from "node:path";
import { EVAL_DIR } from "../paths.js";

// All distill A/B data lives under ~/.vir/eval/distill (noLeak-style guard in
// paths.test.ts). The grades file sits at the path the task fixed.
export const DISTILL_DIR = join(EVAL_DIR, "distill");
export const DISTILL_SAMPLE_PATH = join(DISTILL_DIR, "sample.json");
export const DISTILL_HOMES_DIR = join(DISTILL_DIR, "homes");
export const DISTILL_RUNS_DIR = join(DISTILL_DIR, "runs");
export const DISTILL_GRADING_DIR = join(DISTILL_DIR, "grading");
export const DISTILL_MAPPING_PATH = join(DISTILL_GRADING_DIR, "mapping.json");
export const DISTILL_GRADES_PATH = join(EVAL_DIR, "distill-grades.json");
export const DISTILL_JUDGE_PATH = join(DISTILL_DIR, "judge.json");
export const DISTILL_CLASSIFICATIONS_PATH = join(DISTILL_DIR, "classifications.json");
export const DISTILL_QUICK_SET_PATH = join(DISTILL_DIR, "quick", "set.json");
export const DISTILL_QUICK_SIDES_PATH = join(DISTILL_DIR, "quick", "sides.json");
export const DISTILL_QUICK_ANSWERS_PATH = join(DISTILL_DIR, "quick", "answers.json");

// A second test (e.g. tag "v2") keeps its blind set, sealed sides, answers
// and model verdicts apart from the first. Empty tag = the original files.
function checkTag(tag: string): string {
  if (!/^[a-z0-9-]*$/.test(tag)) throw new Error(`invalid tag: ${tag}`);
  return tag;
}
export function quickPaths(tag: string): { set: string; sides: string; answers: string } {
  const dir = join(DISTILL_DIR, checkTag(tag) ? `quick-${tag}` : "quick");
  return { set: join(dir, "set.json"), sides: join(dir, "sides.json"), answers: join(dir, "answers.json") };
}
export function pairwisePath(model: string, scope: "top" | "full", tag: string): string {
  return join(DISTILL_DIR, `pairwise-${model}-${scope}${checkTag(tag) ? `-${tag}` : ""}.json`);
}
