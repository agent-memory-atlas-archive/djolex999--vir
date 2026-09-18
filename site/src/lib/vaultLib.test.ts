import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearGenerated, withNoteCount } from "../../scripts/vault-lib.mjs";

describe("clearGenerated", () => {
  it("removes only the generated category folders and keeps the hand-written index", () => {
    const out = mkdtempSync(join(tmpdir(), "vault-"));
    writeFileSync(join(out, "index.md"), "hand written");
    mkdirSync(join(out, "patterns"));
    writeFileSync(join(out, "patterns", "old-note.md"), "stale");
    mkdirSync(join(out, "decisions"));
    mkdirSync(join(out, "drafts"));
    writeFileSync(join(out, "drafts", "keep.md"), "not generated");

    clearGenerated(out, ["patterns", "gotchas", "decisions", "tools"]);

    expect(readFileSync(join(out, "index.md"), "utf8")).toBe("hand written");
    expect(existsSync(join(out, "patterns"))).toBe(false);
    expect(existsSync(join(out, "decisions"))).toBe(false);
    expect(existsSync(join(out, "drafts", "keep.md"))).toBe(true);
  });

  it("is a no-op on a missing output directory", () => {
    expect(() => clearGenerated(join(tmpdir(), "vault-does-not-exist-xyz"), ["patterns"])).not.toThrow();
  });
});

describe("withNoteCount", () => {
  it("writes the measured count into the index claim", () => {
    const md = "intro\n\nhere it is: **43 notes vir wrote about vir**, distilled\n";
    expect(withNoteCount(md, 40)).toBe("intro\n\nhere it is: **40 notes vir wrote about vir**, distilled\n");
  });
  it("throws when the claim is missing, so the number cannot drift silently", () => {
    expect(() => withNoteCount("no claim here", 40)).toThrow(/notes vir wrote about vir/);
  });
});
