import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import TestRegex from "./components/test-regex.js";

const server = new McpServer(
{ name: "regex-tester-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(TestRegex);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Regex Tester MCP Server running on stdio");
}

main().catch(console.error);
