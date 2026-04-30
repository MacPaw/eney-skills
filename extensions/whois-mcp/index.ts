import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import LookupWhois from "./components/lookup-whois.js";

const server = new McpServer(
{ name: "whois-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(LookupWhois);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Whois MCP Server running on stdio");
}

main().catch(console.error);
