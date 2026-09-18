import { describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { ARMS, armById } from "./arms.js";
import { buildArmConfig } from "./homes.js";

const raw = {
  vaultPath: "~/Vir",
  outputDir: "vir",
  claudeProjectsDir: "~/.claude/projects",
  articlesDir: "~/Documents/raw",
  provider: "anthropic",
  anthropicApiKey: "sk-ant-secret",
  kieApiKey: "kie-secret",
  retrievalDiversity: 0.3,
  logQueries: true,
  models: { classify: "x", distill: "y" },
};

describe("buildArmConfig", () => {
  it("strips every secret and switches provider to the keyless one", () => {
    const cfg = buildArmConfig(raw, armById("nomic"), 0.3);
    expect(cfg).not.toHaveProperty("anthropicApiKey");
    expect(cfg).not.toHaveProperty("kieApiKey");
    expect(cfg["provider"]).toBe("claude-cli");
  });

  it("rewrites every path to absolute using the PARENT's home", () => {
    const cfg = buildArmConfig(raw, armById("nomic"), 0.3);
    const h = homedir();
    expect(cfg["vaultPath"]).toBe(`${h}/Vir`);
    expect(cfg["claudeProjectsDir"]).toBe(`${h}/.claude/projects`);
    expect(cfg["articlesDir"]).toBe(`${h}/Documents/raw`);
  });

  it("sets provider and diversity per arm; MMR off means diversity 0", () => {
    expect(buildArmConfig(raw, armById("tfidf"), 0.3)["embeddingProvider"]).toBe("none");
    expect(buildArmConfig(raw, armById("tfidf"), 0.3)["retrievalDiversity"]).toBe(0);
    expect(buildArmConfig(raw, armById("nomic"), 0.3)["retrievalDiversity"]).toBe(0);
    expect(buildArmConfig(raw, armById("nomic-mmr"), 0.3)["retrievalDiversity"]).toBe(0.3);
    expect(buildArmConfig(raw, armById("bge-mmr"), 0.3)["embeddingProvider"]).toBe("local");
  });

  it("never lets an arm write the query log", () => {
    for (const arm of ARMS) {
      expect(buildArmConfig(raw, arm, 0.3)["logQueries"]).toBe(false);
    }
  });

  it("does not mutate its input", () => {
    const copy = structuredClone(raw);
    buildArmConfig(raw, armById("bge"), 0.3);
    expect(raw).toEqual(copy);
  });
});

describe("ARMS", () => {
  it("has the five runnable arms with unique ids", () => {
    expect(ARMS.map((a) => a.id)).toEqual([
      "tfidf",
      "nomic",
      "nomic-mmr",
      "bge",
      "bge-mmr",
    ]);
  });
  it("armById throws on an unknown id", () => {
    expect(() => armById("bm25")).toThrow(/unknown arm/);
  });
});
