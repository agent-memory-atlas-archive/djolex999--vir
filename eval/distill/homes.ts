import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_PATH, expandHome } from "../../src/config.js";
import { copyDb } from "../prepareHomes.js";
import { DISTILL_HOMES_DIR } from "./paths.js";

export const HOME_IDS = ["shared", "control", "challenger"] as const;
export type HomeId = (typeof HOME_IDS)[number];

export function distillHome(id: HomeId): string {
  return join(DISTILL_HOMES_DIR, id);
}

const PATH_KEYS = ["claudeProjectsDir", "articlesDir", "pdfsDir"] as const;

// Unlike the retrieval arms, these children DO call the LLM, so the API key
// stays in the copy (0600, inside ~/.vir/eval which is 0700). The vault is
// the home's own; embeddings are off so Ollama cannot add variance; no
// notifications, no query log.
export function buildDistillHomeConfig(raw: Record<string, unknown>, home: string): Record<string, unknown> {
  const cfg: Record<string, unknown> = { ...raw };
  for (const k of PATH_KEYS) {
    const v = cfg[k];
    if (typeof v === "string") cfg[k] = expandHome(v);
  }
  cfg["vaultPath"] = join(home, "vault");
  cfg["embeddingProvider"] = "none";
  cfg["notifications"] = false;
  cfg["logQueries"] = false;
  cfg["distillArticles"] = false;
  cfg["distillPdfs"] = false;
  return cfg;
}

export async function prepareDistillHomes(opts: { refresh?: boolean } = {}): Promise<void> {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as Record<string, unknown>;
  for (const id of HOME_IDS) {
    const home = distillHome(id);
    const virDir = join(home, ".vir");
    mkdirSync(virDir, { recursive: true });
    mkdirSync(join(home, "vault"), { recursive: true });
    const cfgPath = join(virDir, "config.json");
    const dbPath = join(virDir, "vir.db");
    if (opts.refresh || !existsSync(cfgPath)) {
      writeFileSync(cfgPath, JSON.stringify(buildDistillHomeConfig(raw, home), null, 2));
      chmodSync(cfgPath, 0o600);
      process.stdout.write(`[${id}] config written → ${cfgPath}\n`);
    }
    if (opts.refresh || !existsSync(dbPath)) {
      await copyDb(dbPath);
      process.stdout.write(`[${id}] db copied → ${dbPath}\n`);
    }
  }
}
