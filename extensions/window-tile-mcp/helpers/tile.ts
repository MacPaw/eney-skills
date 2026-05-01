// Window-tiling via AppleScript + System Events. We resize the frontmost
// window of the frontmost app to one of the named regions, computed from
// the visible frame of the screen the window currently lives on.
// Requires Accessibility permission for the controlling app (Eney).

import { spawn } from "node:child_process";

export type Region =
  | "left-half"
  | "right-half"
  | "top-half"
  | "bottom-half"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "full"
  | "center"
  | "left-third"
  | "middle-third"
  | "right-third";

export const REGIONS: Region[] = [
  "left-half",
  "right-half",
  "top-half",
  "bottom-half",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "full",
  "center",
  "left-third",
  "middle-third",
  "right-third",
];

export const REGION_LABEL: Record<Region, string> = {
  "left-half": "Left ½",
  "right-half": "Right ½",
  "top-half": "Top ½",
  "bottom-half": "Bottom ½",
  "top-left": "Top-left ¼",
  "top-right": "Top-right ¼",
  "bottom-left": "Bottom-left ¼",
  "bottom-right": "Bottom-right ¼",
  full: "Full",
  center: "Center (60%)",
  "left-third": "Left ⅓",
  "middle-third": "Middle ⅓",
  "right-third": "Right ⅓",
};

export interface FrontWindow {
  app: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  screen: { x: number; y: number; width: number; height: number };
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

// Reads frontmost app's frontmost window position/size and screen visible frame.
export async function readFrontWindow(): Promise<FrontWindow> {
  // The visible-frame AppleScript reads the frame of the screen containing the front window.
  const script = `
tell application "System Events"
  set procName to name of first application process whose frontmost is true
  tell process procName
    if (count of windows) = 0 then
      return "ERROR_NO_WINDOW"
    end if
    set theWin to window 1
    set winTitle to ""
    try
      set winTitle to name of theWin
    end try
    set p to position of theWin
    set s to size of theWin
  end tell
end tell
-- Find the visible bounds of the screen containing the window.
-- We pick screen 1's visible frame (good enough for the common single/main-display case).
tell application "Finder"
  set screenBounds to bounds of window of desktop
end tell
return procName & "|||" & winTitle & "|||" & (item 1 of p) & "|||" & (item 2 of p) & "|||" & (item 1 of s) & "|||" & (item 2 of s) & "|||" & (item 1 of screenBounds) & "|||" & (item 2 of screenBounds) & "|||" & (item 3 of screenBounds) & "|||" & (item 4 of screenBounds)
`;
  const out = (await runAppleScript(script)).trim();
  if (out.startsWith("ERROR_NO_WINDOW")) {
    throw new Error("The frontmost app has no window.");
  }
  const parts = out.split("|||");
  if (parts.length < 10) throw new Error("Unexpected AppleScript output.");
  const [appName, winTitle, px, py, sw, sh, sx1, sy1, sx2, sy2] = parts;
  const sxNum = parseFloat(sx1);
  const syNum = parseFloat(sy1);
  return {
    app: appName,
    title: winTitle,
    position: { x: parseFloat(px), y: parseFloat(py) },
    size: { width: parseFloat(sw), height: parseFloat(sh) },
    screen: {
      x: sxNum,
      y: syNum,
      width: parseFloat(sx2) - sxNum,
      height: parseFloat(sy2) - syNum,
    },
  };
}

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function regionToFrame(region: Region, screen: FrontWindow["screen"]): Frame {
  const { x, y, width: w, height: h } = screen;
  const halfW = Math.floor(w / 2);
  const halfH = Math.floor(h / 2);
  const thirdW = Math.floor(w / 3);
  switch (region) {
    case "left-half":
      return { x, y, width: halfW, height: h };
    case "right-half":
      return { x: x + halfW, y, width: w - halfW, height: h };
    case "top-half":
      return { x, y, width: w, height: halfH };
    case "bottom-half":
      return { x, y: y + halfH, width: w, height: h - halfH };
    case "top-left":
      return { x, y, width: halfW, height: halfH };
    case "top-right":
      return { x: x + halfW, y, width: w - halfW, height: halfH };
    case "bottom-left":
      return { x, y: y + halfH, width: halfW, height: h - halfH };
    case "bottom-right":
      return { x: x + halfW, y: y + halfH, width: w - halfW, height: h - halfH };
    case "full":
      return { x, y, width: w, height: h };
    case "center": {
      const cw = Math.floor(w * 0.6);
      const ch = Math.floor(h * 0.6);
      return { x: x + Math.floor((w - cw) / 2), y: y + Math.floor((h - ch) / 2), width: cw, height: ch };
    }
    case "left-third":
      return { x, y, width: thirdW, height: h };
    case "middle-third":
      return { x: x + thirdW, y, width: thirdW, height: h };
    case "right-third":
      return { x: x + 2 * thirdW, y, width: w - 2 * thirdW, height: h };
  }
}

export async function applyFrame(frame: Frame): Promise<void> {
  const script = `
tell application "System Events"
  set procName to name of first application process whose frontmost is true
  tell process procName
    if (count of windows) = 0 then
      return "ERROR_NO_WINDOW"
    end if
    set position of window 1 to {${Math.round(frame.x)}, ${Math.round(frame.y)}}
    set size of window 1 to {${Math.round(frame.width)}, ${Math.round(frame.height)}}
  end tell
end tell`;
  const out = (await runAppleScript(script)).trim();
  if (out.startsWith("ERROR_NO_WINDOW")) {
    throw new Error("The frontmost app has no window.");
  }
}

export async function tile(region: Region): Promise<{ window: FrontWindow; applied: Frame }> {
  const w = await readFrontWindow();
  const frame = regionToFrame(region, w.screen);
  await applyFrame(frame);
  return { window: w, applied: frame };
}
