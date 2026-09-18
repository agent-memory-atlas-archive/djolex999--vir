import { tokenize } from "../../src/search/retriever.js";

// A conceptual query must reach the note through meaning, not through a rare
// word copied from its title. "Rare" is corpus-relative: a title token that
// appears in at most `maxRatio` of documents would make TF-IDF's job trivial.
// The session-id suffix always counts as rare (df 1).
export function rareTitleTokens(
  title: string,
  df: (token: string) => number,
  nDocs: number,
  maxRatio: number,
): string[] {
  // The slug's directory (gotchas/, patterns/) is taxonomy, not title wording.
  const base = title.slice(title.lastIndexOf("/") + 1);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokenize(base)) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (df(t) / Math.max(1, nDocs) <= maxRatio) out.push(t);
  }
  return out;
}

export function sharesRareTitleToken(
  query: string,
  title: string,
  df: (token: string) => number,
  nDocs: number,
  maxRatio: number,
): boolean {
  const rare = new Set(rareTitleTokens(title, df, nDocs, maxRatio));
  return tokenize(query).some((t) => rare.has(t));
}

export function buildConceptualPrompt(opts: {
  title: string;
  body: string;
  exemplars: readonly string[];
  forbidden: readonly string[];
  count: number;
}): string {
  return [
    "You write search queries the way a coding agent does before starting a task:",
    "terse, 4 to 10 words, lowercase, no punctuation, no question mark, keyword-dense.",
    "Examples of real queries in that style:",
    ...opts.exemplars.map((e) => `- ${e}`),
    "",
    `Below is a note from a developer's knowledge vault. Write ${opts.count} different queries`,
    "that a developer facing the SAME situation would type BEFORE knowing this note exists.",
    "Each query must be answerable by the note, must describe the problem or need rather than",
    "the note's conclusion, and must NOT contain any of these words (or their plural/verb forms):",
    opts.forbidden.length > 0 ? opts.forbidden.join(", ") : "(none)",
    "",
    "Note title (do not copy its wording):",
    opts.title,
    "",
    "Note body:",
    opts.body,
    "",
    `Reply with ONLY a JSON array of ${opts.count} strings. No prose, no code fence.`,
  ].join("\n");
}

export function parseQueryCandidates(text: string): string[] {
  const stripped = text
    .trim()
    .replace(/^[\s\S]*?```(?:json)?\s*/i, (m) => (m.includes("[") ? m : ""))
    .replace(/```[\s\S]*$/, "")
    .trim();
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  const slice = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped;
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch {
    throw new Error(`conceptual generator did not return a JSON array: ${text.slice(0, 200)}`);
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    !parsed.every((s): s is string => typeof s === "string" && s.trim().length > 0)
  ) {
    throw new Error(`conceptual generator did not return a JSON array of strings: ${slice.slice(0, 200)}`);
  }
  return parsed.map((s) => s.trim());
}
