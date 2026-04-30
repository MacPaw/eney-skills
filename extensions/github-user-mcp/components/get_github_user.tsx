import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";

const schema = z.object({
  username: z.string().describe("GitHub username (login), e.g. 'octocat', 'torvalds'."),
});

type Props = z.infer<typeof schema>;

interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
  htmlUrl: string;
}

async function fetchUser(username: string): Promise<GitHubUser> {
  const cleaned = username.trim().replace(/^@/, "");
  if (!cleaned) throw new Error("Empty username.");
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(cleaned)}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404) {
    throw new Error(`No GitHub user "${cleaned}" found.`);
  }
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  const data = await res.json() as {
    login: string;
    name: string | null;
    avatar_url: string;
    bio: string | null;
    company: string | null;
    blog: string | null;
    location: string | null;
    public_repos: number;
    followers: number;
    following: number;
    created_at: string;
    html_url: string;
  };
  return {
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
    bio: data.bio,
    company: data.company,
    blog: data.blog,
    location: data.location,
    publicRepos: data.public_repos,
    followers: data.followers,
    following: data.following,
    createdAt: data.created_at,
    htmlUrl: data.html_url,
  };
}

function buildMarkdown(user: GitHubUser): string {
  const created = new Date(user.createdAt).toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`![avatar](${user.avatarUrl})`);
  lines.push("");
  lines.push(`### ${user.name ?? user.login} ([@${user.login}](${user.htmlUrl}))`);
  if (user.bio) {
    lines.push("");
    lines.push(`> ${user.bio}`);
  }
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Repos | **${user.publicRepos.toLocaleString()}** |`);
  lines.push(`| Followers | **${user.followers.toLocaleString()}** |`);
  lines.push(`| Following | **${user.following.toLocaleString()}** |`);
  if (user.company) lines.push(`| Company | ${user.company} |`);
  if (user.location) lines.push(`| Location | ${user.location} |`);
  if (user.blog) lines.push(`| Blog | ${user.blog} |`);
  lines.push(`| Joined | ${created} |`);
  return lines.join("\n");
}

function GitHubUserWidget(props: Props) {
  const closeWidget = useCloseWidget();
  const [username, setUsername] = useState(props.username);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!username.trim()) {
      setStatus("error");
      setErrorMsg("Username is required.");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    fetchUser(username)
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus("done");
      })
      .catch((err) => {
        if (cancelled) return;
        setUser(null);
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function onLookup() {
    setReloadCount((c) => c + 1);
  }

  function onDone() {
    if (user) {
      closeWidget(
        `${user.name ?? user.login} (@${user.login}): ${user.publicRepos} repos, ` +
        `${user.followers} followers, ${user.following} following. ${user.htmlUrl}`,
      );
    } else {
      closeWidget(errorMsg ? `Error: ${errorMsg}` : "Closed.");
    }
  }

  const markdown =
    status === "loading"
      ? `_Looking up @${username}…_`
      : status === "error"
        ? `**Error:** ${errorMsg}`
        : user
          ? buildMarkdown(user)
          : "";

  return (
    <Form
      header={<CardHeader title="GitHub User" iconBundleId="com.apple.dt.Xcode" />}
      actions={
        <ActionPanel layout="row">
          <Action.SubmitForm title="Look Up" onSubmit={onLookup} style="primary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={markdown} />
      <Form.TextField
        name="username"
        label="GitHub username"
        value={username}
        onChange={setUsername}
      />
    </Form>
  );
}

const GitHubUserWidgetDef = defineWidget({
  name: "get_github_user",
  description:
    "Look up a public GitHub user profile. Returns name, bio, repos, followers, location, blog, and join date. Uses the unauthenticated GitHub REST API (rate limit ~60/hour per IP).",
  schema,
  component: GitHubUserWidget,
});

export default GitHubUserWidgetDef;
