public struct SubmitForm: ComponentProtocol {
    private let title: String
    private let style: ActionStyle
    private let isLoading: Bool
    private let isDisabled: Bool
    private let onSubmit: (() -> Void)?

    public init(
        title: String,
        style: ActionStyle = .secondary,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        onSubmit: (() -> Void)? = nil
    ) {
        self.title = title
        self.style = style
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.onSubmit = onSubmit
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let onSubmit {
            ctx.register(id: id) { _ in onSubmit() }
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
