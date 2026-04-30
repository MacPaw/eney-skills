import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CurrencyConverterWidget from "./components/convert_currency.js";

const server = new McpServer(
  { name: "currency-converter-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CurrencyConverterWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Currency Converter MCP Server running on stdio");
}

main().catch(console.error);
