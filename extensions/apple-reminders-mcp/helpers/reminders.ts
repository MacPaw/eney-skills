import { runScript } from "@eney/api";

const SEPARATOR = "";
const ROW_SEPARATOR = "";

export function escapeForAppleScript(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function listReminderLists(): Promise<string[]> {
  const script = `
    tell application "Reminders"
      set listNames to {}
      repeat with l in lists
        set end of listNames to name of l
      end repeat
      set AppleScript's text item delimiters to "${SEPARATOR}"
      set joined to listNames as string
      set AppleScript's text item delimiters to ""
      return joined
    end tell
  `;
  const out = (await runScript(script)).trim();
  if (!out) return [];
  return out.split(SEPARATOR).filter(Boolean);
}

export interface AddReminderInput {
  list: string;
  name: string;
  body?: string;
  dueDate?: Date;
}

function isoDateToAppleScriptDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export async function addReminder(input: AddReminderInput): Promise<void> {
  const list = escapeForAppleScript(input.list);
  const name = escapeForAppleScript(input.name);
  const body = input.body ? escapeForAppleScript(input.body) : "";

  let propertiesParts = [`name:"${name}"`];
  if (body) propertiesParts.push(`body:"${body}"`);

  let dueDateLine = "";
  if (input.dueDate) {
    const stamp = isoDateToAppleScriptDate(input.dueDate);
    dueDateLine = `set dueStamp to "${stamp}"
      set theYear to text 1 thru 4 of dueStamp as integer
      set theMonth to text 6 thru 7 of dueStamp as integer
      set theDay to text 9 thru 10 of dueStamp as integer
      set theHours to text 12 thru 13 of dueStamp as integer
      set theMinutes to text 15 thru 16 of dueStamp as integer
      set theSeconds to text 18 thru 19 of dueStamp as integer
      set d to (current date)
      set year of d to theYear
      set month of d to theMonth
      set day of d to theDay
      set time of d to theHours * 3600 + theMinutes * 60 + theSeconds`;
    propertiesParts.push(`due date:d`);
  }

  const properties = `{${propertiesParts.join(", ")}}`;

  const script = `
    tell application "Reminders"
      ${dueDateLine}
      tell list "${list}"
        make new reminder with properties ${properties}
      end tell
    end tell
  `;
  await runScript(script);
}

export interface Reminder {
  name: string;
  body: string;
  dueDate: string;
}

export async function listReminders(list: string, includeCompleted: boolean): Promise<Reminder[]> {
  const escapedList = escapeForAppleScript(list);
  const filter = includeCompleted ? "every reminder" : "(every reminder whose completed is false)";
  const script = `
    tell application "Reminders"
      tell list "${escapedList}"
        set theReminders to ${filter}
        set output to ""
        repeat with r in theReminders
          set rName to name of r
          set rBody to ""
          try
            set rBody to body of r as string
          end try
          set rDue to ""
          try
            set rDue to (due date of r) as string
          end try
          set output to output & rName & "${SEPARATOR}" & rBody & "${SEPARATOR}" & rDue & "${ROW_SEPARATOR}"
        end repeat
        return output
      end tell
    end tell
  `;
  const out = (await runScript(script)).trim();
  if (!out) return [];
  return out
    .split(ROW_SEPARATOR)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [name, body, dueDate] = row.split(SEPARATOR);
      return { name: name ?? "", body: body ?? "", dueDate: dueDate ?? "" };
    });
}
