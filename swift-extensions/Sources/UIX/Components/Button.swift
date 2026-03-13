public struct Button: ComponentProtocol {
    let title: String
    let onClick: (() -> Void)?

    public init(_ title: String, onClick: (() -> Void)? = nil) {
        self.title = title
        self.onClick = onClick
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let onClick {
            ctx.register(id: id) { _ in onClick() }
        }
        return Element(type: "widget:button", id: id, properties: ["title": .string(title)])
    }
}
