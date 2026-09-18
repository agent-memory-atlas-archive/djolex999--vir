import type { Scores } from "./grades.js";

const DIMS = ["D1", "D2", "D3", "D4", "D5"] as const;

// One note per call, the rubric verbatim, integers only. Same family as the
// distiller (Sonnet 5), so this is a preview and never the result.
export function buildNoteJudgePrompt(rubric: string, body: string): string {
  return [
    rubric.trim(),
    "",
    "NOTE BODY:",
    "=== begin ===",
    body.trim(),
    "=== end ===",
    "",
    "Score the note on D1 through D5 using the anchors above. Reply with ONLY a JSON object",
    'of the form {"D1": n, "D2": n, "D3": n, "D4": n, "D5": n} where each n is 0, 1 or 2.',
    "No prose, no code fence.",
  ].join("\n");
}

export function parseNoteJudge(text: string): Scores {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error(`judge returned no JSON object: ${text.slice(0, 200)}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(`judge returned unparseable JSON: ${text.slice(0, 200)}`);
  }
  if (typeof parsed !== "object" || parsed === null) throw new Error("judge returned a non-object JSON value");
  const obj = parsed as Record<string, unknown>;
  const out: number[] = [];
  for (const d of DIMS) {
    const v = obj[d];
    if (v !== 0 && v !== 1 && v !== 2) throw new Error(`judge gave an invalid or missing ${d}: ${String(v)}`);
    out.push(v);
  }
  return out as Scores;
}
