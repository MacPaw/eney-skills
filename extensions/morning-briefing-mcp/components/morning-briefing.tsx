import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  Paper,
  defineWidget,
  useCloseWidget,
  Divider,
} from "@eney/api";
import { spawn } from "node:child_process";

// --- Schema ---

const schema = z.object({
  sections: z
    .string()
    .optional()
    .describe(
      "Comma-separated list of sections to include: calendar, weather, email, tasks, notes. Defaults to all.",
    ),
});

type Props = z.infer<typeof schema>;

// --- Types ---

interface WeatherInfo {
  temperature: string;
  condition: string;
  location: string;
}

interface ImportantEmail {
  from: string;
  subject: string;
}

interface ReminderItem {
  title: string;
  dueDate: string;
  list: string;
}

interface NoteItem {
  title: string;
  folder: string;
  snippet: string;
}

interface BriefingData {
  weather: WeatherInfo | null;
  emails: ImportantEmail[];
  reminders: ReminderItem[];
  notes: NoteItem[];
  errors: string[];
}

type SourceStatus = "pending" | "loading" | "done" | "error";

interface FetchProgress {
  weather: SourceStatus;
  email: SourceStatus;
  tasks: SourceStatus;
  notes: SourceStatus;
}

// --- Subprocess helpers ---

