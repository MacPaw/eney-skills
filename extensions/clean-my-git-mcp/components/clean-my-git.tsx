import { Fragment, useEffect, useRef, useState } from "react";
import { spawn } from "node:child_process";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import { Action, ActionPanel, Divider, Form, Paper, defineWidget, runScript, useCloseWidget } from "@eney/api";

const schema = z.object({
  repoPath: z
    .string()
    .optional()
    .describe("A Git repository folder path to prefill when the widget opens."),
  repoPaths: z
    .array(z.string().describe("A Git repository folder path."))
    .optional()
    .describe("A list of Git repository folder paths to prefill when the widget opens."),
});

type Props = z.infer<typeof schema>;

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface BranchInfo {
  name: string;
  commit: string;
  upstream?: string;
  cleanupReason: string;
}

interface ScanResult {
  repoRoot: string;
  branches: BranchInfo[];
}

interface ScanFailure {
  repoRoot: string;
  message: string;
}

interface RepoStatus {
  icon: string;
}

interface CleanupFailure {
  name: string;
  message: string;
}

interface CleanupResult {
  repoRoot: string;
  deleted: string[];
  failed: CleanupFailure[];
}

interface ComparisonTarget {
  displayName: string;
  compareRef: string;
  commit: string;
  isRemote: boolean;
}

interface StoredSelection {
  recentRepoPaths?: string[];
}

type SelectedBranchState = Record<string, boolean>;

const storageDirectory = join(process.env.HOME ?? ".", ".eney", "state");
const storageFilePath = join(storageDirectory, "clean-my-git.json");
const homeDirectory = process.env.HOME?.replace(/\/+$/, "") ?? "";

