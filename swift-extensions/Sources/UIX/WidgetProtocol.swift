public protocol Widget: Sendable {
    associatedtype Body: ComponentProtocol
    func body(_ ctx: Context) -> Body
}
