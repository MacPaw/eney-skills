/**
 * Converts a markdown string into a list of Google Docs batchUpdate requests.
 * Supported syntax:
 *   # Heading 1
 *   ## Heading 2
 *   ### Heading 3
 *   - list item  (also * list item)
 *   plain text
 *
 * @param content  Markdown text
 * @param startIndex  The document character index to begin inserting at (1 for new docs, lastEndIndex-1 for append)
 */
export function markdownToDocRequests(content: string, startIndex: number): object[] {
  const requests: object[] = [];
  const lines = content.split("\n");
  let index = startIndex;

  for (const line of lines) {
    let text = line;
    let style: string | null = null;
    let isList = false;

    if (line.startsWith("### ")) {
      text = line.slice(4);
      style = "HEADING_3";
    } else if (line.startsWith("## ")) {
      text = line.slice(3);
      style = "HEADING_2";
    } else if (line.startsWith("# ")) {
      text = line.slice(2);
      style = "HEADING_1";
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      text = line.slice(2);
      isList = true;
    }

    const textToInsert = text + "\n";
    const endIndex = index + textToInsert.length;

    requests.push({
      insertText: {
        location: { index },
        text: textToInsert,
      },
    });

    if (style) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: endIndex - 1 },
          paragraphStyle: { namedStyleType: style },
          fields: "namedStyleType",
        },
      });
    }

    if (isList) {
      requests.push({
        createParagraphBullets: {
          range: { startIndex: index, endIndex: endIndex - 1 },
          bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
        },
      });
    }

    index = endIndex;
  }

  return requests;
}

export function hasMarkdown(content: string): boolean {
  return /^(#{1,3} |- |\* )/m.test(content);
}

export function categorizeError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("401") || lower.includes("unauthenticated") || lower.includes("token")) {
    return `**Auth error:** Your session may have expired. Try re-connecting your Google account.\n\n> ${msg}`;
  }
  if (lower.includes("403") || lower.includes("permission") || lower.includes("forbidden")) {
    return `**Permission error:** You may not have access to this resource.\n\n> ${msg}`;
  }
  if (lower.includes("404") || lower.includes("not found")) {
    return `**Not found:** The resource could not be located.\n\n> ${msg}`;
  }
  if (lower.includes("network") || lower.includes("timeout") || lower.includes("econnrefused")) {
    return `**Network error:** Check your internet connection.\n\n> ${msg}`;
  }
  return `**Error:** ${msg}`;
}
