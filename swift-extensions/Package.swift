// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "uapp",
    platforms: [.macOS(.v15)],
    products: [
        .library(name: "UIX", targets: ["UIX"]),
        .library(name: "UIXMCP", targets: ["UIXMCP"]),
    ],
    dependencies: [
        .package(url: "https://github.com/modelcontextprotocol/swift-sdk.git", from: "0.11.0"),
        .package(url: "https://github.com/apple/swift-argument-parser.git", from: "1.5.0"),
    ],
    targets: [
        .target(
            name: "UIX"
        ),
        .target(
            name: "UIXMCP",
            dependencies: [
                "UIX",
                .product(name: "MCP", package: "swift-sdk"),
            ]
        ),
        .executableTarget(
            name: "new-password-mcp-server",
            dependencies: [
                "UIX",
                "UIXMCP",
                .product(name: "MCP", package: "swift-sdk"),
            ]
        ),
        .executableTarget(
            name: "pdf-mcp-server",
            dependencies: [
                "UIX",
                "UIXMCP",
                .product(name: "MCP", package: "swift-sdk"),
            ]
        ),
        .executableTarget(
            name: "qr-code-mcp-server",
            dependencies: [
                "UIX",
                "UIXMCP",
                .product(name: "MCP", package: "swift-sdk"),
            ]
        ),
        .executableTarget(
            name: "set-timer-mcp-server",
            dependencies: [
                "UIX",
                "UIXMCP",
                .product(name: "MCP", package: "swift-sdk"),
            ]
        ),
        .executableTarget(
            name: "uix-cli",
            dependencies: [
                .product(name: "ArgumentParser", package: "swift-argument-parser"),
            ]
        ),
    ]
)
