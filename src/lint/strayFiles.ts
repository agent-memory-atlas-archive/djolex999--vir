import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { basename, join, relative } from "node:path";
import type { Config } from "../config.js";
import { LOCK_PATH, acquireLock, releaseLock } from "../pipeline/lock.js";
import { makeSlug, sessionSuffix } from "../pipeline/slug.js";
import { CATEGORY_DIR, dropIndexRow } from "../pipeline/writer.js";
import type { StateDb } from "../state/db.js";

// Same directory `vir dedupe` archives losers into; retrieval skips it.
const ARCHIVED_DIR = "archived";

// Why a note file has no live row behind it.
//   retitle-duplicate — the distiller renamed the session and the writer left
//     the old path behind (every release before 0.17.3). Its session still has
//     a live note under the new title, so nothing unique is in this file.
//   pruned-leftover  — the session was pruned; the demoted copy belongs in
//     `.rejected/`, so a file still sitting in a category dir is debris.
//   unknown          — no row produces this filename at all. Reported without
//     a recommendation: it may be the only copy of its content.
export type StrayKind = "retitle-duplicate" | "pruned-leftover" | "unknown";

export interface StrayFile {
  relPath: string;
  kind: StrayKind;
  // The live note for the same session, when there is one. Its existence is
  // what makes a stray safe to demote.
  liveSibling: string | null;
}

export interface StrayResult {
  scanned: number;
  strays: StrayFile[];
}

function deriveSessionId(path: string): string {
  return basename(path).replace(/\.jsonl$/, "");
}

// Note files in a category dir that no live DB row can account for.
//
// The test is "can any non-pruned row produce this filename", NOT "does a row
// with content produce it". A session awaiting `vir reconcile` has an empty
// content column while its note file on disk holds the only copy of the text —
// judging on content would flag that as debris and demote a real note.
export function strayFileCheck(cfg: Config, db: StateDb): StrayResult {
  const root = join(cfg.vaultPath, cfg.outputDir);

  const live = new Map<string, string>(); // slug -> slug (live notes)
  const liveBySession = new Map<string, string>(); // session suffix -> slug
  const prunedSlugs = new Set<string>();

  for (const row of db.listAllNoteRows()) {
    const sessionId = deriveSessionId(row.path);
    const slug = makeSlug(row.topic, sessionId);
    if (row.pruned_at !== null) {
      prunedSlugs.add(slug);
      continue;
    }
    live.set(slug, slug);
    liveBySession.set(sessionSuffix(sessionId), slug);
  }

  const strays: StrayFile[] = [];
  let scanned = 0;

  // `.rejected/` and `archived/` are where demoted notes are SUPPOSED to live —
  // they are never walked.
  for (const sub of Object.values(CATEGORY_DIR)) {
    const dir = join(root, sub);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".md")) continue;
      scanned += 1;
      const slug = name.slice(0, -".md".length);
      if (live.has(slug)) continue;

      const sibling = liveBySession.get(slug.split("-").pop() ?? "") ?? null;
      const kind: StrayKind = prunedSlugs.has(slug)
        ? "pruned-leftover"
        : sibling !== null
          ? "retitle-duplicate"
          : "unknown";
      strays.push({
        relPath: relative(root, join(dir, name)),
        kind,
        liveSibling: sibling,
      });
    }
  }

  return { scanned, strays };
}

export interface DemoteResult {
  moved: number;
  // Strays reported but deliberately not touched (unknown, pruned-leftover).
  left: number;
}

// Next free name in archived/: an earlier dedupe or demotion may already hold
// this basename, and that copy is not ours to overwrite.
function freeArchivePath(p: string): string {
  if (!existsSync(p)) return p;
  const base = p.slice(0, -".md".length);
  let i = 1;
  while (existsSync(`${base}-${i}.md`)) i += 1;
  return `${base}-${i}.md`;
}

// `vir lint --strays --fix`. Moves only retitle duplicates — the one kind whose
// live sibling proves nothing unique is lost — into archived/, which retrieval
// already skips, so the move is reversible by hand. `unknown` may be the only
// copy of its text and a pruned leftover belongs to prune's own `.rejected/`
// bookkeeping; both are left where they are.
export function demoteStrays(
  cfg: Config,
  result: StrayResult,
  opts: { lockPath?: string } = {},
): DemoteResult {
  const root = join(cfg.vaultPath, cfg.outputDir);
  const archivedDir = join(root, ARCHIVED_DIR);
  // Holding the pipeline lock: a concurrent `vir run` may be rewriting this
  // very session's note while we move its siblings.
  acquireLock(opts.lockPath ?? LOCK_PATH);
  try {
    let moved = 0;
    let left = 0;
    for (const st of result.strays) {
      if (st.kind !== "retitle-duplicate") {
        left += 1;
        continue;
      }
      const src = join(root, st.relPath);
      if (!existsSync(src)) continue;
      mkdirSync(archivedDir, { recursive: true });
      renameSync(src, freeArchivePath(join(archivedDir, basename(src))));
      dropIndexRow(root, st.relPath);
      moved += 1;
    }
    return { moved, left };
  } finally {
    releaseLock(opts.lockPath ?? LOCK_PATH);
  }
}
