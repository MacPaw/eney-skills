import CoreGraphics
import CoreImage
import Foundation
import ImageIO
import UIX
import UniformTypeIdentifiers

// MARK: - QR Code Generator Widget

struct QRCodeWidget: Widget {
    let initialURL: String

    init(properties: [String: PropertyValue] = [:]) {
        self.initialURL = properties["url"]?.stringValue ?? ""
    }

    func body(_ ctx: Context) -> some ComponentProtocol {
        let url = ctx.state(initialURL)
        let outputPath = ctx.state("")
        let errorMessage = ctx.state("")

        let actions = ActionPanel(layout: .row) {
            if !outputPath.value.isEmpty {
                ShowInFinder(path: outputPath.value)
                Action(title: "Done", style: .secondary) {
                    ctx.closeWidget(context: "Generated QR code at: \(outputPath.value)")
                }
            } else {
                Action(title: "Generate QR Code", style: .primary) {
                    do {
                        let path = try generateQRCode(from: url.value)
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
                Text("QR code generated successfully!")
                Files {
                    FilesItem(path: outputPath.value)
                }
            }
        } else {
            return Form(actions: actions) {
                TextField(
                    name: "url",
                    value: url.value,
                    label: "URL to encode",
                    onChange: { val in
                        url.value = val
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

// MARK: - QR Code Generation (CoreImage, works headless)

extension QRCodeWidget {
    private func generateQRCode(from urlString: String) throws -> String {
        guard !urlString.isEmpty else {
            throw QRCodeError.emptyURL
        }

        guard let data = urlString.data(using: .utf8) else {
            throw QRCodeError.encodingFailed
        }

        guard let filter = CIFilter(name: "CIQRCodeGenerator") else {
            throw QRCodeError.filterUnavailable
        }

        filter.setValue(data, forKey: "inputMessage")
        filter.setValue("M", forKey: "inputCorrectionLevel")

        guard let ciImage = filter.outputImage else {
            throw QRCodeError.generationFailed
        }

        // Scale up the QR code for better visibility (default is very small)
        let scale: CGFloat = 10
        let transformed = ciImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

        let context = CIContext()
        guard let cgImage = context.createCGImage(transformed, from: transformed.extent) else {
            throw QRCodeError.generationFailed
        }

        let downloadsURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)
            .first!
        let outputURL = downloadsURL.appendingPathComponent("QRCode-\(UUID().uuidString).png")

        guard let destination = CGImageDestinationCreateWithURL(
            outputURL as CFURL, UTType.png.identifier as CFString, 1, nil
        ) else {
            throw QRCodeError.writeFailed
        }

        CGImageDestinationAddImage(destination, cgImage, nil)

        guard CGImageDestinationFinalize(destination) else {
            throw QRCodeError.writeFailed
        }

        return outputURL.path
    }

    private enum QRCodeError: LocalizedError {
        case emptyURL
        case encodingFailed
        case filterUnavailable
        case generationFailed
        case writeFailed

        var errorDescription: String? {
            switch self {
            case .emptyURL:
                return "URL cannot be empty"
            case .encodingFailed:
                return "Could not encode URL to data"
            case .filterUnavailable:
                return "QR code filter is not available"
            case .generationFailed:
                return "Failed to generate QR code image"
            case .writeFailed:
                return "Failed to write QR code image file"
            }
        }
    }
}

// MARK: - Widget Definition

let qrCodeDefinition = defineWidget(
    name: "generate-qr-code",
    description: "Generate a QR code image from a URL",
    schema: InputSchema {
        InputSchema.Field(
            name: "url", type: .string,
            description: "The URL to encode as a QR code")
    },
    factory: { props in QRCodeWidget(properties: props) }
)
