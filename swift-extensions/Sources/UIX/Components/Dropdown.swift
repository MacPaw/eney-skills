public struct DropdownItem: ComponentProtocol {
    private let value: String
    private let title: String

    public init(value: String, title: String) {
        self.value = value
        self.title = title
    }

    public func render(_ ctx: Context) -> Element {
        Element(type: "widget:dropdown-item", id: ctx.nextId(), properties: [
            "value": .string(value),
            "title": .string(title),
        ])
    }
}

public struct Dropdown: ComponentProtocol {
    private let name: String
    private let value: String
    private let label: String?
    private let searchable: Bool
    private let onChange: ((String) -> Void)?
    private let children: [any ComponentProtocol]

    public init(
        name: String,
        value: String,
        label: String? = nil,
        searchable: Bool = false,
        onChange: ((String) -> Void)? = nil,
        @ComponentBuilder content: () -> [any ComponentProtocol]
    ) {
        self.name = name
        self.value = value
        self.label = label
        self.searchable = searchable
        self.onChange = onChange
        self.children = content()
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let onChange {
            ctx.register(id: id) { props in
                let value = props["value"]?.stringValue ?? ""
                onChange(value)
            }
        }
        var properties: [String: PropertyValue] = [
            "name": .string(name),
            "value": .string(value),
            "searchable": .bool(searchable),
        ]
        if let label {
            properties["label"] = .string(label)
        }
        return Element(
            type: "widget:dropdown",
            id: id,
            properties: properties,
            children: children.map { $0.render(ctx) }
        )
    }
}
