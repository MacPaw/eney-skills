import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SendMessage from "./components/send-message.js";
import OpenMessagesChat from "./components/open-messages-chat.js";
import UnreadMessagesWidget from "./components/unread-messages.js";

const server = new McpServer(
  {
    name: "apple-messages-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      logging: {},
      resources: {},
    },
  },
);

const uixServer = setupUIXForMCP(server);

uixServer.registerWidget(SendMessage);
uixServer.registerWidget(OpenMessagesChat);
uixServer.registerWidget(UnreadMessagesWidget);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Apple Messages MCP Server running on stdio");
}

main().catch(console.error);
