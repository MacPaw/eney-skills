export interface ParseOptions {
  delimiter: string;
  hasHeader: boolean;
}

export type ParseResult =
  | { ok: true; rows: Record<string, string>[] | string[][]; columnCount: number }
  | { ok: false; error: string };

function parseRows(text: string, delimiter: string): string[][] {
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

export function parseCsv(text: string, options: ParseOptions): ParseResult {
  if (!text.trim()) return { ok: false, error: "Input is empty." };
  let rows: string[][];
  try {
    rows = parseRows(text, options.delimiter || ",");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!rows.length) return { ok: false, error: "No rows parsed." };

  const columnCount = Math.max(...rows.map((r) => r.length));

  if (!options.hasHeader) {
    return { ok: true, rows: rows.map((r) => [...r, ...Array(columnCount - r.length).fill("")]), columnCount };
  }

  const [header, ...dataRows] = rows;
  const objects: Record<string, string>[] = dataRows.map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key] = row[idx] ?? "";
    });
    return obj;
  });
  return { ok: true, rows: objects, columnCount };
}
