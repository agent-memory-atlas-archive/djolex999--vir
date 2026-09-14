import { describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import * as paths from "./paths.js";

describe("distill A/B data paths", () => {
  it("every constant resolves under ~/.vir/eval", () => {
    const home = join(homedir(), ".vir", "eval");
    const entries = Object.entries(paths).filter((e): e is [string, string] => typeof e[1] === "string");
    expect(entries.length).toBeGreaterThan(5);
    for (const [name, value] of entries) expect(value.startsWith(home), `${name}=${value}`).toBe(true);
  });
  it("grades land at ~/.vir/eval/distill-grades.json as the task fixed", () => {
    expect(paths.DISTILL_GRADES_PATH).toBe(join(homedir(), ".vir", "eval", "distill-grades.json"));
  });
});
