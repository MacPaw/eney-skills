import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GetClipboard from "./components/get-clipboard.js";
import SetClipboard from "./components/set-clipboard.js";

const server = new McpServer(
  { name: "clipboard-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GetClipboard);
uixServer.registerWidget(SetClipboard);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Clipboard MCP Server running on stdio");
}

main().catch(console.error);