function normalizeRepoPaths(paths: string[]): string[] {
  const uniquePaths = new Set<string>();
  const normalized: string[] = [];

  for (const path of paths) {
    const trimmed = path.trim();
    if (!trimmed || uniquePaths.has(trimmed)) {
      continue;
    }

    uniquePaths.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function sameRepoPaths(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((path, index) => path === right[index]);
}

function repoName(repoRoot: string): string {
  return basename(repoRoot) || repoRoot;
}

function toCompactRepoPath(repoPath: string): string {
  const normalizedHome = homeDirectory;

  if (!normalizedHome) {
    return repoPath;
  }

  if (repoPath === normalizedHome) {
    return "~";
  }

  if (repoPath.startsWith(`${normalizedHome}/`)) {
    return `~${repoPath.slice(normalizedHome.length)}`;
  }

  return repoPath;
}

function branchId(repoRoot: string, branchName: string): string {
  return `${repoRoot}::${branchName}`;
}

function branchCheckboxName(repoRoot: string, branchName: string): string {
  return `branch-${branchId(repoRoot, branchName).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()}`;
}

function toComparisonTargetLabel(target: ComparisonTarget): string {
  if (!target.isRemote) {
    return target.displayName;
  }

  return target.displayName.replace(/^[^/]+\//, "");
}

function runCommand(command: string, args: string[], cwd?: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, cwd ? { cwd } : undefined);
    let stdout = "";
    let stderr = "";

    process.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("error", (error) => {
      reject(error);
    });

    process.on("close", (code) => {
      resolve({
        code: code ?? 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

async function readStoredRepoPaths(): Promise<string[]> {
  try {
    const raw = await readFile(storageFilePath, "utf8");
    const parsed = JSON.parse(raw) as StoredSelection;
    return Array.isArray(parsed.recentRepoPaths) ? normalizeRepoPaths(parsed.recentRepoPaths) : [];
  } catch {
    return [];
  }
}

async function saveStoredRepoPaths(repoPaths: string[]): Promise<void> {
  await mkdir(storageDirectory, { recursive: true });
  await writeFile(storageFilePath, JSON.stringify({ recentRepoPaths: normalizeRepoPaths(repoPaths) }, null, 2), "utf8");
}

async function clearStoredRepoPaths(): Promise<void> {
  await unlink(storageFilePath).catch(() => undefined);
}

async function runGit(repoRoot: string, args: string[]): Promise<string> {
  const result = await runCommand("git", args, repoRoot);
  if (result.code !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed with exit code ${result.code}`);
  }

  return result.stdout;
}

async function chooseRepositoryFolder(): Promise<string | null> {
  try {
    const result = await runScript(`
      set selectedFolder to choose folder with prompt "Choose a Git repository"
      return POSIX path of selectedFolder
    `);

    return result.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("-128")) {
      return null;
    }

    throw error;
  }
}

async function resolveRepoRoot(selectionPath: string): Promise<string> {
  const trimmed = selectionPath.trim();

  if (!trimmed) {
    throw new Error("Select a Git repository folder.");
  }

  const fileStats = await stat(trimmed).catch(() => null);
  if (!fileStats) {
    throw new Error("The selected path no longer exists.");
  }

  const searchRoot = fileStats.isDirectory() ? trimmed : dirname(trimmed);
  const result = await runCommand("git", ["rev-parse", "--show-toplevel"], searchRoot);

  if (result.code !== 0 || !result.stdout) {
    throw new Error("The selected folder is not inside a Git repository.");
  }

  return result.stdout;
}

async function listLocalBranches(repoRoot: string): Promise<BranchInfo[]> {
  const output = await runGit(
    repoRoot,
    [
      "for-each-ref",
      "--format=%(refname:short)%00%(objectname)%00%(upstream:short)",
      "refs/heads",
    ],
  );

  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .map((line) => line.split("\u0000"))
    .filter((parts) => parts[0])
    .map(([name, commit, upstream]) => ({
      name,
      commit: commit ?? "",
      upstream: upstream || undefined,
      cleanupReason: "",
    }));
}

async function listComparisonTargets(repoRoot: string): Promise<ComparisonTarget[]> {
  const output = await runGit(
    repoRoot,
    ["for-each-ref", "--format=%(refname:short)%00%(objectname)%00%(refname)", "refs/heads", "refs/remotes"],
  );

  return output
    .split("\n")
    .map((line) => line.split("\u0000"))
    .filter((parts) => parts[0] && !parts[0].endsWith("/HEAD"))
    .map(([displayName, commit, refName]) => ({
      displayName,
      compareRef: displayName,
      commit: commit ?? "",
      isRemote: (refName ?? "").startsWith("refs/remotes/"),
    }));
}

async function listRemoteBranchNames(repoRoot: string): Promise<Set<string>> {
  const output = await runGit(repoRoot, ["for-each-ref", "--format=%(refname:short)", "refs/remotes"]);

  return new Set(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.endsWith("/HEAD"))
      .map((line) => line.replace(/^[^/]+\//, "")),
  );
}

async function isMergedInto(repoRoot: string, branchName: string, compareRef: string): Promise<boolean> {
  const result = await runCommand("git", ["merge-base", "--is-ancestor", branchName, compareRef], repoRoot);

  if (result.code === 0) {
    return true;
  }

  if (result.code === 1) {
    return false;
  }

  throw new Error(result.stderr || `Could not compare ${branchName} with ${compareRef}.`);
}

async function scanRepository(repoPath: string): Promise<ScanResult> {
  const repoRoot = await resolveRepoRoot(repoPath);
  const [currentBranch, localBranches, comparisonTargets, remoteBranches] = await Promise.all([
    runGit(repoRoot, ["branch", "--show-current"]),
    listLocalBranches(repoRoot),
    listComparisonTargets(repoRoot),
    listRemoteBranchNames(repoRoot),
  ]);
  const comparisonTargetByRef = new Map(comparisonTargets.map((target) => [target.compareRef, target]));
  const branches: BranchInfo[] = [];

  for (const branch of localBranches) {
    if (branch.name === currentBranch || remoteBranches.has(branch.name)) {
      continue;
    }

    const compareRef = branch.upstream || currentBranch;
    if (!compareRef || compareRef === branch.name) {
      continue;
    }

    const target = comparisonTargetByRef.get(compareRef);
    if (!target) {
      continue;
    }

    const merged = await isMergedInto(repoRoot, branch.name, compareRef);
    if (!merged) {
      continue;
    }

    branches.push({
      ...branch,
      cleanupReason:
        branch.commit === target.commit
          ? `identical to ${toComparisonTargetLabel(target)}`
          : `merged to ${toComparisonTargetLabel(target)}`,
    });
  }

  branches.sort((left, right) => left.name.localeCompare(right.name));

  return {
    repoRoot,
    branches,
  };
}

async function cleanupBranches(repoRoot: string, branchNames: string[]): Promise<CleanupResult> {
  const deleted: string[] = [];
  const failed: CleanupFailure[] = [];

  for (const branchName of branchNames) {
    const result = await runCommand("git", ["branch", "-d", branchName], repoRoot);
    if (result.code === 0) {
      deleted.push(branchName);
      continue;
    }

    failed.push({
      name: branchName,
      message: result.stderr || result.stdout || `git branch -d exited with code ${result.code}`,
    });
  }

  return {
    repoRoot,
    deleted,
    failed,
  };
}

function toDisplayText(value: string): string {
  return value.replace(/`/g, "'").trim();
}

function toBoldText(value: string): string {
  return value.replace(/[\\*_`\[\]]/g, "\\$&").trim();
}

function getRepoStatus(scanResult: ScanResult | undefined, scanFailure: ScanFailure | undefined): RepoStatus {
  if (scanFailure) {
    return {
      icon: "⚠️",
    };
  }

  if ((scanResult?.branches.length ?? 0) > 0) {
    return {
      icon: "🧹",
    };
  }

  return {
    icon: "🟢",
  };
}

function getCleanupStatus(result: CleanupResult): RepoStatus {
  if (result.failed.length > 0) {
    return {
      icon: "⚠️",
    };
  }

  return {
    icon: "✅",
  };
}

function buildOverviewMarkdown(repoPaths: string[]): string {
  const lines = ["## 🧹 CleanMyGit", ""];

  if (repoPaths.length === 0) {
    lines.push("No repositories selected yet.");
    lines.push("");
    lines.push("Use **Add Git repository** to track a repository.");
    return lines.join("\n");
  }

  lines.push(`Tracking ${repoPaths.length} repositories`);
  return lines.join("\n");
}

function buildRepositorySummaryMarkdown(repoPath: string, statusIcon: string, note?: string): string {
  const lines = [
    `### 📁 **${toBoldText(repoName(repoPath))}** ${statusIcon}`,
    `> ${toDisplayText(toCompactRepoPath(repoPath))}`,
  ];

  if (note) {
    lines.push("");
    lines.push(note);
  }

  return lines.join("\n");
}

function buildRepositoryBranchesMarkdown(result: ScanResult): string {
  const lines = [
    `### 📁 **${toBoldText(repoName(result.repoRoot))}**`,
    "",
    "**Why these branches can be removed:**",
    "",
  ];

  for (const branch of result.branches) {
    lines.push(`- **${toBoldText(branch.name)}**: ${toDisplayText(branch.cleanupReason)}`);
  }

  lines.push("");

  return lines.join("\n");
}

function buildBranchLabel(branch: BranchInfo): string {
  return branch.name;
}

function buildUnusedBranchesSectionMarkdown(): string {
  return "## **Unused local branches**";
}

function buildAllCleanMarkdown(): string {
  return "## ✅ All tracked repositories are clean";
}

function buildCleanupOverviewMarkdown(results: CleanupResult[]): string {
  const totalDeleted = results.reduce((count, item) => count + item.deleted.length, 0);
  const totalFailed = results.reduce((count, item) => count + item.failed.length, 0);
  const lines = [
    "## 🧹 CleanMyGit",
    "",
    `## ${totalFailed === 0 ? "🎉 Cleanup complete" : "✅ Cleanup finished"}`,
    "",
    `Deleted **${totalDeleted}** branches across **${results.length}** repositories.`,
  ];

  if (totalFailed === 0) {
    lines.push("");
    lines.push("🎊 All selected branches were removed successfully.");
  }

  return lines.join("\n").trim();
}

function buildCleanupRepositoryMarkdown(result: CleanupResult): string {
  const status = getCleanupStatus(result);
  const lines = [buildRepositorySummaryMarkdown(result.repoRoot, status.icon)];

  if (result.deleted.length > 0) {
    lines.push("");
    lines.push(result.failed.length > 0 ? "Deleted local branches:" : "Cleaned local branches:");
    lines.push("");

    for (const branchName of result.deleted) {
      lines.push(`- **${toBoldText(branchName)}**`);
    }
  }

  if (result.failed.length > 0) {
    lines.push("");
    lines.push("Could not remove:");
    lines.push("");

    for (const failure of result.failed) {
      lines.push(`- **${toBoldText(failure.name)}**: ${toDisplayText(failure.message)}`);
    }
  }

  return lines.join("\n").trim();
}

function buildCloseMessage(cleanupResults: CleanupResult[] | null, scanResults: ScanResult[]): string {
  if (cleanupResults) {
    const totalDeleted = cleanupResults.reduce((count, item) => count + item.deleted.length, 0);
    if (totalDeleted === 0) {
      return "No merged branches were deleted.";
    }

    return `Deleted ${totalDeleted} merged branch(es) across ${cleanupResults.length} repos.`;
  }

  const totalCandidates = scanResults.reduce((count, repo) => count + repo.branches.length, 0);
  if (totalCandidates > 0) {
    return `Detected ${totalCandidates} local-only merged branch(es) across ${scanResults.length} repos.`;
  }

  return "Done";
}

function CleanMyGit(props: Props) {
  const closeWidget = useCloseWidget();
  const initialRepoPaths = normalizeRepoPaths([...(props.repoPaths ?? []), ...(props.repoPath ? [props.repoPath] : [])]);
  const hasProvidedRepoPaths = initialRepoPaths.length > 0;
  const lastCompletedScanRevisionRef = useRef(0);
  const [repoPaths, setRepoPaths] = useState(initialRepoPaths);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [scanFailures, setScanFailures] = useState<ScanFailure[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<SelectedBranchState>({});
  const [cleanupResults, setCleanupResults] = useState<CleanupResult[] | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [isRestoringRepos, setIsRestoringRepos] = useState(!hasProvidedRepoPaths && process.env.NODE_ENV !== "test");
  const [isPickingRepository, setIsPickingRepository] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [scanRevision, setScanRevision] = useState(0);

  useEffect(() => {
    if (hasProvidedRepoPaths || process.env.NODE_ENV === "test") {
      setIsRestoringRepos(false);
      return;
    }

    let isActive = true;

    async function restoreRepositories() {
      try {
        const storedRepoPaths = await readStoredRepoPaths();
        const validRepoPaths: string[] = [];

        for (const repoPath of storedRepoPaths) {
          const stats = await stat(repoPath).catch(() => null);
          if (stats) {
            validRepoPaths.push(repoPath);
          }
        }

        if (!isActive) {
          return;
        }

        const normalized = normalizeRepoPaths(validRepoPaths);
        if (normalized.length === 0) {
          await clearStoredRepoPaths();
        } else if (normalized.length !== storedRepoPaths.length) {
          await saveStoredRepoPaths(normalized);
        }

        setRepoPaths(normalized);
      } finally {
        if (isActive) {
          setIsRestoringRepos(false);
        }
      }
    }

    void restoreRepositories();

    return () => {
      isActive = false;
    };
  }, [hasProvidedRepoPaths]);

  useEffect(() => {
    if (repoPaths.length === 0) {
      if (scanResults.length > 0) {
        setScanResults([]);
      }

      if (scanFailures.length > 0) {
        setScanFailures([]);
      }

      setSelectedBranches((currentSelection) => {
        return Object.keys(currentSelection).length === 0 ? currentSelection : {};
      });

      if (cleanupResults) {
        setCleanupResults(null);
      }

      if (isScanning) {
        setIsScanning(false);
      }

      lastCompletedScanRevisionRef.current = scanRevision;
      return;
    }

    const shouldRescanAll = scanRevision !== lastCompletedScanRevisionRef.current;
    const scannedRepoRoots = new Set([
      ...scanResults.map((result) => result.repoRoot),
      ...scanFailures.map((failure) => failure.repoRoot),
    ]);
    const repoPathsToScan = shouldRescanAll
      ? repoPaths
      : repoPaths.filter((repoPath) => !scannedRepoRoots.has(repoPath));

    if (repoPathsToScan.length === 0) {
      if (shouldRescanAll) {
        lastCompletedScanRevisionRef.current = scanRevision;
      }

      setIsScanning(false);
      return;
    }

    let isActive = true;
    setCleanupResults(null);
    setWidgetError(null);
    setIsScanning(true);

    async function runScan() {
      const settled = await Promise.all(
        repoPathsToScan.map(async (repoPath) => {
          try {
            const result = await scanRepository(repoPath);
            return { kind: "success" as const, inputPath: repoPath, result };
          } catch (error) {
            return {
              kind: "failure" as const,
              inputPath: repoPath,
              failure: {
                repoRoot: repoPath,
                message: error instanceof Error ? error.message : String(error),
              },
            };
          }
        }),
      );

      if (!isActive) {
        return;
      }

      const nextResults = settled.flatMap((item) => (item.kind === "success" ? [item.result] : []));
      const nextFailures = settled.flatMap((item) => (item.kind === "failure" ? [item.failure] : []));
      const resolvedRepoPathsByInputPath = new Map(
        settled.map((item) => [item.inputPath, item.kind === "success" ? item.result.repoRoot : item.failure.repoRoot]),
      );
      const normalizedRepoPaths = normalizeRepoPaths(
        repoPaths.map((repoPath) => resolvedRepoPathsByInputPath.get(repoPath) ?? repoPath),
      );
      const replacedRepoRoots = new Set([
        ...repoPathsToScan,
        ...nextResults.map((result) => result.repoRoot),
        ...nextFailures.map((failure) => failure.repoRoot),
      ]);

      if (shouldRescanAll) {
        setScanResults(nextResults);
        setScanFailures(nextFailures);
        lastCompletedScanRevisionRef.current = scanRevision;
      } else {
        setScanResults((currentResults) => [
          ...currentResults.filter((result) => !replacedRepoRoots.has(result.repoRoot)),
          ...nextResults,
        ]);
        setScanFailures((currentFailures) => [
          ...currentFailures.filter((failure) => !replacedRepoRoots.has(failure.repoRoot)),
          ...nextFailures,
        ]);
      }

      if (!sameRepoPaths(repoPaths, normalizedRepoPaths)) {
        setRepoPaths(normalizedRepoPaths);
      }

      void saveStoredRepoPaths(normalizedRepoPaths);
      setIsScanning(false);
    }

    void runScan();

    return () => {
      isActive = false;
    };
  }, [cleanupResults, isScanning, repoPaths, scanFailures, scanResults, scanRevision]);

  useEffect(() => {
    const availableBranchIds = new Set(
      scanResults.flatMap((repo) => repo.branches.map((branch) => branchId(repo.repoRoot, branch.name))),
    );

    setSelectedBranches((currentSelection) => {
      const nextSelection: SelectedBranchState = {};

      for (const id of availableBranchIds) {
        nextSelection[id] = currentSelection[id] ?? true;
      }

      return nextSelection;
    });
  }, [scanResults]);

  const selectedBranchCount = scanResults.reduce((count, repo) => {
    return (
      count +
      repo.branches.filter((branch) => selectedBranches[branchId(repo.repoRoot, branch.name)] ?? true).length
    );
  }, 0);
  const cleanableRepos = repoPaths.flatMap((repoPath) => {
    const result = scanResults.find((repo) => repo.repoRoot === repoPath);
    return result && result.branches.length > 0 ? [result] : [];
  });
  const allRepositoriesClean =
    repoPaths.length > 0 &&
    cleanableRepos.length === 0 &&
    scanFailures.length === 0 &&
    !isScanning &&
    !isRestoringRepos &&
    !widgetError;

  async function onPickRepository() {
    setIsPickingRepository(true);
    setWidgetError(null);

    try {
      const selectedFolder = await chooseRepositoryFolder();
      if (!selectedFolder) {
        return;
      }

      const repoRoot = await resolveRepoRoot(selectedFolder);
      const nextRepoPaths = normalizeRepoPaths([repoRoot, ...repoPaths]);
      setCleanupResults(null);
      setRepoPaths(nextRepoPaths);
      void saveStoredRepoPaths(nextRepoPaths);
    } catch (error) {
      setWidgetError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPickingRepository(false);
    }
  }

  function onRemoveTrackedRepository(repoRoot: string) {
    const nextRepoPaths = repoPaths.filter((path) => path !== repoRoot);

    setCleanupResults(null);
    setWidgetError(null);
    setRepoPaths(nextRepoPaths);
    setScanResults((currentResults) => currentResults.filter((result) => result.repoRoot !== repoRoot));
    setScanFailures((currentFailures) => currentFailures.filter((failure) => failure.repoRoot !== repoRoot));
    setSelectedBranches((currentSelection) =>
      Object.fromEntries(Object.entries(currentSelection).filter(([id]) => !id.startsWith(`${repoRoot}::`))),
    );

    if (nextRepoPaths.length === 0) {
      void clearStoredRepoPaths();
      return;
    }

    void saveStoredRepoPaths(nextRepoPaths);
  }

  async function onCleanUp() {
    if (selectedBranchCount === 0) {
      return;
    }

    setIsCleaning(true);
    setWidgetError(null);

    try {
      const cleanupTargets = scanResults
        .map((repo) => ({
          repoRoot: repo.repoRoot,
          branchNames: repo.branches
            .filter((branch) => selectedBranches[branchId(repo.repoRoot, branch.name)] ?? true)
            .map((branch) => branch.name),
        }))
        .filter((repo) => repo.branchNames.length > 0);

      const results = await Promise.all(
        cleanupTargets.map((repo) => cleanupBranches(repo.repoRoot, repo.branchNames)),
      );

      setCleanupResults(results);
    } catch (error) {
      setWidgetError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCleaning(false);
    }
  }

  function onToggleBranch(id: string, checked: boolean) {
    setSelectedBranches((currentSelection) => ({
      ...currentSelection,
      [id]: checked,
    }));
  }

  function onDone() {
    closeWidget(buildCloseMessage(cleanupResults, scanResults));
  }

  if (cleanupResults) {
    return (
      <Form
        actions={
          <ActionPanel layout="row">
            <Action
              title="Scan Again"
              onAction={() => {
                setCleanupResults(null);
                setScanRevision((revision) => revision + 1);
              }}
              style="secondary"
            />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={buildCleanupOverviewMarkdown(cleanupResults)} />
        {cleanupResults.map((result, index) => {
          return (
            <Fragment key={`${result.repoRoot}-cleanup`}>
              {index > 0 && <Divider />}
              <Paper markdown={buildCleanupRepositoryMarkdown(result)} isScrollable />
            </Fragment>
          );
        })}
      </Form>
    );
  }

  return (
    <Form
      actions={
        <ActionPanel layout="row">
          <Action
            title={selectedBranchCount > 0 ? `Clean Up (${selectedBranchCount})` : "Clean Up"}
            onAction={onCleanUp}
            style="primary"
            isLoading={isCleaning}
            isDisabled={selectedBranchCount === 0 || isScanning || isRestoringRepos}
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper
        markdown={buildOverviewMarkdown(repoPaths)}
        actions={
          <ActionPanel layout="row">
            <Action
              title="Add Git repository"
              onAction={onPickRepository}
              style="secondary"
              isLoading={isPickingRepository}
            />
          </ActionPanel>
        }
      />
      {repoPaths.map((repoPath) => {
        const scanResult = scanResults.find((item) => item.repoRoot === repoPath);
        const scanFailure = scanFailures.find((item) => item.repoRoot === repoPath);
        const status = getRepoStatus(scanResult, scanFailure);

        return (
          <Fragment key={`${repoPath}-summary`}>
            <Divider />
            <Paper
              markdown={buildRepositorySummaryMarkdown(
                repoPath,
                status.icon,
                scanFailure ? `⚠️ ${toDisplayText(scanFailure.message)}` : undefined,
              )}
              actions={
                <ActionPanel layout="row">
                  <Action.ShowInFinder
                    title="Open in Finder"
                    path={repoPath}
                    style="secondary"
                    isDisabled={isScanning || isCleaning || isRestoringRepos}
                  />
                  <Action
                    title="Remove"
                    onAction={() => onRemoveTrackedRepository(repoPath)}
                    style="secondary"
                    isDisabled={isScanning || isCleaning || isRestoringRepos}
                  />
                </ActionPanel>
              }
            />
          </Fragment>
        );
      })}
      {isRestoringRepos && <Paper markdown="Loading saved repositories..." />}
      {isScanning && <Paper markdown="Scanning repositories for local-only merged branches..." />}
      {widgetError && <Paper markdown={`**Error:** ${toDisplayText(widgetError)}`} />}
      {cleanableRepos.length > 0 && (
        <>
          <Divider />
          <Paper markdown={buildUnusedBranchesSectionMarkdown()} />
        </>
      )}
      {cleanableRepos.map((repo, repoIndex) => {
        return (
          <Fragment key={repo.repoRoot}>
            {repoIndex > 0 && <Divider />}
            <Paper markdown={buildRepositoryBranchesMarkdown(repo)} />
            {repo.branches.map((branch) => {
              const id = branchId(repo.repoRoot, branch.name);

              return (
                <Form.Checkbox
                  key={id}
                  name={branchCheckboxName(repo.repoRoot, branch.name)}
                  label={buildBranchLabel(branch)}
                  checked={selectedBranches[id] ?? true}
                  onChange={(checked) => onToggleBranch(id, checked)}
                  variant="checkbox"
                />
              );
            })}
          </Fragment>
        );
      })}
      {cleanableRepos.length > 0 && <Divider />}
      {allRepositoriesClean && <Paper markdown={buildAllCleanMarkdown()} />}
    </Form>
  );
}

const CleanMyGitWidget = defineWidget({
  name: "clean-my-git",
  description: "Scan selected Git repositories for merged local-only branches and let the user delete chosen branches safely.",
  schema,
  component: CleanMyGit,
});

export default CleanMyGitWidget;
