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
import {
  type Note,
  type VaultInfo,
  indexVault,
  loadVaults,
  openInObsidianURI,
  phoneticOf,
  snippetAround,
} from "./shared.js";

const schema = z.object({
  query: z
    .string()
    .optional()
    .describe("Optional initial search query — notes will be searched by title and content."),
  tag: z
    .string()
    .optional()
    .describe("Optional tag filter (without the # prefix)."),
});

type Props = z.infer<typeof schema>;

interface Hit {
  note: Note;
  score: number; // lower = better (fuse.js convention)
  matchKind: "fuzzy" | "phonetic";
  snippet: string;
}

function SearchNotes(props: Props) {
  const closeWidget = useCloseWidget();

  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [vaultId, setVaultId] = useState<string>("");
  const [vaultsError, setVaultsError] = useState<string>("");

  const [notes, setNotes] = useState<Note[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string>("");

  const [query, setQuery] = useState(props.query ?? "");
  const [tagFilter, setTagFilter] = useState(props.tag ?? "");
  const [folderFilter, setFolderFilter] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [lastRanAt, setLastRanAt] = useState<number>(0);

  // Load vaults once
  useEffect(() => {
    loadVaults()
      .then((list) => {
        setVaults(list);
        if (list.length > 0) setVaultId(list[0].id);
        else setVaultsError("No Obsidian vaults found. Open Obsidian and create/open a vault first.");
      })
      .catch((e: Error) => setVaultsError(e.message));
  }, []);

  const selectedVault = useMemo(
    () => vaults.find((v) => v.id === vaultId) ?? null,
    [vaults, vaultId],
  );

  // Re-index whenever vault changes
  useEffect(() => {
    if (!selectedVault) return;
    let cancelled = false;
    setIsIndexing(true);
    setIndexError("");
    indexVault(selectedVault.path)
      .then((list) => {
        if (!cancelled) setNotes(list);
      })
      .catch((e: Error) => {
        if (!cancelled) setIndexError(e.message);
      })
      .finally(() => {
        if (!cancelled) setIsIndexing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVault]);

  // Build Fuse index on notes (memoized)
  const fuse = useMemo(() => {
    if (notes.length === 0) return null;
    return new Fuse(notes, {
      includeScore: true,
      threshold: 0.4, // permissive
      ignoreLocation: true,
      useExtendedSearch: true,
      keys: [
        { name: "title", weight: 3 },
        { name: "tags", weight: 2 },
        { name: "content", weight: 1 },
      ],
    });
  }, [notes]);

  // Tag + folder options
  const { tagOptions, folderOptions } = useMemo(() => {
    const tags = new Set<string>();
    const folders = new Set<string>();
    for (const n of notes) {
      for (const t of n.tags) tags.add(t);
      if (n.folder) folders.add(n.folder);
    }
    return {
      tagOptions: Array.from(tags).sort(),
      folderOptions: Array.from(folders).sort(),
    };
  }, [notes]);

  function runSearch() {
    if (!fuse) return;
    const trimmed = query.trim();
    const results: Hit[] = [];
    const seen = new Set<string>();

    // Stage 1: Fuzzy search via Fuse
    if (trimmed) {
      const fuseResults = fuse.search(trimmed, { limit: 40 });
      for (const r of fuseResults) {
        if (seen.has(r.item.absPath)) continue;
        seen.add(r.item.absPath);
        results.push({
          note: r.item,
          score: r.score ?? 1,
          matchKind: "fuzzy",
          snippet: snippetAround(r.item.content, trimmed),
        });
      }

      // Stage 2: Phonetic fallback — any note whose phonetic signature shares
      // codes with the query's phonetic codes counts as a softer match.
      const qCodes = new Set(phoneticOf(trimmed));
      if (qCodes.size > 0) {
        for (const n of notes) {
          if (seen.has(n.absPath)) continue;
          const noteCodes = new Set(n.phonetic.split(" ").filter(Boolean));
          let overlap = 0;
          for (const c of qCodes) if (noteCodes.has(c)) overlap++;
          if (overlap === 0) continue;
          const score = 0.7 - Math.min(0.4, overlap * 0.05); // better overlap => lower score
          seen.add(n.absPath);
          results.push({
            note: n,
            score,
            matchKind: "phonetic",
            snippet: snippetAround(n.content, trimmed),
          });
        }
      }
    } else {
      // No query: surface the 40 most-recently-modified notes
      const recent = [...notes].sort((a, b) => b.mtime - a.mtime).slice(0, 40);
      for (const n of recent) {
        results.push({ note: n, score: 0, matchKind: "fuzzy", snippet: snippetAround(n.content, "") });
      }
    }

    // Apply filters
    const filtered = results.filter((h) => {
      if (tagFilter && !h.note.tags.includes(tagFilter)) return false;
      if (folderFilter && h.note.folder !== folderFilter) return false;
      return true;
    });

    filtered.sort((a, b) => a.score - b.score);
    setHits(filtered.slice(0, 25));
    setLastRanAt(Date.now());
  }

  function onOpen(hit: Hit) {
    if (!selectedVault) return;
    openInObsidianURI(selectedVault.name, hit.note.relPath);
  }

  function onDone() {
    closeWidget(`Searched "${query}" — ${hits.length} result${hits.length === 1 ? "" : "s"}`);
  }

  const header = <CardHeader title="Search Notes" iconBundleId="md.obsidian" />;

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

  const statusLine = isIndexing
    ? "_Indexing vault..._"
    : indexError
      ? `**Index error:** ${indexError}`
      : lastRanAt > 0
        ? `_${notes.length} notes indexed · ${hits.length} result${hits.length === 1 ? "" : "s"}_`
        : `_${notes.length} notes indexed — type a query and hit Search._`;

  const bodyMarkdown =
    hits.length === 0
      ? lastRanAt > 0
        ? "No matches. Try fewer characters, different spelling, or clear filters."
        : ""
      : hits
          .map((h, i) => {
            const tags = h.note.tags.length ? h.note.tags.map((t) => `\`#${t}\``).join(" ") : "";
            const kind = h.matchKind === "phonetic" ? " · _phonetic_" : "";
            return [
              `**${i + 1}. ${h.note.title}**${kind}`,
              `\`${h.note.relPath}\`${tags ? " · " + tags : ""}`,
              `> ${h.snippet || "_(empty note)_"}`,
            ].join("\n");
          })
          .join("\n\n---\n\n");

  const firstHit = hits[0];

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isIndexing ? "Indexing..." : "Search"}
            onSubmit={runSearch}
            style="primary"
            isDisabled={isIndexing || !selectedVault}
            isLoading={isIndexing}
          />
          {firstHit && (
            <Action
              title={`Open "${firstHit.note.title}" in Obsidian`}
              onAction={() => onOpen(firstHit)}
              style="secondary"
            />
          )}
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={statusLine} />
      {bodyMarkdown && <Paper markdown={bodyMarkdown} isScrollable />}
      <Form.Dropdown name="vault" label="Vault" value={vaultId} onChange={setVaultId}>
        {vaults.map((v) => (
          <Form.Dropdown.Item key={v.id} value={v.id} title={v.name} />
        ))}
      </Form.Dropdown>
      <Form.TextField name="query" label="Query" value={query} onChange={setQuery} />
      <Form.Dropdown name="tag" label="Tag filter" value={tagFilter} onChange={setTagFilter}>
        <Form.Dropdown.Item value="" title="Any tag" />
        {tagOptions.map((t) => (
          <Form.Dropdown.Item key={t} value={t} title={`#${t}`} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown
        name="folder"
        label="Folder filter"
        value={folderFilter}
        onChange={setFolderFilter}
      >
        <Form.Dropdown.Item value="" title="Any folder" />
        {folderOptions.map((f) => (
          <Form.Dropdown.Item key={f} value={f} title={f} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

const SearchNotesWidget = defineWidget({
  name: "search-notes",
  description:
    "Fuzzy and phonetic search across notes in an Obsidian vault. Matches titles, body text, and tags using Fuse.js, with a phonetic (Double Metaphone) fallback for misspellings. Filter results by tag and folder; open matches directly in Obsidian.",
  schema,
  component: SearchNotes,
});

export default SearchNotesWidget;
