import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Config } from "../config.js";
import { LockHeldError } from "../pipeline/lock.js";
import { StateDb } from "../state/db.js";
import { demoteStrays, strayFileCheck } from "./strayFiles.js";

let root: string;
let vault: string;
let db: StateDb;

function cfg(): Config {
  return { vaultPath: vault, outputDir: "vir" } as Config;
}

// A distilled row plus the note file the writer would have produced for it.
function seed(opts: {
  sessionId: string;
  topic: string;
  content?: string | null;
  pruned?: boolean;
}): void {
  const path = `/t/projects/demo/${opts.sessionId}.jsonl`;
  db.record({
    path,
    hash: `h-${opts.sessionId}`,
    skipped: false,
    notePaths: [],
    content: opts.content === undefined ? "body" : opts.content,
    category: "pattern",
    topic: opts.topic,
    project: "demo",
    confidence: 0.9,
    startedAt: "2026-05-01T00:00:00.000Z",
  });
  if (opts.pruned === true) db.markPruned(path, "sidechain-transcript");
}

function writeNote(slug: string): void {
  const dir = join(vault, "vir", "patterns");
  mkdirSync(dir, { recursive: true });
  writeFileSync(dir + `/${slug}.md`, `---\ntopic: "x"\n---\n\nbody\n`);
}

describe("strayFileCheck", () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "vir-stray-"));
    vault = join(root, "vault");
    db = new StateDb(join(root, "vir.db"));
  });
  afterEach(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  it("finds nothing when every file is backed by a live row", () => {
    seed({ sessionId: "aaaa1111", topic: "first topic" });
    writeNote("first-topic-aaaa1111");

    expect(strayFileCheck(cfg(), db).strays).toEqual([]);
  });

  // The file the writer left behind when the distiller retitled a session
  // before 0.17.3 removed the old path. Its session has a live note under the
  // new title, so the content is not unique.
  it("flags a retitle duplicate and names its live sibling", () => {
    seed({ sessionId: "aaaa1111", topic: "new title" });
    writeNote("new-title-aaaa1111");
    writeNote("old-title-aaaa1111");

    const r = strayFileCheck(cfg(), db);

    expect(r.strays).toHaveLength(1);
    expect(r.strays[0]?.relPath).toContain("old-title-aaaa1111.md");
    expect(r.strays[0]?.kind).toBe("retitle-duplicate");
    expect(r.strays[0]?.liveSibling).toBe("new-title-aaaa1111");
  });

  // The trap that nearly demoted a real note during the live cleanup: a
  // session awaiting `vir reconcile` has an EMPTY content column, but it is a
  // live note and its file on disk is the only copy of that text. Content must
  // not be part of the test.
  it("never flags a note whose row is awaiting reconcile", () => {
    seed({ sessionId: "bbbb2222", topic: "pending topic", content: "" });
    writeNote("pending-topic-bbbb2222");

    expect(strayFileCheck(cfg(), db).strays).toEqual([]);
  });

  it("flags a file with no row at all as unknown, not as a duplicate", () => {
    writeNote("who-knows-cccc3333");

    const r = strayFileCheck(cfg(), db);

    expect(r.strays).toHaveLength(1);
    expect(r.strays[0]?.kind).toBe("unknown");
    expect(r.strays[0]?.liveSibling).toBeNull();
  });

  // A pruned note lives in `.rejected/`, so a file left in a category dir for
  // a pruned session is debris — but it is NOT a retitle duplicate, and saying
  // so would invite deleting the only copy.
  it("classifies a file whose session was pruned as pruned-leftover", () => {
    seed({ sessionId: "dddd4444", topic: "pruned topic", pruned: true });
    writeNote("pruned-topic-dddd4444");

    const r = strayFileCheck(cfg(), db);

    expect(r.strays).toHaveLength(1);
    expect(r.strays[0]?.kind).toBe("pruned-leftover");
  });

  it("ignores .rejected/ and archived/ entirely", () => {
    for (const sub of [".rejected", "archived"]) {
      const dir = join(vault, "vir", sub);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "whatever-eeee5555.md"), "---\n---\nbody\n");
    }

    expect(strayFileCheck(cfg(), db).strays).toEqual([]);
  });
});

