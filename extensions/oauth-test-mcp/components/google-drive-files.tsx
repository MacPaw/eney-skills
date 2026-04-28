import { useState, useEffect } from "react";
import { z } from "zod";
import {
  defineWidget,
  useOAuth,
  useCloseWidget,
  Paper,
  ActionPanel,
  Action,
  useLogger,
} from "@eney/api";
import type { OAuthConfig } from "@eney/api";

const schema = z.object({});

type Props = z.infer<typeof schema>;

const googleDriveOAuth: OAuthConfig = {
  clientId: "600315618905-v5613t2s8174mvl1n2ra6r2ugmq4dmju.apps.googleusercontent.com",
  "authorizeUrl": "https://extensions-pr-253.eney.appflix.io/api/v1/public/oauth-proxy/authorize/GkmHQgikJqaFMwcMELHLBpHXQkDP94Mrz-vjnIuzlS9p0gwgm9ruIzJpEXu4elExMKjUwJ9JX0a2MiIXLlakijar2gq4r8ttMmH0cNDAMebDZGDiBYn5gyVfgkq0Wm7Kazh_Ap9_tEvZh5bdzmW-TISZJAdHkKeqWaLYL1GFq1NZEFTqtb27pVwjE6hl0K63toRqktHlvE7OJRDE4wR9--OVZjfa72qt9LsBge_rkvS2w7IDnV4tjMHt7q0LJMQYEdr73hVYk-vBeyMCFDkFoKAvHFttlZ8qsOdVWyv5gubmZeDWTgBzbt2JxE_BWkUDklZyc5uhXUSWxjqUWi2lxwtCXzX7ULVbFvKmHKh078YdAI97Es6kcPHTi7MX-ZyGi-W3lwdvsuEjg8hqT0zvzlUsdl12KiCn5cFqBmLCbbIafj5nbSQpF60OpQs0CoQ",
  "tokenUrl": "https://extensions-pr-253.eney.appflix.io/api/v1/public/oauth-proxy/token/GkmHQgikJqaFMwcMELHLBpHXQkDP94Mrz-vjnIuzlS9p0gwgm9ruIzJpEXu4elExMKjUwJ9JX0a2MiIXLlakijar2gq4r8ttMmH0cNDAMebDZGDiBYn5gyVfgkq0Wm7Kazh_Ap9_tEvZh5bdzmW-TISZJAdHkKeqWaLYL1GFq1NZEFTqtb27pVwjE6hl0K63toRqktHlvE7OJRDE4wR9--OVZjfa72qt9LsBge_rkvS2w7IDnV4tjMHt7q0LJMQYEdr73hVYk-vBeyMCFDkFoKAvHFttlZ8qsOdVWyv5gubmZeDWTgBzbt2JxE_BWkUDklZyc5uhXUSWxjqUWi2lxwtCXzX7ULVbFvKmHKh078YdAI97Es6kcPHTi7MX-ZyGi-W3lwdvsuEjg8hqT0zvzlUsdl12KiCn5cFqBmLCbbIafj5nbSQpF60OpQs0CoQ",
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
};

const DRIVE_URL =
  "https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType,modifiedTime,webViewLink)";

function GoogleDriveFiles(_props: Props) {
  const log = useLogger();
  const { status, tokens, error, refresh, authorize } = useOAuth(googleDriveOAuth);
  const closeWidget = useCloseWidget();
  const [markdown, setMarkdown] = useState("Loading your recent Drive files...");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    log.info("OAuth status changed", { status, tokens, error });
  }, [status, tokens]);

  useEffect(() => {
    log.info("OAuth data changed", { tokens, error });

    if (tokens) {
      setToken(tokens.accessToken);
    }
  }, [tokens]);

  useEffect(() => {
    if (!token) return;

    async function fetchFiles() {
      let res = await fetch(DRIVE_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      log.info("Fetched drive files", { status: res.status });

      if (res.status === 401) {
        const newTokens = await refresh();
        setToken(newTokens.accessToken);
        res = await fetch(DRIVE_URL, {
          headers: { Authorization: `Bearer ${newTokens.accessToken}` },
        });
      }

      const body = await res.json();

      if (body.files?.length) {
        const list = body.files
          .map((f: any, i: number) => {
            const type = (f.mimeType || "").replace("application/vnd.google-apps.", "");
            const modified = f.modifiedTime ? new Date(f.modifiedTime).toLocaleString() : "";
            const name = f.webViewLink ? `[${f.name}](${f.webViewLink})` : f.name;
            return `${i + 1}. **${name}** — ${type} · ${modified}`;
          })
          .join("\n");
        setMarkdown(`## Recent Google Drive Files\n\n${list}`);
      } else {
        setMarkdown("No recent files found.");
      }
    }

    fetchFiles().catch((err: Error) => {
      setMarkdown(`Error: ${err.message}`);
    });
  }, [token]);

  if (status === "pending") {
    return <Paper markdown="Fetching access token..." />;
  }

  if (error) {
    const actions = (
      <ActionPanel>
        <Action title="Retry" onAction={authorize} style="primary" />
      </ActionPanel>
    );
    return <Paper markdown={`**Sign in failed**\n\n${error}`} actions={actions} />;
  }

  if (!tokens && !token) {
    const signInActions = (
      <ActionPanel>
        <Action title="Sign In" onAction={authorize} style="primary" />
      </ActionPanel>
    );

    return (
      <Paper
        actions={signInActions}
        markdown="Please sign in with Google to view your recent Drive files."
      />
    );
  }

  const actions = (
    <ActionPanel>
      <Action title="Done" onAction={() => closeWidget("Showed recent Drive files")} />
    </ActionPanel>
  );

  return <Paper markdown={markdown} actions={actions} />;
}

const GoogleDriveFilesWidget = defineWidget({
  name: "oauth-test_google-drive-recent-files",
  description: "Show your recent Google Drive files",
  schema,
  component: GoogleDriveFiles,
});

export default GoogleDriveFilesWidget;
