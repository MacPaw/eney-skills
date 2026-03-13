import Foundation
import MCP
import UIX
import UIXMCP

// MARK: - Server Setup

let server = Server(
    name: "qr-code-swift-mcp",
    version: "1.0.0",
    capabilities: .init(
        logging: .init(),
        resources: .init(),
        tools: .init(listChanged: false)
    )
)

// MARK: - Widget Registration

let uix = UIXToolProvider()

await uix.register(qrCodeDefinition)

await uix.setOnWidgetTreeUpdated { json in
    try? await server.log(
        level: .info,
        data: .object(["message": .string(json)])
    )
}

await uix.setOnClose { json in
    try? await server.log(
        level: .info,
        data: .object(["message": .string(json)])
    )
}

await uix.start()

// MARK: - MCP Handlers

await server.withMethodHandler(ListTools.self) { _ in
    let widgetTools = await uix.tools()
    return ListTools.Result(tools: widgetTools)
}

await server.withMethodHandler(CallTool.self) { params in
    if let result = try await uix.handle(params) {
        return result
    }
    return CallTool.Result(
        content: [.text("Unknown tool: \(params.name)")],
        isError: true
    )
}

await server.withMethodHandler(ListResources.self) { _ in
    ListResources.Result(resources: [await uix.resource()])
}

await server.withMethodHandler(ReadResource.self) { params in
    let json = await uix.readResource()
    return ReadResource.Result(contents: [
        .text(json, uri: params.uri, mimeType: "application/json")
    ])
}

await server.withMethodHandler(SetLoggingLevel.self) { _ in
    Empty()
}

// MARK: - Start

let transport = StdioTransport()
try await server.start(transport: transport)
await server.waitUntilCompleted()
