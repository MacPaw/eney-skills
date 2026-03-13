public struct NumberField: ComponentProtocol {
    private let name: String
    private let value: Double?
    private let label: String?
    private let min: Double?
    private let max: Double?
    private let onChange: ((Double?) -> Void)?

    public init(
        name: String,
        value: Double? = nil,
        label: String? = nil,
        min: Double? = nil,
        max: Double? = nil,
        onChange: ((Double?) -> Void)? = nil
    ) {
        self.name = name
        self.value = value
        self.label = label
        self.min = min
        self.max = max
        self.onChange = onChange
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let onChange {
            ctx.register(id: id) { props in
                onChange(props["value"]?.doubleValue)
            }
        }
        var properties: [String: PropertyValue] = [
            "name": .string(name),
        ]
        if let value { properties["value"] = .int(Int(value)) }
        if let label { properties["label"] = .string(label) }
        if let min { properties["min"] = .int(Int(min)) }
        if let max { properties["max"] = .int(Int(max)) }
        return Element(type: "widget:number-field", id: id, properties: properties)
    }
}
