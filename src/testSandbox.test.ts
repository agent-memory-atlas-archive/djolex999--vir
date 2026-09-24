import { homedir, tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { DAEMON_LOG_PATH } from "./config.js";
import { notify } from "./ui/notify.js";

// Pins vitest.setup.ts: if the sandbox is ever dropped from setupFiles, the
// suite goes back to writing the developer's real ~/.vir and firing real
// desktop notifications on every `npm test` and every `npm publish`.
describe("test sandbox", () => {
  it("runs with $HOME inside the temp dir, so ~/.vir paths never hit the real one", () => {
    expect(homedir().startsWith(tmpdir())).toBe(true);
    expect(DAEMON_LOG_PATH.startsWith(tmpdir())).toBe(true);
  });

  it("stubs desktop notifications", () => {
    expect(notify).not.toBe(undefined);
    expect("mock" in notify).toBe(true);
  });
});
