public struct CardHeader: ComponentProtocol {
    private let title: String
    private let iconBundleId: String?

    public init(title: String, iconBundleId: String? = nil) {
        self.title = title
        self.iconBundleId = iconBundleId
    }

    public func render(_ ctx: Context) -> Element {
        var properties: [String: PropertyValue] = [
            "title": .string(title),
        ]
        if let iconBundleId {
            properties["iconBundleId"] = .string(iconBundleId)
        }
        return Element(type: "widget:card-header", id: ctx.nextId(), properties: properties)
    }
}
