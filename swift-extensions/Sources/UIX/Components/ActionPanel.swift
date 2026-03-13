public enum ActionPanelLayout: String, Sendable {
    case row
    case column
}

public struct ActionPanel: ComponentProtocol {
    private let layout: ActionPanelLayout
    private let children: [any ComponentProtocol]

    public init(
        layout: ActionPanelLayout = .column,
        @ComponentBuilder content: () -> [any ComponentProtocol]
    ) {
        self.layout = layout
        self.children = content()
    }

    public func render(_ ctx: Context) -> Element {
        Element(
            type: "widget:action-panel",
            id: ctx.nextId(),
            properties: ["layout": .string(layout.rawValue)],
            children: children.map { $0.render(ctx) }
        )
    }
}
