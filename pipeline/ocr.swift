import PDFKit
import Vision
import AppKit
// Usage: swift ocr.swift file.pdf [firstPage lastPage]
let args = CommandLine.arguments
guard let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else { print("cannot open"); exit(1) }
let first = args.count > 2 ? Int(args[2])! : 1
let last = args.count > 3 ? Int(args[3])! : doc.pageCount
for i in (first-1)..<min(last, doc.pageCount) {
  guard let page = doc.page(at: i) else { continue }
  let bounds = page.bounds(for: .mediaBox)
  let scale: CGFloat = 2.5
  let size = NSSize(width: bounds.width * scale, height: bounds.height * scale)
  let image = page.thumbnail(of: size, for: .mediaBox)
  guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = false
  try? VNImageRequestHandler(cgImage: cg).perform([request])
  // Rebuild lines: group observations by vertical position, then sort left to right.
  var rows: [(y: CGFloat, items: [(x: CGFloat, s: String)])] = []
  for obs in request.results ?? [] {
    guard let s = obs.topCandidates(1).first?.string else { continue }
    let y = obs.boundingBox.midY, x = obs.boundingBox.minX
    if let idx = rows.firstIndex(where: { abs($0.y - y) < 0.006 }) { rows[idx].items.append((x, s)) }
    else { rows.append((y, [(x, s)])) }
  }
  print("=== PAGE \(i+1)")
  for row in rows.sorted(by: { $0.y > $1.y }) {
    print(row.items.sorted(by: { $0.x < $1.x }).map { $0.s }.joined(separator: " | "))
  }
}
