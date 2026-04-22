import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  defineWidget,
  Form,
  Paper,
  useCloseWidget,
} from "@eney/api";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  buildPlan,
  executePlan,
  formatBytes,
  listSubdirectories,
  scanDirectory,
  scanSubdirectories,
} from "../helpers/organizer.js";
import type { Plan, ExecuteResult, PlanOptions, MoveAction, MoveFolderAction } from "../helpers/organizer.js";
import {
  classifyWithAnthropic,
  classifyFoldersWithAnthropic,
  mapAnthropicError,
} from "../helpers/anthropic-classifier.js";
import { loadApiKey, saveApiKey } from "../helpers/keychain.js";
import { readContentPreview } from "../helpers/content-preview.js";
import { isScreenshot, ocrImage } from "../helpers/ocr.js";
import { revealInFinder } from "../helpers/run-script.js";

const MODEL = "claude-haiku-4-5";
const DEFAULT_FOLDER = join(homedir(), "Downloads");

const schema = z.object({
  directoryPath: z
    .string()
    .optional()
    .describe(
      "Absolute path of the macOS directory to organize (e.g., /Users/name/Downloads). Defaults to ~/Downloads."
    ),
  applyFinderTags: z
    .boolean()
    .optional()
    .describe("Apply macOS Finder color tags by category. Default: true."),
  renameFiles: z
    .boolean()
    .optional()
    .describe("Strip IMG_/DSC_ prefixes and version suffixes from filenames. Default: false."),
  duplicateHandling: z
    .enum(["skip", "flag", "move"])
    .optional()
    .describe("How to treat duplicate files. Default: 'flag'."),
  archiveDaysThreshold: z
    .number()
    .optional()
    .describe("Move files older than N days to Archive/. 0 or omitted disables archiving."),
});

type Props = z.infer<typeof schema>;

type ViewState = "analyzing" | "no-key" | "preview" | "error";

