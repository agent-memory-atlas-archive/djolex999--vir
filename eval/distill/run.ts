import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { REPO_ROOT } from "../repo.js";
import { distillHome, prepareDistillHomes, type HomeId } from "./homes.js";
import {
  DISTILL_CLASSIFICATIONS_PATH,
  DISTILL_HOMES_DIR,
  DISTILL_RUNS_DIR,
  DISTILL_SAMPLE_PATH,
} from "./paths.js";
import { CHALLENGER_MD_PATH, CONTROL_TEMPLATE, extractPromptTemplate, promptHash } from "./prompts.js";
import type { ClassifiedEntry } from "./worker.js";

const WORKER_JS = join(REPO_ROOT, "eval", "dist", "eval", "distill", "worker.js");
const RUBRIC_PATH = join(REPO_ROOT, "eval", "distill", "RUBRIC.md");

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function runWorker(homeId: HomeId, args: string[]): void {
  const home = distillHome(homeId);
  // Real HOME on purpose: claude -p reads its login from the Keychain there.
  const res = spawnSync(process.execPath, [WORKER_JS, "--homes", DISTILL_HOMES_DIR, "--home", home, ...args], {
    stdio: "inherit",
  });
  if (res.status !== 0) throw new Error(`worker ${homeId} ${args[1] ?? ""} exited ${res.status}`);
}

function gitInfo(): { sha: string; dirty: boolean } {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  return { sha, dirty: status.length > 0 };
}

// Anthropic list rates; the chars/4 estimate has run 1.1–1.9× under real
// tokenization on these transcripts, so the dry run states both ends.
const RATES: Record<string, { inp: number; out: number }> = {
  "claude-sonnet-5": { inp: 3, out: 15 },
  "claude-haiku-4-5": { inp: 1, out: 5 },
};

export async function runDistillAb(opts: { dryRun: boolean; reclassify: boolean; resumeDir?: string }): Promise<string> {
  if (!existsSync(WORKER_JS)) throw new Error(`${WORKER_JS} missing — run npm run eval:build`);
  if (!existsSync(DISTILL_SAMPLE_PATH)) throw new Error(`${DISTILL_SAMPLE_PATH} missing (Phase 1 sample)`);
  await prepareDistillHomes();

  if (opts.reclassify || !existsSync(DISTILL_CLASSIFICATIONS_PATH)) {
    if (opts.dryRun) {
      process.stdout.write("dry run: classify stage would run once in the shared home (≈15 Haiku calls)\n");
    } else {
      runWorker("shared", ["--stage", "classify", "--sample", DISTILL_SAMPLE_PATH, "--out", DISTILL_CLASSIFICATIONS_PATH]);
    }
  } else {
    process.stdout.write(`classifications cached: ${DISTILL_CLASSIFICATIONS_PATH}\n`);
  }

  if (opts.dryRun) {
    if (existsSync(DISTILL_CLASSIFICATIONS_PATH)) {
      const cls = JSON.parse(readFileSync(DISTILL_CLASSIFICATIONS_PATH, "utf8")) as ClassifiedEntry[];
      let lo = 0;
      let hi = 0;
      for (const c of cls) {
        if (c.skipped) continue;
        const r = RATES[c.model] ?? RATES["claude-sonnet-5"]!;
        const one = (c.distillTokens / 1e6) * r.inp + (1300 / 1e6) * r.out;
        lo += one;
        hi += one * 1.8;
      }
      process.stdout.write(`dry run: ${cls.filter((c) => !c.skipped).length} transcripts × 2 arms ≈ $${(2 * lo).toFixed(2)}–$${(2 * hi).toFixed(2)}\n`);
    }
    return "";
  }

  // --resume <dir>: keep the manifest and every arm's partial output; the
  // workers skip transcripts they already wrote. Never re-bills a success.
  const runDir = opts.resumeDir ?? join(DISTILL_RUNS_DIR, new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(runDir, { recursive: true });
  const challengerMd = readFileSync(CHALLENGER_MD_PATH, "utf8");
  if (opts.resumeDir) {
    if (!existsSync(join(runDir, "manifest.json"))) throw new Error(`${runDir} has no manifest.json`);
    process.stdout.write(`resuming ${runDir}\n`);
  } else {
  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    git: gitInfo(),
    samplePath: DISTILL_SAMPLE_PATH,
    sampleSha256: sha256(readFileSync(DISTILL_SAMPLE_PATH, "utf8")),
    rubricSha256: sha256(readFileSync(RUBRIC_PATH, "utf8")),
    prompts: {
      control: promptHash(CONTROL_TEMPLATE),
      challenger: promptHash(extractPromptTemplate(challengerMd)),
      challengerFileSha256: sha256(challengerMd),
    },
    classificationsPath: DISTILL_CLASSIFICATIONS_PATH,
  };
  writeFileSync(join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
  for (const arm of ["control", "challenger"] as const) {
    runWorker(arm, [
      "--stage", "distill", "--arm", arm,
      "--classifications", DISTILL_CLASSIFICATIONS_PATH,
      "--challenger", CHALLENGER_MD_PATH,
      "--out", join(runDir, `${arm}.json`),
    ]);
  }
  process.stdout.write(`run written → ${runDir}\n`);
  return runDir;
}

export function latestRunDir(): string {
  if (!existsSync(DISTILL_RUNS_DIR)) throw new Error("no runs yet");
  const dirs = execFileSync("ls", [DISTILL_RUNS_DIR], { encoding: "utf8" }).split("\n").filter(Boolean).sort();
  const last = dirs[dirs.length - 1];
  if (!last) throw new Error("no runs yet");
  return join(DISTILL_RUNS_DIR, last);
}
