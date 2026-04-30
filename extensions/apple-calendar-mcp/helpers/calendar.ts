import { runScript } from "@eney/api";

const FIELD_SEP = "\x1F";
const ROW_SEP = "\x1E";

function escapeForAppleScript(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function listCalendars(): Promise<string[]> {
  const script = `
    tell application "Calendar"
      set names to {}
      repeat with c in calendars
        set end of names to name of c
      end repeat
      set AppleScript's text item delimiters to "${FIELD_SEP}"
      set joined to names as string
      set AppleScript's text item delimiters to ""
      return joined
    end tell
  `;
  const out = (await runScript(script)).trim();
  if (!out) return [];
  return out.split(FIELD_SEP).filter(Boolean);
}

export interface AddEventInput {
  calendar: string;
  summary: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  description?: string;
}

function dateToAppleScriptComponents(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function dateAssignmentBlock(varName: string, stamp: string): string {
  return `set ${varName}Stamp to "${stamp}"
    set ${varName}Year to text 1 thru 4 of ${varName}Stamp as integer
    set ${varName}Month to text 6 thru 7 of ${varName}Stamp as integer
    set ${varName}Day to text 9 thru 10 of ${varName}Stamp as integer
    set ${varName}Hours to text 12 thru 13 of ${varName}Stamp as integer
    set ${varName}Minutes to text 15 thru 16 of ${varName}Stamp as integer
    set ${varName}Seconds to text 18 thru 19 of ${varName}Stamp as integer
    set ${varName}Date to (current date)
    set year of ${varName}Date to ${varName}Year
    set month of ${varName}Date to ${varName}Month
    set day of ${varName}Date to ${varName}Day
    set time of ${varName}Date to ${varName}Hours * 3600 + ${varName}Minutes * 60 + ${varName}Seconds`;
}

export async function addEvent(input: AddEventInput): Promise<void> {
  const calendar = escapeForAppleScript(input.calendar);
  const summary = escapeForAppleScript(input.summary);
  const location = input.location ? escapeForAppleScript(input.location) : "";
  const description = input.description ? escapeForAppleScript(input.description) : "";

  const propertyParts = [
    `summary:"${summary}"`,
    `start date:startDate`,
    `end date:endDate`,
  ];
  if (location) propertyParts.push(`location:"${location}"`);
  if (description) propertyParts.push(`description:"${description}"`);

  const script = `
    tell application "Calendar"
      ${dateAssignmentBlock("start", dateToAppleScriptComponents(input.startDate))}
      ${dateAssignmentBlock("end", dateToAppleScriptComponents(input.endDate))}
      tell calendar "${calendar}"
        make new event with properties {${propertyParts.join(", ")}}
      end tell
    end tell
  `;
  await runScript(script);
}

export interface CalendarEvent {
  summary: string;
  startDate: string;
  endDate: string;
  location: string;
}

export async function listTodaysEvents(calendar: string): Promise<CalendarEvent[]> {
  const escaped = escapeForAppleScript(calendar);
  const script = `
    tell application "Calendar"
      set rangeStart to (current date)
      set hours of rangeStart to 0
      set minutes of rangeStart to 0
      set seconds of rangeStart to 0
      set rangeEnd to rangeStart + (1 * days)
      tell calendar "${escaped}"
        set todayEvents to (every event whose start date ≥ rangeStart and start date < rangeEnd)
        set output to ""
        repeat with e in todayEvents
          set eSummary to summary of e
          set eStart to (start date of e) as string
          set eEnd to (end date of e) as string
          set eLocation to ""
          try
            set eLocation to location of e as string
          end try
          set output to output & eSummary & "${FIELD_SEP}" & eStart & "${FIELD_SEP}" & eEnd & "${FIELD_SEP}" & eLocation & "${ROW_SEP}"
        end repeat
        return output
      end tell
    end tell
  `;
  const out = (await runScript(script)).trim();
  if (!out) return [];
  return out
    .split(ROW_SEP)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [summary, startDate, endDate, location] = row.split(FIELD_SEP);
      return {
        summary: summary ?? "",
        startDate: startDate ?? "",
        endDate: endDate ?? "",
        location: location ?? "",
      };
    });
}
