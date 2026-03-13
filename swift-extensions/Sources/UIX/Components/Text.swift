public enum TextSize: String, Sendable {
    case s, m, l, xl
}

public enum TextAlignment: String, Sendable {
    case left, center, right
}

public struct Text: ComponentProtocol {
    private var properties: [String: PropertyValue]

    public init(_ content: String) {
        self.properties = ["markdown": .string(content), "isScrollable": .bool(false)]
    }

    public func size(_ size: TextSize) -> Self {
        var copy = self
        copy.properties["size"] = .string(size.rawValue)
        return copy
    }

    public func alignment(_ alignment: TextAlignment) -> Self {
        var copy = self
        copy.properties["alignment"] = .string(alignment.rawValue)
        return copy
    }

    public func color(_ color: String) -> Self {
        var copy = self
        copy.properties["color"] = .string(color)
        return copy
    }

    public func render(_ ctx: Context) -> Element {
        Element(type: "widget:paper", id: ctx.nextId(), properties: properties)
    }
}
