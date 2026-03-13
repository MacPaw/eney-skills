public struct PasswordField: ComponentProtocol {
    private let name: String
    private let value: String
    private let label: String?
    private let onChange: ((String) -> Void)?

    public init(
        name: String,
        value: String = "",
        label: String? = nil,
        onChange: ((String) -> Void)? = nil
    ) {
        self.name = name
        self.value = value
        self.label = label
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
        var properties: [String: PropertyValue] = [
            "name": .string(name),
            "value": .string(value),
        ]
        if let label {
            properties["label"] = .string(label)
        }
        return Element(type: "widget:password-field", id: id, properties: properties)
    }
}
