import { spawn } from "node:child_process";

export interface WhoisResult {
  raw: string;
  fields: Map<string, string[]>;
}

export async function runWhois(query: string, timeoutMs = 15000): Promise<WhoisResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn("whois", [query]);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`whois timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `whois exited with code ${code}`));
        return;
      }
      resolve({ raw: stdout, fields: parseFields(stdout) });
    });
  });
}

function parseFields(text: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("%") || line.startsWith("#") || line.startsWith(">>>")) continue;
    const match = line.match(/^\s*([^:]+?):\s*(.+?)\s*$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim();
    if (!value) continue;
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  }
  return map;
}

const FIELD_GROUPS: Array<{ label: string; keys: string[] }> = [
  { label: "Registrar", keys: ["Registrar", "Sponsoring Registrar", "registrar"] },
  { label: "Created", keys: ["Creation Date", "Created", "Registration Time", "created"] },
  { label: "Updated", keys: ["Updated Date", "Last Modified", "Last Updated On", "Modified", "changed"] },
  { label: "Expires", keys: ["Registry Expiry Date", "Registrar Registration Expiration Date", "Expiration Date", "Expires", "Expiry Date", "paid-till"] },
  { label: "Status", keys: ["Domain Status", "status"] },
  { label: "Name Servers", keys: ["Name Server", "nserver"] },
  { label: "DNSSEC", keys: ["DNSSEC"] },
  { label: "Registrant", keys: ["Registrant", "Registrant Name", "Registrant Organization"] },
  { label: "Registrant Country", keys: ["Registrant Country"] },
];

export interface SummaryRow {
  label: string;
  values: string[];
}

export function summarize(fields: Map<string, string[]>): SummaryRow[] {
  const rows: SummaryRow[] = [];
  for (const group of FIELD_GROUPS) {
    const values: string[] = [];
    const seen = new Set<string>();
    for (const key of group.keys) {
      const list = fields.get(key);
      if (!list) continue;
      for (const v of list) {
        if (!seen.has(v)) {
          seen.add(v);
          values.push(v);
        }
      }
    }
    if (values.length) rows.push({ label: group.label, values });
  }
  return rows;
}