function runCommand(
  command: string,
  args: string[],
  timeoutMs = 10000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) {
        reject(new Error("Timed out"));
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Exit code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function runAppleScript(script: string, timeoutMs = 8000): Promise<string> {
  return runCommand("osascript", ["-e", script], timeoutMs);
}

// --- Localized folder name translations ---

const DELETED_FOLDERS = [
  "Recently Deleted",
  "Zuletzt gelöscht",
  "Supprimés récemment",
  "Eliminados recientemente",
  "Нещодавно видалені",
];

// Gmail "Important" label — localized names across languages
const IMPORTANT_FOLDER_NAMES = [
  "Important",
  "Importante",
  "Wichtig",
  "Importants",
  "Belangrijk",
  "Viktigt",
  "Vigtigt",
  "Tärkeä",
  "Ważne",
  "Důležité",
  "Dôležité",
  "Fontos",
  "Важливо",
  "Важные",
  "Σημαντικά",
  "Önemli",
  "重要",
  "重要メール",
  "중요",
];

// --- Data fetchers ---

// Calendar is fetched by the LLM via gcal_list_events MCP tool (AppleScript is too slow with 17 calendars)

async function fetchWeather(): Promise<WeatherInfo | null> {
  const result = await runCommand(
    "curl",
    ["-s", "-m", "5", "https://wttr.in/?format=%C|%t|%l"],
    6000,
  );
  if (!result || !result.includes("|")) return null;
  const [condition, temperature, location] = result.split("|");
  return {
    condition: condition?.trim() ?? "Unknown",
    temperature: temperature?.trim() ?? "",
    location: location?.trim() ?? "",
  };
}

async function fetchImportantEmails(): Promise<ImportantEmail[]> {
  // Read from the Gmail "Important" mailbox (localized name varies by language)
  // Falls back to inbox recent unreads if no Important mailbox is found
  const importantNames = IMPORTANT_FOLDER_NAMES.map((n) => `"${n}"`).join(", ");
  const script = `
set output to ""
set foundCount to 0
set foundImportant to false
set importantNames to {${importantNames}}
tell application "Mail"
  try
    repeat with acct in every account
      if foundImportant then exit repeat
      repeat with mbox in mailboxes of acct
        if foundImportant then exit repeat
        if name of mbox is in importantNames then
          set foundImportant to true
          set allMsgs to messages of mbox
          set msgCount to count of allMsgs
          if msgCount > 30 then set msgCount to 30
          repeat with i from 1 to msgCount
            if foundCount >= 15 then exit repeat
            set msg to item i of allMsgs
            if read status of msg is false then
              set output to output & (sender of msg) & "|||" & (subject of msg) & linefeed
              set foundCount to foundCount + 1
            end if
          end repeat
        end if
      end repeat
    end repeat
  end try
  -- Fallback: recent inbox unreads if Important mailbox not found
  if not foundImportant then
    set yesterday to (current date) - (1 * days)
    set time of yesterday to 0
    set allMsgs to messages of inbox
    set msgCount to count of allMsgs
    if msgCount > 200 then set msgCount to 200
    repeat with i from 1 to msgCount
      if foundCount >= 15 then exit repeat
      set msg to item i of allMsgs
      set msgDate to date received of msg
      if msgDate < yesterday then exit repeat
      if read status of msg is false then
        set output to output & (sender of msg) & "|||" & (subject of msg) & linefeed
        set foundCount to foundCount + 1
      end if
    end repeat
  end if
end tell
return output`;

  const result = await runAppleScript(script, 10000);
  if (!result.trim()) return [];

  return result
    .trim()
    .split("\n")
    .filter((line) => line.includes("|||"))
    .map((line) => {
      const [from, subject] = line.split("|||");
      return {
        from: from?.trim() ?? "Unknown",
        subject: subject?.trim() ?? "(No subject)",
      };
    });
}

async function fetchRecentNotes(): Promise<NoteItem[]> {
  // Yesterday + today only — small enough set that plaintext fetch is fast (~0.5s)
  // Newlines in body are escaped to \\n so they don't break line-based parsing
  const deletedFilter = DELETED_FOLDERS.map((t) => `"${t}"`).join(", ");

  const script = `
set output to ""
set yesterday to (current date) - (1 * days)
set time of yesterday to 0
set deletedNames to {${deletedFilter}}
tell application "Notes"
  set noteCount to 0
  repeat with f in folders
    if noteCount >= 5 then exit repeat
    set fName to name of f
    if fName is not in deletedNames then
      set recentNotes to (every note of f whose modification date >= yesterday)
      repeat with aNote in recentNotes
        if noteCount >= 5 then exit repeat
        set noteTitle to name of aNote
        set noteBody to ""
        try
          set noteBody to plaintext of aNote
          if (length of noteBody) > 300 then
            set noteBody to text 1 thru 300 of noteBody
          end if
          set AppleScript's text item delimiters to {return, linefeed, character id 10, character id 13}
          set bodyParts to text items of noteBody
          set AppleScript's text item delimiters to "\\\\n"
          set noteBody to bodyParts as text
          set AppleScript's text item delimiters to ""
        end try
        set output to output & noteTitle & "|||" & fName & "|||" & noteBody & linefeed
        set noteCount to noteCount + 1
      end repeat
    end if
  end repeat
end tell
return output`;

  const result = await runAppleScript(script, 10000);
  if (!result.trim()) return [];

  return result
    .trim()
    .split("\n")
    .filter((line) => line.includes("|||"))
    .map((line) => {
      const [title, folder, ...snippetParts] = line.split("|||");
      const snippet = (snippetParts.join("|||") ?? "")
        .trim()
        .replace(/\\n/g, "\n");
      return {
        title: title?.trim() ?? "Untitled",
        folder: folder?.trim() ?? "",
        snippet,
      };
    });
}

async function fetchReminders(): Promise<ReminderItem[]> {
  // Includes overdue + due today (everything due before end of today)
  const script = `
set output to ""
set taskCount to 0
tell application "Reminders"
  set tomorrow to (current date)
  set time of tomorrow to 0
  set tomorrow to tomorrow + (1 * days)
  repeat with reminderList in lists
    if taskCount >= 20 then exit repeat
    set listName to name of reminderList
    set allReminders to (reminders of reminderList whose completed is false)
    repeat with rem in allReminders
      if taskCount >= 20 then exit repeat
      try
        set remDate to due date of rem
        if remDate < tomorrow then
          set remTitle to name of rem
          set output to output & remTitle & "|||" & (remDate as string) & "|||" & listName & linefeed
          set taskCount to taskCount + 1
        end if
      end try
    end repeat
  end repeat
end tell
return output`;

  const result = await runAppleScript(script, 10000);
  if (!result.trim()) return [];

  return result
    .trim()
    .split("\n")
    .filter((line) => line.includes("|||"))
    .map((line) => {
      const [title, dueDate, list] = line.split("|||");
      return {
        title: title?.trim() ?? "Untitled",
        dueDate: dueDate?.trim() ?? "",
        list: list?.trim() ?? "",
      };
    });
}

// --- LLM context builder ---

function buildContextForLLM(
  data: BriefingData,
  sections: Set<string>,
): string {
  const parts: string[] = [];
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  parts.push(`Today: ${today}`);
  parts.push("");
  parts.push(`INSTRUCTIONS:
1. First, fetch today's and yesterday's calendar events using gcal_list_events MCP tool (timeMin = yesterday start of day, timeMax = end of today). Check both primary and work calendars.
2. Then compose a morning briefing that is NOT just a list — be a smart assistant:
   - Cross-reference data: e.g. if there's a PR review email AND a meeting with that person today, connect the dots
   - Flag what actually needs attention vs what's just noise (CI notifications, automated emails)
   - For emails: group related threads, highlight what needs a response vs FYI
   - For notes: understand the content and suggest if any action is needed (e.g. "shopping list — might want to do this today since you have a free afternoon")
   - For tasks: if something is overdue, flag it prominently
   - Propose 2-3 concrete actions for the day based on all the data (e.g. "Reply to the PR feedback from Bogdan before your 1:1", "Payslip validation is due — approve it today")
   - If the day looks light, say so and suggest what could be a good use of the time
   - If the day looks packed, suggest what could be deprioritized
3. Keep it conversational, concise. No need to list every single email — synthesize.`);
  parts.push("");

  // --- Calendar & Email: instruct the LLM to fetch via MCP tools ---

  if (sections.has("calendar")) {
    parts.push("");
    parts.push("=== CALENDAR (fetch needed) ===");
    parts.push(
      "ACTION REQUIRED: Call gcal_list_events with timeMin set to yesterday start-of-day and timeMax set to end of today. Check both primary and ollegro@macpaw.com calendars. Separate yesterday's events (for catch-up context) from today's events. Look for scheduling conflicts in today's events.",
    );
  }

  if (sections.has("email")) {
    parts.push("");
    parts.push(
      `=== IMPORTANT UNREAD EMAILS (${data.emails.length} messages) ===`,
    );
    if (data.emails.length === 0) {
      parts.push("No important unread emails.");
    } else {
      for (const e of data.emails) {
        parts.push(`- ${e.from}: ${e.subject}`);
      }
    }
  }

  // --- Weather: already fetched by widget ---

  if (sections.has("weather") && data.weather) {
    parts.push("");
    parts.push("=== WEATHER ===");
    parts.push(
      `${data.weather.condition}, ${data.weather.temperature} — ${data.weather.location}`,
    );
  }

  // --- Notes: already fetched by widget ---

  if (sections.has("notes")) {
    parts.push("");
    parts.push(
      `=== RECENT NOTES (yesterday + today, ${data.notes.length} notes) ===`,
    );
    if (data.notes.length === 0) {
      parts.push("No notes modified yesterday or today.");
    } else {
      for (const n of data.notes) {
        const snippet = n.snippet ? `: ${n.snippet}` : "";
        parts.push(`- "${n.title}" (${n.folder})${snippet}`);
      }
    }
  }

  // --- Tasks: already fetched by widget ---

  if (sections.has("tasks")) {
    parts.push("");
    parts.push(`=== TASKS DUE/OVERDUE (${data.reminders.length} tasks) ===`);
    if (data.reminders.length === 0) {
      parts.push("No tasks due or overdue.");
    } else {
      for (const r of data.reminders) {
        parts.push(`- ${r.title} (${r.list})`);
      }
    }
  }

  if (data.errors.length > 0) {
    parts.push("");
    parts.push(`=== UNAVAILABLE ===`);
    parts.push(data.errors.join(", "));
  }

  return parts.join("\n");
}

// --- Progress UI helpers ---

function statusIcon(s: SourceStatus): string {
  switch (s) {
    case "pending":
      return "⏳";
    case "loading":
      return "🔄";
    case "done":
      return "✅";
    case "error":
      return "⚠️";
  }
}

function buildProgressMarkdown(
  progress: FetchProgress,
  data: BriefingData,
  sections: Set<string>,
  allDone: boolean,
): string {
  const lines: string[] = [];
  lines.push("## Preparing your briefing...\n");

  if (sections.has("weather")) {
    const s = progress.weather;
    const detail =
      s === "done" && data.weather
        ? ` — ${data.weather.condition}, ${data.weather.temperature}`
        : "";
    lines.push(`${statusIcon(s)} Weather${detail}\n`);
  }
  if (sections.has("calendar")) {
    lines.push(`${statusIcon("done")} Calendar — via Google Calendar\n`);
  }
  if (sections.has("email")) {
    const s = progress.email;
    const detail =
      s === "done" ? ` — ${data.emails.length} important` : "";
    lines.push(`${statusIcon(s)} Important emails${detail}\n`);
  }
  if (sections.has("notes")) {
    const s = progress.notes;
    const detail =
      s === "done" ? ` — ${data.notes.length} recent notes` : "";
    lines.push(`${statusIcon(s)} Recent notes${detail}\n`);
  }
  if (sections.has("tasks")) {
    const s = progress.tasks;
    const detail =
      s === "done" ? ` — ${data.reminders.length} tasks` : "";
    lines.push(`${statusIcon(s)} Tasks${detail}\n`);
  }

  if (allDone) {
    lines.push("");
    lines.push("Sending to assistant...");
  }

  return lines.join("\n");
}

// --- Widget Component ---

function MorningBriefing(props: Props) {
  const closeWidget = useCloseWidget();

  const requestedSections = new Set(
    props.sections
      ? props.sections.split(",").map((s) => s.trim().toLowerCase())
      : ["calendar", "weather", "email", "tasks", "notes"],
  );

  const [data, setData] = useState<BriefingData>({
    weather: null,
    emails: [],
    reminders: [],
    notes: [],
    errors: [],
  });

  const [progress, setProgress] = useState<FetchProgress>({
    weather: requestedSections.has("weather") ? "pending" : "done",
    email: requestedSections.has("email") ? "pending" : "done",
    tasks: requestedSections.has("tasks") ? "pending" : "done",
    notes: requestedSections.has("notes") ? "pending" : "done",
  });

  const [allDone, setAllDone] = useState(false);
  const [hasError, setHasError] = useState(false);

  const sendBriefing = useCallback(
    (briefingData: BriefingData) => {
      const context = buildContextForLLM(briefingData, requestedSections);
      closeWidget(context);
    },
    [closeWidget, requestedSections],
  );

  useEffect(() => {
    const currentData: BriefingData = {
      weather: null,
      emails: [],
      reminders: [],
      notes: [],
      errors: [],
    };

    // Only count widget-fetched sections (weather, email, notes, tasks)
    const widgetSections = ["weather", "email", "notes", "tasks"].filter((s) =>
      requestedSections.has(s),
    );
    let completedCount = 0;
    const totalSections = widgetSections.length;
    let hasAnyError = false;

    function onSourceDone() {
      completedCount++;
      if (completedCount >= totalSections) {
        setData({ ...currentData });
        if (hasAnyError) {
          setHasError(true);
        }
        setAllDone(true);
        if (!hasAnyError) {
          setTimeout(() => {
            const context = buildContextForLLM(
              currentData,
              requestedSections,
            );
            closeWidget(context);
          }, 500);
        }
      }
    }

    // If no widget sections requested (only calendar/email), send immediately
    if (totalSections === 0) {
      setAllDone(true);
      setTimeout(() => {
        const context = buildContextForLLM(currentData, requestedSections);
        closeWidget(context);
      }, 300);
      return;
    }

    if (requestedSections.has("weather")) {
      setProgress((p) => ({ ...p, weather: "loading" }));
      fetchWeather()
        .then((weather) => {
          currentData.weather = weather;
          setProgress((p) => ({ ...p, weather: "done" }));
          setData((d) => ({ ...d, weather }));
        })
        .catch(() => {
          currentData.errors.push("Weather");
          hasAnyError = true;
          setProgress((p) => ({ ...p, weather: "error" }));
        })
        .finally(onSourceDone);
    }

    if (requestedSections.has("email")) {
      setProgress((p) => ({ ...p, email: "loading" }));
      fetchImportantEmails()
        .then((emails) => {
          currentData.emails = emails;
          setProgress((p) => ({ ...p, email: "done" }));
          setData((d) => ({ ...d, emails }));
        })
        .catch(() => {
          currentData.errors.push("Mail");
          hasAnyError = true;
          setProgress((p) => ({ ...p, email: "error" }));
        })
        .finally(onSourceDone);
    }

    if (requestedSections.has("notes")) {
      setProgress((p) => ({ ...p, notes: "loading" }));
      fetchRecentNotes()
        .then((notes) => {
          currentData.notes = notes;
          setProgress((p) => ({ ...p, notes: "done" }));
          setData((d) => ({ ...d, notes }));
        })
        .catch(() => {
          currentData.errors.push("Notes");
          hasAnyError = true;
          setProgress((p) => ({ ...p, notes: "error" }));
        })
        .finally(onSourceDone);
    }

    if (requestedSections.has("tasks")) {
      setProgress((p) => ({ ...p, tasks: "loading" }));
      fetchReminders()
        .then((reminders) => {
          currentData.reminders = reminders;
          setProgress((p) => ({ ...p, tasks: "done" }));
          setData((d) => ({ ...d, reminders }));
        })
        .catch(() => {
          currentData.errors.push("Reminders");
          hasAnyError = true;
          setProgress((p) => ({ ...p, tasks: "error" }));
        })
        .finally(onSourceDone);
    }
  }, []);

  const markdown = buildProgressMarkdown(
    progress,
    data,
    requestedSections,
    allDone,
  );

  // Error state: show actions to send partial data or retry
  if (allDone && hasError) {
    return (
      <Paper
        markdown={markdown}
        actions={
          <ActionPanel>
            <Divider />
            <Action.SubmitForm
              title="Send partial briefing"
              onSubmit={() => sendBriefing(data)}
              style="primary"
            />
          </ActionPanel>
        }
      />
    );
  }

  return <Paper markdown={markdown} />;
}

const MorningBriefingWidget = defineWidget({
  name: "morning-briefing",
  description:
    "Get your personalized daily briefing with calendar, email, weather, tasks, and recent notes",
  schema,
  component: MorningBriefing,
});

export default MorningBriefingWidget;