describe("demoteStrays", () => {
  let lockPath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "vir-stray-fix-"));
    vault = join(root, "vault");
    lockPath = join(root, "vir.lock");
    db = new StateDb(join(root, "vir.db"));
  });
  afterEach(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });

  const notes = (): string => join(vault, "vir", "patterns");
  const archived = (): string => join(vault, "vir", "archived");

  it("moves a retitle duplicate into archived/ and leaves the live note", () => {
    seed({ sessionId: "aaaa1111", topic: "new title" });
    writeNote("new-title-aaaa1111");
    writeNote("old-title-aaaa1111");

    const r = demoteStrays(cfg(), strayFileCheck(cfg(), db), { lockPath });

    expect(r.moved).toBe(1);
    expect(existsSync(join(notes(), "old-title-aaaa1111.md"))).toBe(false);
    expect(existsSync(join(archived(), "old-title-aaaa1111.md"))).toBe(true);
    expect(existsSync(join(notes(), "new-title-aaaa1111.md"))).toBe(true);
    expect(strayFileCheck(cfg(), db).strays).toEqual([]);
  });

  // Neither kind has a live sibling vouching for its content: an `unknown` may
  // be the only copy, and a pruned leftover's canonical home is `.rejected/`,
  // which prune --restore reads by exact name. Both are reported, never moved.
  it("never moves an unknown stray or a pruned leftover", () => {
    writeNote("who-knows-cccc3333");
    seed({ sessionId: "dddd4444", topic: "pruned topic", pruned: true });
    writeNote("pruned-topic-dddd4444");

    const r = demoteStrays(cfg(), strayFileCheck(cfg(), db), { lockPath });

    expect(r.moved).toBe(0);
    expect(r.left).toBe(2);
    expect(existsSync(join(notes(), "who-knows-cccc3333.md"))).toBe(true);
    expect(existsSync(join(notes(), "pruned-topic-dddd4444.md"))).toBe(true);
  });

  it("never overwrites a file already in archived/", () => {
    seed({ sessionId: "aaaa1111", topic: "new title" });
    writeNote("new-title-aaaa1111");
    writeNote("old-title-aaaa1111");
    mkdirSync(archived(), { recursive: true });
    writeFileSync(join(archived(), "old-title-aaaa1111.md"), "earlier copy\n");

    demoteStrays(cfg(), strayFileCheck(cfg(), db), { lockPath });

    expect(readFileSync(join(archived(), "old-title-aaaa1111.md"), "utf8")).toBe(
      "earlier copy\n",
    );
    expect(existsSync(join(archived(), "old-title-aaaa1111-1.md"))).toBe(true);
  });

  // index.md is append-only outside --rewrite-only, so the stray's row stays
  // behind as a dead wikilink unless it is dropped explicitly.
  it("drops the stray's index.md row and keeps the live one", () => {
    seed({ sessionId: "aaaa1111", topic: "new title" });
    writeNote("new-title-aaaa1111");
    writeNote("old-title-aaaa1111");
    writeFileSync(
      join(vault, "vir", "index.md"),
      [
        "| date | topic |",
        "| 2026-05-01 | [[patterns/new-title-aaaa1111|new title]] |",
        "| 2026-05-01 | [[patterns/old-title-aaaa1111|old title]] |",
      ].join("\n"),
    );

    demoteStrays(cfg(), strayFileCheck(cfg(), db), { lockPath });

    const index = readFileSync(join(vault, "vir", "index.md"), "utf8");
    expect(index).toContain("new-title-aaaa1111|");
    expect(index).not.toContain("old-title-aaaa1111|");
  });

  // A running `vir run` may be writing this very session's note; moving files
  // underneath it is exactly the race the pipeline lock exists to prevent.
  it("refuses to run while the pipeline lock is held", () => {
    seed({ sessionId: "aaaa1111", topic: "new title" });
    writeNote("new-title-aaaa1111");
    writeNote("old-title-aaaa1111");
    writeFileSync(lockPath, String(process.pid));

    expect(() =>
      demoteStrays(cfg(), strayFileCheck(cfg(), db), { lockPath }),
    ).toThrow(LockHeldError);
    expect(existsSync(join(notes(), "old-title-aaaa1111.md"))).toBe(true);
  });
});
