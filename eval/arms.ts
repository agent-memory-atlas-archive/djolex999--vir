import type { EmbeddingProviderChoice } from "../src/search/provider.js";

// An arm is a production configuration, nothing more: which provider the
// retriever resolves and whether MMR reorders the pool. The retriever itself
// is never reimplemented here — an arm runs `searchWithOutcome` in a child
// process whose HOME holds the arm's config and DB copy (homes.ts).
//
// TF-IDF has no MMR arm because production applies MMR in the embedding path
// only (config.ts: "TF-IDF is too sparse to benefit"); a second TF-IDF arm
// would measure the same system twice.
//
// C4 hybrid and C5 re-rank plug in as new ArmSpec entries once the retriever
// exposes them as config; the harness needs no change.
export interface ArmSpec {
  id: string;
  provider: EmbeddingProviderChoice;
  mmr: boolean;
  label: string;
}

export const ARMS: readonly ArmSpec[] = [
  { id: "tfidf", provider: "none", mmr: false, label: "TF-IDF (no provider)" },
  { id: "nomic", provider: "ollama", mmr: false, label: "nomic-embed-text, MMR off" },
  { id: "nomic-mmr", provider: "ollama", mmr: true, label: "nomic-embed-text, MMR on" },
  { id: "bge", provider: "local", mmr: false, label: "bge-small-en-v1.5, MMR off" },
  { id: "bge-mmr", provider: "local", mmr: true, label: "bge-small-en-v1.5, MMR on" },
];

export function armById(id: string): ArmSpec {
  const arm = ARMS.find((a) => a.id === id);
  if (!arm) throw new Error(`unknown arm: ${id} (known: ${ARMS.map((a) => a.id).join(", ")})`);
  return arm;
}
