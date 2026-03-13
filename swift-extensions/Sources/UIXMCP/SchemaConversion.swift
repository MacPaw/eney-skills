import Foundation
import MCP
import UIX

/// Converts an InputSchema to MCP Value (JSON Schema format for Tool.inputSchema).
public func schemaToMCPValue(_ schema: InputSchema) -> Value {
    var properties: [String: Value] = [:]
    var required: [Value] = []

    for field in schema.fields {
        let jsonType: String
        switch field.type {
        case .string: jsonType = "string"
        case .number: jsonType = "number"
        case .boolean: jsonType = "boolean"
        }

        properties[field.name] = .object([
            "type": .string(jsonType),
            "description": .string(field.description),
        ])

        if field.required {
            required.append(.string(field.name))
        }
    }

    return .object([
        "type": .string("object"),
        "properties": .object(properties),
        "required": .array(required),
    ])
}

/// Converts MCP `[String: Value]?` arguments to `[String: PropertyValue]`.
public func mcpArgumentsToProperties(_ arguments: [String: Value]?) -> [String: PropertyValue] {
    guard let arguments else { return [:] }
    var result: [String: PropertyValue] = [:]
    for (key, value) in arguments {
        result[key] = valueToPropertyValue(value)
    }
    return result
}

private func valueToPropertyValue(_ value: Value) -> PropertyValue {
    switch value {
    case .null:
        return .null
    case .bool(let v):
        return .bool(v)
    case .int(let v):
        return .int(v)
    case .double(let v):
        return .double(v)
    case .string(let v):
        return .string(v)
    case .array(let arr):
        let strings = arr.compactMap { v -> String? in
            if case .string(let s) = v { return s }
            return nil
        }
        return .stringArray(strings)
    case .object:
        // Objects are not supported in PropertyValue; encode as JSON string
        if let data = try? JSONEncoder().encode(value),
           let str = String(data: data, encoding: .utf8) {
            return .string(str)
        }
        return .null
    case .data:
        return .null
    }
}

/// Converts a PropertyValue to MCP Value.
public func propertyValueToMCPValue(_ pv: PropertyValue) -> Value {
    switch pv {
    case .null: return .null
    case .bool(let v): return .bool(v)
    case .int(let v): return .int(v)
    case .double(let v): return .double(v)
    case .string(let v): return .string(v)
    case .stringArray(let v): return .array(v.map { .string($0) })
    }
}
