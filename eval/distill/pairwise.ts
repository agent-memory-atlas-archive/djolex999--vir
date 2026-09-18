import type { Arm } from "./gradingSet.js";
import { parseChoice, type Choice } from "./quick.js";

// The human's quick test, given to a model verbatim: two texts about the same
// session under neutral labels, the same two questions, no mention of arms.
export function buildPairwisePrompt(one: string, two: string): string {
  return [
    "Two notes were written about the SAME Claude Code session. You are the developer who ran that session, reading them a month later without the transcript.",
    "",
    "----- [1] -----",
    one.trim(),
    "",
    "----- [2] -----",
    two.trim(),
    "",
    "Question A: Which would you rather find a month from now?",
    "Question B: Which reads more like a diary of the session?",
    "",
    'Answer each with "1", "2" or "=" (no real difference). Reply with ONLY a JSON object:',
    '{"prefer": "1|2|=", "diary": "1|2|=", "reason": "one sentence on what decided Question A"}',
  ].join("\n");
}

export interface PairwiseAnswer {
  prefer: Choice;
  diary: Choice;
  reason: string;
}

export function parsePairwise(text: string): PairwiseAnswer {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`no JSON object in: ${text.slice(0, 120)}`);
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error(`unparseable JSON in: ${text.slice(0, 120)}`);
  }
  const prefer = parseChoice(String(obj["prefer"] ?? ""));
  const diary = parseChoice(String(obj["diary"] ?? ""));
  if (!prefer) throw new Error(`invalid prefer: ${String(obj["prefer"])}`);
  if (!diary) throw new Error(`invalid diary: ${String(obj["diary"])}`);
  return { prefer, diary, reason: typeof obj["reason"] === "string" ? obj["reason"] : "" };
}

export type Verdict = Arm | "=" | "inconsistent";

function armOf(oneIs: Arm, choice: Choice): Arm | "=" {
  if (choice === "=") return "=";
  return choice === "1" ? oneIs : oneIs === "control" ? "challenger" : "control";
}

// Each pair is judged twice with the sides swapped. A verdict counts only if
// both orders name the same arm; following the slot is reported, not counted.
export function reconcileOrders(a: { oneIs: Arm; choice: Choice }, b: { oneIs: Arm; choice: Choice }): Verdict {
  const x = armOf(a.oneIs, a.choice);
  const y = armOf(b.oneIs, b.choice);
  if (x === "=" || y === "=") return "=";
  return x === y ? x : "inconsistent";
}
