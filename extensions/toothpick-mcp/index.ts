import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ToothpickSelector from "./components/toothpick-selector.js";

const server = new McpServer(
{ name: "toothpick-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ToothpickSelector);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Bluetooth device selection MCP Server running on stdio");
}

main().catch(console.error);
