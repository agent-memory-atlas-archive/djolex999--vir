import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StateDb } from "./db.js";

const PROV = { model: "nomic-embed-text", dim: 3 };
const SID = "abc12345-0000-4000-8000-000000000001";
const PATH = `/p/-home-u-app/${SID}.jsonl`;

// `vir review` rejects by moving the note file, which SQL cannot see. Before
// rejected_at, a rejected note kept feeding listDistilled (sync-claude,
// summaries, vir_recent_notes), getStats and the embedding sweep.
describe("review rejection on the sessions row", () => {
  let dir: string;
  let db: StateDb;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "vir-reject-db-"));
    db = new StateDb(join(dir, "vir.db"));
    db.record({
      path: PATH,
      hash: "h1",
      skipped: false,
      notePaths: [`/v/patterns/x-abc12345.md`],
      content: "note body",
      category: "pattern",
      topic: "x",
      project: "demo",
      confidence: 0.9,
      startedAt: "2026-05-01T00:00:00.000Z",
    });
    db.storeEmbedding(SID, [1, 0, 0], PROV);
  });
  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("markRejected hides the row from every DB-backed read path", () => {
    expect(db.markRejected(SID)).toBe(1);

    expect(db.listDistilled()).toHaveLength(0);
    expect(db.getStats().total).toBe(0);
    expect(db.getEmbeddings("/v")).toHaveLength(0);
    expect(db.listReconcileTargets()).toHaveLength(0);
    expect(db.listEmbeddingTargets()).toHaveLength(0);
  });

  it("keeps the row processed, with its content, so nothing is re-billed", () => {
    db.markRejected(SID);

    expect(db.isProcessed(PATH, "h1")).toBe(true);
    expect(db.getByPath(PATH)?.content).toBe("note body");
  });

  it("is untouched by a later record() of the same session", () => {
    db.markRejected(SID);
    db.record({ path: PATH, hash: "h2", skipped: false, notePaths: [] });

    expect(db.listDistilled()).toHaveLength(0);
  });

  it("does not overwrite an earlier rejection time", () => {
    db.markRejected(SID, "2026-01-01T00:00:00.000Z");

    expect(db.markRejected(SID, "2026-09-25T00:00:00.000Z")).toBe(0);
  });

  it("matches the whole session id, never a prefix", () => {
    expect(db.markRejected("abc12345")).toBe(0);
    expect(db.listDistilled()).toHaveLength(1);
  });

  // 785 rows in the reference DB carry this form, from older subagent runs.
  it("matches an agent-<hex> session id, not only a UUID", () => {
    db.record({
      path: "/p/-home-u-app/agent-a969027c17288b203.jsonl",
      hash: "h",
      skipped: false,
      notePaths: [],
      content: "agent body",
      category: "gotcha",
      topic: "y",
      project: "demo",
      confidence: 0.9,
      startedAt: "2026-05-01T00:00:00.000Z",
    });

    expect(db.markRejected("agent-a969027c17288b203")).toBe(1);
    expect(db.listDistilled().map((r) => r.topic)).toEqual(["x"]);
  });

  // A hand-edited frontmatter must not be able to widen the match.
  it("selects nothing for an id carrying a LIKE wildcard", () => {
    expect(db.markRejected("%")).toBe(0);
    expect(db.markRejected("abc12345_0000%")).toBe(0);
    expect(db.clearRejected("%")).toBe(0);
    expect(db.listDistilled()).toHaveLength(1);
  });

  it("clearRejected puts the row back on every read path", () => {
    db.markRejected(SID);
    expect(db.clearRejected(SID)).toBe(1);

    expect(db.listDistilled()).toHaveLength(1);
    expect(db.getStats().total).toBe(1);
    expect(db.getEmbeddings("/v")).toHaveLength(1);
  });
});
