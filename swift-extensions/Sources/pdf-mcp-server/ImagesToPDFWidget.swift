import CoreGraphics
import Foundation
import ImageIO
import UIX
import UniformTypeIdentifiers

// MARK: - Images to PDF Widget

struct ImagesToPDFWidget: Widget {
    let initialFiles: [String]

    init(properties: [String: PropertyValue] = [:]) {
        if let arr = properties["files"]?.stringArrayValue {
            self.initialFiles = arr
        } else if let single = properties["files"]?.stringValue {
            self.initialFiles = [single]
        } else {
            self.initialFiles = []
        }
    }

    func body(_ ctx: Context) -> some ComponentProtocol {
        let files = ctx.state(initialFiles)
        let outputPath = ctx.state("")
        let errorMessage = ctx.state("")

        let actions = ActionPanel(layout: .row) {
            if !outputPath.value.isEmpty {
                ShowInFinder(path: outputPath.value)
                Action(title: "Done", style: .secondary) {
                    ctx.closeWidget(context: "Created PDF at: \(outputPath.value)")
                }
            } else {
                Action(title: "Create PDF", style: .primary) {
                    do {
                        let path = try createPDF(from: files.value)
                        outputPath.value = path
                        errorMessage.value = ""
                    } catch let err {
                        outputPath.value = ""
                        errorMessage.value = "Error: \(err.localizedDescription)"
                    }
                }
            }
        }

        if !outputPath.value.isEmpty {
            return Form(actions: actions) {
                Text("PDF created successfully!")
                Files {
                    FilesItem(path: outputPath.value)
                }
            }
        } else {
            return Form(actions: actions) {
                FilePicker(
                    name: "files",
                    value: files.value,
                    label: "Select images (PNG, JPEG)",
                    accept: "image/png,image/jpeg",
                    multiple: true,
                    onChange: { val in
                        files.value = val
                        errorMessage.value = ""
                    }
                )
                if !errorMessage.value.isEmpty {
                    Text(errorMessage.value)
                }
            }
        }
    }
}

// MARK: - PDF Creation (CoreGraphics, works headless)
extension ImagesToPDFWidget {
    private func createPDF(from imagePaths: [String]) throws -> String {
        guard !imagePaths.isEmpty else {
            throw PDFError.noImages
        }

        let downloadsURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)
            .first!
        let outputURL = downloadsURL.appendingPathComponent("\(UUID().uuidString).pdf")

        guard let pdfContext = CGContext(outputURL as CFURL, mediaBox: nil, nil) else {
            throw PDFError.writeFailed
        }

        for path in imagePaths {
            let url = URL(fileURLWithPath: path) as CFURL
            guard let imageSource = CGImageSourceCreateWithURL(url, nil),
                let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)
            else {
                throw PDFError.invalidImage(path)
            }

            let width = CGFloat(cgImage.width)
            let height = CGFloat(cgImage.height)
            var mediaBox = CGRect(x: 0, y: 0, width: width, height: height)

            pdfContext.beginPage(mediaBox: &mediaBox)
            pdfContext.draw(cgImage, in: mediaBox)
            pdfContext.endPage()
        }

        pdfContext.closePDF()

        return outputURL.path
    }

    private enum PDFError: LocalizedError {
        case noImages
        case invalidImage(String)
        case pageCreationFailed(String)
        case writeFailed

        var errorDescription: String? {
            switch self {
            case .noImages:
                return "No images provided"
            case .invalidImage(let path):
                return "Could not load image: \(path)"
            case .pageCreationFailed(let path):
                return "Could not create PDF page from image: \(path)"
            case .writeFailed:
                return "Failed to write PDF file"
            }
        }
    }
}
// MARK: - Widget Definition

let imagesToPDFDefinition = defineWidget(
    name: "images-to-pdf-swift",
    description: "Combine multiple images (PNG, JPEG) into a single PDF document",
    schema: InputSchema {
        InputSchema.Field(
            name: "files", type: .string,
            description: "Comma-separated image file paths to combine into a PDF.")
    },
    factory: { props in ImagesToPDFWidget(properties: props) }
)
