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
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type Note,
  type VaultInfo,
  type FolderSuggestion,
  buildFrontmatter,
  extractInlineTags,
  extractWikilinks,
  indexVault,
  isoDateTime,
  loadVaults,
  openInObsidianURI,
  slugify,
  suggestFolders,
} from "./shared.js";

const schema = z.object({
  title: z.string().optional().describe("Note title (becomes filename and frontmatter title)."),
  content: z.string().optional().describe("Note content in markdown."),
  tags: z
    .string()
    .optional()
    .describe("Comma-separated tags to apply (without the # prefix)."),
  folder: z
    .string()
    .optional()
    .describe(
      "Optional folder override (relative to vault). If omitted, the widget auto-suggests a folder based on content similarity to existing notes.",
    ),
});

type Props = z.infer<typeof schema>;

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function CreateNote(props: Props) {
  const closeWidget = useCloseWidget();

  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [vaultId, setVaultId] = useState<string>("");
  const [vaultsError, setVaultsError] = useState<string>("");

  const [notes, setNotes] = useState<Note[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexError, setIndexError] = useState("");

  const [title, setTitle] = useState(props.title ?? "");
  const [content, setContent] = useState(props.content ?? "");
  const [tags, setTags] = useState(props.tags ?? "");
  const [folder, setFolder] = useState(props.folder ?? "");
  const [useAuto, setUseAuto] = useState(!props.folder);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    absPath: string;
    relPath: string;
    vaultName: string;
  } | null>(null);

  useEffect(() => {
    loadVaults()
      .then((list) => {
        setVaults(list);
        if (list.length > 0) setVaultId(list[0].id);
        else setVaultsError("No Obsidian vaults found.");
      })
      .catch((e: Error) => setVaultsError(e.message));
  }, []);

  const selectedVault = useMemo(
    () => vaults.find((v) => v.id === vaultId) ?? null,
    [vaults, vaultId],
  );

  useEffect(() => {
    if (!selectedVault) return;
    let cancelled = false;
    setIsIndexing(true);
    setIndexError("");
    indexVault(selectedVault.path)
      .then((list) => !cancelled && setNotes(list))
      .catch((e: Error) => !cancelled && setIndexError(e.message))
      .finally(() => !cancelled && setIsIndexing(false));
    return () => {
      cancelled = true;
    };
  }, [selectedVault]);

  const suggestions: FolderSuggestion[] = useMemo(() => {
    if (notes.length === 0 || (!title.trim() && !content.trim())) return [];
    return suggestFolders(title, content, notes, 3);
  }, [notes, title, content]);

  const topSuggestion = suggestions[0]?.folder ?? "";
  const effectiveFolder = useAuto
    ? topSuggestion === "(vault root)"
      ? ""
      : topSuggestion || "Inbox"
    : folder.trim();

  const extractedWikilinks = useMemo(() => extractWikilinks(content), [content]);
  const inlineTags = useMemo(() => extractInlineTags(content), [content]);

  async function onSubmit() {
    if (!selectedVault) {
      setError("Please select a vault.");
      return;
    }
    if (!title.trim() && !content.trim()) {
      setError("Please provide a title or some content.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const folderClean = effectiveFolder.replace(/^\/+|\/+$/g, "");
      const folderAbs = folderClean
        ? join(selectedVault.path, folderClean)
        : selectedVault.path;
      await mkdir(folderAbs, { recursive: true });

      const finalTitle = (title.trim() || content.split(/\r?\n/)[0] || "note")
        .replace(/[\r\n]+/g, " ")
        .trim()
        .slice(0, 120);
      const baseName = slugify(finalTitle) || "note";
      let filename = `${baseName}.md`;
      let candidate = join(folderAbs, filename);
      let n = 1;
      while (await fileExists(candidate)) {
        n++;
        filename = `${baseName}-${n}.md`;
        candidate = join(folderAbs, filename);
      }

      const tagList = Array.from(
        new Set([
          ...tags
            .split(/[,\s]+/)
            .map((t) => t.replace(/^#/, "").trim())
            .filter(Boolean),
          ...inlineTags,
        ]),
      );

      const fm: Record<string, unknown> = {
        title: finalTitle,
        created: isoDateTime(),
      };
      if (tagList.length) fm.tags = tagList;
      if (extractedWikilinks.length) fm.links = extractedWikilinks;

      const fullText = buildFrontmatter(fm) + content + "\n";
      await writeFile(candidate, fullText, "utf-8");

      const relPath = join(folderClean, filename);
      setSuccess({ absPath: candidate, relPath, vaultName: selectedVault.name });
      closeWidget(`Created ${relPath} in ${selectedVault.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  function onCreateAnother() {
    setTitle("");
    setContent("");
    setTags("");
    setSuccess(null);
    setError("");
  }

  function onOpenInObsidian() {
    if (!success || !selectedVault) return;
    openInObsidianURI(selectedVault.name, success.relPath);
  }

  function onDone() {
    closeWidget(success ? `Created ${success.relPath}` : "Cancelled.");
  }

  const header = <CardHeader title="Create Note" iconBundleId="md.obsidian" />;

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
        <Paper markdown={`### No vaults found\n\n${vaultsError}`} />
      </Form>
    );
  }

  if (success) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Create More" onAction={onCreateAnother} style="secondary" />
            <Action title="Open..." onAction={onOpenInObsidian} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper
          markdown={`### Created\n\n\`${success.relPath}\` in **${success.vaultName}**`}
        />
      </Form>
    );
  }

  const suggestionBlock = suggestions.length
    ? "**Suggested folders:** " +
      suggestions
        .map((s, i) => `${i + 1}. \`${s.folder}\` _(${s.reason})_`)
        .join(" · ")
    : indexError
      ? `_Index error: ${indexError}_`
      : isIndexing
        ? "_Indexing vault for folder suggestions..._"
        : "_Type a title and content to get folder suggestions._";

  const previewBlock =
    [
      `**Will be saved as:** \`${effectiveFolder || "(vault root)"}/${slugify(title.trim() || "note")}.md\``,
      extractedWikilinks.length
        ? `**Detected wikilinks:** ${extractedWikilinks.map((w) => `\`[[${w}]]\``).join(" ")}`
        : "",
      inlineTags.length
        ? `**Detected inline tags:** ${inlineTags.map((t) => `\`#${t}\``).join(" ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isSubmitting ? "Creating..." : "Create Note"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isSubmitting}
            isDisabled={isSubmitting || !selectedVault || (!title.trim() && !content.trim())}
          />
          <Action title="Cancel" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper markdown={suggestionBlock} />
      <Paper markdown={previewBlock} />
      <Form.Dropdown name="vault" label="Vault" value={vaultId} onChange={setVaultId}>
        {vaults.map((v) => (
          <Form.Dropdown.Item key={v.id} value={v.id} title={v.name} />
        ))}
      </Form.Dropdown>
      <Form.TextField name="title" label="Title" value={title} onChange={setTitle} />
      <Form.Checkbox
        name="useAuto"
        label="Auto-detect folder from content"
        checked={useAuto}
        onChange={setUseAuto}
        variant="switch"
      />
      {!useAuto && (
        <Form.TextField
          name="folder"
          label="Folder (relative to vault)"
          value={folder}
          onChange={setFolder}
        />
      )}
      <Form.TextField
        name="tags"
        label="Tags (comma-separated)"
        value={tags}
        onChange={setTags}
      />
      <Form.RichTextEditor value={content} onChange={setContent} isInitiallyFocused />
    </Form>
  );
}

const CreateNoteWidget = defineWidget({
  name: "create-note",
  description:
    "Create a new note in an Obsidian vault. Auto-detects the best folder by comparing the note's content against existing notes (keyword, tag, and folder-name overlap), writes YAML frontmatter with title/created/tags/links, and extracts inline hashtags and [[wikilinks]] automatically.",
  schema,
  component: CreateNote,
});

export default CreateNoteWidget;
