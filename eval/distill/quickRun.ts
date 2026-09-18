import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { makeRng } from "../rng.js";
import { stripFrontmatterAndHeader } from "./gradingSetIo.js";
import { DISTILL_QUICK_ANSWERS_PATH, DISTILL_QUICK_SET_PATH, DISTILL_QUICK_SIDES_PATH } from "./paths.js";
import { buildQuickSet, parseChoice, quickSummary, type Choice, type QuickAnswer, type QuickItem, type QuickSide } from "./quick.js";
import type { ArmOutput } from "./worker.js";

const MAX_WORDS = 80;

function ensureSet(runDir: string, seed: number): QuickItem[] {
  if (existsSync(DISTILL_QUICK_SET_PATH)) return (JSON.parse(readFileSync(DISTILL_QUICK_SET_PATH, "utf8")) as { items: QuickItem[] }).items;
  const control = JSON.parse(readFileSync(join(runDir, "control.json"), "utf8")) as ArmOutput;
  const challenger = JSON.parse(readFileSync(join(runDir, "challenger.json"), "utf8")) as ArmOutput;
  const pairs = control.results.map((c) => {
    const x = challenger.results.find((r) => r.idx === c.idx);
    if (!x) throw new Error(`pair ${c.idx} has no challenger note`);
    return { pairIdx: c.idx, control: stripFrontmatterAndHeader(c.body), challenger: stripFrontmatterAndHeader(x.body) };
  });
  const set = buildQuickSet(pairs, makeRng(seed), MAX_WORDS);
  mkdirSync(dirname(DISTILL_QUICK_SET_PATH), { recursive: true });
  writeFileSync(DISTILL_QUICK_SET_PATH, JSON.stringify({ version: 1, seed, runDir, maxWords: MAX_WORDS, items: set.items }, null, 2));
  writeFileSync(DISTILL_QUICK_SIDES_PATH, JSON.stringify({ version: 1, seed, sides: set.sides }, null, 2));
  chmodSync(DISTILL_QUICK_SIDES_PATH, 0o600);
  return set.items;
}

function readAnswers(): QuickAnswer[] {
  return existsSync(DISTILL_QUICK_ANSWERS_PATH) ? (JSON.parse(readFileSync(DISTILL_QUICK_ANSWERS_PATH, "utf8")) as { answers: QuickAnswer[] }).answers : [];
}

export async function runQuick(runDir: string, seed: number): Promise<void> {
  const items = ensureSet(runDir, seed);
  let answers = readAnswers();
  const done = new Set(answers.map((a) => a.pairIdx));
  const todo = items.filter((i) => !done.has(i.pairIdx));
  const log = (l: string): void => void stdout.write(`${l}\n`);
  log(`Quick test: ${items.length} pairs, ${done.size} done. Two notes about the SAME session, top part only.`);
  log(`Answer each question with 1, 2 or = (no difference). "q" stops; it saves after every pair.`);
  const rl = createInterface({ input: stdin, output: stdout });
  const ask = async (q: string): Promise<Choice | "q"> => {
    for (;;) {
      const line = await rl.question(q);
      if (line.trim() === "q") return "q";
      const c = parseChoice(line);
      if (c) return c;
      log("  type 1, 2 or =");
    }
  };
  try {
    for (const item of todo) {
      log("");
      log(`=============== pair ${items.length - todo.length + todo.indexOf(item) + 1} of ${items.length} ===============`);
      log("");
      log("----- [1] -----");
      log(item.one);
      log("");
      log("----- [2] -----");
      log(item.two);
      log("");
      const prefer = await ask("Which would you rather find a month from now?  1 / 2 / =  > ");
      if (prefer === "q") return;
      const diary = await ask("Which reads more like a diary of the session?   1 / 2 / =  > ");
      if (diary === "q") return;
      answers = [...answers.filter((a) => a.pairIdx !== item.pairIdx), { pairIdx: item.pairIdx, prefer, diary }];
      writeFileSync(DISTILL_QUICK_ANSWERS_PATH, JSON.stringify({ version: 1, answers }, null, 2));
    }
    log("");
    log("done — tell Claude, or run: npm run distill:ab -- quick-report");
  } finally {
    rl.close();
  }
}

export function quickReport(): string {
  const sides = (JSON.parse(readFileSync(DISTILL_QUICK_SIDES_PATH, "utf8")) as { sides: QuickSide[] }).sides;
  const answers = readAnswers();
  const s = quickSummary(sides, answers);
  const row = (name: string, t: { challenger: number; control: number; ties: number; p: number }): string =>
    `| ${name} | ${t.challenger} | ${t.control} | ${t.ties} | ${t.p.toFixed(3)} |`;
  return [
    "# Distill prompt A/B — quick human test",
    "",
    `Human forced choice on the top of each note (summary + lead bullet, ≤ ${MAX_WORDS} words), ${s.n} of ${sides.length} pairs answered. Sides were randomised and sealed.`,
    "",
    "| Question | challenger | control | no difference | exact sign-test p |",
    "|---|---|---|---|---|",
    row("Rather find in a month", s.prefer),
    row("Reads more like a session diary (lower is better)", s.diary),
    "",
    s.prefer.p < 0.05 ? "The preference is detectable at this n." : "The preference is not detectable at this n; treat it as a tie.",
    "Scope: this judges the part of a note a reader skims. It says nothing about the bullets further down.",
    "",
  ].join("\n");
}
