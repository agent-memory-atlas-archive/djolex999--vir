import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createHash } from "node:crypto";
import { REPO_ROOT } from "../repo.js";
import { parseScores, upsertGrade, type GradeStore } from "./grades.js";
import { DISTILL_GRADES_PATH, DISTILL_GRADING_DIR } from "./paths.js";

const RUBRIC_PATH = join(REPO_ROOT, "eval", "distill", "RUBRIC.md");

function readStore(rubricSha256: string): GradeStore {
  if (!existsSync(DISTILL_GRADES_PATH)) return { version: 1, rubricSha256, grades: [] };
  const s = JSON.parse(readFileSync(DISTILL_GRADES_PATH, "utf8")) as GradeStore;
  if (s.rubricSha256 !== rubricSha256) throw new Error(`grades file was written under rubric ${s.rubricSha256}, current is ${rubricSha256}`);
  return s;
}

// One note at a time, opaque id only, five scores, optional free text. No
// arm, no totals, no pair. Resumable: graded ids are skipped.
export async function runGrader(): Promise<void> {
  const rubric = readFileSync(RUBRIC_PATH, "utf8");
  const rubricSha256 = createHash("sha256").update(rubric, "utf8").digest("hex");
  const setPath = join(DISTILL_GRADING_DIR, "set.json");
  if (!existsSync(setPath)) throw new Error("no grading set — run the grading-set step first");
  const set = JSON.parse(readFileSync(setPath, "utf8")) as { order: string[] };
  let store = readStore(rubricSha256);
  const done = new Set(store.grades.map((g) => g.id));
  const todo = set.order.filter((id) => !done.has(id));
  const log = (l: string) => stdout.write(`${l}\n`);
  log(rubric.trim());
  log("");
  log(`${set.order.length} notes, ${done.size} graded, ${todo.length} to go. Enter five scores as "2 1 0 2 1" (D1 D2 D3 D4 D5). "q" stops; progress is saved after every note.`);
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    for (const id of todo) {
      const body = readFileSync(join(DISTILL_GRADING_DIR, `${id}.md`), "utf8");
      log("");
      log(`================ note ${done.size + 1} of ${set.order.length} ================`);
      log("");
      log(body.trim());
      log("");
      let scores = null;
      while (scores === null) {
        const line = await rl.question("D1 D2 D3 D4 D5 > ");
        if (line.trim() === "q") return;
        scores = parseScores(line);
        if (scores === null) log("  five integers 0-2, e.g. 2 1 0 2 1");
      }
      const note = (await rl.question("comment (enter to skip) > ")).trim();
      store = upsertGrade(store, { id, scores, note: note.length > 0 ? note : null, ts: new Date().toISOString() });
      writeFileSync(DISTILL_GRADES_PATH, JSON.stringify(store, null, 2));
      done.add(id);
    }
    log("");
    log(`all ${set.order.length} notes graded → ${DISTILL_GRADES_PATH}`);
  } finally {
    rl.close();
  }
}
