import { spawnSync } from "node:child_process";

// Desktop notification, platform-aware and best-effort. macOS uses osascript;
// Linux uses notify-send when present; every other platform silently skips.
// All paths use spawnSync arg-arrays (no shell, no injection) and the whole
// thing is wrapped so a notification failure never crashes the pipeline.
export function notify(title: string, message: string): void {
  try {
    if (process.platform === "darwin") {
      const safeTitle = escapeAppleScript(title);
      const safeMessage = escapeAppleScript(message);
      spawnSync(
        "osascript",
        [
          "-e",
          `display notification "${safeMessage}" with title "${safeTitle}" sound name "Glass"`,
        ],
        { stdio: "ignore" },
      );
    } else if (process.platform === "linux") {
      const which = spawnSync("which", ["notify-send"], { stdio: "ignore" });
      if (which.status === 0) {
        spawnSync("notify-send", [title, message], { stdio: "ignore" });
      }
    }
    // win32 + everything else: no notification mechanism, skip silently.
  } catch {
    // notification failure must never crash the pipeline
  }
}

function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
