public struct Input: ComponentProtocol {
    private var properties: [String: PropertyValue]
    private var onChangeHandler: ((String) -> Void)?

    public init(value: String) {
        self.properties = ["value": .string(value)]
    }

    public func placeholder(_ text: String) -> Self {
        var copy = self
        copy.properties["placeholder"] = .string(text)
        return copy
    }

    public func onChange(_ handler: @escaping (String) -> Void) -> Self {
        var copy = self
        copy.onChangeHandler = handler
        return copy
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let handler = onChangeHandler {
            ctx.register(id: id, triggersRender: false) { props in
                handler(props["value"]?.stringValue ?? "")
            }
        }
        return Element(type: "widget:input", id: id, properties: properties)
    }
}
