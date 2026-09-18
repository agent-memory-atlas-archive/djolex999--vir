export type Score = 0 | 1 | 2;
export type Scores = [Score, Score, Score, Score, Score];

export interface GradeRecord {
  id: string;
  scores: Scores;
  note: string | null;
  ts: string;
}

export interface GradeStore {
  version: 1;
  rubricSha256: string;
  grades: GradeRecord[];
}

// "2 1 0 2 1" or "21021"; anything else is null so the grader re-prompts.
export function parseScores(line: string): Scores | null {
  const t = line.trim();
  const parts = /^[012]{5}$/.test(t) ? t.split("") : t.split(/\s+/);
  if (parts.length !== 5) return null;
  const nums = parts.map((p) => (/^[012]$/.test(p) ? (Number(p) as Score) : null));
  if (nums.some((n) => n === null)) return null;
  return nums as Scores;
}

export function upsertGrade(store: GradeStore, rec: GradeRecord): GradeStore {
  const rest = store.grades.filter((g) => g.id !== rec.id);
  const idx = store.grades.findIndex((g) => g.id === rec.id);
  const grades = idx >= 0 ? [...store.grades.slice(0, idx), rec, ...store.grades.slice(idx + 1)] : [...rest, rec];
  return { ...store, grades };
}
