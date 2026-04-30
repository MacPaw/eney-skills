import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  owner: z.string().describe("Repository owner/organisation, e.g. 'facebook'. Accepts 'owner/repo'."),
  repo: z.string().optional().describe("Repository name, e.g. 'react'. Optional if owner is 'owner/repo'."),
});

type Props = z.infer<typeof schema>;

interface Repo {
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  license: string | null;
  defaultBranch: string;
  homepage: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  archived: boolean;
  fork: boolean;
}

function normaliseOwnerRepo(rawOwner: string, rawRepo?: string): { owner: string; repo: string } {
  const owner = rawOwner.trim().replace(/^@/, "");
  if (!rawRepo || !rawRepo.trim()) {
    if (owner.includes("/")) {
      const [o, r] = owner.split("/").map((s) => s.trim());
      if (!o || !r) throw new Error("Use 'owner/repo' format.");
      return { owner: o, repo: r };
    }
    throw new Error("Both owner and repo are required.");
  }
  return { owner, repo: rawRepo.trim() };
}

async function fetchRepo(owner: string, repo: string): Promise<Repo> {
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (res.status === 404) throw new Error(`Repository ${owner}/${repo} not found.`);
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  const data = await res.json() as {
    full_name: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    subscribers_count?: number;
    watchers_count: number;
    open_issues_count: number;
    license: { spdx_id?: string; name?: string } | null;
    default_branch: string;
    homepage: string | null;
    html_url: string;
    created_at: string;
    updated_at: string;
    pushed_at: string;
    archived: boolean;
    fork: boolean;
  };
  return {
    fullName: data.full_name,
    description: data.description,
    language: data.language,
    stars: data.stargazers_count,
    forks: data.forks_count,
    watchers: data.watchers_count,
    openIssues: data.open_issues_count,
    license: data.license?.spdx_id ?? data.license?.name ?? null,
    defaultBranch: data.default_branch,
    homepage: data.homepage,
    htmlUrl: data.html_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at,
    archived: data.archived,
    fork: data.fork,
  };
}

function buildMarkdown(r: Repo): string {
  const date = (s: string) => new Date(s).toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`### ${r.fullName}${r.archived ? " 🗄️ archived" : ""}${r.fork ? " 🍴 fork" : ""}`);
  if (r.description) {
    lines.push("");
    lines.push(`> ${r.description}`);
  }
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| ⭐ Stars | **${r.stars.toLocaleString()}** |`);
  lines.push(`| 🍴 Forks | ${r.forks.toLocaleString()} |`);
  lines.push(`| 👀 Watchers | ${r.watchers.toLocaleString()} |`);
  lines.push(`| 🐛 Open issues/PRs | ${r.openIssues.toLocaleString()} |`);
  if (r.language) lines.push(`| Language | ${r.language} |`);
  if (r.license) lines.push(`| License | ${r.license} |`);
  lines.push(`| Default branch | \`${r.defaultBranch}\` |`);
  if (r.homepage) lines.push(`| Homepage | ${r.homepage} |`);
  lines.push(`| Created | ${date(r.createdAt)} |`);
  lines.push(`| Last push | ${date(r.pushedAt)} |`);
  lines.push("");
  lines.push(`[Open on GitHub](${r.htmlUrl})`);
  return lines.join("\n");
}

function GithubRepo(props: Props) {
  const closeWidget = useCloseWidget();
  const [owner, setOwner] = useState(props.owner);
  const [repo, setRepo] = useState(props.repo ?? "");
  const [data, setData] = useState<Repo | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    try {
      const { owner: o, repo: r } = normaliseOwnerRepo(owner, repo);
      fetchRepo(o, r)
        .then((d) => {
          if (cancelled) return;
          setData(d);
          setStatus("done");
        })
        .catch((err) => {
          if (cancelled) return;
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setStatus("error");
        });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function onLookup() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (data) {
      closeWidget(
        `${data.fullName}: ${data.stars.toLocaleString()} ★, ${data.forks.toLocaleString()} forks. ` +
        `${data.description ?? ""} ${data.htmlUrl}`,
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? "_Looking up repository…_"
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : data
          ? buildMarkdown(data)
          : "";

  return (
    <Form
      header={<CardHeader title="GitHub Repo" iconBundleId="com.apple.dt.Xcode" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="owner"
        label="Owner (or owner/repo)"
        value={owner}
        onChange={setOwner}
      />
      <Form.TextField name="repo" label="Repo name" value={repo} onChange={setRepo} />
    </Form>
  );
}

const GithubRepoWidget = defineWidget({
  name: "get_github_repo",
  description:
    "Look up a public GitHub repository via the unauthenticated REST API (rate limit ~60/hour per IP). Returns stars, forks, watchers, open issues, language, license, default branch, homepage, and timestamps. Accepts 'owner/repo' in the owner field.",
  schema,
  component: GithubRepo,
});

export default GithubRepoWidget;
