import Foundation
import MCP
import UIX

/// Middleware that provides UIX widget tools without owning the MCP Server.
/// The developer explicitly wires tools and handlers into their own server setup.
public actor UIXToolProvider {
    private let widgetRunner: WidgetRunner
    private var registeredWidgets: [String: any AnyWidgetDefinition] = [:]
    private var currentWidgetId: String?
    private var currentWidgetJSON: String?

    private var onWidgetTreeUpdated: (@Sendable (String) async -> Void)?
    private var onClose: (@Sendable (String) async -> Void)?

    public static let uixResourceURI = "uix://widget-tree"

    public init() {
        self.widgetRunner = WidgetRunner()
    }

    /// Set a callback for when the widget tree updates (e.g. after a state change triggers re-render).
    /// Use this to forward notifications via the MCP Server.
    public func setOnWidgetTreeUpdated(_ handler: @escaping @Sendable (String) async -> Void) {
        onWidgetTreeUpdated = handler
    }

    /// Set a callback for when a widget closes itself (e.g. "Done" button).
    /// The callback receives the finalize JSON to send via MCP logging.
    public func setOnClose(_ handler: @escaping @Sendable (String) async -> Void) {
        onClose = handler
    }

    /// Register a widget definition.
    public func register(_ definition: some AnyWidgetDefinition) {
        registeredWidgets[definition.name] = definition
    }

    /// Start listening for widget runner events. Call once after registering widgets.
    public func start() async {
        await widgetRunner.withEventHandler { [weak self] notification in
            guard let json = notification.updatedJSON else { return }
            Task {
                await self?.handleWidgetUpdated(json: json)
            }
        }

        await widgetRunner.withCloseHandler { [weak self] _, context in
            guard let self else { return }
            if let json = await self.closeWidget(context: context) {
                await self.onClose?(json)
            }
        }
    }

    // MARK: - Tool Provider API

    /// Returns all UIX tools (one per widget + send-event).
    public func tools() -> [Tool] {
        var result: [Tool] = []

        // send-event tool
        result.append(Tool(
            name: "send-event",
            description: "Send a UIX event to an extension session",
            inputSchema: .object([
                "type": .string("object"),
                "properties": .object([
                    "event": .object([
                        "type": .string("string"),
                        "description": .string("JSON-encoded event with id, type, and properties fields"),
                    ])
                ]),
                "required": .array([.string("event")]),
            ])
        ))

        // One tool per registered widget
        for (_, widget) in registeredWidgets {
            let inputSchema: Value
            if let schema = widget.schema {
                inputSchema = schemaToMCPValue(schema)
            } else {
                inputSchema = .object([
                    "type": .string("object"),
                    "properties": .object([:]),
                ])
            }

            result.append(Tool(
                name: widget.name,
                description: widget.description,
                inputSchema: inputSchema
            ))
        }

        return result
    }

    /// Returns true if this provider handles the given tool name.
    public func canHandle(_ name: String) -> Bool {
        name == "send-event" || registeredWidgets[name] != nil
    }

    /// Handle a CallTool request. Returns nil if the tool name is not handled.
    public func handle(_ params: CallTool.Parameters) async throws -> CallTool.Result? {
        if params.name == "send-event" {
            return try await handleSendEvent(params)
        }

        guard let widgetDef = registeredWidgets[params.name] else {
            return nil
        }

        return try await handleOpenWidget(widgetDef, arguments: params.arguments)
    }

    /// Returns the UIX resource descriptor for the widget tree.
    public func resource() -> Resource {
        Resource(
            name: "widget-tree",
            uri: Self.uixResourceURI,
            description: "Current widget tree",
            mimeType: "application/json"
        )
    }

    /// Returns the current widget tree JSON wrapped in a root event envelope.
    public func readResource() -> String {
        let elementJSON = currentWidgetJSON ?? "null"
        return """
        {"type":"root","properties":{},"children":[\(elementJSON)]}
        """
    }

    /// Close the current widget and return a finalize payload JSON string.
    public func closeWidget(context: String) async -> String? {
        let finalizePayload: [String: String] = [
            "type": "tools/finalize",
            "context": context,
        ]

        let json: String?
        if let data = try? JSONEncoder().encode(finalizePayload) {
            json = String(data: data, encoding: .utf8)
        } else {
            json = nil
        }

        if let widgetId = currentWidgetId {
            await widgetRunner.close(widgetId: widgetId)
        }
        currentWidgetId = nil
        currentWidgetJSON = nil

        return json
    }

    // MARK: - Private

    private func handleOpenWidget(_ definition: any AnyWidgetDefinition, arguments: [String: Value]?) async throws -> CallTool.Result {
        let properties = mcpArgumentsToProperties(arguments)

        do {
            let result = try await definition.createAndRender(
                properties: properties,
                runner: widgetRunner
            )
            let widgetId = result.id
            let json = result.json

            currentWidgetId = widgetId
            currentWidgetJSON = json

            // Notify about initial widget tree
            await onWidgetTreeUpdated?(wrapInRootEvent(json))

            let widgetTreeJSON = wrapInRootEvent(json)
            let responseJSON = """
            {"isUixResource":true,"uri":"\(Self.uixResourceURI)","widgetTree":\(widgetTreeJSON)}
            """

            return CallTool.Result(content: [.text(responseJSON)])
        } catch {
            return CallTool.Result(
                content: [.text("Failed to open widget: \(error)")],
                isError: true
            )
        }
    }

    private func handleSendEvent(_ params: CallTool.Parameters) async throws -> CallTool.Result {
        guard let eventString = params.arguments?["event"]?.stringValue else {
            return CallTool.Result(
                content: [.text("Missing required argument: event")],
                isError: true
            )
        }

        do {
            let eventData = Data(eventString.utf8)
            let event = try Self.decodeEvent(from: eventData)

            guard let widgetId = currentWidgetId else {
                return CallTool.Result(
                    content: [.text("No active widget")],
                    isError: true
                )
            }

            let newJSON = await widgetRunner.handle(widgetId: widgetId, event: event)

            if let newJSON {
                currentWidgetJSON = newJSON
            }

            return CallTool.Result(
                content: [.text(currentWidgetJSON ?? "")]
            )
        } catch {
            return CallTool.Result(
                content: [.text("Failed to process event: \(error)")],
                isError: true
            )
        }
    }

    private func handleWidgetUpdated(json: String) {
        currentWidgetJSON = json
        Task {
            await onWidgetTreeUpdated?(wrapInRootEvent(json))
        }
    }

    private func wrapInRootEvent(_ elementJSON: String) -> String {
        """
        {"type":"root","properties":{},"children":[\(elementJSON)]}
        """
    }

    // MARK: - Eney Compatibility

    /// Decodes an Event from JSON, handling Eney's "widget" key as an alias for "id".
    private static func decodeEvent(from data: Data) throws -> Event {
        if let event = try? JSONDecoder().decode(Event.self, from: data) {
            return event
        }
        // Eney sends "widget" instead of "id"
        let raw = try JSONDecoder().decode(EneyEvent.self, from: data)
        return Event(id: raw.widget, type: raw.type, properties: raw.properties)
    }

    private struct EneyEvent: Decodable {
        let widget: String
        let type: String
        let properties: [String: PropertyValue]?
    }
}
