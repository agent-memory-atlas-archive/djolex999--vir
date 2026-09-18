// Child-process entry for one arm. Runs with HOME pointed at the arm home, so
// every production path constant below resolves inside it. Reads config and
// DB the way the MCP server does (read-only), calls the production retriever,
// and writes one JSON file. Nothing else.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { CONFIG_PATH, STATE_PATH, loadConfig } from "../src/config.js";
import { LOCAL_PROVIDER_DIR } from "../src/search/localProvider.js";
import { loadIndex, searchWithOutcome, vaultRoot } from "../src/search/retriever.js";
import { StateDb } from "../src/state/db.js";
import type { ArmQueryResult, ArmRunOutput, QuerySet } from "./types.js";

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`armWorker: missing --${name}`);
  return v;
}

async function main(): Promise<void> {
  const armId = arg("arm");
  const queriesPath = arg("queries");
  const limit = Number.parseInt(arg("limit"), 10);
  const outPath = arg("out");
  if (!Number.isInteger(limit) || limit < 1) throw new Error("armWorker: --limit must be ≥ 1");

  const set = JSON.parse(readFileSync(queriesPath, "utf8")) as QuerySet;
  const cfg = loadConfig();
  const db = new StateDb(STATE_PATH, { readonly: true });
  const results: ArmQueryResult[] = [];
  try {
    for (const q of set.queries) {
      const t0 = Date.now();
      const o = await searchWithOutcome(cfg, db, q.text, limit);
      results.push({
        queryId: q.id,
        method: o.method,
        degraded: o.degraded,
        embedError: o.embedError,
        noProvider: o.noProvider,
        candidates: o.candidates,
        excludedMismatched: o.excludedMismatched,
        provider: o.provider,
        latencyMs: Date.now() - t0,
        hits: o.hits.map((h) => ({ slug: h.title, score: h.score })),
      });
    }
  } finally {
    db.close();
  }
  // What each path could see: TF-IDF walks files, embedding reads DB rows.
  const root = vaultRoot(cfg);
  const dbRead = new StateDb(STATE_PATH, { readonly: true });
  let embeddingRows: Record<string, number> = {};
  try {
    const rows = [
      ...dbRead.getEmbeddings(root),
      ...dbRead.getArticleEmbeddings(),
      ...dbRead.getTopicEmbeddings(root, cfg.topicsDir),
      ...dbRead.getPdfEmbeddings(),
    ];
    embeddingRows = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.embeddingModel] = (acc[r.embeddingModel] ?? 0) + 1;
      return acc;
    }, {});
  } finally {
    dbRead.close();
  }
  const out: ArmRunOutput = {
    armId,
    limit,
    corpus: { walkedFiles: loadIndex(cfg).length, embeddingRows },
    home: homedir(),
    dbPath: STATE_PATH,
    configPath: CONFIG_PATH,
    embedderDir: LOCAL_PROVIDER_DIR,
    results,
  };
  writeFileSync(outPath, JSON.stringify(out), "utf8");
}

main().catch((err: unknown) => {
  process.stderr.write(`armWorker failed: ${(err as Error).stack ?? String(err)}\n`);
  process.exit(1);
});
