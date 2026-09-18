import { tokenize } from "../../src/search/retriever.js";
import type { Rng } from "../rng.js";

// An identifier is an inline-code span that could only have come from code or
// config: camelCase, dotted access, SCREAMING_SNAKE, or a kebab flag. A plain
// lowercase word in backticks (`vir`, `null`) is prose to the retriever and
// would test nothing lexical.
const IDENT_RE = /^(?:--)?[A-Za-z_][A-Za-z0-9_.-]{2,39}$/;
function looksLikeIdentifier(s: string): boolean {
  if (!IDENT_RE.test(s)) return false;
  const hasCamel = /[a-z][A-Z]/.test(s);
  const hasSep = /[._-]/.test(s);
  return hasCamel || hasSep;
}

export function extractIdentifiers(raw: string): string[] {
  const noFrontmatter = raw.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const noFences = noFrontmatter.replace(/```[\s\S]*?```/g, " ");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of noFences.matchAll(/`([^`\n]+)`/g)) {
    const span = m[1]!.trim().replace(/\(\)$/, "");
    if (!looksLikeIdentifier(span) || seen.has(span)) continue;
    seen.add(span);
    out.push(span);
  }
  return out;
}

// One or two distinct identifiers from the same note, space-joined — the
// terse shape real (agent-written) queries take. Null when the note offers
// nothing lexical to ask for.
export function buildIdentifierQuery(idents: readonly string[], rng: Rng): string | null {
  if (idents.length === 0) return null;
  const want = idents.length >= 2 && rng() < 0.5 ? 2 : 1;
  const pool = [...idents];
  const picked: string[] = [];
  while (picked.length < want && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    picked.push(pool.splice(i, 1)[0]!);
  }
  return picked.join(" ");
}

// Rarity-gated pick: an identifier tests lexical recall only if at least one
// of its retriever tokens is rare in the corpus (a skill name mentioned in
// half the vault points at nothing). `used` keeps one identifier from
// becoming two queries. Picks one or two of the survivors.
export function pickIdentifierQuery(
  idents: readonly string[],
  df: (token: string) => number,
  nDocs: number,
  maxRatio: number,
  used: ReadonlySet<string>,
  rng: Rng,
): string | null {
  const rare = idents.filter((id) => {
    if (used.has(id)) return false;
    const toks = tokenize(id);
    return toks.length > 0 && toks.some((t) => df(t) / Math.max(1, nDocs) <= maxRatio);
  });
  return buildIdentifierQuery(rare, rng);
}
