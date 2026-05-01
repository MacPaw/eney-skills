import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  id: z.string().optional().describe("Exact SPDX identifier, e.g. 'MIT', 'Apache-2.0', 'GPL-3.0-only'."),
  query: z.string().optional().describe("Substring search across SPDX id and license name. Used when id isn't provided."),
});

type Props = z.infer<typeof schema>;

interface SpdxLicense {
  licenseId: string;
  name: string;
  reference: string;
  isOsiApproved?: boolean;
  isFsfLibre?: boolean;
  isDeprecatedLicenseId?: boolean;
  seeAlso?: string[];
}

interface RawList {
  licenseListVersion: string;
  licenses: SpdxLicense[];
}

let cache: { version: string; licenses: SpdxLicense[] } | null = null;

async function fetchList(): Promise<{ version: string; licenses: SpdxLicense[] }> {
  if (cache) return cache;
  const res = await fetch("https://raw.githubusercontent.com/spdx/license-list-data/main/json/licenses.json");
  if (!res.ok) throw new Error(`SPDX list error ${res.status}`);
  const data = (await res.json()) as RawList;
  cache = { version: data.licenseListVersion, licenses: data.licenses };
  return cache;
}

function buildIdMarkdown(l: SpdxLicense): string {
  const lines: string[] = [];
  lines.push(`### ${l.name}`);
  lines.push(`**SPDX ID:** \`${l.licenseId}\``);
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| OSI approved | ${l.isOsiApproved ? "✅ yes" : "—"} |`);
  lines.push(`| FSF libre | ${l.isFsfLibre ? "✅ yes" : "—"} |`);
  lines.push(`| Deprecated | ${l.isDeprecatedLicenseId ? "⚠️ yes" : "no"} |`);
  lines.push("");
  lines.push(`[Reference page](${l.reference})`);
  if (l.seeAlso && l.seeAlso.length > 0) {
    lines.push("");
    lines.push("**See also:**");
    for (const url of l.seeAlso.slice(0, 5)) lines.push(`- ${url}`);
  }
  return lines.join("\n");
}

function buildSearchMarkdown(query: string, hits: SpdxLicense[]): string {
  if (hits.length === 0) return `_No SPDX licenses match "${query}"._`;
  const lines: string[] = [];
  lines.push(`### ${hits.length} match${hits.length === 1 ? "" : "es"} for "${query}"`);
  lines.push("");
  for (const l of hits.slice(0, 30)) {
    const flags: string[] = [];
    if (l.isOsiApproved) flags.push("OSI");
    if (l.isFsfLibre) flags.push("FSF");
    if (l.isDeprecatedLicenseId) flags.push("deprecated");
    lines.push(`- \`${l.licenseId}\` — ${l.name}${flags.length ? ` _(${flags.join(", ")})_` : ""}`);
  }
  if (hits.length > 30) lines.push("\n_…showing first 30; refine the query for fewer results._");
  return lines.join("\n");
}

function SpdxLicense(props: Props) {
  const closeWidget = useCloseWidget();
  const [id, setId] = useState(props.id ?? "");
  const [query, setQuery] = useState(props.query ?? "");
  const [info, setInfo] = useState<SpdxLicense | null>(null);
  const [hits, setHits] = useState<SpdxLicense[]>([]);
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchList()
      .then((d) => {
        if (cancelled) return;
        setVersion(d.version);
        const trimmedId = id.trim();
        const trimmedQuery = query.trim();
        if (trimmedId) {
          const exact =
            d.licenses.find((l) => l.licenseId.toLowerCase() === trimmedId.toLowerCase()) ?? null;
          setInfo(exact);
          setHits([]);
          if (!exact) {
            setErrorMsg(`No license with SPDX id "${trimmedId}".`);
            setStatus("error");
            return;
          }
        } else if (trimmedQuery) {
          const q = trimmedQuery.toLowerCase();
          const matched = d.licenses.filter(
            (l) => l.licenseId.toLowerCase().includes(q) || l.name.toLowerCase().includes(q),
          );
          setInfo(null);
          setHits(matched);
        } else {
          setInfo(null);
          setHits(d.licenses);
        }
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [reloadCount]);

  function onLookup() {
    setReloadCount((c) => c + 1);
  }

  function onPreset(presetId: string) {
    setId(presetId);
    setQuery("");
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (info) {
      const flags: string[] = [];
      if (info.isOsiApproved) flags.push("OSI approved");
      if (info.isFsfLibre) flags.push("FSF libre");
      if (info.isDeprecatedLicenseId) flags.push("deprecated");
      closeWidget(
        `${info.licenseId} — ${info.name}${flags.length ? ` (${flags.join(", ")})` : ""}. ${info.reference}`,
      );
      return;
    }
    if (hits.length > 0) {
      const summary = hits.slice(0, 20).map((l) => `${l.licenseId} (${l.name})`).join("; ");
      closeWidget(`SPDX matches for "${query}": ${summary}${hits.length > 20 ? "; …" : ""}`);
      return;
    }
    closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
  }

  let markdown: string;
  if (status === "loading") {
    markdown = "_Loading SPDX list…_";
  } else if (status === "error") {
    markdown = `**Error:** ${errorMsg}`;
  } else if (info) {
    markdown = `${buildIdMarkdown(info)}\n\n_License list version: ${version}_`;
  } else if (hits.length > 0) {
    markdown = `${buildSearchMarkdown(query.trim() || "(all)", hits)}\n\n_List version: ${version}_`;
  } else {
    markdown = "_Enter an SPDX id or a query._";
  }

  return (
    <Form
      header={<CardHeader title="SPDX License" iconBundleId="com.apple.dt.Xcode" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="MIT" onAction={() => onPreset("MIT")} style="secondary" />
          <Action title="Apache-2.0" onAction={() => onPreset("Apache-2.0")} style="secondary" />
          <Action title="GPL-3.0-only" onAction={() => onPreset("GPL-3.0-only")} style="secondary" />
          <Action title="BSD-3-Clause" onAction={() => onPreset("BSD-3-Clause")} style="secondary" />
          <Action title="ISC" onAction={() => onPreset("ISC")} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="id" label="SPDX id (exact)" value={id} onChange={setId} />
      <Form.TextField name="query" label="Or substring query" value={query} onChange={setQuery} />
    </Form>
  );
}

const SpdxWidget = defineWidget({
  name: "lookup_spdx_license",
  description:
    "Look up an open-source license by exact SPDX identifier (e.g. 'MIT', 'Apache-2.0') or run a substring search across all SPDX licenses. Reports OSI-approved / FSF-libre / deprecated flags and a reference URL. Sources data from the spdx/license-list-data repository (CC0 metadata).",
  schema,
  component: SpdxLicense,
});

export default SpdxWidget;
