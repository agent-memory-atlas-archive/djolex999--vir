import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import type { Config } from "../config.js";
import type { DistilledRow, StateDb } from "../state/db.js";
import {
  maybeAnthropicClient,
  callLLM,
  normalizeModelName,
  withRateLimitRetry,
} from "../pipeline/distiller.js";
import { makeSlug } from "../pipeline/slug.js";
import { VaultWriter, stripRelatedSection } from "../pipeline/writer.js";

const CATEGORY_DIRS: Record<string, string> = {
  pattern: "patterns",
  gotcha: "gotchas",
  decision: "decisions",
  tool: "tools",
};

export interface MergeOutcome {
  winnerPath: string;
  archivedPath: string;
  action: "keep-a" | "keep-b" | "merge";
}

export async function mergeNotes(
  cfg: Config,
  db: StateDb,
  a: DistilledRow,
  b: DistilledRow,
  keepWhich: "A" | "B" | "merge",
  // Tests only — lets them pin the embedding provider. Production passes
  // nothing and gets a writer over cfg/db.
  opts: { writer?: VaultWriter } = {},
): Promise<MergeOutcome> {
  const root = join(cfg.vaultPath, cfg.outputDir);
  const archivedDir = join(root, "archived");
  if (!existsSync(archivedDir)) mkdirSync(archivedDir, { recursive: true });

  const aFile = resolveNotePath(root, a);
  const bFile = resolveNotePath(root, b);

  if (keepWhich === "merge") {
    const writer = opts.writer ?? new VaultWriter(cfg, db);
    return doMerge(cfg, db, writer, archivedDir, a, b, aFile, bFile);
  }

  const loser = keepWhich === "A" ? b : a;
  const winnerFile = keepWhich === "A" ? aFile : bFile;
  const loserFile = keepWhich === "A" ? bFile : aFile;

  const archivedPath = archiveFile(archivedDir, loserFile);
  appendArchivedSection(winnerFile, archivedPath);
  db.archive(loser.path);

  return {
    winnerPath: winnerFile,
    archivedPath,
    action: keepWhich === "A" ? "keep-a" : "keep-b",
  };
}

async function doMerge(
  cfg: Config,
  db: StateDb,
  writer: VaultWriter,
  archivedDir: string,
  a: DistilledRow,
  b: DistilledRow,
  aFile: string,
  bFile: string,
): Promise<MergeOutcome> {
  // Higher-confidence row wins the file path (and DB content); tie → A.
  const aWins = a.confidence >= b.confidence;
  const winner = aWins ? a : b;
  const loser = aWins ? b : a;
  const loserFile = aWins ? bFile : aFile;

  const client = maybeAnthropicClient(cfg);
  const model = normalizeModelName(cfg.models.distill, cfg.provider);
  const raw = await withRateLimitRetry(() =>
    callLLM(cfg, client, {
      prompt: buildMergePrompt(winner, loser),
      model,
      maxTokens: 2000,
      cost: { stage: "dedupe-merge" },
    }),
  );
  // Validated before anything on disk or in the db changes.
  const merged = parseMergedBody(raw);

  // Archive first so the loser is out of the embedding pool before the winner
  // picks its Related neighbours — otherwise it would link to the note it
  // just absorbed.
  const archivedPath = archiveFile(archivedDir, loserFile);
  db.archive(loser.path);

  // Clears the stored embedding; the writer re-embeds the new content (or the
  // self-heal sweep does, if no provider is up).
  db.updateContent(winner.path, merged);
  const [winnerFile] = await writer.rewriteRow({ ...winner, content: merged });
  if (winnerFile === undefined) {
    throw new Error(`writer produced no file for ${winner.path}`);
  }
  appendArchivedSection(winnerFile, archivedPath);

  return { winnerPath: winnerFile, archivedPath, action: "merge" };
}

// Same output contract as buildDistillPrompt: the writer owns frontmatter,
// the wikilink header and Related, so the model writes only the three body
// sections. Conflicts resolve to the newer note — a stale claim is an age
// problem, and the confidence that picks the winner says nothing about age.
export function buildMergePrompt(winner: DistilledRow, loser: DistilledRow): string {
  const winnerIsNewer = (winner.startedAt ?? "") >= (loser.startedAt ?? "");
  const [newer, older] = winnerIsNewer ? [winner, loser] : [loser, winner];
  return `Merge these two knowledge notes about the same topic into one note.

Output a markdown page with these sections (no preamble, start with '## Summary'):
- ## Summary (2-3 sentences)
- ## What Was Learned
- ## Context

Write no other sections. In particular, no Related section — links to other
notes are generated separately.

Summary: say in plain words what the work was and the single most important
thing it established, with its specifics.

What Was Learned: bullets, most important first. Each bullet is a claim tied
to something concrete. Keep every claim from either note that the other does
not contradict, and state each one once.

Conflicts: Note 1 is the newer note. Where the notes disagree, or Note 2
describes something Note 1 shows was replaced, keep Note 1's version and drop
Note 2's.

Context: one or two sentences on the situation that produced these lessons.
Do not repeat the project, category, or date.

Note 1 (newer, ${newer.startedAt ?? "date unknown"}):
${stripRelatedSection(newer.content)}

Note 2 (older, ${older.startedAt ?? "date unknown"}):
${stripRelatedSection(older.content)}`;
}

// Drops any preamble before '## Summary' and any Related section the model
// emitted anyway. Throws rather than let a malformed reply replace a note.
export function parseMergedBody(raw: string): string {
  const start = raw.search(/^## Summary\b/m);
  if (start === -1) {
    throw new Error("merge reply has no '## Summary' section — notes left unchanged");
  }
  return stripRelatedSection(raw.slice(start)).trim();
}

function resolveNotePath(root: string, r: DistilledRow): string {
  const dir = CATEGORY_DIRS[r.category] ?? `${r.category}s`;
  return join(root, dir, `${makeSlug(r.topic, r.sessionId)}.md`);
}

function archiveFile(archivedDir: string, sourcePath: string): string {
  if (!existsSync(sourcePath)) {
    // Nothing to move on disk; still record what the target *would* have been.
    return join(archivedDir, basename(sourcePath));
  }
  const dest = uniquePath(join(archivedDir, basename(sourcePath)));
  renameSync(sourcePath, dest);
  return dest;
}

function uniquePath(p: string): string {
  if (!existsSync(p)) return p;
  const dot = p.lastIndexOf(".");
  const base = dot === -1 ? p : p.slice(0, dot);
  const ext = dot === -1 ? "" : p.slice(dot);
  let i = 1;
  while (existsSync(`${base}-${i}${ext}`)) i += 1;
  return `${base}-${i}${ext}`;
}

function appendArchivedSection(winnerFile: string, archivedPath: string): void {
  if (!existsSync(winnerFile)) return;
  const loserSlug = basename(archivedPath, ".md");
  const link = `- [[${loserSlug}]]`;

  const current = readFileSync(winnerFile, "utf8");
  if (current.includes("## Archived Duplicates")) {
    // Append the bullet under the existing section.
    const updated = current.replace(
      /(## Archived Duplicates\n(?:[\s\S]*?))(\n##|\n*$)/,
      (_match, body: string, tail: string) =>
        `${body}${body.endsWith("\n") ? "" : "\n"}${link}\n${tail}`,
    );
    writeFileSync(winnerFile, updated);
  } else {
    appendFileSync(winnerFile, `\n## Archived Duplicates\n${link}\n`);
  }
}
