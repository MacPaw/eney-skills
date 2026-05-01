// Frontmost-app + window introspection via AppleScript / lsappinfo.

import { spawn } from "node:child_process";

export interface ActiveWindow {
  appName: string;
  bundleId: string;
  pid: number;
  windowTitle: string;
  windowCount: number;
  position: { x: number; y: number } | null;
  size: { width: number; height: number } | null;
}

function runCmd(cmd: string, args: string[], timeoutMs = 5000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    let killed = false;
    const t = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, timeoutMs);
    proc.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(t);
      if (killed) return reject(new Error("Timed out"));
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

async function runAppleScript(script: string): Promise<string> {
  const { code, stdout, stderr } = await runCmd("osascript", ["-e", script]);
  if (code !== 0) throw new Error(stderr.trim() || `osascript exit code ${code}`);
  return stdout;
}

export async function readActiveWindow(): Promise<ActiveWindow> {
  const script = `
tell application "System Events"
  set frontProc to first application process whose frontmost is true
  set procName to name of frontProc
  set procPid to unix id of frontProc
  set procBundle to bundle identifier of frontProc
  set wCount to count of windows of frontProc
  set winTitle to ""
  set winPos to "?"
  set winSize to "?"
  if wCount > 0 then
    try
      set winTitle to name of window 1 of frontProc
    end try
    try
      set p to position of window 1 of frontProc
      set winPos to (item 1 of p) & "," & (item 2 of p)
    end try
    try
      set s to size of window 1 of frontProc
      set winSize to (item 1 of s) & "," & (item 2 of s)
    end try
  end if
end tell
return procName & "|||" & procBundle & "|||" & procPid & "|||" & wCount & "|||" & winTitle & "|||" & winPos & "|||" & winSize`;
  const out = (await runAppleScript(script)).trim();
  const parts = out.split("|||");
  if (parts.length < 7) {
    throw new Error("Unexpected AppleScript output.");
  }
  const [appName, bundleId, pidStr, wCountStr, winTitle, posStr, sizeStr] = parts;
  function parsePair(s: string): { x: number; y: number } | null {
    if (!s || s === "?") return null;
    const m = s.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
  }
  const pos = parsePair(posStr);
  const sz = parsePair(sizeStr);
  return {
    appName,
    bundleId,
    pid: parseInt(pidStr, 10) || 0,
    windowCount: parseInt(wCountStr, 10) || 0,
    windowTitle: winTitle,
    position: pos,
    size: sz ? { width: sz.x, height: sz.y } : null,
  };
}

export async function listAppWindows(appName: string): Promise<{ index: number; title: string }[]> {
  const safe = appName.replace(/"/g, '\\"');
  const script = `
tell application "System Events"
  if not (exists application process "${safe}") then
    return ""
  end if
  set output to ""
  set wins to windows of application process "${safe}"
  set i to 0
  repeat with w in wins
    set i to i + 1
    set t to ""
    try
      set t to name of w
    end try
    set output to output & i & "|||" & t & linefeed
  end repeat
  return output
end tell`;
  const out = (await runAppleScript(script)).trim();
  if (!out) return [];
  return out
    .split("\n")
    .map((line) => {
      const parts = line.split("|||");
      if (parts.length < 2) return null;
      return {
        index: parseInt(parts[0], 10) || 0,
        title: parts.slice(1).join("|||"),
      };
    })
    .filter((x): x is { index: number; title: string } => x !== null);
}

export async function activateApp(appName: string): Promise<void> {
  const safe = appName.replace(/"/g, '\\"');
  await runAppleScript(`tell application "${safe}" to activate`);
}
