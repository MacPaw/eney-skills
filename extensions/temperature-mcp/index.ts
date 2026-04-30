import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ConvertTemperature from "./components/convert-temperature.js";

const server = new McpServer(
{ name: "temperature-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ConvertTemperature);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Temperature Converter MCP Server running on stdio");
}

main().catch(console.error);
