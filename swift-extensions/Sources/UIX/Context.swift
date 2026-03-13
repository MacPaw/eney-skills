import Foundation

/// Callback invoked to trigger a widget re-render after async work completes.
public typealias Rerender = @Sendable () async -> Void

/// Async work scheduled by a widget via `Context.task(id:_:)`.
/// Receives a `Rerender` callback to request UI updates during execution.
public typealias TaskWork = @Sendable (Rerender) async throws -> Void

public final class Context: @unchecked Sendable {

    // MARK: - State Slots

    private var slots: [Any] = []
    private var slotCursor = 0

    // MARK: - ID Generation

    private var ids: [String] = []
    private var idCursor = 0

    // MARK: - Callback Registry

    private struct Callback {
        let handler: ([String: PropertyValue]) -> Void
        let triggersRender: Bool
    }
    private var callbacks: [String: Callback] = [:]

    // MARK: - Task Scheduling

    private var pendingTasks: [String: TaskWork] = [:]
    private var startedTasks: Set<String> = []

    // MARK: - Lifecycle Hooks

    /// Called by components to close the widget session with a context message.
    public var onCloseWidget: (@Sendable (String) async -> Void)?

    /// Called by components to send log messages.
    public var onLog: (@Sendable (String, String) async -> Void)?

    // MARK: - Init

    public init() {}

    // MARK: - Lifecycle

    /// Close the current widget session. Call from widget body to dismiss the UI.
    public func closeWidget(context: String = "done") {
        guard let onCloseWidget else { return }
        Task {
            await onCloseWidget(context)
        }
    }

    /// Resets cursors and clears callback/task registrations.
    /// Must be called before each render pass — callbacks and tasks are
    /// re-registered by the widget's `body(_:)` during rendering.
    public func beginRender() {
        slotCursor = 0
        idCursor = 0
        callbacks = [:]
        pendingTasks = [:]
    }

    // MARK: - State

    public func state<T>(_ initial: T) -> Binding<T> {
        let index = slotCursor
        slotCursor += 1
        if index < slots.count {
            return slots[index] as! Binding<T>
        }
        let binding = Binding(initial)
        slots.append(binding)
        return binding
    }

    // MARK: - IDs

    public func nextId() -> String {
        let index = idCursor
        idCursor += 1
        if index < ids.count {
            return ids[index]
        }
        let id = UUID().uuidString.lowercased()
        ids.append(id)
        return id
    }

    // MARK: - Callbacks

    public func register(id: String, triggersRender: Bool = true, handler: @escaping ([String: PropertyValue]) -> Void) {
        callbacks[id] = Callback(handler: handler, triggersRender: triggersRender)
    }

    @discardableResult
    public func invoke(_ id: String, properties: [String: PropertyValue] = [:]) -> Bool {
        guard let cb = callbacks[id] else { return false }
        cb.handler(properties)
        return cb.triggersRender
    }

    // MARK: - Tasks

    public func task(id: String, _ work: @escaping TaskWork) {
        guard !startedTasks.contains(id) else { return }
        pendingTasks[id] = work
    }

    public func consumePendingTasks() -> [String: TaskWork] {
        let tasks = pendingTasks
        startedTasks.formUnion(tasks.keys)
        return tasks
    }
}
