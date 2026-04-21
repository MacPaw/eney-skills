import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  Form,
  Paper,
  CardHeader,
  defineWidget,
  useCloseWidget,
} from "@eney/api";
import { readFile, writeFile, mkdir, appendFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname, basename } from "node:path";
import { exec } from "node:child_process";

const schema = z.object({
  content: z
    .string()
    .optional()
    .describe(
      "Optional prefilled content to capture into Obsidian. The widget will still auto-detect type (URL / task / code / note) and format accordingly.",
    ),
  tags: z
    .string()
    .optional()
    .describe("Optional comma-separated tags to attach to the note (without the # prefix)."),
});

type Props = z.infer<typeof schema>;

// --- Vault discovery ---

interface VaultInfo {
  id: string;
  path: string;
  name: string;
}

async function loadVaults(): Promise<VaultInfo[]> {
  const configPath = join(
    homedir(),
    "Library",
    "Application Support",
    "obsidian",
    "obsidian.json",
  );
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      vaults?: Record<string, { path: string; ts: number; open?: boolean }>;
    };
    const entries = parsed.vaults ?? {};
    return Object.entries(entries)
      .map(([id, v]) => ({
        id,
        path: v.path,
        name: basename(v.path),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// --- Smart content detection ---

type CaptureType = "auto" | "note" | "link" | "task" | "code" | "quote";
type CaptureMode = "new-note" | "append-inbox" | "append-daily";

const URL_REGEX = /^(https?:\/\/\S+)$/i;
const HASHTAG_REGEX = /(^|\s)#([a-zA-Z][a-zA-Z0-9_-]{1,30})/g;

function detectType(raw: string): Exclude<CaptureType, "auto"> {
  const content = raw.trim();
  if (!content) return "note";
  if (URL_REGEX.test(content)) return "link";
  if (/^```/m.test(content) || /^( {4}|\t)/m.test(content)) return "code";
  if (/^(todo|- \[ \]|\[ \])\b/i.test(content) || /^todo:/i.test(content)) {
    return "task";
  }
  if (/^>\s/m.test(content) || (content.startsWith('"') && content.endsWith('"'))) {
    return "quote";
  }
  return "note";
}

function extractHashtags(content: string): string[] {
  const tags = new Set<string>();
  let match: RegExpExecArray | null;
  HASHTAG_REGEX.lastIndex = 0;
  while ((match = HASHTAG_REGEX.exec(content)) !== null) {
    tags.add(match[2].toLowerCase());
  }
  return Array.from(tags);
}

function splitTags(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function isoDate(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function fetchUrlTitle(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 EneyObsidianCapture/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    const match = /<title[^>]*>([^<]+)<\/title>/i.exec(text);
    if (!match) return null;
    return match[1].replace(/\s+/g, " ").trim();
  } catch {
    return null;
  }
}

function formatBody(raw: string, type: Exclude<CaptureType, "auto">, urlTitle?: string | null): string {
  const content = raw.trim();
  switch (type) {
    case "link": {
      const title = urlTitle ?? content;
      return `- [${title}](${content})`;
    }
    case "task": {
      const text = content
        .replace(/^todo:\s*/i, "")
        .replace(/^(?:- \[ \]|\[ \])\s*/, "")
        .replace(/^todo\b\s*/i, "");
      return `- [ ] ${text}`;
    }
    case "code": {
      if (/^```/m.test(content)) return content;
      return "```\n" + content + "\n```";
    }
    case "quote": {
      const inner = content.replace(/^"(.*)"$/s, "$1");
      return inner
        .split(/\r?\n/)
        .map((l) => `> ${l}`)
        .join("\n");
    }
    default:
      return content;
  }
}

function buildFrontmatter(args: {
  type: Exclude<CaptureType, "auto">;
  tags: string[];
  source?: string;
  title?: string;
}): string {
  const lines = ["---", `created: ${timestamp()}`, `type: ${args.type}`];
  if (args.title) lines.push(`title: "${args.title.replace(/"/g, '\\"')}"`);
  if (args.source) lines.push(`source: ${args.source}`);
  if (args.tags.length) lines.push(`tags: [${args.tags.map((t) => t).join(", ")}]`);
  lines.push("---", "");
  return lines.join("\n");
}

function buildFilename(type: Exclude<CaptureType, "auto">, raw: string, urlTitle?: string | null): string {
  const date = isoDate();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const d = new Date();
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  let base = "";
  if (type === "link") {
    base = urlTitle ? slugify(urlTitle) : slugify(raw.replace(/^https?:\/\//, ""));
  } else {
    const firstLine = raw.split(/\r?\n/)[0] ?? "";
    base = slugify(firstLine);
  }
  if (!base) base = "note";
  return `${date}-${time}-${base}.md`;
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function openInObsidian(vaultName: string, filePath: string) {
  const url = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(
    filePath,
  )}`;
  exec(`open '${url.replace(/'/g, "'\\''")}'`);
}

// --- Component ---

function CaptureToObsidian(props: Props) {
  const closeWidget = useCloseWidget();

  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [vaultId, setVaultId] = useState<string>("");
  const [vaultsError, setVaultsError] = useState<string>("");

  const [content, setContent] = useState(props.content ?? "");
  const [tagsInput, setTagsInput] = useState(props.tags ?? "");
  const [folder, setFolder] = useState("Inbox");
  const [type, setType] = useState<CaptureType>("auto");
  const [mode, setMode] = useState<CaptureMode>("new-note");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    path: string;
    vaultName: string;
    relativePath: string;
    preview: string;
  } | null>(null);

  useEffect(() => {
    loadVaults()
      .then((list) => {
        setVaults(list);
        if (list.length > 0) setVaultId(list[0].id);
        else setVaultsError("No Obsidian vaults found. Open Obsidian and create or open a vault first.");
      })
      .catch((e: Error) => setVaultsError(e.message));
  }, []);

  const selectedVault = useMemo(
    () => vaults.find((v) => v.id === vaultId) ?? null,
    [vaults, vaultId],
  );

  async function onSubmit() {
    if (!content.trim()) {
      setError("Please enter something to capture.");
      return;
    }
    if (!selectedVault) {
      setError("Please select an Obsidian vault.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const detected: Exclude<CaptureType, "auto"> =
        type === "auto" ? detectType(content) : type;

      // Fetch URL title for link captures (best-effort, non-blocking for failure)
      const urlMatch = URL_REGEX.exec(content.trim());
      const urlTitle = detected === "link" && urlMatch ? await fetchUrlTitle(urlMatch[1]) : null;

      const body = formatBody(content, detected, urlTitle);
      const hashtags = extractHashtags(content);
      const inputTags = splitTags(tagsInput);
      const allTags = Array.from(new Set([...hashtags, ...inputTags]));

      const source = detected === "link" && urlMatch ? urlMatch[1] : undefined;
      const title =
        detected === "link"
          ? urlTitle ?? urlMatch?.[1]
          : content.split(/\r?\n/)[0]?.slice(0, 80);

      const vaultRoot = selectedVault.path;
      const folderClean = folder.trim().replace(/^\/+|\/+$/g, "") || "Inbox";
      const folderAbs = join(vaultRoot, folderClean);
      await ensureDir(folderAbs);

      let absPath: string;
      let relativePath: string;

      if (mode === "new-note") {
        const filename = buildFilename(detected, content, urlTitle);
        absPath = join(folderAbs, filename);
        relativePath = join(folderClean, filename);
        const frontmatter = buildFrontmatter({
          type: detected,
          tags: allTags,
          source,
          title,
        });
        await writeFile(absPath, frontmatter + body + "\n", "utf-8");
      } else if (mode === "append-daily") {
        const filename = `${isoDate()}.md`;
        absPath = join(folderAbs, filename);
        relativePath = join(folderClean, filename);
        const header = (await exists(absPath))
          ? ""
          : `# ${isoDate()}\n\n`;
        const entry = `## ${timestamp().slice(11, 16)}\n\n${body}\n`;
        await appendFile(absPath, header + entry + "\n", "utf-8");
      } else {
        // append-inbox
        const filename = "Inbox.md";
        absPath = join(folderAbs, filename);
        relativePath = join(folderClean, filename);
        const header = (await exists(absPath)) ? "" : `# Inbox\n\n`;
        const entry = `## ${timestamp()} — ${detected}\n\n${body}\n`;
        await appendFile(absPath, header + entry + "\n", "utf-8");
      }

      const tagPreview = allTags.length ? `\n\n**Tags:** ${allTags.map((t) => `#${t}`).join(" ")}` : "";
      setSuccess({
        path: absPath,
        vaultName: selectedVault.name,
        relativePath,
        preview: `**Type:** \`${detected}\`${tagPreview}\n\n---\n\n${body}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  function onCaptureAnother() {
    setContent("");
    setTagsInput("");
    setSuccess(null);
    setError("");
  }

  function onOpenInObsidian() {
    if (!success || !selectedVault) return;
    openInObsidian(selectedVault.name, success.relativePath);
  }

  function onDone() {
    closeWidget(success ? `Captured to ${success.relativePath}` : "Cancelled.");
  }

  const header = <CardHeader title="Capture to Obsidian" iconBundleId="md.obsidian" />;

  if (vaultsError) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Close" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={`### Can't find Obsidian vaults\n\n${vaultsError}`} />
      </Form>
    );
  }

  if (success) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm
              title="Capture Another"
              onSubmit={onCaptureAnother}
              style="secondary"
            />
            <Action title="Open in Obsidian" onAction={onOpenInObsidian} style="primary" />
            <Action.CopyToClipboard content={success.path} title="Copy Path" />
            <Action title="Done" onAction={onDone} style="secondary" />
          </ActionPanel>
        }
      >
        <Paper
          markdown={`### Saved\n\n\`${success.relativePath}\` in vault **${success.vaultName}**\n\n${success.preview}`}
          isScrollable
        />
      </Form>
    );
  }

  const detectedPreview: Exclude<CaptureType, "auto"> =
    type === "auto" ? detectType(content) : type;

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isSubmitting ? "Capturing..." : "Capture"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isSubmitting}
            isDisabled={!content.trim() || !selectedVault || isSubmitting}
          />
          <Action title="Cancel" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper
        markdown={
          content.trim()
            ? `_Will be captured as:_ \`${detectedPreview}\`${selectedVault ? ` → **${selectedVault.name}**/\`${folder || "Inbox"}\`` : ""}`
            : "Enter anything — a URL, a task, a snippet, a quote, or a plain note. The widget will detect the type and format it for you."
        }
      />
      <Form.Dropdown
        name="vault"
        label="Vault"
        value={vaultId}
        onChange={setVaultId}
      >
        {vaults.map((v) => (
          <Form.Dropdown.Item key={v.id} value={v.id} title={v.name} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        name="folder"
        label="Folder"
        value={folder}
        onChange={setFolder}
      />
      <Form.Dropdown name="mode" label="Mode" value={mode} onChange={(v: string) => setMode(v as CaptureMode)}>
        <Form.Dropdown.Item value="new-note" title="New note in folder" />
        <Form.Dropdown.Item value="append-daily" title="Append to daily note (YYYY-MM-DD.md)" />
        <Form.Dropdown.Item value="append-inbox" title="Append to Inbox.md" />
      </Form.Dropdown>
      <Form.Dropdown name="type" label="Type" value={type} onChange={(v: string) => setType(v as CaptureType)}>
        <Form.Dropdown.Item value="auto" title="Auto-detect" />
        <Form.Dropdown.Item value="note" title="Note" />
        <Form.Dropdown.Item value="link" title="Link / Bookmark" />
        <Form.Dropdown.Item value="task" title="Task" />
        <Form.Dropdown.Item value="code" title="Code snippet" />
        <Form.Dropdown.Item value="quote" title="Quote" />
      </Form.Dropdown>
      <Form.RichTextEditor value={content} onChange={setContent} isInitiallyFocused />
      <Form.TextField
        name="tags"
        label="Tags (comma-separated, optional)"
        value={tagsInput}
        onChange={setTagsInput}
      />
    </Form>
  );
}

const CaptureToObsidianWidget = defineWidget({
  name: "capture-to-obsidian",
  description:
    "Smart capture anything into your Obsidian vault. Auto-detects URLs, tasks, code, quotes, or plain notes and formats them correctly. Supports new notes, daily notes, or Inbox append. Pulls the vault list from Obsidian's local config.",
  schema,
  component: CaptureToObsidian,
});

export default CaptureToObsidianWidget;
