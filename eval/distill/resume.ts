// A worker writes its output after every transcript, so a mid-run failure
// (a 400 on credit exhaustion cost the first run its 15th call) resumes
// from the partial file instead of re-billing what already succeeded.
export function pendingEntries<T extends { idx: number; skipped: string | null }>(
  classified: readonly T[],
  done: ReadonlyArray<{ idx: number }>,
): T[] {
  const have = new Set(done.map((d) => d.idx));
  return classified.filter((c) => c.skipped === null && !have.has(c.idx));
}
