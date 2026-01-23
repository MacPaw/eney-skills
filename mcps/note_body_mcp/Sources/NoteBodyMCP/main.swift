import Foundation
import MCP
import Logging
import SQLite3

// MARK: - Environment Config

struct EnvConfig {
    let authKey: String?
    let summaryURL: String?
    
    init() {
        self.authKey = ProcessInfo.processInfo.environment["AUTH_KEY"]
        self.summaryURL = ProcessInfo.processInfo.environment["SUMMARY_URL"]
    }
    
    var isConfigured: Bool {
        authKey != nil && summaryURL != nil
    }
}

// MARK: - Summary API Models

struct SummaryRequestParam: Codable {
    let value: String
    let id: String
}

struct SummaryRequest: Codable {
    let params: [SummaryRequestParam]
    let files: [String]
    let apiName: String
}

struct SummaryResponse: Codable {
    let files: [String]
    let response: String
}

// MARK: - Summary API Client

actor SummaryAPIClient {
    private let logger: Logger
    private let config: EnvConfig
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    
    init(logger: Logger, config: EnvConfig) {
        self.logger = logger
        self.config = config
    }
    
    func sendSummaryRequest(snippet: String) async throws -> String? {
        guard let authKey = config.authKey,
              let summaryURL = config.summaryURL,
              let url = URL(string: summaryURL) else {
            logger.warning("Summary API not configured - AUTH_KEY or SUMMARY_URL missing")
            return nil
        }
        
        logger.info("Sending summary request to: \(summaryURL)")
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(authKey)", forHTTPHeaderField: "Authorization")
        
        let body = SummaryRequest(
            params: [SummaryRequestParam(value: snippet, id: "text")],
            files: [],
            apiName: "general_summary"
        )
        
        request.httpBody = try encoder.encode(body)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        if let httpResponse = response as? HTTPURLResponse {
            logger.info("Summary API response status: \(httpResponse.statusCode)")
        }
        
        let summaryResponse = try decoder.decode(SummaryResponse.self, from: data)
        logger.info("Summary API response received")
        
        return summaryResponse.response
    }
}

// MARK: - Note Models

struct NoteSummary {
    let id: String
    let pk: Int
    let title: String
    let folder: String
    let modifiedAt: String
    let snippet: String
    let account: String?
    let uuid: String
    let locked: Bool
    let pinned: Bool
    let checklist: Bool
    let checklistInProgress: Bool
}

actor NotesSQLite {
    private let logger: Logger
    private let databasePath: String
    
    init(logger: Logger) {
        self.logger = logger
        let homeDirectory = FileManager.default.homeDirectoryForCurrentUser.path
        self.databasePath = "\(homeDirectory)/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite"
    }
    
    func getNoteSummary(title: String) async throws -> NoteSummary? {
        logger.info("Searching for note with title containing: \(title)")
        
        var db: OpaquePointer?
        
        guard sqlite3_open_v2(databasePath, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            logger.error("Failed to open database: \(errorMessage)")
            sqlite3_close(db)
            return nil
        }
        
        defer {
            sqlite3_close(db)
        }
        
        let query = """
            SELECT
                'x-coredata://' || zmd.z_uuid || '/ICNote/p' || note.z_pk AS id,
                note.z_pk AS pk,
                note.ztitle1 AS title,
                folder.ztitle2 AS folder,
                datetime(note.zmodificationdate1 + 978307200, 'unixepoch') AS modifiedAt,
                note.zsnippet AS snippet,
                acc.zname AS account,
                note.zidentifier AS UUID,
                (note.zispasswordprotected = 1) as locked,
                (note.zispinned = 1) as pinned,
                (note.zhaschecklist = 1) as checklist,
                (note.zhaschecklistinprogress = 1) as checklistInProgress
            FROM 
                ziccloudsyncingobject AS note
            INNER JOIN ziccloudsyncingobject AS folder 
                ON note.zfolder = folder.z_pk
            LEFT JOIN ziccloudsyncingobject AS acc 
                ON note.zaccount4 = acc.z_pk
            LEFT JOIN z_metadata AS zmd ON 1=1
            WHERE
                note.ztitle1 IS NOT NULL AND
                note.zmodificationdate1 IS NOT NULL AND
                note.z_pk IS NOT NULL AND
                note.zmarkedfordeletion != 1 AND
                folder.zmarkedfordeletion != 1 AND
                LOWER(note.ztitle1) LIKE LOWER(?)
            ORDER BY
                note.zmodificationdate1 DESC
            LIMIT 1
            """
        
        var statement: OpaquePointer?
        
        guard sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            logger.error("Failed to prepare statement: \(errorMessage)")
            return nil
        }
        
        defer {
            sqlite3_finalize(statement)
        }
        
        let searchPattern = "%\(title)%"
        sqlite3_bind_text(statement, 1, searchPattern, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
        
        guard sqlite3_step(statement) == SQLITE_ROW else {
            logger.info("No note found with title containing: \(title)")
            return nil
        }
        
        let id = String(cString: sqlite3_column_text(statement, 0))
        let pk = Int(sqlite3_column_int(statement, 1))
        let noteTitle = String(cString: sqlite3_column_text(statement, 2))
        let folder = String(cString: sqlite3_column_text(statement, 3))
        let modifiedAt = String(cString: sqlite3_column_text(statement, 4))
        let snippet = sqlite3_column_text(statement, 5).map { String(cString: $0) } ?? ""
        let account = sqlite3_column_text(statement, 6).map { String(cString: $0) }
        let uuid = String(cString: sqlite3_column_text(statement, 7))
        let locked = sqlite3_column_int(statement, 8) == 1
        let pinned = sqlite3_column_int(statement, 9) == 1
        let checklist = sqlite3_column_int(statement, 10) == 1
        let checklistInProgress = sqlite3_column_int(statement, 11) == 1
        
        logger.info("Found note: \(noteTitle)")
        
        return NoteSummary(
            id: id,
            pk: pk,
            title: noteTitle,
            folder: folder,
            modifiedAt: modifiedAt,
            snippet: snippet,
            account: account,
            uuid: uuid,
            locked: locked,
            pinned: pinned,
            checklist: checklist,
            checklistInProgress: checklistInProgress
        )
    }
}

