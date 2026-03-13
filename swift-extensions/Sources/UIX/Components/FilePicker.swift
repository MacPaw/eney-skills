public struct FilePicker: ComponentProtocol {
    private let name: String
    private let value: [String]
    private let label: String?
    private let accept: String?
    private let multiple: Bool
    private let onChange: (([String]) -> Void)?

    public init(
        name: String,
        value: [String] = [],
        label: String? = nil,
        accept: String? = nil,
        multiple: Bool = false,
        onChange: (([String]) -> Void)? = nil
    ) {
        self.name = name
        self.value = value
        self.label = label
        self.accept = accept
        self.multiple = multiple
        self.onChange = onChange
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let onChange {
            ctx.register(id: id) { props in
                let paths: [String]
                if let arr = props["value"]?.stringArrayValue {
                    paths = arr
                } else if let single = props["value"]?.stringValue, !single.isEmpty {
                    paths = [single]
                } else {
                    paths = []
                }
                onChange(paths)
            }
        }
        var properties: [String: PropertyValue] = [
            "name": .string(name),
            "value": .stringArray(value),
            "multiple": .bool(multiple),
        ]
        if let label {
            properties["label"] = .string(label)
        }
        if let accept {
            properties["accept"] = .stringArray(accept.split(separator: ",").map { String($0) })
        }
        return Element(type: "widget:file-picker", id: id, properties: properties)
    }
}