function SmartOrganizeDirectory(props: Props) {
  const closeWidget = useCloseWidget();
  const resolvedPath =
    (props.directoryPath && props.directoryPath.trim()) || DEFAULT_FOLDER;
  const options: PlanOptions = {
    applyFinderTags: props.applyFinderTags ?? true,
    renameFiles: props.renameFiles ?? false,
    duplicateHandling: props.duplicateHandling ?? "flag",
    archiveDaysThreshold: props.archiveDaysThreshold ?? 0,
  };

  const [view, setView] = useState<ViewState>("analyzing");
  const [analyzeStatus, setAnalyzeStatus] = useState("Reading files...");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  // ── Mount effect: drives the entire analysis pipeline ──────────────────
  // setState from useEffect DOES persist in Eney.
  // setState from action handlers does NOT persist.
  // Empty dep array is intentional: Eney widgets are single-use — props are fixed at mount
  // and never change. The analysis runs once on mount and drives all state transitions.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const apiKey = await loadApiKey();

      if (!apiKey) {
        if (!cancelled) setView("no-key");
        return;
      }

      try {
        setAnalyzeStatus("Reading files...");
        const [entries, existingFolders] = await Promise.all([
          scanDirectory(resolvedPath),
          listSubdirectories(resolvedPath),
        ]);

        if (cancelled) return;

        // OCR screenshots in parallel batches of 4
        const screenshotEntries = entries.filter((e) => isScreenshot(e.name));
        const ocrMap = new Map<string, string>();
        if (screenshotEntries.length > 0) {
          setAnalyzeStatus(
            `OCR-ing ${screenshotEntries.length} screenshot${screenshotEntries.length === 1 ? "" : "s"}...`
          );
          const CONCURRENCY = 4;
          for (let i = 0; i < screenshotEntries.length; i += CONCURRENCY) {
            if (cancelled) return;
            const batch = screenshotEntries.slice(i, i + CONCURRENCY);
            const texts = await Promise.all(batch.map((e) => ocrImage(e.path)));
            batch.forEach((e, j) => {
              const text = texts[j];
              if (text) ocrMap.set(e.name, text);
            });
          }
        }

        const forLLM: {
          filename: string;
          extension: string;
          sizeBytes: number;
          contentPreview?: string;
        }[] = [];
        for (const e of entries) {
          const preview =
            ocrMap.get(e.name) ?? (await readContentPreview(e.path, e.ext));
          forLLM.push({
            filename: e.name,
            extension: e.ext,
            sizeBytes: e.size,
            contentPreview: preview ?? undefined,
          });
        }

        if (cancelled) return;
        setAnalyzeStatus(`Classifying ${forLLM.length} file${forLLM.length === 1 ? "" : "s"}...`);

        const classifications = await classifyWithAnthropic({
          apiKey,
          model: MODEL,
          files: forLLM,
          existingFolders,
          onProgress: (done, total) => {
            if (!cancelled) setAnalyzeStatus(`Classified ${done}/${total}...`);
          },
        });

        if (cancelled) return;

        const subfolders = await scanSubdirectories(resolvedPath);
        let folderGroupings: Record<string, string> | undefined;
        if (subfolders.length > 0) {
          setAnalyzeStatus(
            `Grouping ${subfolders.length} folder${subfolders.length === 1 ? "" : "s"}...`
          );
          folderGroupings = await classifyFoldersWithAnthropic({
            apiKey,
            model: MODEL,
            folders: subfolders,
            existingFolders,
          });
        }

        if (cancelled) return;
        setAnalyzeStatus("Building plan...");

        const p = await buildPlan(resolvedPath, {
          ...options,
          classifications,
          folderGroupings,
        });

        if (cancelled) return;

        if (p.actions.length === 0) {
          closeWidget(`Nothing to organize — \`${resolvedPath}\` already looks tidy.`);
          return;
        }

        setPlan(p);
        setView("preview");
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(mapAnthropicError(e));
          setView("error");
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Action handlers (closeWidget works; setState does NOT persist here) ─

  async function onSaveKey() {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setSavingKey(true);
    try {
      await saveApiKey(trimmed);
      closeWidget(
        "Anthropic API key saved to Keychain. Please re-run **Smart Organize Directory** to start the analysis."
      );
    } catch (e) {
      // Can't persist error state from handler — just close with error message
      closeWidget(`Failed to save API key: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function onApply() {
    if (!plan) return;
    try {
      const r = await executePlan(plan);
      closeWidget(renderResultMarkdown(plan, r));
    } catch (e) {
      closeWidget(`**Error during apply:** ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function onCancel() {
    closeWidget("Cancelled — no files changed.");
  }

  async function onShowInFinder() {
    if (!plan) return;
    try { await revealInFinder(plan.root); } catch { /* ignore */ }
  }

  const header = (
    <CardHeader title="Smart Organize Directory" iconBundleId="com.apple.finder" />
  );

  // ── Render: preview state ───────────────────────────────────────────────
  if (view === "preview" && plan) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            <Action title="Cancel" onAction={onCancel} style="secondary" />
            <Action title="Show in Finder" onAction={onShowInFinder} style="secondary" />
            <Action.SubmitForm title="Apply Changes" onSubmit={onApply} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={renderPlanMarkdown(plan)} />
      </Form>
    );
  }

  // ── Render: no-key state ────────────────────────────────────────────────
  if (view === "no-key") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action
              title={savingKey ? "Saving..." : "Save & Analyze"}
              onAction={onSaveKey}
              isLoading={savingKey}
              isDisabled={!apiKeyInput.trim()}
              style="primary"
            />
          </ActionPanel>
        }
      >
        <Paper
          markdown={
            "**Anthropic API key required** — AI classification needs an API key to analyze your files. " +
            "It will be stored securely in macOS Keychain. Get one at [console.anthropic.com](https://console.anthropic.com)."
          }
        />
        <Form.PasswordField
          name="apiKey"
          label="Anthropic API key"
          value={apiKeyInput}
          onChange={setApiKeyInput}
        />
      </Form>
    );
  }

  // ── Render: error state ─────────────────────────────────────────────────
  if (view === "error") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Close" onAction={() => closeWidget(`**Error:** ${errorMsg}`)} style="secondary" />
          </ActionPanel>
        }
      >
        <Paper markdown={`**Error:** ${errorMsg}`} />
      </Form>
    );
  }

  // ── Render: analyzing state (default/initial) ───────────────────────────
  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action title="Cancel" onAction={onCancel} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={`### Analyzing \`${resolvedPath}\`\n\n_${analyzeStatus}_`} />
    </Form>
  );
}

