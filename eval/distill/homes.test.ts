import { describe, expect, it } from "vitest";
import { buildDistillHomeConfig } from "./homes.js";

describe("buildDistillHomeConfig", () => {
  const raw = {
    vaultPath: "~/Vir",
    claudeProjectsDir: "~/.claude/projects",
    provider: "anthropic",
    anthropicApiKey: "sk-ant-secret",
    kieApiKey: "kie-secret",
    notifications: true,
    logQueries: true,
    models: { classify: "claude-haiku-4-5-20251001", distill: "claude-sonnet-5", distillFast: "claude-haiku-4-5" },
  };
  it("runs both arms on claude-cli with every secret stripped", () => {
    const cfg = buildDistillHomeConfig(raw, "/h/.vir/eval/distill/homes/control");
    expect(cfg["provider"]).toBe("claude-cli");
    expect(cfg).not.toHaveProperty("anthropicApiKey");
    expect(cfg).not.toHaveProperty("kieApiKey");
  });
  it("points the vault inside the arm home, turns embeddings, notifications and query log off, keeps models", () => {
    const cfg = buildDistillHomeConfig(raw, "/h/.vir/eval/distill/homes/control");
    expect(cfg["vaultPath"]).toBe("/h/.vir/eval/distill/homes/control/vault");
    expect(cfg["embeddingProvider"]).toBe("none");
    expect(cfg["notifications"]).toBe(false);
    expect(cfg["logQueries"]).toBe(false);
    expect(cfg["models"]).toEqual(raw.models);
    expect(String(cfg["claudeProjectsDir"]).startsWith("/")).toBe(true);
  });
});
