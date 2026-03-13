public struct Paper: ComponentProtocol {
    private let markdown: String
    private let isScrollable: Bool
    private let actions: (any ComponentProtocol)?

    public init(
        markdown: String,
        isScrollable: Bool = false,
        actions: (any ComponentProtocol)? = nil
    ) {
        self.markdown = markdown
        self.isScrollable = isScrollable
        self.actions = actions
    }

    public func render(_ ctx: Context) -> Element {
        let children = actions.map { [$0.render(ctx)] } ?? []
        return Element(
            type: "widget:paper",
            id: ctx.nextId(),
            properties: [
                "markdown": .string(markdown),
                "isScrollable": .bool(isScrollable),
            ],
            children: children
        )
    }
}
