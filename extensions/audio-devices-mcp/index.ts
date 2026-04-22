import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import AudioDeviceSwitcher from "./components/audio-device-switcher.js";

const server = new McpServer(
{ name: "audio-devices-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(AudioDeviceSwitcher);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Audio Devices MCP Server running on stdio");
}

main().catch(console.error);
