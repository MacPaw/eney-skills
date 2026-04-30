export type Alignment = "left" | "center" | "right" | "none";

export interface ParseOptions {
  delimiter: string;
}

export function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === delimiter) {
      current.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r" && text[i + 1] === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      i += 2;
      continue;
    }
    if (c === "\n" || c === "\r") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field !== "" || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function escapePipes(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function rowsToMarkdownTable(rows: string[][], hasHeader: boolean, alignment: Alignment): string {
  if (!rows.length) return "";
  const columnCount = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => [...r, ...Array(columnCount - r.length).fill("")]);
  const header = hasHeader ? padded[0] : padded[0].map((_, i) => `Column ${i + 1}`);
  const body = hasHeader ? padded.slice(1) : padded;

  const separator = (() => {
    switch (alignment) {
      case "left":
        return ":---";
      case "center":
        return ":---:";
      case "right":
        return "---:";
      default:
        return "---";
    }
  })();

  const lines: string[] = [];
  lines.push("| " + header.map(escapePipes).join(" | ") + " |");
  lines.push("|" + Array(columnCount).fill(separator).map((s) => ` ${s} `).join("|") + "|");
  for (const row of body) lines.push("| " + row.map(escapePipes).join(" | ") + " |");
  return lines.join("\n");
}
