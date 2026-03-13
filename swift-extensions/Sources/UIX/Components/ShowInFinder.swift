import Foundation

public struct ShowInFinder: ComponentProtocol {
    private let path: String
    private let title: String
    private let style: ActionStyle
    private let isDisabled: Bool

    public init(
        path: String,
        title: String = "Show in Finder",
        style: ActionStyle = .secondary,
        isDisabled: Bool = false
    ) {
        self.path = path
        self.title = title
        self.style = style
        self.isDisabled = isDisabled
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        let capturedPath = path
        ctx.register(id: id, triggersRender: false) { _ in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/open")
            process.arguments = ["-R", capturedPath]
            try? process.run()
        }
        var properties: [String: PropertyValue] = [
            "title": .string(title),
            "style": .string(style.rawValue),
        ]
        if isDisabled { properties["isDisabled"] = .bool(true) }
        return Element(type: "widget:action", id: id, properties: properties)
    }
}
