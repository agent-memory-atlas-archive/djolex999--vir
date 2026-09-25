import type { StateDb } from "../state/db.js";
import { LOCK_PATH, acquireLock, releaseLock } from "../pipeline/lock.js";
import type { VaultWriter } from "../pipeline/writer.js";

// Before 0.12.0 the distill prompt asked for a `## Related` section, and the
// model often filled it with content, not links: file paths with what lives
// there, API endpoints, a SQL query. Since 0.12.0 the writer strips stored
// Related and rebuilds it from embedding neighbours, so every rewrite dropped
// those bullets from the file. The DB still holds them. This moves them into
// `## Details` in stored content, where every writer version renders them.
export const DETAILS_HEADING = "## Details";

const RELATED_RE = /^##\s+related\b/i;
const HEADING_RE = /^#{1,6}\s+/;
const TOP_BULLET_RE = /^[-*]\s+(.*)$/;
const WIKILINKS_ONLY_RE = /^\[\[[^\]]+\]\](\s*,\s*\[\[[^\]]+\]\])*$/;
// Letters, digits, spaces and the punctuation a topic name carries
// ("Next.js", "third-party", "Claude's", "auth & billing"). No backticks,
// colons, dashes-as-separators, parentheses or slashes: those mark a bullet
// that says something.
const PLAIN_PHRASE_RE = /^[\p{L}\p{N}][\p{L}\p{N}\s'’&+,.-]*$/u;
// On the reference DB, topic names run up to ~11 words, but past 8 claims
// start to appear ("Controlled component values in React are XSS-safe by
// default"). A kept topic costs a line of noise; a dropped claim is lost, so
// the cap errs short.
const MAX_TOPIC_WORDS = 8;
const CLAIM_WORD_RE =
  /\b(is|are|was|were|must|should|never|always|not|don't|doesn't|can't|won't|if|unless)\b/i;

// The old-style related-topic list: "Supabase SSR authentication in Next.js
// API routes", or a bare wikilink. Those named topics the model couldn't see
// (1/2261 resolved on a real vault), and neighbour links replace them. Anything
// with a path, a code span, an explanation, a verb of assertion or a second
// sentence is kept.
export function isBareTopic(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  if (WIKILINKS_ONLY_RE.test(t)) return true;
  if (!PLAIN_PHRASE_RE.test(t)) return false;
  if (/\.$/.test(t) || /\.\s/.test(t) || /\s-\s/.test(t)) return false;
  if (CLAIM_WORD_RE.test(t)) return false;
  return t.split(/\s+/).length <= MAX_TOPIC_WORDS;
}

export interface LegacyRelatedSplit {
  content: string;
  kept: number;
  dropped: number;
}

// Rewrites one stored note: the `## Related` section is removed, and whatever
// in it is content moves, verbatim and in place, under `## Details`. Returns
// null when there is no Related section, which makes a second pass a no-op.
//
// Items are grouped as a top-level bullet plus the lines under it. An item is
// dropped only when it is a single bare topic with nothing nested beneath;
// non-bullet lines (a bold sub-label, prose) are kept.
export function splitLegacyRelated(content: string): LegacyRelatedSplit | null {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => RELATED_RE.test(l));
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && HEADING_RE.test(l));
  if (end === -1) end = lines.length;

  const items: string[][] = [];
  for (const line of lines.slice(start + 1, end)) {
    const continuesItem = /^\s+\S/.test(line) && items.length > 0;
    if (continuesItem) items[items.length - 1]?.push(line);
    else if (line.trim().length > 0) items.push([line]);
  }

  const keptLines: string[] = [];
  let kept = 0;
  let dropped = 0;
  for (const item of items) {
    const head = item[0] ?? "";
    const bullet = head.match(TOP_BULLET_RE);
    if (bullet && item.length === 1 && isBareTopic(bullet[1] ?? "")) {
      dropped += 1;
      continue;
    }
    if (bullet) kept += 1;
    keptLines.push(...item);
  }

  const before = lines.slice(0, start).join("\n").replace(/\n+$/, "");
  const after = lines.slice(end).join("\n").replace(/^\n+/, "");
  const details =
    keptLines.length > 0 ? `${DETAILS_HEADING}\n\n${keptLines.join("\n")}` : "";
  const out = [before, details, after].filter((s) => s.length > 0).join("\n\n");
  return { content: out, kept, dropped };
}

export interface LegacyRelatedRow {
  path: string;
  kept: number;
  dropped: number;
  // False for pruned and rejected rows: stored content changes, the file is
  // not re-rendered (a restore or the next rewrite renders it).
  serving: boolean;
}

export interface LegacyRelatedResult {
  scanned: number;
  rows: LegacyRelatedRow[];
}

// `vir lint --legacy-related`. Read-only: every stored note that still carries
// a `## Related` section, with how many of its items are content.
export function legacyRelatedCheck(db: StateDb): LegacyRelatedResult {
  const rows: LegacyRelatedRow[] = [];
  const stored = db.listStoredContent();
  for (const r of stored) {
    const split = splitLegacyRelated(r.content);
    if (split === null) continue;
    rows.push({
      path: r.path,
      kept: split.kept,
      dropped: split.dropped,
      serving: r.serving,
    });
  }
  return { scanned: stored.length, rows };
}

export interface MigrateResult {
  migrated: number;
  rewritten: number;
  errors: Array<{ path: string; message: string }>;
}

// `vir lint --legacy-related --fix`. Rewrites stored content, then re-renders
// the serving notes it touched. Idempotent: a migrated row has no Related
// section, so the next pass selects nothing. `updateContent` clears the row's
// embedding because the embedded text now includes Details; the rewrite
// re-embeds, and the sweep back-fills anything it could not.
export async function migrateLegacyRelated(
  db: StateDb,
  writer: VaultWriter,
  opts: { lockPath?: string } = {},
): Promise<MigrateResult> {
  const lockPath = opts.lockPath ?? LOCK_PATH;
  // A concurrent `vir run` may be writing the same rows and files.
  acquireLock(lockPath);
  try {
    const touched = new Set<string>();
    for (const r of db.listStoredContent()) {
      const split = splitLegacyRelated(r.content);
      if (split === null) continue;
      db.updateContent(r.path, split.content);
      touched.add(r.path);
    }

    let rewritten = 0;
    const errors: MigrateResult["errors"] = [];
    for (const row of db.listDistilled()) {
      if (!touched.has(row.path)) continue;
      try {
        await writer.rewriteRow(row);
        rewritten += 1;
      } catch (err) {
        errors.push({
          path: row.path,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { migrated: touched.size, rewritten, errors };
  } finally {
    releaseLock(lockPath);
  }
}
