public struct TextField: ComponentProtocol {
    private let name: String
    private let value: String
    private let label: String?
    private let isCopyable: Bool
    private let onChange: ((String) -> Void)?

    public init(
        name: String,
        value: String = "",
        label: String? = nil,
        isCopyable: Bool = false,
        onChange: ((String) -> Void)? = nil
    ) {
        self.name = name
        self.value = value
        self.label = label
        self.isCopyable = isCopyable
        self.onChange = onChange
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let onChange {
            ctx.register(id: id, triggersRender: false) { props in
                onChange(props["value"]?.stringValue ?? "")
            }
        }
        var properties: [String: PropertyValue] = [
            "name": .string(name),
            "value": .string(value),
        ]
        if let label { properties["label"] = .string(label) }
        if isCopyable { properties["isCopyable"] = .bool(true) }
        return Element(type: "widget:text-field", id: id, properties: properties)
    }
}
