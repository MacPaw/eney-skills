import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GenerateGradient from "./components/generate-gradient.js";

const server = new McpServer(
{ name: "gradient-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GenerateGradient);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("CSS Gradient MCP Server running on stdio");
}

main().catch(console.error);
