import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SearchContacts from "./components/search-contacts.js";

const server = new McpServer(
{ name: "apple-contacts-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SearchContacts);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Apple Contacts MCP Server running on stdio");
}

main().catch(console.error);
