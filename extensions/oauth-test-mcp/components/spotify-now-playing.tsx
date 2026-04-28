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

const spotifyOAuth: OAuthConfig = {
  clientId: "0e55fc06990a4c919411995547b0494d",
  authorizeUrl: "https://accounts.spotify.com/authorize",
  tokenUrl: "https://accounts.spotify.com/api/token",
  scopes: ["user-top-read", "user-read-recently-played"],
};

function SpotifyNowPlaying(_props: Props) {
  const log = useLogger();
  const { status, tokens, error, refresh, authorize } = useOAuth(spotifyOAuth);
  const closeWidget = useCloseWidget();
  const [markdown, setMarkdown] = useState("Loading your top tracks...");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    log.info("OAuth data changed", { tokens, error });

    if (tokens) {
      setToken(tokens.accessToken);
    }
  }, [tokens]);

  useEffect(() => {
    if (!token) return;

    async function fetchTracks() {
      let res = await fetch(
        "https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=short_term",
        { headers: { Authorization: `Bearer ${token}` } },
      );

      log.info("Fetched top tracks", { res });

      if (res.status === 401) {
        const newTokens = await refresh();
        setToken(newTokens.accessToken);
        res = await fetch(
          "https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=short_term",
          { headers: { Authorization: `Bearer ${newTokens.accessToken}` } },
        );
      }

      const body = await res.json();

      if (body.items?.length) {
        const list = body.items
          .map(
            (t: any, i: number) =>
              `${i + 1}. **${t.name}** — ${t.artists.map((a: any) => a.name).join(", ")}`,
          )
          .join("\n");
        setMarkdown(`## Your Top Tracks\n\n${list}`);
      } else {
        setMarkdown("No recent tracks found.");
      }
    }

    fetchTracks().catch((err: Error) => {
      setMarkdown(`Error: ${err.message}`)
    });
  }, [token]);

  if (status === "pending") {
    return <Paper markdown="Fetching access token..." />;
  }

  if (!tokens && !token) {
    const signInActions = (
      <ActionPanel>
        <Action title="Sign In" onAction={authorize} style="primary" />
      </ActionPanel>
    );

    return <Paper actions={signInActions} markdown="Please sign in to view your top tracks." />;
  }

  if (error) {
    const actions = (
      <ActionPanel>
        <Action title="Retry" onAction={authorize} style="primary" />
      </ActionPanel>
    );
    return <Paper markdown={`**Sign in failed**\n\n${error}`} actions={actions} />;
  }

  const actions = (
    <ActionPanel>
      <Action title="Done" onAction={() => closeWidget("Showed top tracks")} />
    </ActionPanel>
  );

  return <Paper markdown={markdown} actions={actions} />;
}

const SpotifyNowPlayingWidget = defineWidget({
  name: "oauth-test_spotify-top-tracks",
  description: "Show your top Spotify tracks",
  schema,
  component: SpotifyNowPlaying,
});

export default SpotifyNowPlayingWidget;
