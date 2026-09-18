// Helpers for build-vault.mjs, split out so they can be tested.
import { rmSync } from "node:fs";
import { join } from "node:path";

// Clear only what the build generates. The vault index page is hand-written
// and lives in the same directory; a blanket rm deleted it on every rebuild.
export function clearGenerated(outDir, categoryDirs) {
  for (const dir of categoryDirs) rmSync(join(outDir, dir), { recursive: true, force: true });
}

const CLAIM = /\*\*\d+ notes vir wrote about vir\*\*/;

// The count on the index is a claim on a public page, so it is derived from
// the build, never typed. A missing claim throws rather than drifting quietly.
export function withNoteCount(indexMd, count) {
  if (!CLAIM.test(indexMd)) {
    throw new Error('vault index is missing the "**N notes vir wrote about vir**" claim');
  }
  return indexMd.replace(CLAIM, `**${count} notes vir wrote about vir**`);
}
