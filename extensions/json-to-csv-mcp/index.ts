import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import JsonToCsvWidget from "./components/convert_json_to_csv.js";

const server = new McpServer(
  { name: "json-to-csv-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(JsonToCsvWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("JSON to CSV MCP Server running on stdio");
}

main().catch(console.error);
