import Foundation

public struct Event: Codable, Sendable {
    public let id: String
    public let type: String
    public let properties: [String: PropertyValue]?

    /// Convenience accessor: extracts `properties["value"]` as a string.
    public var value: String? {
        properties?["value"]?.stringValue
    }

    public init(id: String, type: String, properties: [String: PropertyValue]? = nil) {
        self.id = id
        self.type = type
        self.properties = properties
    }

    /// Convenience initializer for simple string-value events.
    public init(id: String, type: String, value: String?) {
        self.id = id
        self.type = type
        if let value {
            self.properties = ["value": .string(value)]
        } else {
            self.properties = nil
        }
    }
}
