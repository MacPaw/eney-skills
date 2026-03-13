import Foundation

// MARK: - Supporting Types

public struct RenderResult: Sendable {
    public let json: String
    public let element: Element
}

public struct OpenResult: Sendable {
    public let id: String
    public let json: String
    public let element: Element
}

public struct EventNotification: Sendable {
    public let widgetId: String
    public let event: Event
    public let needsRender: Bool
    public let updatedJSON: String?
}

// MARK: - WidgetRunner

public actor WidgetRunner {
    private struct Entry: @unchecked Sendable {
        let ctx: Context
        let renderFn: @Sendable () throws -> RenderResult
    }

    private var entries: [String: Entry] = [:]
    private var eventHandler: (@Sendable (EventNotification) -> Void)?
    private var closeHandler: (@Sendable (String, String) async -> Void)?

    public init() {}

    /// Set a handler called when a widget requests to close itself.
    /// Parameters: (widgetId, context)
    public func withCloseHandler(_ handler: @escaping @Sendable (String, String) async -> Void) {
        closeHandler = handler
    }

    public func withEventHandler(_ handler: @escaping @Sendable (EventNotification) -> Void) {
        eventHandler = handler
    }

    public func open<W: Widget>(_ widget: W) throws -> OpenResult {
        let id = UUID().uuidString.lowercased()
        let ctx = Context()

        // Wire close handler
        let closeHandler = self.closeHandler
        ctx.onCloseWidget = { @Sendable context in
            await closeHandler?(id, context)
        }

        let entry = Entry(ctx: ctx, renderFn: {
            let el = widget.body(ctx).render(ctx)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
            let data = try encoder.encode(el)
            let json = String(data: data, encoding: .utf8)!
            return RenderResult(json: json, element: el)
        })
        entries[id] = entry
        let result = try render(entry: entry)
        startPendingTasks(id: id, entry: entry)
        return OpenResult(id: id, json: result.json, element: result.element)
    }

    @discardableResult
    public func handle(widgetId: String, event: Event) async -> String? {
        guard let entry = entries[widgetId] else { return nil }
        let properties = event.properties ?? [:]
        let needsRender = entry.ctx.invoke(event.id, properties: properties)
        let json: String? = needsRender ? try? render(entry: entry).json : nil
        if json != nil {
            startPendingTasks(id: widgetId, entry: entry)
        }
        emit(EventNotification(widgetId: widgetId, event: event, needsRender: needsRender, updatedJSON: json))
        return json
    }

    public func close(widgetId: String) {
        entries.removeValue(forKey: widgetId)
    }

    // MARK: - Private

    private func render(entry: Entry) throws -> RenderResult {
        entry.ctx.beginRender()
        return try entry.renderFn()
    }

    private func startPendingTasks(id: String, entry: Entry) {
        for (_, work) in entry.ctx.consumePendingTasks() {
            Task { [self] in
                try await work {
                    let result = try? await self.render(entry: entry)
                    let event = Event(id: id, type: "task")
                    await self.emit(EventNotification(widgetId: id, event: event, needsRender: true, updatedJSON: result?.json))
                }
            }
        }
    }

    private func emit(_ notification: EventNotification) {
        eventHandler?(notification)
    }
}
