import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { makeRng } from "../rng.js";
import { buildGradingSet, type ArmNote } from "./gradingSet.js";
import { DISTILL_GRADING_DIR, DISTILL_MAPPING_PATH } from "./paths.js";
import type { ArmOutput } from "./worker.js";

// Body only: frontmatter carries the session id, which would pair the arms.
export function stripFrontmatterAndHeader(md: string): string {
  return md
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/^Project: \[\[[^\]]*\]\]\nCategory: \[\[[^\]]*\]\]\n\n/, "")
    .trim();
}

export function buildAndWriteGradingSet(runDir: string, seed: number, refresh: boolean): void {
  if (existsSync(DISTILL_GRADING_DIR) && !refresh) {
    const n = readdirSync(DISTILL_GRADING_DIR).filter((f) => f.endsWith(".md")).length;
    throw new Error(`${DISTILL_GRADING_DIR} already holds ${n} notes; pass --refresh to rebuild (grades keyed on old ids will not match)`);
  }
  const notes: ArmNote[] = [];
  for (const arm of ["control", "challenger"] as const) {
    const out = JSON.parse(readFileSync(join(runDir, `${arm}.json`), "utf8")) as ArmOutput;
    for (const r of out.results) notes.push({ pairIdx: r.idx, arm, body: stripFrontmatterAndHeader(r.body) });
  }
  const pairs = new Set(notes.map((n) => n.pairIdx));
  for (const p of pairs) {
    if (notes.filter((n) => n.pairIdx === p).length !== 2) throw new Error(`pair ${p} is missing an arm`);
  }
  const set = buildGradingSet(notes, makeRng(seed));
  mkdirSync(DISTILL_GRADING_DIR, { recursive: true });
  for (const item of set.items) writeFileSync(join(DISTILL_GRADING_DIR, `${item.id}.md`), item.body + "\n");
  writeFileSync(join(DISTILL_GRADING_DIR, "set.json"), JSON.stringify({ version: 1, seed, runDir, order: set.items.map((i) => i.id) }, null, 2));
  writeFileSync(DISTILL_MAPPING_PATH, JSON.stringify({ version: 1, seed, runDir, mapping: set.mapping }, null, 2));
  chmodSync(DISTILL_MAPPING_PATH, 0o600);
  process.stdout.write(`${set.items.length} notes → ${DISTILL_GRADING_DIR} (mapping sealed in mapping.json — do not open until grading is done)\n`);
}
