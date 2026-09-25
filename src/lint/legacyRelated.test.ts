import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Config } from "../config.js";
import { LockHeldError } from "../pipeline/lock.js";
import { VaultWriter } from "../pipeline/writer.js";
import type { EmbeddingProvider } from "../search/provider.js";
import { StateDb } from "../state/db.js";
import {
  isBareTopic,
  legacyRelatedCheck,
  migrateLegacyRelated,
  splitLegacyRelated,
} from "./legacyRelated.js";

// Shaped like the 2026-05-08 auth-onboarding-routing row: a pre-0.12.0 note
// whose Related section is file pointers and a SQL query, plus the old-style
// topic names and a wikilink that should still go.
const LEGACY = `## Summary

Onboarding routing moved into middleware.

## What Was Learned

- The profile check is cached for 30s.

## Context

A redirect loop after sign-up.

## Related

- \`lib/ai/structured.ts\` — reusable \`generateStructured<T>\` helper
- Supabase SQL to check for rogue triggers: \`SELECT tgname FROM pg_trigger\`
- Supabase SSR authentication in Next.js API routes
- [[auth-onboarding]]
- Controlled component values in React are XSS-safe by default`;

describe("isBareTopic", () => {
  it.each([
    "Supabase SSR authentication in Next.js API routes",
    "Paddle webhook integration for subscription lifecycle",
    "ioredis connection lifecycle and error propagation",
    "[[auth-onboarding]]",
    "[[a|A]], [[b]]",
  ])("drops %s", (t) => {
    expect(isBareTopic(t)).toBe(true);
  });

  it.each([
    "`lib/ai/structured.ts` — reusable helper",
    "Serbian market targeting: Facebook/Instagram primary",
    "External service integration (Kie.ai, Cloudinary)",
    "Monorepo i18n design — when to split translation files",
    "**Payment idempotency:** status field + transaction",
    "Pattern reusable for any optional third-party API.",
    "Controlled component values in React are XSS-safe by default",
    "Reject premature release if a generation is in flight",
    "[[auth-onboarding]] — the routing rules live there",
    // Past the word cap, a phrase is more often a claim than a name.
    "Distributed system considerations around concurrent plan generation and locking",
  ])("keeps %s", (t) => {
    expect(isBareTopic(t)).toBe(false);
  });
});

