import Foundation
import MCP
import Logging

actor NotesAppleScript {
    private let logger: Logger
    
    init(logger: Logger) {
        self.logger = logger
    }
    
    func runScript(_ script: String) async throws -> String {
        logger.info("Executing AppleScript...")

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
        process.arguments = ["-e", script]

        let stdoutPipe = Pipe()

        process.standardOutput = stdoutPipe

        try process.run()

        let data = stdoutPipe.fileHandleForReading.readDataToEndOfFile()

        let output = String(data: data, encoding: .utf8) ?? "No data"
        logger.info("Executed AppleScript with chars count - \(output.count)")

        return output
    }
    
    func getNote(identifier: String) async throws -> [String: String]? {
        let script = """
        tell application "Notes"
            try
                set targetNote to null
                repeat with eachNote in notes
                    if (name of eachNote as string) contains "\(identifier)" or (id of eachNote as string) = "\(identifier)" then
                        set targetNote to eachNote
                        exit repeat
                    end if
                end repeat
                
                if targetNote is not null then
                    set noteName to name of targetNote
                    set noteBody to body of targetNote
                    return noteName & "|^|" & noteBody
                else
                    return ""
                end if
            on error errMsg
                return "ERROR: " & errMsg
            end try
        end tell
        """
        
        let result = try await runScript(script)
        
        if result.isEmpty || result.hasPrefix("ERROR:") {
            return nil
        }
        
        let parts = result.components(separatedBy: "|^|")
        if parts.count >= 2 {
            return [
                "name": parts[0].trimmingCharacters(in: .whitespacesAndNewlines),
                "body": parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
            ]
        }
        
        return nil
    }
}

// MARK: - Main Server

LoggingSystem.bootstrap { label in
    var handler = StreamLogHandler.standardError(label: label)
    handler.logLevel = .info
    return handler
}

let logger = Logger(label: "com.noteBodyMCP.server")

let server = Server(
    name: "NoteBodyMCP",
    version: "1.0.0"
)

let notesScript = NotesAppleScript(logger: logger)

await server.withMethodHandler(ListTools.self) { _ in
    return .init(tools: [
        Tool(
            name: "get_note",
            description: "Get a specific note by its name or ID. Returns the note's name and body.",
            inputSchema: .object([
                "type": .string("object"),
                "properties": .object([
                    "identifier": .object([
                        "type": .string("string"),
                        "description": .string("The name or ID of the note to retrieve")
                    ])
                ]),
                "required": .array([.string("identifier")])
            ])
        )
    ])
}

await server.withMethodHandler(CallTool.self) { params in
    do {
        switch params.name {
        case "get_note":
            logger.info("did receive get_note tool call")
            guard let arguments = params.arguments,
                  let identifierValue = arguments["identifier"],
                  let identifier = String(identifierValue) else {
                return .init(
                    content: [.text("Identifier is required")],
                    isError: true
                )
            }

            logger.debug("did start get_note tool execution, identifier - \(identifier)")
            if let note = try await notesScript.getNote(identifier: identifier) {
                let name = note["name", default: "no name"]
                let body = note["body", default: "body"]
                let resultString = """
                    This is the requested note:
                        Name: 
                            \(name)
                        Content: 
                            \(body)
                    """
                logger.info("did end get_note tool execution with success, identifier - \(identifier)")
                return .init(
                    content: [.text(resultString)],
                    isError: false
                )
            } else {
                logger.info("did end get_note tool execution with error, identifier - \(identifier)")
                return .init(
                    content: [.text("Note not found")],
                    isError: true
                )
            }
        default:
            return .init(
                content: [.text("Unknown tool: \(params.name)")],
                isError: true
            )
        }
    } catch {
        logger.error("Error executing tool \(params.name): \(error.localizedDescription)")
        return .init(
            content: [.text("Error: \(error.localizedDescription)")],
            isError: true
        )
    }
}

do {
    let transport = StdioTransport()
    logger.info("Starting NoteBodyMCP Server...")
    try await server.start(transport: transport)
    await server.waitUntilCompleted()
} catch {
    logger.error("Server error: \(error.localizedDescription)")
    exit(1)
}
