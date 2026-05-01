import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  package: z.string().describe("Package name and optional version, e.g. 'react', 'react@18.2.0', '@eney/api'."),
});

type Props = z.infer<typeof schema>;

interface Size {
  name: string;
  version: string;
  size: number;
  gzip: number;
  dependencyCount: number;
  hasJSModule: boolean;
  hasSideEffects: boolean;
  isModuleType: boolean;
  description?: string;
  repository?: string;
  topDeps: { name: string; size: number }[];
}

interface RawSize {
  name: string;
  version: string;
  size: number;
  gzip: number;
  dependencyCount: number;
  hasJSModule?: boolean;
  hasSideEffects?: boolean | string[];
  isModuleType?: boolean;
  description?: string;
  repository?: string;
  dependencySizes?: { name: string; approximateSize: number }[];
}

async function fetchSize(pkg: string): Promise<Size> {
  const cleaned = pkg.trim();
  if (!cleaned) throw new Error("Empty package name.");
  const url = `https://bundlephobia.com/api/size?package=${encodeURIComponent(cleaned)}&record=true`;
  const res = await fetch(url, {
    headers: { "User-Agent": "eney-skills-mcp/1.0 (https://github.com/MacPaw/eney-skills)" },
  });
  if (res.status === 404) throw new Error(`Package "${cleaned}" not found.`);
  if (!res.ok) throw new Error(`Bundlephobia error ${res.status}`);
  const data = (await res.json()) as RawSize;
  return {
    name: data.name,
    version: data.version,
    size: data.size,
    gzip: data.gzip,
    dependencyCount: data.dependencyCount,
    hasJSModule: !!data.hasJSModule,
    hasSideEffects: data.hasSideEffects === true || (Array.isArray(data.hasSideEffects) && data.hasSideEffects.length > 0),
    isModuleType: !!data.isModuleType,
    description: data.description,
    repository: data.repository,
    topDeps: (data.dependencySizes ?? [])
      .slice()
      .sort((a, b) => b.approximateSize - a.approximateSize)
      .slice(0, 8)
      .map((d) => ({ name: d.name, size: d.approximateSize })),
  };
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function bar(size: number, max: number, width = 16): string {
  const blocks = Math.max(0, Math.round((size / max) * width));
  return "█".repeat(blocks) + "░".repeat(width - blocks);
}

function buildMarkdown(s: Size): string {
  const lines: string[] = [];
  lines.push(`### 📦 ${s.name}@${s.version}`);
  if (s.description) {
    lines.push("");
    lines.push(`> ${s.description}`);
  }
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Minified | **${fmtBytes(s.size)}** |`);
  lines.push(`| Gzipped | **${fmtBytes(s.gzip)}** |`);
  lines.push(`| Dependencies | ${s.dependencyCount} |`);
  lines.push(`| ESM module | ${s.isModuleType || s.hasJSModule ? "yes" : "no"} |`);
  lines.push(`| Side effects | ${s.hasSideEffects ? "yes (no tree-shaking)" : "no (tree-shakeable)"} |`);
  if (s.topDeps.length > 0) {
    const max = s.topDeps[0].size;
    lines.push("");
    lines.push("**Top dependencies by size:**");
    lines.push("");
    for (const d of s.topDeps) {
      lines.push(`- \`${d.name.padEnd(28)}\` ${bar(d.size, max)} ${fmtBytes(d.size)}`);
    }
  }
  if (s.repository) {
    lines.push("");
    lines.push(`[Repository](${s.repository}) · [Bundlephobia](https://bundlephobia.com/package/${encodeURIComponent(s.name)}@${encodeURIComponent(s.version)})`);
  }
  return lines.join("\n");
}

function BundleSize(props: Props) {
  const closeWidget = useCloseWidget();
  const [pkg, setPkg] = useState(props.package);
  const [info, setInfo] = useState<Size | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchSize(pkg)
      .then((s) => {
        if (cancelled) return;
        setInfo(s);
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
        `${info.name}@${info.version}: ${fmtBytes(info.size)} minified / ${fmtBytes(info.gzip)} gzipped, ` +
        `${info.dependencyCount} deps. Tree-shakeable: ${info.hasSideEffects ? "no" : "yes"}.`,
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Measuring bundle…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : info
          ? buildMarkdown(info)
          : "";

  return (
    <Form
      header={<CardHeader title="Bundle Size" iconBundleId="com.apple.Terminal" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="package"
        label="Package (name or name@version)"
        value={pkg}
        onChange={setPkg}
      />
    </Form>
  );
}

const BundleSizeWidget = defineWidget({
  name: "get_bundle_size",
  description:
    "Show the minified + gzipped JS bundle size of an npm package via Bundlephobia. Reports dependency count, ESM/CJS detection, side-effects status (tree-shakeability), and the top dependencies by size with bar charts.",
  schema,
  component: BundleSize,
});

export default BundleSizeWidget;
