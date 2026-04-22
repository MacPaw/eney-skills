import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CleanKeyboard from "./components/clean-keyboard.js";

const server = new McpServer(
{ name: "keyboard-cleaner-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CleanKeyboard);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Keyboard Cleaner MCP Server running on stdio");
}

main().catch(console.error);
