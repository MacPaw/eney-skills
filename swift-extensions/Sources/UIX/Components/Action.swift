public enum ActionStyle: String, Sendable {
    case primary
    case secondary
}

public struct Action: ComponentProtocol {
    private let title: String
    private let style: ActionStyle
    private let isLoading: Bool
    private let isDisabled: Bool
    private let onAction: (() -> Void)?

    public init(
        title: String,
        style: ActionStyle = .primary,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        onAction: (() -> Void)? = nil
    ) {
        self.title = title
        self.style = style
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.onAction = onAction
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let onAction {
            ctx.register(id: id) { _ in onAction() }
        }
        var properties: [String: PropertyValue] = [
            "title": .string(title),
            "style": .string(style.rawValue),
        ]
        if isLoading { properties["isLoading"] = .bool(true) }
        if isDisabled { properties["isDisabled"] = .bool(true) }
        return Element(type: "widget:action", id: id, properties: properties)
    }
}
