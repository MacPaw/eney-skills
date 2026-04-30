import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ValidateLuhn from "./components/validate-luhn.js";

const server = new McpServer(
{ name: "luhn-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ValidateLuhn);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Luhn Validator MCP Server running on stdio");
}

main().catch(console.error);
