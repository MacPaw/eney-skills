import { runScript } from "@eney/api";

const FIELD_SEP = "\x1F";
const ROW_SEP = "\x1E";

export interface SafariTab {
  windowIndex: number;
  tabIndex: number;
  title: string;
  url: string;
  isCurrent: boolean;
}

export async function listOpenTabs(): Promise<SafariTab[]> {
  const script = `
    tell application "Safari"
      if it is not running then return ""
      set output to ""
      set winIdx to 0
      repeat with w in windows
        set winIdx to winIdx + 1
        set currentTabId to -1
        try
          set currentTabId to index of current tab of w
        end try
        set tabIdx to 0
        repeat with t in tabs of w
          set tabIdx to tabIdx + 1
          set tabName to ""
          try
            set tabName to name of t
          end try
          set tabUrl to ""
          try
            set tabUrl to URL of t as string
          end try
          set isCurrent to "0"
          if tabIdx = currentTabId then set isCurrent to "1"
          set output to output & winIdx & "${FIELD_SEP}" & tabIdx & "${FIELD_SEP}" & tabName & "${FIELD_SEP}" & tabUrl & "${FIELD_SEP}" & isCurrent & "${ROW_SEP}"
        end repeat
      end repeat
      return output
    end tell
  `;
  const out = (await runScript(script)).trim();
  if (!out) return [];
  return out
    .split(ROW_SEP)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [windowIndex, tabIndex, title, url, isCurrent] = row.split(FIELD_SEP);
      return {
        windowIndex: Number.parseInt(windowIndex ?? "0", 10),
        tabIndex: Number.parseInt(tabIndex ?? "0", 10),
        title: title ?? "",
        url: url ?? "",
        isCurrent: isCurrent === "1",
      };
    });
}
