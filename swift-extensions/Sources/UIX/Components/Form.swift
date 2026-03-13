public struct Form: ComponentProtocol {
    private let children: [any ComponentProtocol]
    private let actions: (any ComponentProtocol)?

    public init(
        actions: (any ComponentProtocol)? = nil,
        @ComponentBuilder content: () -> [any ComponentProtocol]
    ) {
        self.actions = actions
        self.children = content()
    }

    public func render(_ ctx: Context) -> Element {
        var childElements = children.map { $0.render(ctx) }
        if let actions {
            childElements.append(actions.render(ctx))
        }
        return Element(type: "widget:form", id: ctx.nextId(), children: childElements)
    }
}
