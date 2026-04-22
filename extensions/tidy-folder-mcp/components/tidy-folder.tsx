import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  CardHeader,
  Files,
  Form,
  Paper,
  defineWidget,
  useCloseWidget,
} from "@eney/api";
import {
  AGE_DAYS,
  Candidate,
  UNTIDY_FOLDER_NAME,
  formatBytes,
  moveToTrash,
  moveToUntidyFolder,
  resolveFolder,
  scanFolder,
} from "../helpers/tidy.js";

const schema = z.object({
  folder: z
    .string()
    .optional()
    .describe(
      "Folder to tidy. Accepts a full path (e.g. /Users/me/Projects/old) or one of these aliases: Desktop, Downloads, Documents. Defaults to Downloads.",
    ),
});

type Props = z.infer<typeof schema>;
type Stage = "input" | "preview" | "done";

const header = <CardHeader title="Tidy Folder" iconBundleId="com.apple.finder" />;

function TidyFolder(props: Props) {
  const closeWidget = useCloseWidget();
  const [folderInput, setFolderInput] = useState(props.folder ?? "Downloads");
  const [stage, setStage] = useState<Stage>("input");
  const [resolvedFolder, setResolvedFolder] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [revealPath, setRevealPath] = useState<string | null>(null);

  async function onScan() {
    setError("");
    setIsBusy(true);
    try {
      const folder = resolveFolder(folderInput);
      const matches = await scanFolder(folder);
      setResolvedFolder(folder);
      setCandidates(matches);
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsBusy(false);
    }
  }

  async function onMoveToTrash() {
    setError("");
    setIsBusy(true);
    try {
      await moveToTrash(candidates.map((c) => c.fullPath));
      const total = candidates.reduce((sum, c) => sum + c.size, 0);
      setRevealPath(null);
      setSummary(
        `Moved **${candidates.length} file(s)** (${formatBytes(total)}) to the Trash.\n\n` +
          `From: \`${resolvedFolder}\`\n\n` +
          `Recover with ⌘Z in Finder, or use **Put Back** from the Trash.`,
      );
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsBusy(false);
    }
  }

  async function onMoveToUntidy() {
    setError("");
    setIsBusy(true);
    try {
      const dest = await moveToUntidyFolder(
        resolvedFolder,
        candidates.map((c) => c.fullPath),
      );
      const total = candidates.reduce((sum, c) => sum + c.size, 0);
      setRevealPath(dest);
      setSummary(
        `Moved **${candidates.length} file(s)** (${formatBytes(total)}) to the \`${UNTIDY_FOLDER_NAME}\` folder.\n\n` +
          `Destination: \`${dest}\``,
      );
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsBusy(false);
    }
  }

  function onBack() {
    setStage("input");
    setCandidates([]);
    setError("");
  }

  function onDone() {
    closeWidget("Done.");
  }

  if (stage === "done") {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="row">
            {revealPath && (
              <Action.ShowInFinder path={revealPath} style="secondary" />
            )}
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={summary} />
      </Form>
    );
  }

  if (stage === "preview") {
    if (candidates.length === 0) {
      return (
        <Form
          header={header}
          actions={
            <ActionPanel layout="row">
              <Action title="Back" onAction={onBack} style="secondary" />
              <Action title="Done" onAction={onDone} style="primary" />
            </ActionPanel>
          }
        >
          <Paper
            markdown={
              `Nothing to clean in \`${resolvedFolder}\`.\n\n` +
              `No files older than ${AGE_DAYS} days matched the cleanup patterns.`
            }
          />
        </Form>
      );
    }

    const total = candidates.reduce((sum, c) => sum + c.size, 0);
    const summaryMd =
      `**${candidates.length} file(s)** — ${formatBytes(total)} total  \n` +
      `From: \`${resolvedFolder}\`  \n` +
      `Older than ${AGE_DAYS} days`;

    return (
      <Form
        header={header}
        actions={
          <ActionPanel layout="column">
            <Action
              title="Back"
              onAction={onBack}
              style="secondary"
              isDisabled={isBusy}
            />
            <Action
              title={isBusy ? "Moving…" : `Move to "${UNTIDY_FOLDER_NAME}" folder`}
              onAction={onMoveToUntidy}
              style="secondary"
              isLoading={isBusy}
              isDisabled={isBusy}
            />
            <Action
              title={isBusy ? "Moving…" : "Move to Trash"}
              onAction={onMoveToTrash}
              style="primary"
              isLoading={isBusy}
              isDisabled={isBusy}
            />
          </ActionPanel>
        }
      >
        {error && <Paper markdown={`**Error:** ${error}`} />}
        <Paper markdown={summaryMd} />
        <Files>
          {candidates.map((c) => (
            <Files.Item key={c.fullPath} path={c.fullPath} />
          ))}
        </Files>
      </Form>
    );
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isBusy ? "Scanning…" : "Scan"}
            onSubmit={onScan}
            style="primary"
            isLoading={isBusy}
            isDisabled={isBusy || !folderInput.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper
        markdown={
          `Cleans files older than **${AGE_DAYS} days** matching: screenshots (Screen Shot/Screenshot/CleanShot), ` +
          `screen recordings (.mov/.mp4), installers (.dmg/.pkg), and archives (.zip/.tar/.tar.gz/.tgz/.rar/.7z). ` +
          `Top-level only — subfolders are left alone. You can move matches to a \`${UNTIDY_FOLDER_NAME}\` ` +
          `folder inside the scanned folder, or straight to the Trash.`
        }
      />
      <Form.TextField
        name="folder"
        label="Folder"
        value={folderInput}
        onChange={setFolderInput}
      />
    </Form>
  );
}

const TidyFolderWidget = defineWidget({
  name: "tidy-folder",
  description:
    "Review stale clutter (old screenshots, screen recordings, installers, archives) in a folder, then move it to an `untidy` subfolder or to the Trash. Accepts a full path or one of these aliases: Desktop, Downloads, Documents.",
  schema,
  component: TidyFolder,
});

export default TidyFolderWidget;
