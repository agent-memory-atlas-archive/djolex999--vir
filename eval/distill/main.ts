// `npm run distill:ab -- <command>` and `npm run distill:grade`. Experiment
// code: never a vir command, never shipped (eval/ compiles to eval/dist).
import { buildAndWriteGradingSet } from "./gradingSetIo.js";
import { runGrader } from "./grade.js";
import { prepareDistillHomes } from "./homes.js";
import { runJudge } from "./judgeRun.js";
import { writeReport } from "./reportRun.js";
import { latestRunDir, runDistillAb } from "./run.js";

const DEFAULT_SEED = 20260915;

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function opt(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const USAGE = `usage: npm run distill:ab -- <command>

  homes         prepare shared/control/challenger homes under ~/.vir/eval/distill/homes [--refresh]
  run           classify once, then distill every sample transcript under both arms [--dry-run] [--reclassify] [--resume <dir>]
  grading-set   shuffle the latest run into opaque-id notes + sealed mapping [--seed N] [--refresh]
  judge         model preview of the rubric (sealed, not shown)
  report        unblind and write <run>/report.md (requires every note graded)

  npm run distill:grade   grade the notes one at a time`;

async function main(): Promise<void> {
  const cmd = process.argv[2];
  const seed = Number.parseInt(opt("seed") ?? String(DEFAULT_SEED), 10);
  switch (cmd) {
    case "homes":
      await prepareDistillHomes({ refresh: flag("refresh") });
      return;
    case "run":
      await runDistillAb({ dryRun: flag("dry-run"), reclassify: flag("reclassify"), resumeDir: opt("resume") });
      return;
    case "grading-set":
      buildAndWriteGradingSet(opt("run") ?? latestRunDir(), seed, flag("refresh"));
      return;
    case "grade":
      await runGrader();
      return;
    case "judge":
      await runJudge();
      return;
    case "report":
      process.stdout.write(writeReport());
      return;
    default:
      process.stderr.write(`${USAGE}\n`);
      process.exit(cmd ? 2 : 0);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`distill:ab failed: ${(err as Error).stack ?? String(err)}\n`);
  process.exit(1);
});