describe("splitLegacyRelated", () => {
  it("moves content bullets under Details and drops topic names", () => {
    const r = splitLegacyRelated(LEGACY);
    expect(r).not.toBeNull();
    expect(r?.kept).toBe(3);
    expect(r?.dropped).toBe(2);
    expect(r?.content).not.toMatch(/^## Related/m);
    expect(r?.content).toContain(
      "## Details\n\n- `lib/ai/structured.ts` — reusable `generateStructured<T>` helper\n" +
        "- Supabase SQL to check for rogue triggers: `SELECT tgname FROM pg_trigger`\n" +
        "- Controlled component values in React are XSS-safe by default",
    );
    expect(r?.content).not.toContain("Supabase SSR authentication");
    expect(r?.content).not.toContain("[[auth-onboarding]]");
  });

  it("is a no-op on its own output", () => {
    const once = splitLegacyRelated(LEGACY);
    expect(once).not.toBeNull();
    expect(splitLegacyRelated(once?.content ?? "")).toBeNull();
  });

  it("returns null when there is no Related section", () => {
    expect(splitLegacyRelated("## Summary\n\nbody")).toBeNull();
  });

  it("removes a Related section of only topic names without adding Details", () => {
    const r = splitLegacyRelated(
      "## Summary\n\nbody\n\n## Related\n\n- Zod schema validation\n- [[x]]",
    );
    expect(r?.content).toBe("## Summary\n\nbody");
    expect(r?.kept).toBe(0);
    expect(r?.dropped).toBe(2);
  });

  it("keeps the section in place when it is not last", () => {
    const r = splitLegacyRelated(
      "## Summary\n\nbody\n\n## Related\n\n- `a.ts` — entry point\n\n## Context\n\nwhy",
    );
    expect(r?.content).toBe(
      "## Summary\n\nbody\n\n## Details\n\n- `a.ts` — entry point\n\n## Context\n\nwhy",
    );
  });

  it("keeps a topic bullet that has nested content, and non-bullet lines", () => {
    const r = splitLegacyRelated(
      [
        "## Related",
        "",
        "**Low-priority:**",
        "- Zod schema validation",
        "  - `schemas.ts` holds every AI output shape",
        "- Render free tier cold start mitigation",
      ].join("\n"),
    );
    expect(r?.content).toBe(
      [
        "## Details",
        "",
        "**Low-priority:**",
        "- Zod schema validation",
        "  - `schemas.ts` holds every AI output shape",
      ].join("\n"),
    );
    expect(r?.kept).toBe(1);
    expect(r?.dropped).toBe(1);
  });
});

function makeCfg(vaultPath: string): Config {
  return { vaultPath, outputDir: "vir", topicsDir: "topics" } as Config;
}

function stubProvider(): EmbeddingProvider {
  return {
    name: "ollama",
    modelName: "nomic-embed-text",
    dimensions: 3,
    maxInputChars: 100_000,
    available: async () => true,
    embedDoc: async () => ({ embedding: [1, 0, 0], truncated: false, sentChars: 0 }),
    embedQuery: async () => [1, 0, 0],
    provenance: () => ({ model: "nomic-embed-text", dim: 3 }),
  } as unknown as EmbeddingProvider;
}

describe("migrateLegacyRelated", () => {
  let vault: string;
  let db: StateDb;
  let writer: VaultWriter;
  let lockPath: string;

  const LIVE = "/proj/1c49a801-0000-0000-0000-000000000000.jsonl";
  const PRUNED = "/proj/2d2d2d2d-0000-0000-0000-000000000000.jsonl";
  const REJECTED = "/proj/3e3e3e3e-0000-0000-0000-000000000000.jsonl";
  const ARCHIVED = "/proj/4f4f4f4f-0000-0000-0000-000000000000.jsonl";
  const CLEAN = "/proj/5a5a5a5a-0000-0000-0000-000000000000.jsonl";

  function record(path: string, topic: string, content: string): void {
    db.record({
      path, hash: `h-${topic}`, skipped: false, notePaths: [], content,
      category: "decision", topic, project: "train", confidence: 0.9,
      startedAt: "2026-05-08T11:12:58.833Z",
    });
  }

  function noteFile(): string {
    const dir = join(vault, "vir", "decisions");
    const name = readdirSync(dir).find((f) => f.includes("1c49a801"));
    if (!name) throw new Error("no note for the live row");
    return join(dir, name);
  }

  beforeEach(() => {
    vault = mkdtempSync(join(tmpdir(), "vir-legacy-related-"));
    db = new StateDb(join(vault, "vir.db"));
    writer = new VaultWriter(makeCfg(vault), db, stubProvider());
    lockPath = join(vault, "vir.lock");
    record(LIVE, "auth onboarding routing", LEGACY);
    record(PRUNED, "pruned note", LEGACY);
    record(REJECTED, "rejected note", LEGACY);
    record(ARCHIVED, "archived note", LEGACY);
    record(CLEAN, "clean note", "## Summary\n\nno related here");
    db.markPruned(PRUNED, "agent-transcript");
    db.markRejected("3e3e3e3e-0000-0000-0000-000000000000");
    db.archive(ARCHIVED);
  });
  afterEach(() => {
    db.close();
    rmSync(vault, { recursive: true, force: true });
  });

  function contentOf(path: string): string {
    const row = db.listStoredContent().find((r) => r.path === path);
    if (!row) throw new Error(`no stored content for ${path}`);
    return row.content;
  }

  it("reports every non-archived row with a Related section", () => {
    const r = legacyRelatedCheck(db);
    expect(r.scanned).toBe(4);
    expect(r.rows.map((x) => [x.path, x.serving, x.kept, x.dropped]).sort()).toEqual(
      [
        [LIVE, true, 3, 2],
        [PRUNED, false, 3, 2],
        [REJECTED, false, 3, 2],
      ].sort(),
    );
  });

  it("migrates stored content, including rows that are not serving", async () => {
    const r = await migrateLegacyRelated(db, writer, { lockPath });
    expect(r).toEqual({ migrated: 3, rewritten: 1, errors: [] });
    for (const p of [LIVE, PRUNED, REJECTED]) {
      expect(contentOf(p)).toContain("## Details");
      expect(contentOf(p)).not.toMatch(/^## Related/m);
    }
    expect(legacyRelatedCheck(db).rows).toEqual([]);
  });

  it("leaves archived and Related-free rows alone", async () => {
    await migrateLegacyRelated(db, writer, { lockPath });
    expect(contentOf(CLEAN)).toBe("## Summary\n\nno related here");
    const archived = db.listStoredContent().find((r) => r.path === ARCHIVED);
    expect(archived).toBeUndefined();
  });

  it("re-renders the serving note with Details and neighbour-built Related", async () => {
    // The clean row, rendered and embedded, is the note's one neighbour.
    for (const path of [CLEAN, LIVE]) {
      const row = db.listDistilled().find((r) => r.path === path);
      if (!row) throw new Error(`no row for ${path}`);
      await writer.rewriteRow(row);
    }
    // What 0.12.0+ rewrites left on disk: the content bullets gone.
    expect(readFileSync(noteFile(), "utf8")).not.toContain("lib/ai/structured.ts");

    await migrateLegacyRelated(db, writer, { lockPath });
    const text = readFileSync(noteFile(), "utf8");
    expect(text).toContain("## Details\n\n- `lib/ai/structured.ts`");
    expect(text).not.toContain("Supabase SSR authentication");
    expect(text.indexOf("## Details")).toBeLessThan(text.indexOf("## Related"));
    // Related is the writer's own section: neighbour links only.
    const related = text.slice(text.indexOf("## Related"));
    expect(related).toContain("[[clean-note-5a5a5a5a|clean note]]");
    for (const l of related.split("\n").filter((x) => x.startsWith("- "))) {
      expect(l).toMatch(/^- \[\[[^\]]+\|[^\]]+\]\]$/);
    }
  });

  it("is idempotent: a second pass changes nothing", async () => {
    await migrateLegacyRelated(db, writer, { lockPath });
    const first = readFileSync(noteFile(), "utf8");
    const again = await migrateLegacyRelated(db, writer, { lockPath });
    expect(again).toEqual({ migrated: 0, rewritten: 0, errors: [] });
    expect(readFileSync(noteFile(), "utf8")).toBe(first);
  });

  it("does not write a file for a pruned row", async () => {
    await migrateLegacyRelated(db, writer, { lockPath });
    const dir = join(vault, "vir", "decisions");
    expect(readdirSync(dir).some((f) => f.includes("2d2d2d2d"))).toBe(false);
  });

  it("refuses to run while the pipeline lock is held", async () => {
    writeFileSync(lockPath, String(process.pid));
    await expect(migrateLegacyRelated(db, writer, { lockPath })).rejects.toThrow(
      LockHeldError,
    );
    expect(contentOf(LIVE)).toBe(LEGACY);
    expect(existsSync(lockPath)).toBe(true);
  });
});
