public struct Card: ComponentProtocol {
    let children: [any ComponentProtocol]

    public init(@ComponentBuilder content: () -> [any ComponentProtocol]) {
        self.children = content()
    }

    public func render(_ ctx: Context) -> Element {
        Element(type: "widget:card", id: ctx.nextId(), children: children.map { $0.render(ctx) })
    }
}
