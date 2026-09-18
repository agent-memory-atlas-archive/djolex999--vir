import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { callJudge, mapLimit } from "../llm.js";
import { stripFrontmatterAndHeader } from "./gradingSetIo.js";
import { pairwisePath } from "./paths.js";
import { buildPairwisePrompt, parsePairwise, reconcileOrders, type PairwiseAnswer, type Verdict } from "./pairwise.js";
import { noteTop } from "./quick.js";
import type { ArmOutput } from "./worker.js";

export interface PairwiseRecord {
  pairIdx: number;
  scope: "top" | "full";
  controlFirst: PairwiseAnswer;
  challengerFirst: PairwiseAnswer;
  prefer: Verdict;
  diary: Verdict;
}

export async function runPairwise(runDir: string, model: string, scope: "top" | "full", tag = ""): Promise<void> {
  const out = pairwisePath(model, scope, tag);
  const have: PairwiseRecord[] = existsSync(out) ? (JSON.parse(readFileSync(out, "utf8")) as { records: PairwiseRecord[] }).records : [];
  const control = JSON.parse(readFileSync(join(runDir, "control.json"), "utf8")) as ArmOutput;
  const challenger = JSON.parse(readFileSync(join(runDir, "challenger.json"), "utf8")) as ArmOutput;
  const text = (body: string): string => (scope === "top" ? noteTop(stripFrontmatterAndHeader(body), 80) : stripFrontmatterAndHeader(body));
  const todo = control.results.filter((c) => !have.some((h) => h.pairIdx === c.idx));
  process.stdout.write(`pairwise ${model} ${scope}: ${todo.length} pairs × 2 orders (${have.length} cached)\n`);
  const records = [...have];
  await mapLimit(todo, 2, async (c) => {
    const x = challenger.results.find((r) => r.idx === c.idx);
    if (!x) throw new Error(`pair ${c.idx} missing challenger`);
    const cT = text(c.body);
    const xT = text(x.body);
    const a = parsePairwise((await callJudge("eval-distill-judge", buildPairwisePrompt(cT, xT), `pw-${c.idx}-cf`, model)).text);
    const b = parsePairwise((await callJudge("eval-distill-judge", buildPairwisePrompt(xT, cT), `pw-${c.idx}-xf`, model)).text);
    records.push({
      pairIdx: c.idx,
      scope,
      controlFirst: a,
      challengerFirst: b,
      prefer: reconcileOrders({ oneIs: "control", choice: a.prefer }, { oneIs: "challenger", choice: b.prefer }),
      diary: reconcileOrders({ oneIs: "control", choice: a.diary }, { oneIs: "challenger", choice: b.diary }),
    });
    writeFileSync(out, JSON.stringify({ version: 1, model, scope, records }, null, 2));
    process.stdout.write(`  pair ${c.idx} done\n`);
  });
}
