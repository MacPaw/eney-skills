import Foundation

public enum DatePickerType: String, Sendable {
    case date
    case datetime
}

public struct DatePicker: ComponentProtocol {
    private let name: String
    private let value: Date
    private let label: String?
    private let type: DatePickerType
    private let onChange: ((Date) -> Void)?

    public init(
        name: String,
        value: Date,
        label: String? = nil,
        type: DatePickerType = .datetime,
        onChange: ((Date) -> Void)? = nil
    ) {
        self.name = name
        self.value = value
        self.label = label
        self.type = type
        self.onChange = onChange
    }

    public func render(_ ctx: Context) -> Element {
        let id = ctx.nextId()
        if let onChange {
            ctx.register(id: id) { props in
                // The client sends a unix timestamp
                let timestamp = props["value"]?.doubleValue ?? 0
                let date = Date(timeIntervalSince1970: timestamp)
                onChange(date)
            }
        }
        let unixTimestamp = Int(value.timeIntervalSince1970)
        var properties: [String: PropertyValue] = [
            "name": .string(name),
            "value": .int(unixTimestamp),
            "type": .string(type.rawValue),
        ]
        if let label {
            properties["label"] = .string(label)
        }
        return Element(type: "widget:date-picker", id: id, properties: properties)
    }
}
