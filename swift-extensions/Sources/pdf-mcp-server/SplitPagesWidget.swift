import CoreGraphics
import Foundation
import UIX

// MARK: - Split Pages Widget

struct SplitPagesWidget: Widget {
    let initialFile: String

    init(properties: [String: PropertyValue] = [:]) {
        self.initialFile = properties["file"]?.stringValue ?? ""
    }

    func body(_ ctx: Context) -> some ComponentProtocol {
        let file = ctx.state(initialFile)
        let emptyStringArray: [String] = []
        let outputFiles = ctx.state(emptyStringArray)
        let errorMessage = ctx.state("")

        let actions = ActionPanel(layout: .row) {
            if !outputFiles.value.isEmpty {
                ShowInFinder(
                    path: URL(fileURLWithPath: outputFiles.value.first!).deletingLastPathComponent()
                        .path)
                Action(title: "Done", style: .secondary) {
                    ctx.closeWidget(context: "Split PDF into \(outputFiles.value.count) pages")
                }
            } else {
                Action(title: "Split PDF", style: .primary) {
                    do {
                        let paths = try splitPDF(at: file.value)
                        outputFiles.value = paths
                        errorMessage.value = ""
                    } catch let err {
                        outputFiles.value = []
                        errorMessage.value = "Error: \(err.localizedDescription)"
                    }
                }
            }
        }

        if !outputFiles.value.isEmpty {
            return Form(actions: actions) {
                Text("Split into \(outputFiles.value.count) pages!")
                Files {
                    for path in outputFiles.value {
                        FilesItem(path: path)
                    }
                }
            }
        } else {
            return Form(actions: actions) {
                FilePicker(
                    name: "file",
                    value: file.value.isEmpty ? [] : [file.value],
                    label: "Select a PDF file",
                    accept: "application/pdf",
                    onChange: { val in
                        file.value = val.first ?? ""
                        outputFiles.value = []
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

// MARK: - PDF Splitting (CoreGraphics, works headless)
extension SplitPagesWidget {
    private func splitPDF(at path: String) throws -> [String] {
        guard !path.isEmpty else {
            throw SplitError.noFile
        }

        let url = URL(fileURLWithPath: path) as CFURL
        guard let srcDocument = CGPDFDocument(url) else {
            throw SplitError.invalidPDF(path)
        }

        let pageCount = srcDocument.numberOfPages
        guard pageCount > 0 else {
            throw SplitError.emptyPDF
        }

        let downloadsURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)
            .first!
        let folderName =
            URL(fileURLWithPath: path).deletingPathExtension().lastPathComponent + "_pages"
        let outputFolder = downloadsURL.appendingPathComponent(folderName)

        try FileManager.default.createDirectory(at: outputFolder, withIntermediateDirectories: true)

        var outputPaths: [String] = []

        for i in 1...pageCount {
            guard let page = srcDocument.page(at: i) else { continue }

            let outputURL = outputFolder.appendingPathComponent("page_\(i).pdf")
            var mediaBox = page.getBoxRect(.mediaBox)

            guard let pdfContext = CGContext(outputURL as CFURL, mediaBox: &mediaBox, nil) else {
                throw SplitError.writeFailed(i)
            }

            pdfContext.beginPDFPage(nil)
            pdfContext.drawPDFPage(page)
            pdfContext.endPDFPage()
            pdfContext.closePDF()

            outputPaths.append(outputURL.path)
        }

        return outputPaths
    }

    private enum SplitError: LocalizedError {
        case noFile
        case invalidPDF(String)
        case emptyPDF
        case writeFailed(Int)

        var errorDescription: String? {
            switch self {
            case .noFile:
                return "No PDF file provided"
            case .invalidPDF(let path):
                return "Could not load PDF: \(path)"
            case .emptyPDF:
                return "PDF has no pages"
            case .writeFailed(let page):
                return "Failed to write page \(page)"
            }
        }
    }
}

// MARK: - Widget Definition

let splitPagesDefinition = defineWidget(
    name: "split-pages-swift",
    description: "Split a PDF document into individual single-page PDF files",
    schema: InputSchema {
        InputSchema.Field(
            name: "file", type: .string, description: "Path to the PDF file to split.")
    },
    factory: { props in SplitPagesWidget(properties: props) }
)
