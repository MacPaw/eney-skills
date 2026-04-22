import { getApiKey } from "./keychain.js";

export function parseOptions(question: string): string[] {
  const cleaned = question.trim().replace(/\?$/, "");

  const orMatch = cleaned.match(/(.+?)\s+or\s+(.+)/i);
  if (orMatch) {
    const left = orMatch[1].replace(/^(should i|do i|can i|will i|would i|shall i)\s+/i, "").trim();
    const right = orMatch[2].trim();
    const all = [...left.split(/\s*,\s*/), right].map((o) => o.trim()).filter(Boolean);
    if (all.length >= 2) return all;
  }

  const parts = cleaned.split(/\s*,\s*/).map((o) => o.trim()).filter(Boolean);
  if (parts.length >= 2) return parts;

  return [];
}

export async function compareOptions(question: string, apiKey: string): Promise<string> {
  const options = parseOptions(question);
  if (options.length < 2) {
    throw new Error("Couldn't parse options. Try: *Pizza or sushi?* or *React, Vue, Svelte*");
  }

  return callApi(apiKey,
    `Compare these options: ${options.join(", ")}\n\nProvide:\n1. A markdown table comparing key features (rows = features, columns = options)\n2. A short paragraph: in which scenario is each option the better choice?\n\nBe concise and practical.`,
    1500
  );
}

async function callApi(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `HTTP ${response.status}`);
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  return data.content[0].text;
}

export async function generateRollReasoning(options: string[], chosen: string, apiKey: string): Promise<string> {
  return callApi(apiKey, `The universe has chosen: ${chosen}.

Write one absurd, confident reason why ${chosen} was chosen. Base it on something completely unrelated: cosmic signs, animal behaviour, ancient wisdom, weather, geology, a random historical event, superstition, etc.

Rules:
- Take a real proverb or saying from any country or language (NOT English — vary it: Japanese, Arabic, Ukrainian, Swahili, Brazilian, Finnish, etc.), then twist it so it naturally mentions "${chosen}"
- Output ONLY the twisted proverb/reasoning — do NOT mention the original proverb, do NOT say you are twisting or modifying anything, do NOT include any meta-commentary
- The twist should feel absurd and unexpected, not logical
- Every call should feel like a completely different style — never repeat the same proverb or structure
- Maximum 20 words total — be short and punchy`, 80);
}

export { getApiKey };
