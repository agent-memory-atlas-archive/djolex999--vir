# Retrieval eval harness

Every retrieval change produces a number, not an impression. Roadmap v7 rule 5
("measure before building in Track C"). Gates C4 (prune), C6 (hybrid ranking),
C7 (Haiku re-rank), C8 (time decay), MMR tuning, and the bge garbage-query
threshold.

## Rules the code enforces

- **Code here, data in `~/.vir/eval/`.** The repo is public; queries, labels,
  arm homes and run records carry session content. `noLeak.test.ts` fails if
  any path constant leaves `~/.vir/eval` or git tracks anything that looks
  like eval data. `.gitignore` covers `eval/dist/` and `eval/data/`.
- **Never ships.** `package.json` `files` whitelists `dist/`; this tree
  compiles to `eval/dist/`. Not a `vir` command.
- **Read-only against the real vault and `~/.vir/vir.db`.** Each arm runs in a
  child process with `HOME` set to `~/.vir/eval/homes/<arm>/`, which holds a
  config copy (secrets stripped, paths absolute, query log off) and a
  `vir.db` copy made through SQLite's backup API. Every production path
  constant (`config.ts` `VIR_DIR`, `localProvider.ts` `LOCAL_PROVIDER_DIR`,
  `cost/log.ts`, `search/queryLog.ts`, `pipeline/lock.ts`) derives from
  `os.homedir()`, which honors `HOME`; `runArm.ts` refuses a worker's output
  unless the child reports all of them inside its arm home.
- **Measures the real system.** Arms call `searchWithOutcome` from
  `src/search/retriever.ts`. The bge arm's vectors are written by the
  production `vir embed --force` under the arm's HOME. No ranking is
  reimplemented here.
- **LLM calls run in the parent** (real `HOME`, real `claude -p` auth) and
  land in `~/.vir/cost.log` under `eval-label` / `eval-query-gen` with
  `estimated_cost_usd: null` (subscription quota, per the 0.17.0 convention).

## Commands

```
npm run eval -- queries   [--seed N] [--dry-run]   # build the query set
npm run eval -- homes     [--arm id] [--refresh]   # arm homes (+ bge install/embed)
npm run eval -- pool                               # every arm at top-20 → pooled candidates
npm run eval -- label     [--seed N] [--dry-run]   # judge pooled pairs (dry run: calls + tokens)
npm run eval:spotcheck                             # blind human grading, agreement report
npm run eval -- show      [--per-class N]          # labeled queries with grades and arm ranks
npm run eval -- run       [--seed N]               # every arm at top-8 → ~/.vir/eval/runs/<ts>.json
npm run eval -- arms
```

## Metrics (`metrics/`, all TDD with hand-computed fixtures)

Per arm, per query class, at K = 8 (the `vir query` default):

- **nDCG@8**, gain 2^grade − 1, ideal from the query's full judged pool.
- **recall@8**: share of judged-relevant (grade ≥ 1) notes in the top 8.
- **MRR**: 1/rank of the first relevant hit in the top 8.
- **unjudged@8**: share of the top 8 with no label at all (pool-depth honesty;
  unlabeled counts as 0 in the metrics above).
- **contamination@8**: share of the top 8 whose session row the production
  prune classifier would demote, or whose transcript path is a sidechain or
  workflow (`prune/classify.ts`, `pipeline/projects.ts`). Rows with no
  evidence either way are not counted.
- **garbage**: share of garbage queries returning any hit, split into "passed
  the embedding floor" and "served by the TF-IDF fallback".

A query with no relevant judged note is undefined for nDCG/recall/MRR and
excluded (`n` per class says how many counted), never scored 0.

Arm differences carry a paired bootstrap 95% CI over per-query differences
(2000 rounds, seeded). A CI that crosses zero is reported as no detectable
difference; arms are not ranked on it. Baseline is `nomic-mmr`, production's
own configuration.

The run record carries git SHA and dirty flag, K, seed, hashes of the query
set, label file and rubric, spot-check agreement, per-arm corpus sizes and
embedding provenance, method split, every per-query number, every
comparison, and each arm's config snapshot. `eval:diff` waits for a second run.

## Query classes

| class | source | tests |
|---|---|---|
| `real` | `~/.vir/queries.jsonl` before `REAL_CUTOFF`, near-duplicates collapsed (Jaccard ≥ 0.6 on retriever tokens) | what people actually ask; report-only until ≥ 20 |
| `identifier` | one or two inline-code identifiers from a sampled live note | lexical recall |
| `conceptual` | `claude -p` paraphrase of a sampled note in the real queries' style, rejected if it shares a rare title token (df/N ≤ 0.05) | semantic recall without lexical leakage |
| `garbage` | fixed out-of-domain list in `queries/garbage.ts` | false positives above each model's floor |

Sampling is seeded (`--seed`, default 20260911). Sources are notes with a live
DB row in a category dir, so every arm can reach them.

## Labels

TREC-style pooling: the union of each arm's top-20 per query. Graded 0/1/2 by
`claude-sonnet-5` against `labels/rubric.md`, at most 10 candidates per call in
seeded-shuffled order. A label is keyed by `queryId | slug @ sha256(content)[:12]`
and carries the rubric hash: an edited note or rubric invalidates it, and a
re-run judges only what changed. The spot-check is the anchor: model labels
agreeing with themselves are correlation, not verification.

## Arms

`tfidf`, `nomic`, `nomic-mmr`, `bge`, `bge-mmr`. TF-IDF has no MMR arm because
production applies MMR in the embedding path only. New arms (hybrid, re-rank)
are `ArmSpec` entries once the retriever exposes them as config.
