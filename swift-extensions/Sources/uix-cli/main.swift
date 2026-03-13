import ArgumentParser
import Foundation

@main
struct UIXCli: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "uix-cli",
        abstract: "UIX CLI tools for managing Swift MCP widget extensions",
        subcommands: [Dev.self, Install.self, Uninstall.self]
    )
}

// MARK: - Dev

struct Dev: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Build the MCP server and launch MCP Inspector for testing"
    )

    @Option(name: .long, help: "Swift build configuration (debug or release)")
    var config: String = "debug"

    @Option(name: .long, help: "Executable target name to build and run")
    var target: String = "mcp-server"

    @Option(name: .long, help: "Package directory (defaults to current directory)")
    var packageDir: String? = nil

    func run() throws {
        let fm = FileManager.default
        let dir = packageDir ?? fm.currentDirectoryPath

        // Step 1: Build
        print("Building \(target) (\(config))...")
        let buildArgs = ["swift", "build", "-c", config, "--target", target, "--package-path", dir]
        let buildProcess = Process()
        buildProcess.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        buildProcess.arguments = buildArgs
        buildProcess.currentDirectoryURL = URL(fileURLWithPath: dir)
        try buildProcess.run()
        buildProcess.waitUntilExit()

        guard buildProcess.terminationStatus == 0 else {
            throw ValidationError("Build failed with exit code \(buildProcess.terminationStatus)")
        }
        print("Build successful.\n")

        // Step 2: Find binary
        let binaryPath = findBinary(in: dir, target: target, config: config)
        guard let binaryPath, fm.fileExists(atPath: binaryPath) else {
            throw ValidationError("Could not find built binary for target '\(target)'. Check your target name.")
        }
        print("Binary: \(binaryPath)")

        // Step 3: Launch MCP Inspector
        print("Launching MCP Inspector...\n")
        print("  Inspector UI: http://localhost:6274")
        print("  Press Ctrl+C to stop.\n")

        let inspectorProcess = Process()
        inspectorProcess.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        inspectorProcess.arguments = ["npx", "@modelcontextprotocol/inspector", binaryPath]
        inspectorProcess.currentDirectoryURL = URL(fileURLWithPath: dir)

        // Forward Ctrl+C to kill inspector
        signal(SIGINT) { _ in
            Darwin.exit(0)
        }

        try inspectorProcess.run()
        inspectorProcess.waitUntilExit()
    }

    private func findBinary(in dir: String, target: String, config: String) -> String? {
        // Try common Swift build output paths
        let candidates = [
            "\(dir)/.build/\(config)/\(target)",
            "\(dir)/.build/arm64-apple-macosx/\(config)/\(target)",
            "\(dir)/.build/x86_64-apple-macosx/\(config)/\(target)",
        ]
        let fm = FileManager.default
        for path in candidates {
            if fm.fileExists(atPath: path) {
                return path
            }
        }
        return nil
    }
}

// MARK: - Install

