import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SearchNotes from "./components/search-notes.js";
import CreateNote from "./components/create-note.js";
import EditNote from "./components/edit-note.js";

const server = new McpServer(
{ name: "obsidian-knowledge-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SearchNotes);
uixServer.registerWidget(CreateNote);
uixServer.registerWidget(EditNote);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Obsidian Knowledge MCP Server running on stdio");
}

main().catch(console.error);
