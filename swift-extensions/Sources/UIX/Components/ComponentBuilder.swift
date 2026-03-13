@resultBuilder
public struct ComponentBuilder {
    public static func buildBlock(_ components: [any ComponentProtocol]...) -> [any ComponentProtocol] {
        components.flatMap { $0 }
    }

    public static func buildExpression(_ expression: any ComponentProtocol) -> [any ComponentProtocol] {
        [expression]
    }

    public static func buildOptional(_ component: [any ComponentProtocol]?) -> [any ComponentProtocol] {
        component ?? []
    }

    public static func buildEither(first component: [any ComponentProtocol]) -> [any ComponentProtocol] {
        component
    }

    public static func buildEither(second component: [any ComponentProtocol]) -> [any ComponentProtocol] {
        component
    }

    public static func buildArray(_ components: [[any ComponentProtocol]]) -> [any ComponentProtocol] {
        components.flatMap { $0 }
    }
}