struct Install: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Install a Swift MCP extension into Eney"
    )

    @Argument(help: "MCP server name (e.g. security-utilities-swift-mcp)")
    var serverName: String

    @Option(name: .long, help: "Path to the compiled binary")
    var binary: String

    @Option(name: .long, parsing: .upToNextOption, help: "Widget tool names (e.g. new-password-swift timer)")
    var tools: [String] = []

    @Option(name: .long, parsing: .upToNextOption, help: "Tool descriptions (one per tool, same order)")
    var descriptions: [String] = []

    @Option(name: .long, help: "Server version")
    var version: String = "1.0.0"

    @Option(name: .long, help: "Author name")
    var author: String = "Unknown"

    @Option(name: .long, help: "Server description")
    var serverDescription: String = "Swift UIX MCP extension"

    func validate() throws {
        if !tools.isEmpty && descriptions.count != tools.count {
            throw ValidationError("Number of --descriptions must match number of --tools")
        }
    }

    func run() throws {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let eneyToolsDir = "\(home)/.eney/tools"
        let mcpBaseDir = "\(home)/Library/Application Support/com.macpaw.assistant-macos.client-setapp/MCP"
        let mcpServerDir = "\(mcpBaseDir)/\(serverName)"
        let fm = FileManager.default

        // Resolve binary path
        let binaryPath: String
        if binary.hasPrefix("/") {
            binaryPath = binary
        } else {
            binaryPath = "\(fm.currentDirectoryPath)/\(binary)"
        }

        guard fm.fileExists(atPath: binaryPath) else {
            throw ValidationError("Binary not found at: \(binaryPath)")
        }

        // Step 1: Create tool JSONs
        if !tools.isEmpty {
            try fm.createDirectory(atPath: eneyToolsDir, withIntermediateDirectories: true)

            for (i, toolName) in tools.enumerated() {
                let desc = descriptions.indices.contains(i) ? descriptions[i] : toolName
                let toolId = toolName.replacingOccurrences(of: "-", with: "_")
                let toolJSON = """
                {
                  "implicitConfirmationRequired": false,
                  "reparseRequired": false,
                  "processCommandOutputWithLlm": true,
                  "usesThirdPartyProviders": false,
                  "supportsLocalEngine": false,
                  "id": "\(toolId)",
                  "manifestId": "eney_core",
                  "name": "\(toolId)",
                  "description": "\(desc)",
                  "status": "ACTIVE",
                  "category": null,
                  "contentVersion": "\(version)",
                  "syntaxVersion": 4,
                  "inputParameters": [],
                  "outputUI": [],
                  "dependencies": [],
                  "icon": {
                    "type": "predefined",
                    "identifier": "generic"
                  },
                  "messageTexts": {
                    "inputParametersCtaButtonLabel": "Submit"
                  },
                  "onboardingConfig": {
                    "title": "\(toolName)",
                    "visible": false
                  },
                  "execution": {
                    "type": "mcp",
                    "mode": "local",
                    "toolName": "\(toolName)",
                    "version": "\(version)",
                    "artifactId": "\(serverName)"
                  }
                }
                """

                let toolFile = "\(eneyToolsDir)/\(toolName).json"
                try toolJSON.write(toFile: toolFile, atomically: true, encoding: .utf8)
                print("Created tool: \(toolFile)")
            }
        }

        // Step 2: Create MCP server folder
        try fm.createDirectory(atPath: mcpServerDir, withIntermediateDirectories: true)

        // Step 3: Copy binary
        let destBinary = "\(mcpServerDir)/mcp-server"
        if fm.fileExists(atPath: destBinary) {
            try fm.removeItem(atPath: destBinary)
        }
        try fm.copyItem(atPath: binaryPath, toPath: destBinary)

        // Make executable
        let attrs: [FileAttributeKey: Any] = [.posixPermissions: 0o755]
        try fm.setAttributes(attrs, ofItemAtPath: destBinary)
        print("Copied binary to: \(destBinary)")

        // Step 4: Create manifest.json
        let manifestJSON = """
        {
          "manifest_version": "0.3",
          "name": "\(serverName)",
          "version": "\(version)",
          "description": "\(serverDescription)",
          "author": {
            "name": "\(author)"
          },
          "server": {
            "type": "node",
            "entry_point": "mcp-server",
            "mcp_config": {
              "command": "\(destBinary)",
              "args": [],
              "env": {}
            }
          },
          "license": "MIT"
        }
        """

        let manifestFile = "\(mcpServerDir)/manifest.json"
        try manifestJSON.write(toFile: manifestFile, atomically: true, encoding: .utf8)
        print("Created manifest: \(manifestFile)")

        print("")
        print("Done! Restart Eney to load the extension.")
    }
}

// MARK: - Uninstall

struct Uninstall: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Uninstall a Swift MCP extension from Eney"
    )

    @Argument(help: "MCP server name (e.g. security-utilities-swift-mcp)")
    var serverName: String

    @Option(name: .long, parsing: .upToNextOption, help: "Widget tool names to remove from ~/.eney/tools/")
    var tools: [String] = []

    func run() throws {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let fm = FileManager.default

        // Remove tool JSONs
        for toolName in tools {
            let toolFile = "\(home)/.eney/tools/\(toolName).json"
            if fm.fileExists(atPath: toolFile) {
                try fm.removeItem(atPath: toolFile)
                print("Removed tool: \(toolFile)")
            }
        }

        // Remove MCP server folder
        let mcpServerDir = "\(home)/Library/Application Support/com.macpaw.assistant-macos.client-setapp/MCP/\(serverName)"
        if fm.fileExists(atPath: mcpServerDir) {
            try fm.removeItem(atPath: mcpServerDir)
            print("Removed: \(mcpServerDir)")
        }

        print("")
        print("Done! Restart Eney to apply changes.")
    }
}
