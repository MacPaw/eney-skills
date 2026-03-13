public final class Binding<T>: @unchecked Sendable {
    public var value: T

    public init(_ value: T) {
        self.value = value
    }
}
