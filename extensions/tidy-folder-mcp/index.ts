import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import TidyFolder from "./components/tidy-folder.js";

const server = new McpServer(
{ name: "tidy-folder-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(TidyFolder);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Tidy Folder MCP Server running on stdio");
}

main().catch(console.error);
