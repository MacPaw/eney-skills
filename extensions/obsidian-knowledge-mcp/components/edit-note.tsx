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
import Fuse from "fuse.js";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type Note,
  type VaultInfo,
  buildFrontmatter,
  extractInlineTags,
  extractWikilinks,
  indexVault,
  isoDateTime,
  loadVaults,
  normalizeTags,
  openInObsidianURI,
  stripFrontmatter,
} from "./shared.js";

const schema = z.object({
  path: z
    .string()
    .optional()
    .describe(
      "Optional vault-relative path to the note to edit (e.g., 'Projects/Idea.md'). If omitted, you can search for a note from the vault.",
    ),
  title: z
    .string()
    .optional()
    .describe("Optional note title to look up if no path is provided."),
});

type Props = z.infer<typeof schema>;

function tagsToInput(tags: string[]): string {
  return tags.join(", ");
}

function EditNote(props: Props) {
  const closeWidget = useCloseWidget();

  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [vaultId, setVaultId] = useState<string>("");
  const [vaultsError, setVaultsError] = useState<string>("");

  const [notes, setNotes] = useState<Note[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexError, setIndexError] = useState("");

  const [searchQuery, setSearchQuery] = useState(props.title ?? "");
  const [selectedPath, setSelectedPath] = useState(props.path ?? "");

  const [loadedNote, setLoadedNote] = useState<Note | null>(null);
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [loadError, setLoadError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

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

  // Fuse for finding a note to edit
  const fuse = useMemo(() => {
    if (notes.length === 0) return null;
    return new Fuse(notes, {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
      keys: [
        { name: "title", weight: 3 },
        { name: "relPath", weight: 2 },
        { name: "tags", weight: 1 },
      ],
    });
  }, [notes]);

  const candidateMatches = useMemo(() => {
    if (loadedNote) return [];
    const q = searchQuery.trim();
    if (!q || !fuse) return [];
    return fuse.search(q, { limit: 10 }).map((r) => r.item);
  }, [fuse, searchQuery, loadedNote]);

  // Auto-load if a path was passed in or has been selected
  useEffect(() => {
    if (!selectedVault || !selectedPath) return;
    let cancelled = false;
    (async () => {
      try {
        const abs = join(selectedVault.path, selectedPath);
        const raw = await readFile(abs, "utf-8");
        const { body, fm } = stripFrontmatter(raw);
        const tags = Array.from(
          new Set([...normalizeTags(fm.tags ?? fm.tag), ...extractInlineTags(body)]),
        );
        const title =
          (typeof fm.title === "string" && fm.title.trim()) ||
          selectedPath.replace(/\.md$/i, "").split("/").pop() ||
          "note";
        if (cancelled) return;
        setLoadedNote({
          absPath: abs,
          relPath: selectedPath,
          folder: selectedPath.includes("/") ? selectedPath.slice(0, selectedPath.lastIndexOf("/")) : "",
          title,
          content: body,
          frontmatter: fm,
          tags,
          wikilinks: extractWikilinks(body),
          mtime: Date.now(),
          phonetic: "",
        });
        setContent(body);
        setTagsInput(tagsToInput(tags));
        setLoadError("");
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedVault, selectedPath]);

  function onPickCandidate(relPath: string) {
    setSelectedPath(relPath);
  }

  function onUnload() {
    setLoadedNote(null);
    setSelectedPath("");
    setContent("");
    setTagsInput("");
    setSavedAt(null);
    setSaveError("");
  }

  async function onSave() {
    if (!loadedNote || !selectedVault) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const tagsList = tagsInput
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean);
      const wikilinks = extractWikilinks(content);

      // Preserve existing frontmatter keys we don't explicitly manage
      const preserved: Record<string, unknown> = { ...loadedNote.frontmatter };
      delete preserved.tags;
      delete preserved.tag;
      delete preserved.updated;
      delete preserved.links;

      const fm: Record<string, unknown> = {
        ...preserved,
        updated: isoDateTime(),
      };
      if (tagsList.length) fm.tags = tagsList;
      if (wikilinks.length) fm.links = wikilinks;

      const newRaw = buildFrontmatter(fm) + content.replace(/\n+$/, "") + "\n";
      await writeFile(loadedNote.absPath, newRaw, "utf-8");
      setSavedAt(Date.now());
      closeWidget(`Saved ${loadedNote.relPath} in ${selectedVault.name}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  }

  function onOpenInObsidian() {
    if (!loadedNote || !selectedVault) return;
    openInObsidianURI(selectedVault.name, loadedNote.relPath);
  }

  function onDone() {
    closeWidget(loadedNote ? `Edited ${loadedNote.relPath}` : "Cancelled.");
  }

  const header = <CardHeader title="Edit Note" iconBundleId="md.obsidian" />;

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

  // Editor view
  if (loadedNote) {
    const extractedWikilinks = extractWikilinks(content);
    const preview = [
      `### ${loadedNote.title}`,
      `\`${loadedNote.relPath}\``,
      extractedWikilinks.length
        ? `**Wikilinks:** ${extractedWikilinks.map((w) => `\`[[${w}]]\``).join(" ")}`
        : "",
      savedAt ? `_Saved at ${new Date(savedAt).toLocaleTimeString()}_` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Back to Search" onAction={onUnload} style="secondary" />
            
            <Action title="Open..." onAction={onOpenInObsidian} style="secondary" />
            <Action.SubmitForm
              title={isSaving ? "Saving..." : "Save"}
              onSubmit={onSave}
              style="primary"
              isLoading={isSaving}
              isDisabled={isSaving}
            />
          </ActionPanel>
        }
      >
        {saveError && <Paper markdown={`**Error:** ${saveError}`} />}
        <Paper markdown={preview} />
        <Form.TextField
          name="tags"
          label="Tags (comma-separated)"
          value={tagsInput}
          onChange={setTagsInput}
        />
        <Form.RichTextEditor value={content} onChange={setContent} isInitiallyFocused />
      </Form>
    );
  }

  // Picker view
  const pickerBody = candidateMatches.length
    ? candidateMatches
        .map(
          (n, i) =>
            `**${i + 1}. ${n.title}** — \`${n.relPath}\`${
              n.tags.length ? " · " + n.tags.map((t) => `\`#${t}\``).join(" ") : ""
            }`,
        )
        .join("\n\n")
    : isIndexing
      ? "_Indexing vault..._"
      : indexError
        ? `_Index error: ${indexError}_`
        : searchQuery
          ? "No matches. Try a different query."
          : "_Enter a query to find a note to edit, or have the LLM pass a path._";

  const firstMatch = candidateMatches[0];
  const secondMatch = candidateMatches[1];
  const thirdMatch = candidateMatches[2];

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          {firstMatch && (
            <Action
              title={`Edit #1: ${firstMatch.title}`}
              onAction={() => onPickCandidate(firstMatch.relPath)}
              style="primary"
            />
          )}
          {secondMatch && (
            <Action
              title={`Edit #2: ${secondMatch.title}`}
              onAction={() => onPickCandidate(secondMatch.relPath)}
              style="secondary"
            />
          )}
          {thirdMatch && (
            <Action
              title={`Edit #3: ${thirdMatch.title}`}
              onAction={() => onPickCandidate(thirdMatch.relPath)}
              style="secondary"
            />
          )}
          <Action title="Cancel" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      {loadError && <Paper markdown={`**Load error:** ${loadError}`} />}
      <Paper markdown={pickerBody} isScrollable />
      <Form.Dropdown name="vault" label="Vault" value={vaultId} onChange={setVaultId}>
        {vaults.map((v) => (
          <Form.Dropdown.Item key={v.id} value={v.id} title={v.name} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        name="query"
        label="Find note by title or path"
        value={searchQuery}
        onChange={setSearchQuery}
      />
    </Form>
  );
}

const EditNoteWidget = defineWidget({
  name: "edit-note",
  description:
    "Find and edit an existing Obsidian note. Search the vault by title, path, or tag; load the note; edit body content and tags. Preserves existing YAML frontmatter keys, refreshes the updated timestamp, and re-extracts [[wikilinks]] into the frontmatter on save.",
  schema,
  component: EditNote,
});

export default EditNoteWidget;
