import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const LIVESCORE_URL = "https://livescoremcp.com/sse";

export async function callTool(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const transport = new SSEClientTransport(new URL(LIVESCORE_URL));
  const client = new Client(
    { name: "football-scores-mcp", version: "1.0.0" },
    { capabilities: {} },
  );

  await client.connect(transport);
  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    const content = result.content;
    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text as string)
        .join("\n");
    }
    return JSON.stringify(result);
  } finally {
    await client.close();
  }
}