// MARK: - Main Server

LoggingSystem.bootstrap { label in
    var handler = StreamLogHandler.standardError(label: label)
    handler.logLevel = .info
    return handler
}

let logger = Logger(label: "com.noteBodyMCP.server")

let envConfig = EnvConfig()
if envConfig.isConfigured {
    logger.info("Summary API configured with URL: \(envConfig.summaryURL ?? "")")
} else {
    logger.warning("Summary API not configured - AUTH_KEY or SUMMARY_URL missing from environment")
}

let server = Server(
    name: "NoteBodyMCP",
    version: "1.0.0",
    capabilities: .init(
        tools: .init(listChanged: true)
    )
)

let notesSQLite = NotesSQLite(logger: logger)
let summaryClient = SummaryAPIClient(logger: logger, config: envConfig)

await server.withMethodHandler(ListTools.self) { _ in
    return .init(tools: [
        Tool(
            name: "get_note_summary",
            description: "Search for a note by its title and get a summary. Returns note metadata and snippet.",
            inputSchema: .object([
                "type": .string("object"),
                "properties": .object([
                    "title": .object([
                        "type": .string("string"),
                        "description": .string("The title (or partial title) of the note to search for")
                    ])
                ]),
                "required": .array([.string("title")])
            ])
        )
    ])
}

await server.withMethodHandler(CallTool.self) { params in
    do {
        switch params.name {
        case "get_note_summary":
            logger.info("did receive get_note_summary tool call")
            guard let arguments = params.arguments,
                  let titleValue = arguments["title"],
                  let title = String(titleValue) else {
                return .init(
                    content: [.text("Title is required")],
                    isError: true
                )
            }

            logger.debug("did start get_note_summary tool execution, title - \(title)")
            if let note = try await notesSQLite.getNoteSummary(title: title) {
                // Send snippet to summary API
                if envConfig.isConfigured {
                    do {
                        if let apiResponse = try await summaryClient.sendSummaryRequest(snippet: note.snippet) {
                            logger.info("did end get_note_summary tool execution with success, title - \(title)")
                            return .init(
                                content: [.text(apiResponse)],
                                isError: false
                            )
                        }
                    } catch {
                        logger.error("Failed to get API summary: \(error.localizedDescription)")
                        return .init(
                            content: [.text("Failed to get summary: \(error.localizedDescription)")],
                            isError: true
                        )
                    }
                }
                
                // Fallback if API not configured
                logger.info("did end get_note_summary tool execution with success (no API), title - \(title)")
                return .init(
                    content: [.text(note.snippet)],
                    isError: false
                )
            } else {
                logger.info("did end get_note_summary tool execution with error, title - \(title)")
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
    logger.info("Finishing NoteBodyMCP Server...")
} catch {
    logger.error("Server error: \(error.localizedDescription)")
    exit(1)
}
