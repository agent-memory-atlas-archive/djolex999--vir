import { classifyTranscript } from "../../src/pipeline/projects.js";
import { classifyRow, type PruneRow } from "../../src/prune/classify.js";

// Agent-derived = the production prune classifier would demote the row, OR
// its transcript path is structurally a sidechain/workflow. The second clause
// covers merge winners: classifyRow keeps them because their sources are not
// recorded, but for a contamination COUNT the path is evidence enough. Rows
// with no evidence either way (null entrypoint, plain path) are not counted —
// the metric reports what can be shown, never what is suspected.
export function isAgentDerived(row: PruneRow, projectsDir: string): boolean {
  if (classifyRow(row, projectsDir).action === "prune") return true;
  return classifyTranscript(row.path, projectsDir) !== "session";
}

export function contaminationAtK(
  ranked: readonly string[],
  isAgent: (slug: string) => boolean,
  k: number,
): number {
  const top = ranked.slice(0, k);
  if (top.length === 0) return 0;
  return top.filter((s) => isAgent(s)).length / top.length;
}
