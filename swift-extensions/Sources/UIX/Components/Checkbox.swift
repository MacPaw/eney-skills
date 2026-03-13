public enum CheckboxVariant: String, Sendable {
    case checkbox
    case `switch` = "switch"
}

public struct Checkbox: ComponentProtocol {
    private let name: String
    private let label: String
    private let checked: Bool
    private let variant: CheckboxVariant
    private let onChange: ((Bool) -> Void)?

    public init(
        name: String,
        label: String,
        checked: Bool = false,
        variant: CheckboxVariant = .checkbox,
        onChange: ((Bool) -> Void)? = nil
    ) {
        self.name = name
        self.label = label
        self.checked = checked
        self.variant = variant
        self.onChange = onChange
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let onChange {
            ctx.register(id: id) { props in
                let value = props["value"]?.boolValue ?? false
                onChange(value)
            }
        }
        return Element(type: "widget:checkbox", id: id, properties: [
            "name": .string(name),
            "label": .string(label),
            "value": .bool(checked),
            "variant": .string(variant.rawValue),
        ])
    }
}
