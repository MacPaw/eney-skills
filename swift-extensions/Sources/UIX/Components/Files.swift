public struct FilesItem: ComponentProtocol {
    private let path: String

    public init(path: String) {
        self.path = path
    }

    public func render(_ ctx: Context) -> Element {
        Element(type: "widget:files-item", id: ctx.nextId(), properties: [
            "path": .string(path),
        ])
    }
}

public struct Files: ComponentProtocol {
    private let children: [any ComponentProtocol]

    public init(@ComponentBuilder content: () -> [any ComponentProtocol]) {
        self.children = content()
    }

    public func render(_ ctx: Context) -> Element {
        Element(
            type: "widget:files",
            id: ctx.nextId(),
            children: children.map { $0.render(ctx) }
        )
    }
}
