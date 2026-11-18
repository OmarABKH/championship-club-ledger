import PDFKit
import AppKit
// Usage: render file.pdf page out.png [x0 y0 x1 y1 as fractions from top-left]
let a = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: a[1]))!
let page = doc.page(at: Int(a[2])! - 1)!
let b = page.bounds(for: .mediaBox)
let img = page.thumbnail(of: NSSize(width: b.width * 2.2, height: b.height * 2.2), for: .mediaBox)
var cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil)!
if a.count > 7 {
  let w = CGFloat(cg.width), h = CGFloat(cg.height)
  let f = a[4...7].map { CGFloat(Double($0)!) }
  cg = cg.cropping(to: CGRect(x: f[0]*w, y: f[1]*h, width: (f[2]-f[0])*w, height: (f[3]-f[1])*h))!
}
let rep = NSBitmapImageRep(cgImage: cg)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[3]))
