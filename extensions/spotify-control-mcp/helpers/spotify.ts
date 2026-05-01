// Spotify control via AppleScript. Talks to the user's locally-running
// Spotify app — no API key, no Spotify Web API.

import { spawn } from "node:child_process";

export type PlayerState = "playing" | "paused" | "stopped" | "unknown";

export interface NowPlaying {
  state: PlayerState;
  trackName: string;
  artist: string;
  album: string;
  durationMs: number;
  positionMs: number;
  spotifyUrl: string;
}

function runAppleScript(script: string, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("osascript", ["-e", script]);
    let out = "";
    let err = "";
    let killed = false;
    const t = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, timeoutMs);
    proc.stdout?.on("data", (d) => {
      out += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(t);
      if (killed) return reject(new Error("AppleScript timed out"));
      if (code !== 0) return reject(new Error(err.trim() || `Exit code ${code}`));
      resolve(out);
    });
  });
}

export async function isRunning(): Promise<boolean> {
  const out = await runAppleScript(`
tell application "System Events"
  return (exists (processes whose name is "Spotify"))
end tell`);
  return out.trim() === "true";
}

export async function nowPlaying(): Promise<NowPlaying> {
  const running = await isRunning();
  if (!running) {
    return {
      state: "unknown",
      trackName: "",
      artist: "",
      album: "",
      durationMs: 0,
      positionMs: 0,
      spotifyUrl: "",
    };
  }
  const script = `
tell application "Spotify"
  if player state is playing then
    set s to "playing"
  else if player state is paused then
    set s to "paused"
  else
    set s to "stopped"
  end if
  set tn to ""
  set ar to ""
  set al to ""
  set du to 0
  set ps to 0
  set sp to ""
  try
    set tn to name of current track
    set ar to artist of current track
    set al to album of current track
    set du to duration of current track
    set sp to spotify url of current track
  end try
  try
    set ps to player position
  end try
  return s & "|||" & tn & "|||" & ar & "|||" & al & "|||" & du & "|||" & ps & "|||" & sp
end tell`;
  const out = (await runAppleScript(script)).trim();
  const parts = out.split("|||");
  if (parts.length < 7) {
    return {
      state: "unknown",
      trackName: "",
      artist: "",
      album: "",
      durationMs: 0,
      positionMs: 0,
      spotifyUrl: "",
    };
  }
  return {
    state: (parts[0] as PlayerState) || "unknown",
    trackName: parts[1] ?? "",
    artist: parts[2] ?? "",
    album: parts[3] ?? "",
    durationMs: parseInt(parts[4], 10) || 0,
    positionMs: Math.round((parseFloat(parts[5]) || 0) * 1000),
    spotifyUrl: parts[6] ?? "",
  };
}

async function tellSpotify(cmd: string): Promise<void> {
  await runAppleScript(`tell application "Spotify" to ${cmd}`);
}

export async function play(): Promise<void> {
  await tellSpotify("play");
}

export async function pause(): Promise<void> {
  await tellSpotify("pause");
}

export async function playPause(): Promise<void> {
  await tellSpotify("playpause");
}

export async function nextTrack(): Promise<void> {
  await tellSpotify("next track");
}

export async function previousTrack(): Promise<void> {
  // First "previous track" call typically restarts the current track on
  // Spotify; many users expect it to actually go back. We send it twice.
  await tellSpotify("previous track");
  await tellSpotify("previous track");
}

export async function setVolume(percent: number): Promise<void> {
  const v = Math.max(0, Math.min(100, Math.floor(percent)));
  await runAppleScript(`tell application "Spotify" to set sound volume to ${v}`);
}

export async function openSpotifyUri(uri: string): Promise<void> {
  // `open location` accepts spotify:track:..., spotify:album:..., http(s) Spotify URLs
  if (!/^(spotify:|https?:\/\/open\.spotify\.com\/)/i.test(uri.trim())) {
    throw new Error("Provide a spotify: URI or an open.spotify.com URL.");
  }
  // Escape quotes inside the URI
  const safe = uri.replace(/"/g, '\\"');
  await runAppleScript(
    `tell application "Spotify" to activate\ntell application "Spotify" to open location "${safe}"`,
  );
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
