import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import VsCodeRecentsWidget from "./components/show_vscode_recents.js";

const server = new McpServer(
  { name: "vscode-recent-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(VsCodeRecentsWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("VS Code Recents MCP Server running on stdio");
}

main().catch(console.error);
