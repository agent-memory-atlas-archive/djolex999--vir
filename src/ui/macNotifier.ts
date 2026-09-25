import { spawnSync } from "node:child_process";
import { cpSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VIR_DIR } from "../config.js";

// macOS attributes an osascript notification to "Script Editor". Vir.app
// (native/notifier, prebuilt into assets/) posts them as "vir" with the vir
// icon instead. It is copied to ~/.vir/Vir.app so its path survives npm
// upgrades, since macOS keys the Allow decision to the bundle id dev.vir.app.

export type NotifierPermission = "allowed" | "denied" | "undetermined";

// dist/ui/macNotifier.js → <package root>/assets/Vir.app
const BUNDLED_APP = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "assets",
  "Vir.app",
);
export const INSTALLED_APP = join(VIR_DIR, "Vir.app");
const EXECUTABLE = join(INSTALLED_APP, "Contents", "MacOS", "vir-notifier");
const LSREGISTER =
  "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

export function bundleVersion(infoPlist: string): string | null {
  const m = /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/.exec(
    infoPlist,
  );
  return m?.[1] ?? null;
}

export function parsePermission(stdout: string): NotifierPermission | null {
  const s = stdout.trim();
  return s === "allowed" || s === "denied" || s === "undetermined" ? s : null;
}

function readBundleVersion(app: string): string | null {
  try {
    return bundleVersion(
      readFileSync(join(app, "Contents", "Info.plist"), "utf8"),
    );
  } catch {
    return null;
  }
}

/**
 * Installs (or upgrades) ~/.vir/Vir.app from the copy shipped in the package
 * and registers it with LaunchServices. Without registration the notification
 * daemon can't resolve dev.vir.app and rejects it as "not allowed", so this
 * re-registers on every call (~30ms): cheap insurance against a rebuilt
 * LaunchServices database. Returns false off macOS or when the package has no
 * helper (a source checkout that never ran npm run build:notifier).
 */
export function ensureNotifierApp(): boolean {
  if (process.platform !== "darwin") return false;
  const bundled = readBundleVersion(BUNDLED_APP);
  if (bundled === null) return false;
  if (readBundleVersion(INSTALLED_APP) !== bundled) {
    rmSync(INSTALLED_APP, { recursive: true, force: true });
    cpSync(BUNDLED_APP, INSTALLED_APP, { recursive: true });
  }
  spawnSync(LSREGISTER, ["-f", INSTALLED_APP], { stdio: "ignore" });
  return true;
}

/**
 * Posts through Vir.app. False means "use the fallback": no helper, or the
 * user hasn't allowed vir yet. Never prompts for permission (see main.swift).
 */
export function notifyViaApp(title: string, message: string): boolean {
  if (!ensureNotifierApp()) return false;
  const r = spawnSync(EXECUTABLE, ["notify", title, message], {
    stdio: "ignore",
    timeout: 15_000,
  });
  return r.status === 0;
}

export function notifierPermission(): NotifierPermission | null {
  if (!ensureNotifierApp()) return null;
  const r = spawnSync(EXECUTABLE, ["status"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  return r.status === 0 ? parsePermission(r.stdout) : null;
}

/**
 * Shows the macOS "vir would like to send notifications" prompt and blocks
 * until the user answers (the helper gives up after 10 minutes). Interactive
 * commands only: an unanswered prompt is withdrawn when the helper exits and
 * macOS then records a denial.
 */
export function requestNotifierPermission(): NotifierPermission | null {
  if (!ensureNotifierApp()) return null;
  const r = spawnSync(EXECUTABLE, ["request"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return r.status === 0 ? parsePermission(r.stdout) : null;
}
