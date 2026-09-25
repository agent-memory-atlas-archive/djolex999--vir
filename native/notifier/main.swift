// vir-notifier: posts desktop notifications as "vir" (with the vir icon)
// instead of osascript's "Script Editor". Lives inside Vir.app so macOS
// attributes notifications to the bundle id dev.vir.app.
//
//   vir-notifier notify <title> <message>   exit 0 delivered, 3 not allowed
//   vir-notifier status                     prints allowed | denied | undetermined
//   vir-notifier request                    asks for permission, prints the result
//
// `notify` never asks for permission: a daemon run has nobody at the keyboard,
// and a permission prompt withdrawn by an exiting process is recorded by macOS
// as a denial. Only the interactive `request` (vir notifications) asks.

import Foundation
import UserNotifications

let EXIT_ERROR: Int32 = 1
let EXIT_USAGE: Int32 = 2
let EXIT_NOT_ALLOWED: Int32 = 3

let center = UNUserNotificationCenter.current()

func die(_ message: String, _ code: Int32) -> Never {
    FileHandle.standardError.write("vir-notifier: \(message)\n".data(using: .utf8)!)
    exit(code)
}

// Bridges a completion-handler API to a blocking call; the handlers fire on a
// background queue, so the main thread can wait on the semaphore.
func block<T>(timeout: TimeInterval, _ body: (@escaping (T) -> Void) -> Void) -> T {
    let done = DispatchSemaphore(value: 0)
    var result: T?
    body { value in
        result = value
        done.signal()
    }
    if done.wait(timeout: .now() + timeout) == .timedOut {
        die("timed out after \(Int(timeout))s", EXIT_ERROR)
    }
    return result!
}

func authorizationStatus() -> UNAuthorizationStatus {
    block(timeout: 10) { resolve in
        center.getNotificationSettings { resolve($0.authorizationStatus) }
    }
}

func label(_ status: UNAuthorizationStatus) -> String {
    switch status {
    case .authorized, .provisional: return "allowed"
    case .denied: return "denied"
    case .notDetermined: return "undetermined"
    @unknown default: return "undetermined"
    }
}

let args = Array(CommandLine.arguments.dropFirst())

switch args.first {
case "notify":
    guard args.count >= 3 else { die("usage: vir-notifier notify <title> <message>", EXIT_USAGE) }
    let status = authorizationStatus()
    guard status == .authorized || status == .provisional else {
        die("notifications are \(label(status)) for vir", EXIT_NOT_ALLOWED)
    }
    let content = UNMutableNotificationContent()
    content.title = args[1]
    content.body = args[2]
    content.sound = .default
    let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
    let error: Error? = block(timeout: 10) { resolve in center.add(request) { resolve($0) } }
    if let error { die("delivery failed: \(error.localizedDescription)", EXIT_ERROR) }

case "status":
    print(label(authorizationStatus()))

case "request":
    // The prompt stays on screen only while this process lives, so wait long
    // enough for a person to find it and click Allow. An error means macOS
    // already has an answer (usually "denied"); the status query reports it.
    let granted: Bool = block(timeout: 600) { resolve in
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in resolve(granted) }
    }
    print(granted ? "allowed" : label(authorizationStatus()))

default:
    die("usage: vir-notifier notify <title> <message> | status | request", EXIT_USAGE)
}
