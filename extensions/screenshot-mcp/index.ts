import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import TakeScreenshot from "./components/take-screenshot.js";

const server = new McpServer(
{ name: "screenshot-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(TakeScreenshot);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Screenshot MCP Server running on stdio");
}

main().catch(console.error);
