import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, runScript, useCloseWidget } from "@eney/api";

const schema = z.object({});

type Props = z.infer<typeof schema>;

type PlayerState = "playing" | "paused" | "stopped" | "fast forwarding" | "rewinding";

interface NowPlaying {
  state: PlayerState;
  title: string;
  artist: string;
  album: string;
}

const SEPARATOR = "";

async function getNowPlaying(): Promise<NowPlaying | null> {
  const script = `
    tell application "Music"
      if it is not running then return ""
      set s to player state as string
      if s is "stopped" then return "stopped${SEPARATOR}${SEPARATOR}${SEPARATOR}"
      try
        set t to name of current track
        set a to artist of current track
        set al to album of current track
        return s & "${SEPARATOR}" & t & "${SEPARATOR}" & a & "${SEPARATOR}" & al
      on error
        return s & "${SEPARATOR}${SEPARATOR}${SEPARATOR}"
      end try
    end tell
  `;
  const out = (await runScript(script)).trim();
  if (!out) return null;
  const [state, title, artist, album] = out.split(SEPARATOR);
  return { state: state as PlayerState, title: title ?? "", artist: artist ?? "", album: album ?? "" };
}

async function sendCommand(verb: "play" | "pause" | "playpause" | "next track" | "previous track"): Promise<void> {
  await runScript(`tell application "Music" to ${verb}`);
}

function NowPlaying(_props: Props) {
  const closeWidget = useCloseWidget();
  const [info, setInfo] = useState<NowPlaying | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      setInfo(await getNowPlaying());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, []);

  async function act(verb: Parameters<typeof sendCommand>[0]) {
    setIsActing(true);
    setError("");
    try {
      await sendCommand(verb);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsActing(false);
    }
  }

  function onDone() {
    if (info && info.state === "playing" && info.title) {
      closeWidget(`Now playing: ${info.title} — ${info.artist}`);
    } else {
      closeWidget("Music app is not playing.");
    }
  }

  const header = <CardHeader title="Now Playing" iconBundleId="com.apple.Music" />;

  if (isLoading) {
    return (
      <Form
        header={header}
        actions={
          <ActionPanel>
            <Action title="Done" onAction={onDone} style="primary" isDisabled />
          </ActionPanel>
        }
      >
        <Paper markdown="Loading..." />
      </Form>
    );
  }

  const isPlaying = info?.state === "playing";
  const hasTrack = !!info && info.state !== "stopped" && !!info.title;

  const lines: string[] = [];
  if (!info) {
    lines.push("Music app is not running.");
  } else if (info.state === "stopped" || !info.title) {
    lines.push("Nothing is playing.");
  } else {
    lines.push(`### ${info.title}`);
    if (info.artist) lines.push(`**Artist:** ${info.artist}`);
    if (info.album) lines.push(`**Album:** ${info.album}`);
    lines.push("");
    lines.push(`_${info.state === "playing" ? "Playing" : "Paused"}_`);
  }

  return (
    <Form
      header={header}
      actions={
        <ActionPanel layout="row">
          <Action
            title="Previous"
            onAction={() => act("previous track")}
            style="secondary"
            isLoading={isActing}
            isDisabled={!hasTrack}
          />
          <Action
            title={isPlaying ? "Pause" : "Play"}
            onAction={() => act("playpause")}
            style="primary"
            isLoading={isActing}
          />
          <Action
            title="Next"
            onAction={() => act("next track")}
            style="secondary"
            isLoading={isActing}
            isDisabled={!hasTrack}
          />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Paper markdown={lines.join("\n")} />
    </Form>
  );
}

const NowPlayingWidget = defineWidget({
  name: "now-playing",
  description: "Show what is currently playing in the Music app and offer playback controls (play/pause, next, previous).",
  schema,
  component: NowPlaying,
});

export default NowPlayingWidget;
