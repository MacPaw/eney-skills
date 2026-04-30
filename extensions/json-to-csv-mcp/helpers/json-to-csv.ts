// JSON-to-CSV converter following RFC 4180. Always quotes values that
// contain the delimiter, a quote, or a newline; doubles embedded quotes.

export type Delimiter = "," | ";" | "\t" | "|";

export interface ConvertOptions {
  delimiter: Delimiter;
  flatten: boolean;
  forceQuoteAll: boolean;
}

export interface ConvertResult {
  csv: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      Object.assign(out, flattenObject(value, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  // arrays, nested objects (when flatten=false): JSON-encode
  return JSON.stringify(value);
}

function escapeCell(raw: string, delimiter: string, forceQuoteAll: boolean): string {
  const needsQuoting =
    forceQuoteAll ||
    raw.includes(delimiter) ||
    raw.includes('"') ||
    raw.includes("\n") ||
    raw.includes("\r");
  if (!needsQuoting) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

export function convert(input: string, options: ConvertOptions): ConvertResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { csv: "", rowCount: 0, columnCount: 0, headers: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Accept either a top-level array or a single object (treated as one row).
  let rows: unknown[];
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (isPlainObject(parsed)) {
    rows = [parsed];
  } else {
    throw new Error("Top-level JSON must be an array of objects or a single object.");
  }

  if (rows.length === 0) {
    return { csv: "", rowCount: 0, columnCount: 0, headers: [] };
  }

  // Normalize each row to a flat object
  const normalized: Record<string, unknown>[] = rows.map((r, i) => {
    if (!isPlainObject(r)) {
      throw new Error(`Row ${i + 1} is not an object (got ${typeof r}).`);
    }
    return options.flatten ? flattenObject(r) : r;
  });

  // Header set is the union of all keys, preserving first-seen order
  const headerOrder: string[] = [];
  const headerSet = new Set<string>();
  for (const row of normalized) {
    for (const key of Object.keys(row)) {
      if (!headerSet.has(key)) {
        headerSet.add(key);
        headerOrder.push(key);
      }
    }
  }

  const lines: string[] = [];
  lines.push(headerOrder.map((h) => escapeCell(h, options.delimiter, options.forceQuoteAll)).join(options.delimiter));
  for (const row of normalized) {
    const cells = headerOrder.map((h) => escapeCell(formatCell(row[h]), options.delimiter, options.forceQuoteAll));
    lines.push(cells.join(options.delimiter));
  }

  return {
    csv: lines.join("\n"),
    rowCount: normalized.length,
    columnCount: headerOrder.length,
    headers: headerOrder,
  };
}
