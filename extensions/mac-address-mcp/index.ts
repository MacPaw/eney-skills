import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import MacVendorWidget from "./components/lookup_mac_vendor.js";

const server = new McpServer(
  { name: "mac-address-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(MacVendorWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MAC Address Vendor MCP Server running on stdio");
}

main().catch(console.error);
