import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REJECTED_DIR } from "../pipeline/vaultDirs.js";
import type { StateDb } from "./db.js";

// One scalar from a note's frontmatter block, unquoted; null when absent.
function frontmatterValue(content: string, key: string): string | null {
  const block = /^---\n([\s\S]*?)\n---/.exec(content)?.[1];
  if (block === undefined) return null;
  const m = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(block);
  return m?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;
}

// Carry every review rejection in `.rejected/` into the database, so the
// rejected note stops serving DB-backed read paths (listDistilled, getStats,
// embeddings). Idempotent, and the backfill for rejections made before the
// column existed. Only files stamped `rejected_at` count: `vir prune` also
// moves notes here but owns its own state. Returns the number of rows marked.
export function syncRejections(db: StateDb, vaultRoot: string): number {
  const dir = join(vaultRoot, REJECTED_DIR);
  if (!existsSync(dir)) return 0;
  let marked = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    let content: string;
    try {
      content = readFileSync(join(dir, name), "utf8");
    } catch {
      continue;
    }
    const rejectedAt = frontmatterValue(content, "rejected_at");
    const sessionId = frontmatterValue(content, "session_id");
    if (rejectedAt === null || sessionId === null) continue;
    marked += db.markRejected(sessionId, rejectedAt);
  }
  return marked;
}
