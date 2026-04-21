import { join } from "node:path";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import {
  REPO_FOLDER_NAME,
  REPO_URL,
  ToolId,
  ToolStatus,
  cloneRepo,
  detectAll,
  installBrew,
  installGit,
  installNode,
  requestXcodeCLT,
} from "../helpers/detect.js";

const schema = z.object({});
type Props = z.infer<typeof schema>;

type Statuses = Record<ToolId, ToolStatus> | null;

function statusLine(tool: ToolStatus): string {
  const mark = tool.installed ? "✅" : "⬜️";
  const version = tool.installed ? ` — \`${tool.version ?? "installed"}\`` : " — _not installed_";
  const manager = tool.manager ? ` _(via ${tool.manager})_` : "";
  const note = tool.note ? `\n  > ${tool.note}` : "";
  return `- ${mark} **${tool.name}**${version}${manager}${note}`;
}

function buildStatusMarkdown(statuses: Statuses, log: string): string {
  if (!statuses) return "Detecting installed tools…";
  const lines = [statuses.brew, statuses.git, statuses.node].map(statusLine).join("\n");
  const logBlock = log ? `\n\n---\n\n\`\`\`\n${log.slice(-2000)}\n\`\`\`` : "";
  return `### Status\n\n${lines}${logBlock}`;
}

function SetupDevEnvironment(_props: Props) {
  const closeWidget = useCloseWidget();
  const [statuses, setStatuses] = useState<Statuses>(null);
  const [busy, setBusy] = useState<ToolId | "refresh" | "clone" | null>(null);
  const [log, setLog] = useState("");
  const [error, setError] = useState("");
  const [brewTerminalOpened, setBrewTerminalOpened] = useState(false);
  const [cloneDir, setCloneDir] = useState("");
  const [clonedPath, setClonedPath] = useState<string | null>(null);

  async function refresh() {
    setBusy("refresh");
    setError("");
    try {
      const next = await detectAll();
      setStatuses(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function runInstall(id: ToolId, fn: (onOutput: (chunk: string) => void) => Promise<void>) {
    setBusy(id);
    setError("");
    setLog(`Installing ${id}…\n`);
    try {
      await fn((chunk) => setLog((prev) => prev + chunk));
      setLog((prev) => prev + `\n✅ ${id} installed.\n`);
      const next = await detectAll();
      setStatuses(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onInstallBrew() {
    setBusy("brew");
    setError("");
    try {
      await installBrew();
      setBrewTerminalOpened(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onCloneRepo() {
    if (!cloneDir) return;
    setBusy("clone");
    setError("");
    setLog(`Cloning ${REPO_URL}…\n`);
    try {
      const dest = await cloneRepo(cloneDir, (chunk) => setLog((prev) => prev + chunk));
      setClonedPath(dest);
      setLog((prev) => prev + `\n✅ Cloned to ${dest}\n`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onInstallGit() {
    if (statuses && !statuses.brew.installed) {
      setError("Install Homebrew first — Git on macOS is installed via Homebrew or Xcode Command Line Tools.");
      return;
    }
    if (statuses?.git.note?.includes("Xcode")) {
      await requestXcodeCLT();
      setLog("Xcode Command Line Tools installer opened. Complete the dialog, then click Re-check.\n");
      return;
    }
    await runInstall("git", installGit);
  }

  async function onInstallNode() {
    if (statuses && !statuses.brew.installed) {
      setError("Install Homebrew first — Node.js will be installed via Homebrew.");
      return;
    }
    await runInstall("node", installNode);
  }

  function onDone() {
    closeWidget("Dev environment check complete.");
  }

  const allInstalled = statuses !== null && statuses.brew.installed && statuses.git.installed && statuses.node.installed;
  const isBusy = busy !== null;

  const actions = (
    <ActionPanel layout="column">
      {statuses && !statuses.brew.installed && !brewTerminalOpened && (
        <Action
          title={busy === "brew" ? "Opening Terminal…" : "Install Homebrew"}
          onAction={onInstallBrew}
          style="primary"
          isLoading={busy === "brew"}
          isDisabled={isBusy}
        />
      )}
      {statuses && !statuses.brew.installed && brewTerminalOpened && (
        <Action
          title={busy === "refresh" ? "Re-checking…" : "Homebrew Installed — Re-check"}
          onAction={refresh}
          style="primary"
          isLoading={busy === "refresh"}
          isDisabled={isBusy}
        />
      )}
      {statuses && statuses.brew.installed && !statuses.git.installed && (
        <Action
          title={busy === "git" ? "Installing Git…" : "Install Git"}
          onAction={onInstallGit}
          style="primary"
          isLoading={busy === "git"}
          isDisabled={isBusy}
        />
      )}
      {statuses && statuses.brew.installed && !statuses.node.installed && (
        <Action
          title={busy === "node" ? "Installing Node.js…" : "Install Node.js"}
          onAction={onInstallNode}
          style="primary"
          isLoading={busy === "node"}
          isDisabled={isBusy}
        />
      )}
      {allInstalled && !clonedPath && cloneDir && (
        <Action
          title={busy === "clone" ? "Cloning…" : "Clone Repository"}
          onAction={onCloneRepo}
          style="primary"
          isLoading={busy === "clone"}
          isDisabled={isBusy}
        />
      )}
      {clonedPath && (
        <Action.ShowInFinder title="Reveal in Finder" path={clonedPath} />
      )}
      <Action
        title={busy === "refresh" ? "Re-checking…" : "Re-check"}
        onAction={refresh}
        style="secondary"
        isLoading={busy === "refresh"}
        isDisabled={isBusy}
      />
      <Action title="Done" onAction={onDone} style={allInstalled && clonedPath ? "primary" : "secondary"} isDisabled={isBusy} />
    </ActionPanel>
  );

  const brewInstructions =
    statuses && !statuses.brew.installed
      ? brewTerminalOpened
        ? "\n\n---\n\n**Homebrew installer is running in Terminal.**\n\nFollow the prompts and enter your password when asked. Once complete, click *Homebrew Installed — Re-check*."
        : "\n\n---\n\n**Install Homebrew**\n\nClick *Install Homebrew* to open Terminal and start the installer. You'll need to enter your password when prompted."
      : "";

  const cloneDestPreview = cloneDir ? `\n\n**Will clone into:** \`${join(cloneDir, REPO_FOLDER_NAME)}\`` : "";
  const cloneSuccessNote = clonedPath ? `\n\n✅ **Cloned to** \`${clonedPath}\`` : "";

  return (
    <Form header={<CardHeader title="Eney Dev Setup" iconBundleId="com.apple.Terminal" />} actions={actions}>
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper markdown={buildStatusMarkdown(statuses, log) + brewInstructions} isScrollable />
      {allInstalled && (
        <Form.FilePicker
          name="cloneDir"
          label="Clone Repository Into"
          value={cloneDir}
          onChange={(v) => { setCloneDir(v as string); setClonedPath(null); }}
          accept={["public.folder"]}
        />
      )}
      {allInstalled && (cloneDir || clonedPath) && (
        <Paper markdown={`### Repository\n\n\`${REPO_URL}\`` + cloneDestPreview + cloneSuccessNote} />
      )}
    </Form>
  );
}

const SetupDevEnvironmentWidget = defineWidget({
  name: "setup-dev-environment",
  description:
    "Check and install the core Eney developer dependencies on macOS: Homebrew, Git, and Node.js. Shows live status and install progress.",
  schema,
  component: SetupDevEnvironment,
});

export default SetupDevEnvironmentWidget;
