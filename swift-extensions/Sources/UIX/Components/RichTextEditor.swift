public struct RichTextEditor: ComponentProtocol {
    private let value: String
    private let isInitiallyFocused: Bool
    private let onChange: ((String) -> Void)?

    public init(
        value: String = "",
        isInitiallyFocused: Bool = false,
        onChange: ((String) -> Void)? = nil
    ) {
        self.value = value
        self.isInitiallyFocused = isInitiallyFocused
        self.onChange = onChange
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let onChange {
            ctx.register(id: id, triggersRender: false) { props in
                let value = props["value"]?.stringValue ?? ""
                onChange(value)
            }
        }
        return Element(type: "widget:rich-text-editor", id: id, properties: [
            "value": .string(value),
            "isInitiallyFocused": .bool(isInitiallyFocused),
        ])
    }
}
