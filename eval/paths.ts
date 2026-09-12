import { homedir } from "node:os";
import { join } from "node:path";

// Every byte of eval data lives here, never in the repo (noLeak.test.ts). The
// repo is public; queries, labels, arm homes and run records carry private
// session content.
export const EVAL_DIR = join(homedir(), ".vir", "eval");
export const EVAL_QUERIES_PATH = join(EVAL_DIR, "queries.json");
export const EVAL_POOL_PATH = join(EVAL_DIR, "pool.json");
export const EVAL_LABELS_PATH = join(EVAL_DIR, "labels.json");
export const EVAL_SPOTCHECK_PATH = join(EVAL_DIR, "spotcheck.json");
// One HOME per arm: `<homes>/<armId>/.vir/{config.json, vir.db[, embedder/]}`.
// Arms run as child processes with HOME pointed here, so every production path
// constant (config, db, embedder, cost log, query log, lock) resolves inside
// the arm home and the real ~/.vir is never touched.
export const EVAL_HOMES_DIR = join(EVAL_DIR, "homes");
export const EVAL_RUNS_DIR = join(EVAL_DIR, "runs");
