import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import LookupDns from "./components/lookup-dns.js";

const server = new McpServer(
{ name: "dns-lookup-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(LookupDns);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("DNS Lookup MCP Server running on stdio");
}

main().catch(console.error);
