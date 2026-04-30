import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GetNetworkInfo from "./components/get-network-info.js";

const server = new McpServer(
{ name: "network-info-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GetNetworkInfo);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Network Info MCP Server running on stdio");
}

main().catch(console.error);
