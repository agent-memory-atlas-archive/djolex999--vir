import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bundleVersion, parsePermission } from "./macNotifier.js";

const SOURCE_PLIST = readFileSync("native/notifier/Info.plist", "utf8");
const SHIPPED_PLIST = readFileSync("assets/Vir.app/Contents/Info.plist", "utf8");

describe("bundleVersion", () => {
  it("reads CFBundleVersion out of an Info.plist", () => {
    const plist = `<dict>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>7</string>
</dict>`;
    expect(bundleVersion(plist)).toBe("7");
  });

  it("is null when the key is missing", () => {
    expect(bundleVersion("<dict></dict>")).toBe(null);
  });
});

// The installed ~/.vir/Vir.app is replaced only when CFBundleVersion changes,
// so a source edit that isn't rebuilt (npm run build:notifier) or a rebuild
// without a version bump would ship silently stale.
describe("shipped Vir.app", () => {
  it("was built from the current native/notifier/Info.plist", () => {
    expect(SHIPPED_PLIST).toBe(SOURCE_PLIST);
  });

  it("posts as bundle id dev.vir.app, the id users have allowed", () => {
    expect(SHIPPED_PLIST).toMatch(
      /<key>CFBundleIdentifier<\/key>\s*<string>dev\.vir\.app<\/string>/,
    );
    expect(bundleVersion(SHIPPED_PLIST)).not.toBe(null);
  });
});

describe("parsePermission", () => {
  it("accepts the helper's three answers, ignoring the trailing newline", () => {
    expect(parsePermission("allowed\n")).toBe("allowed");
    expect(parsePermission("denied\n")).toBe("denied");
    expect(parsePermission("undetermined\n")).toBe("undetermined");
  });

  it("is null for anything else", () => {
    expect(parsePermission("")).toBe(null);
    expect(parsePermission("maybe")).toBe(null);
  });
});
