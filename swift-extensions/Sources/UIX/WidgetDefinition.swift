import Foundation

// MARK: - Input Schema

public enum FieldType: String, Sendable {
    case string
    case number
    case boolean
}

public struct InputSchema: Sendable {
    public struct Field: Sendable {
        public let name: String
        public let type: FieldType
        public let description: String
        public let required: Bool

        public init(name: String, type: FieldType, description: String, required: Bool = false) {
            self.name = name
            self.type = type
            self.description = description
            self.required = required
        }
    }

    public let fields: [Field]

    public init(fields: [Field]) {
        self.fields = fields
    }

    public init(@SchemaBuilder _ build: () -> [Field]) {
        self.fields = build()
    }
}

@resultBuilder
public struct SchemaBuilder {
    public static func buildBlock(_ fields: InputSchema.Field...) -> [InputSchema.Field] {
        fields
    }
}

// MARK: - Widget Definition

/// Type-erased protocol for storing widget definitions in collections.
public protocol AnyWidgetDefinition: Sendable {
    var name: String { get }
    var description: String { get }
    var schema: InputSchema? { get }
    func createAndRender(properties: [String: PropertyValue], runner: WidgetRunner) async throws -> OpenResult
}

public struct WidgetDefinition<W: Widget>: AnyWidgetDefinition, Sendable {
    public let name: String
    public let description: String
    public let schema: InputSchema?
    public let factory: @Sendable ([String: PropertyValue]) -> W

    public init(
        name: String,
        description: String,
        schema: InputSchema? = nil,
        factory: @escaping @Sendable ([String: PropertyValue]) -> W
    ) {
        self.name = name
        self.description = description
        self.schema = schema
        self.factory = factory
    }

    public func createAndRender(properties: [String: PropertyValue], runner: WidgetRunner) async throws -> OpenResult {
        let widget = factory(properties)
        return try await runner.open(widget)
    }
}

/// Convenience function for defining widgets.
public func defineWidget<W: Widget>(
    name: String,
    description: String,
    schema: InputSchema? = nil,
    factory: @escaping @Sendable ([String: PropertyValue]) -> W
) -> WidgetDefinition<W> {
    WidgetDefinition(name: name, description: description, schema: schema, factory: factory)
}
