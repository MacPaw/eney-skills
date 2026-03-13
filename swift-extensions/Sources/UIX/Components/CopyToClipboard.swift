import Foundation

public struct CopyToClipboard: ComponentProtocol {
    private let content: String
    private let title: String
    private let style: ActionStyle
    private let isDisabled: Bool

    public init(
        content: String,
        title: String = "Copy",
        style: ActionStyle = .secondary,
        isDisabled: Bool = false
    ) {
        self.content = content
        self.title = title
        self.style = style
        self.isDisabled = isDisabled
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        let capturedContent = content
        ctx.register(id: id, triggersRender: false) { _ in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/pbcopy")
            let pipe = Pipe()
            process.standardInput = pipe
            try? process.run()
            pipe.fileHandleForWriting.write(Data(capturedContent.utf8))
            pipe.fileHandleForWriting.closeFile()
            process.waitUntilExit()
        }
        var properties: [String: PropertyValue] = [
            "title": .string(title),
            "style": .string(style.rawValue),
        ]
        if isDisabled { properties["isDisabled"] = .bool(true) }
        return Element(type: "widget:action", id: id, properties: properties)
    }
}
