import {
  notifierPermission,
  notifyViaApp,
  requestNotifierPermission,
} from "../ui/macNotifier.js";
import * as ui from "../ui/display.js";

/**
 * `vir notifications` (and the tail of `vir init`): installs Vir.app and walks
 * the user through macOS's one-time Allow prompt while they're at the
 * keyboard. The daemon never prompts: an unanswered prompt becomes a denial.
 */
export function setupNotifications(opts: { test: boolean }): void {
  if (process.platform !== "darwin") {
    ui.row(ui.muted(ui.BULLET), ui.text("nothing to set up on this platform"));
    return;
  }

  let permission = notifierPermission();
  if (permission === "undetermined") {
    ui.row(
      ui.accent(ui.ARROW),
      ui.text("macOS will ask to allow notifications from vir: click Allow"),
      ui.dim("(hover the banner → Options if no button shows)"),
    );
    permission = requestNotifierPermission();
  }

  switch (permission) {
    case "allowed":
      ui.row(ui.success(ui.CHECK), ui.text("notifications allowed for vir"));
      if (opts.test && !notifyViaApp("vir", "Notifications are on.")) {
        ui.row(ui.warn(ui.WARN_GLYPH), ui.text("test notification failed"));
      }
      return;
    case "denied":
    case "undetermined":
      ui.row(
        ui.warn(ui.WARN_GLYPH),
        ui.text("notifications are off for vir"),
        ui.dim("System Settings → Notifications → vir → Allow Notifications"),
      );
      return;
    case null:
      ui.row(
        ui.warn(ui.WARN_GLYPH),
        ui.text("vir helper unavailable, falling back to Script Editor banners"),
      );
  }
}