function renderPlanMarkdown(plan: Plan): string {
  const lines: string[] = [];
  lines.push(`### Plan for \`${plan.root}\``);
  lines.push("");
  lines.push(`- **Files scanned:** ${plan.totalFiles}`);
  lines.push(`- **Actions queued:** ${plan.actions.length}`);
  if (plan.skipped > 0) lines.push(`- **Skipped:** ${plan.skipped}`);
  if (plan.duplicateBytes > 0) {
    lines.push(`- **Duplicate payload:** ${formatBytes(plan.duplicateBytes)}`);
  }
  lines.push("");

  const categoryEntries = Object.entries(plan.categoryCounts).sort((a, b) => b[1] - a[1]);
  if (categoryEntries.length > 0) {
    lines.push("**Destinations:**");
    for (const [cat, count] of categoryEntries) {
      const folder = plan.existingFolders[cat] ?? cat;
      const isExistingFolder =
        !!plan.existingFolders[cat] ||
        Object.values(plan.existingFolders).includes(cat);
      const tag = isExistingFolder ? " _(existing)_" : " _(new)_";
      lines.push(`- \`${folder}/\`${tag} — ${count} file${count === 1 ? "" : "s"}`);
    }
    lines.push("");
  }

  const moves = plan.actions.filter(
    (a): a is MoveAction => a.type === "move"
  );
  const archives = plan.actions.filter((a) => a.type === "archive");
  const duplicates = plan.actions.filter((a) => a.type === "duplicate");
  const folderMoves = plan.actions.filter(
    (a): a is MoveFolderAction => a.type === "move_folder"
  );

  if (folderMoves.length > 0) {
    lines.push(`**Grouping ${folderMoves.length} folder${folderMoves.length === 1 ? "" : "s"}:**`);
    for (const a of folderMoves) {
      const name = a.from.split("/").pop() ?? a.from;
      lines.push(`- \`${name}/\` → \`${a.parentName}/${name}/\``);
    }
    lines.push("");
  }
  if (archives.length > 0) {
    lines.push(`**Archiving ${archives.length} older file${archives.length === 1 ? "" : "s"}**`);
    lines.push("");
  }
  if (duplicates.length > 0) {
    lines.push(`**Moving ${duplicates.length} duplicate${duplicates.length === 1 ? "" : "s"} to \`Duplicates/\`**`);
    lines.push("");
  }

  const preview = moves.slice(0, 15);
  if (preview.length > 0) {
    lines.push("**Preview (first moves):**");
    for (const a of preview) {
      const fromName = a.from.split("/").pop() ?? a.from;
      const toName = a.to.split("/").pop() ?? a.to;
      if (fromName === toName) lines.push(`- \`${fromName}\` → \`${a.folderName}/\``);
      else lines.push(`- \`${fromName}\` → \`${a.folderName}/${toName}\``);
    }
    if (moves.length > 15) lines.push(`- _…and ${moves.length - 15} more_`);
  }

  if (plan.actions.length === 0) {
    lines.push("_Nothing to do — directory already looks organized._");
  }
  return lines.join("\n");
}

function renderResultMarkdown(plan: Plan, result: ExecuteResult): string {
  const lines: string[] = [];
  lines.push(`### Organized \`${plan.root}\``);
  lines.push("");
  lines.push(`- **Applied:** ${result.applied} action${result.applied === 1 ? "" : "s"}`);
  if (result.failed.length > 0) lines.push(`- **Failed:** ${result.failed.length}`);
  if (result.destinations.length > 0)
    lines.push(`- **Folders touched:** ${result.destinations.length}`);
  lines.push("");
  if (result.failed.length > 0) {
    lines.push("**Failures:**");
    for (const f of result.failed.slice(0, 10)) {
      const action = f.action;
      const path = "path" in action ? action.path : "from" in action ? action.from : "";
      const name = path.split("/").pop() ?? path;
      lines.push(`- \`${name}\` — ${f.error}`);
    }
    if (result.failed.length > 10)
      lines.push(`- _…and ${result.failed.length - 10} more_`);
  }
  return lines.join("\n");
}

const SmartOrganizeDirectoryWidget = defineWidget({
  name: "smart-organize-directory",
  description:
    "Analyzes and organizes files in a macOS folder into semantic subfolders using AI. " +
    "Shows a preview of all planned moves before applying. Applies macOS Finder color tags, " +
    "cleans filenames, archives old files, and handles duplicates.",
  schema,
  component: SmartOrganizeDirectory,
});

export default SmartOrganizeDirectoryWidget;
