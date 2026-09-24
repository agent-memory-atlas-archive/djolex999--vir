import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, vi } from "vitest";

// Every ~/.vir path (daemon.log, cost.log, queries.jsonl, vir.lock, the
// claude-cli cwd) is derived from os.homedir() at module load, and on POSIX
// homedir() honors $HOME. Setup files run before each test file imports
// anything, so pointing $HOME at a throwaway dir here keeps the suite out of
// the real ~/.vir. Before this, `npm publish` (prepublishOnly → npm test)
// appended fixture runs to the real daemon.log.
const tmpHome = mkdtempSync(join(tmpdir(), "vir-test-home-"));
process.env.HOME = tmpHome;

// A test that exercises the failure path used to fire a real macOS
// "distill failures" notification on the developer's desktop.
vi.mock("./src/ui/notify.js", () => ({ notify: vi.fn() }));

afterAll(() => {
  rmSync(tmpHome, { recursive: true, force: true });
});
