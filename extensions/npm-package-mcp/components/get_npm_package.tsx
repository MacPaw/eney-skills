import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  name: z.string().describe("Package name, e.g. 'react', '@eney/api', 'lodash'."),
});

type Props = z.infer<typeof schema>;

interface PkgInfo {
  name: string;
  description?: string;
  latest: string;
  homepage?: string;
  repository?: string;
  license?: string;
  author?: string;
  maintainers: string[];
  keywords: string[];
  weeklyDownloads: number | null;
  npmUrl: string;
  modifiedAt?: string;
  createdAt?: string;
}

interface RegistryRaw {
  name: string;
  description?: string;
  "dist-tags": { latest: string };
  homepage?: string;
  repository?: { url?: string };
  license?: string;
  author?: { name?: string } | string;
  maintainers?: ({ name?: string } | string)[];
  keywords?: string[];
  time?: { modified?: string; created?: string };
}

function asName(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object" && "name" in x && typeof (x as { name?: unknown }).name === "string") {
    return (x as { name: string }).name;
  }
  return "";
}

async function fetchPackage(rawName: string): Promise<PkgInfo> {
  const cleaned = rawName.trim().replace(/^@?npm:/, "");
  if (!cleaned) throw new Error("Empty package name.");
  const encoded = cleaned.startsWith("@")
    ? `@${encodeURIComponent(cleaned.slice(1))}`
    : encodeURIComponent(cleaned);
  const res = await fetch(`https://registry.npmjs.org/${encoded}`);
  if (res.status === 404) throw new Error(`No npm package named "${cleaned}".`);
  if (!res.ok) throw new Error(`npm registry error ${res.status}`);
  const data = (await res.json()) as RegistryRaw;

  let weekly: number | null = null;
  try {
    const dRes = await fetch(`https://api.npmjs.org/downloads/point/last-week/${encoded}`);
    if (dRes.ok) {
      const d = (await dRes.json()) as { downloads?: number };
      weekly = d.downloads ?? null;
    }
  } catch {
    /* ignore */
  }

  const repoUrl = data.repository?.url
    ?.replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/\.git$/, "");

  return {
    name: data.name,
    description: data.description,
    latest: data["dist-tags"]?.latest ?? "?",
    homepage: data.homepage,
    repository: repoUrl,
    license: data.license,
    author: typeof data.author === "string" ? data.author : data.author?.name,
    maintainers: (data.maintainers ?? []).map(asName).filter(Boolean),
    keywords: (data.keywords ?? []).slice(0, 12),
    weeklyDownloads: weekly,
    npmUrl: `https://www.npmjs.com/package/${cleaned}`,
    modifiedAt: data.time?.modified,
    createdAt: data.time?.created,
  };
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function buildMarkdown(p: PkgInfo): string {
  const lines: string[] = [];
  lines.push(`### ${p.name}@${p.latest}`);
  if (p.description) {
    lines.push("");
    lines.push(`> ${p.description}`);
  }
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  if (p.weeklyDownloads !== null) {
    lines.push(`| Weekly downloads | **${p.weeklyDownloads.toLocaleString()}** |`);
  }
  if (p.license) lines.push(`| License | ${p.license} |`);
  if (p.author) lines.push(`| Author | ${p.author} |`);
  if (p.maintainers.length > 0) {
    lines.push(`| Maintainers | ${p.maintainers.slice(0, 5).join(", ")}${p.maintainers.length > 5 ? "…" : ""} |`);
  }
  if (p.homepage) lines.push(`| Homepage | ${p.homepage} |`);
  if (p.repository) lines.push(`| Repository | ${p.repository} |`);
  lines.push(`| Published | ${fmtDate(p.createdAt)} |`);
  lines.push(`| Last update | ${fmtDate(p.modifiedAt)} |`);
  if (p.keywords.length > 0) {
    lines.push("");
    lines.push(`**Keywords:** ${p.keywords.map((k) => `\`${k}\``).join(" · ")}`);
  }
  lines.push("");
  lines.push(`[Open on npmjs.com](${p.npmUrl})`);
  return lines.join("\n");
}

function NpmPackage(props: Props) {
  const closeWidget = useCloseWidget();
  const [name, setName] = useState(props.name);
  const [info, setInfo] = useState<PkgInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchPackage(name)
      .then((p) => {
        if (cancelled) return;
        setInfo(p);
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

  function onDone() {
    if (info) {
      closeWidget(
        `${info.name}@${info.latest}: ${info.description ?? ""}. ` +
        (info.weeklyDownloads !== null ? `${info.weeklyDownloads.toLocaleString()} weekly downloads. ` : "") +
        `${info.npmUrl}`,
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Looking up package…_ 📦"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : info
          ? buildMarkdown(info)
          : "";

  return (
    <Form
      header={<CardHeader title="npm Package" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField name="name" label="Package name" value={name} onChange={setName} />
    </Form>
  );
}

const NpmPackageWidget = defineWidget({
  name: "get_npm_package",
  description:
    "Look up an npm package: latest version, description, weekly downloads, license, author, maintainers, homepage, repository, and keywords. Sources data from the public npm registry (registry.npmjs.org) and download stats from api.npmjs.org. No key required.",
  schema,
  component: NpmPackage,
});

export default NpmPackageWidget;
