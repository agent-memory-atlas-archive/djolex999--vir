// Renders the vir logo SVG onto a macOS-style rounded-square tile.
// usage: icon <logo.svg> <out.png> <pixels>
import AppKit

let args = CommandLine.arguments
guard args.count == 4, let size = Double(args[3]).map({ CGFloat($0) }) else {
    fatalError("usage: icon <logo.svg> <out.png> <pixels>")
}
guard let logo = NSImage(contentsOfFile: args[1]) else { fatalError("cannot load \(args[1])") }

let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size),
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

// Apple's icon grid: an 824/1024 body with a ~185/1024 corner radius.
let inset = size * 100 / 1024
let body = NSRect(x: inset, y: inset, width: size - 2 * inset, height: size - 2 * inset)
let tile = NSBezierPath(roundedRect: body, xRadius: size * 185 / 1024, yRadius: size * 185 / 1024)
NSGradient(
    starting: NSColor(srgbRed: 0.10, green: 0.08, blue: 0.20, alpha: 1),
    ending: NSColor(srgbRed: 0.03, green: 0.03, blue: 0.08, alpha: 1))!
    .draw(in: tile, angle: -90)
logo.draw(in: body.insetBy(dx: body.width * 0.06, dy: body.width * 0.06))

NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
