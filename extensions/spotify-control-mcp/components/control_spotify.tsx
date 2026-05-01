import { useEffect, useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, CardHeader, Form, Paper, defineWidget, useCloseWidget } from "@eney/api";
import {
  nowPlaying,
  play,
  pause,
  playPause,
  nextTrack,
  previousTrack,
  setVolume,
  openSpotifyUri,
  formatTime,
  type NowPlaying,
} from "../helpers/spotify.js";

const schema = z.object({
  uri: z
    .string()
    .optional()
    .describe("Optional Spotify URI or open.spotify.com URL to open immediately."),
  volume: z
    .number()
    .int()
    .optional()
    .describe("Optional volume (0–100) to set on load."),
});

type Props = z.infer<typeof schema>;

const STATE_EMOJI: Record<string, string> = {
  playing: "▶️",
  paused: "⏸",
  stopped: "⏹",
  unknown: "❓",
};

interface State {
  status: "loading" | "done" | "error";
  errorMsg: string;
  np: NowPlaying | null;
  flash: string;
}

function buildMarkdown(s: State): string {
  if (s.status === "loading") return "_Talking to Spotify…_ 🎧";
  if (s.status === "error") return `**Error:** ${s.errorMsg}`;
  const np = s.np;
  if (!np || np.state === "unknown" || (!np.trackName && np.state !== "stopped")) {
    return [
      "### Spotify",
      "",
      "_Spotify isn't running, or no track is loaded. Open the app to start a track, then refresh._",
      ...(s.flash ? ["", `> ${s.flash}`] : []),
    ].join("\n");
  }
  const lines: string[] = [];
  lines.push(`### ${STATE_EMOJI[np.state] ?? ""} ${np.state}`);
  if (np.trackName) {
    lines.push("");
    lines.push(`**${np.trackName}**`);
    if (np.artist) lines.push(`_${np.artist}${np.album ? " · " + np.album : ""}_`);
  }
  if (np.durationMs > 0) {
    const pct = Math.max(0, Math.min(1, np.positionMs / np.durationMs));
    const blocks = Math.round(pct * 20);
    const bar = "█".repeat(blocks) + "░".repeat(20 - blocks);
    lines.push("");
    lines.push(`\`${bar}\` ${formatTime(np.positionMs)} / ${formatTime(np.durationMs)}`);
  }
  if (np.spotifyUrl) {
    lines.push("");
    lines.push(`[Open in Spotify](${np.spotifyUrl})`);
  }
  if (s.flash) {
    lines.push("");
    lines.push(`> ${s.flash}`);
  }
  return lines.join("\n");
}

function SpotifyControl(props: Props) {
  const closeWidget = useCloseWidget();
  const [state, setState] = useState<State>({ status: "loading", errorMsg: "", np: null, flash: "" });
  const [reloadCount, setReloadCount] = useState(0);
  const [uri, setUri] = useState(props.uri ?? "");
  const [volumeInput, setVolumeInput] = useState<number>(props.volume ?? 70);
  const [didApplyInitialUri, setDidApplyInitialUri] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    (async () => {
      try {
        // On first load only, honor a uri/volume passed via props
        if (!didApplyInitialUri) {
          if (props.uri) {
            try {
              await openSpotifyUri(props.uri);
            } catch (err) {
              if (!cancelled) {
                setState({ status: "error", errorMsg: err instanceof Error ? err.message : String(err), np: null, flash: "" });
                return;
              }
            }
          }
          if (typeof props.volume === "number") {
            try {
              await setVolume(props.volume);
            } catch {
              /* non-fatal */
            }
          }
          setDidApplyInitialUri(true);
        }
        const np = await nowPlaying();
        if (cancelled) return;
        setState((s) => ({ status: "done", errorMsg: "", np, flash: s.flash }));
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          errorMsg: err instanceof Error ? err.message : String(err),
          np: null,
          flash: "",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [reloadCount]);

  function refresh() {
    setReloadCount((c) => c + 1);
  }

  async function safeAct(label: string, fn: () => Promise<void>) {
    try {
      await fn();
      setState((s) => ({ ...s, flash: `✅ ${label}` }));
      refresh();
    } catch (err) {
      setState((s) => ({ ...s, flash: `❌ ${err instanceof Error ? err.message : String(err)}` }));
    }
  }

  function onPlay() {
    void safeAct("Play", play);
  }
  function onPause() {
    void safeAct("Pause", pause);
  }
  function onToggle() {
    void safeAct("Play/Pause", playPause);
  }
  function onNext() {
    void safeAct("Next track", nextTrack);
  }
  function onPrev() {
    void safeAct("Previous track", previousTrack);
  }
  function onApplyVolume() {
    void safeAct(`Volume ${volumeInput}%`, () => setVolume(volumeInput));
  }
  function onOpenUri() {
    if (!uri.trim()) {
      setState((s) => ({ ...s, flash: "⚠️ Enter a Spotify URI or URL first." }));
      return;
    }
    void safeAct("Opened URI", () => openSpotifyUri(uri));
  }

  function onDone() {
    if (state.status === "error") {
      closeWidget(`Error: ${state.errorMsg}`);
      return;
    }
    const np = state.np;
    if (!np || !np.trackName) {
      closeWidget("Spotify is idle.");
      return;
    }
    closeWidget(
      `Spotify ${STATE_EMOJI[np.state] ?? ""} ${np.state}: ${np.trackName} — ${np.artist}${np.album ? " (" + np.album + ")" : ""} ` +
      `[${formatTime(np.positionMs)}/${formatTime(np.durationMs)}]${np.spotifyUrl ? " " + np.spotifyUrl : ""}`,
    );
  }

  return (
    <Form
      header={<CardHeader title="Spotify" iconBundleId="com.spotify.client" />}
      actions={
        <ActionPanel layout="row">
          <Action title="Refresh" onAction={refresh} style="primary" />
          <Action title="Play / Pause" onAction={onToggle} style="secondary" />
          <Action title="Play" onAction={onPlay} style="secondary" />
          <Action title="Pause" onAction={onPause} style="secondary" />
          <Action title="Next" onAction={onNext} style="secondary" />
          <Action title="Previous" onAction={onPrev} style="secondary" />
          <Action title="Set volume" onAction={onApplyVolume} style="secondary" />
          <Action title="Open URI" onAction={onOpenUri} style="secondary" />
          <Action title="Done" onAction={onDone} style="secondary" />
        </ActionPanel>
      }
    >
      <Paper markdown={buildMarkdown(state)} />
      <Form.TextField
        name="uri"
        label="Spotify URI or open.spotify.com URL"
        value={uri}
        onChange={setUri}
      />
      <Form.NumberField
        name="volume"
        label="Volume (0–100)"
        value={volumeInput}
        onChange={(v) => setVolumeInput(Math.max(0, Math.min(100, Math.floor(Number(v) || 0))))}
      />
    </Form>
  );
}

const SpotifyControlWidget = defineWidget({
  name: "control_spotify",
  description:
    "Control the Spotify desktop app via AppleScript: play / pause / next / previous, set volume, open a Spotify URI or URL, and see what's currently playing (track, artist, album, position). No Spotify Web API key needed.",
  schema,
  component: SpotifyControl,
});

export default SpotifyControlWidget;
