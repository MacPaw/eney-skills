import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import OpenInFinder from "./components/open-in-finder.js";
import NewFolder from "./components/new-folder.js";

const server = new McpServer(
  { name: "finder-actions-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(OpenInFinder);
uixServer.registerWidget(NewFolder);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Finder Actions MCP Server running on stdio");
}

main().catch(console.error);
