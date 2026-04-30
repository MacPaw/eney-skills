import { runScript } from "@eney/api";

const FIELD_SEP = "\x1F";
const VALUE_SEP = "\x1E";
const ROW_SEP = "\x1D";

function escapeForAppleScript(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export interface Contact {
  name: string;
  organization: string;
  phones: string[];
  emails: string[];
}

export async function searchContacts(query: string, limit: number): Promise<Contact[]> {
  const escaped = escapeForAppleScript(query);
  const script = `
    tell application "Contacts"
      set matches to (every person whose name contains "${escaped}")
      set output to ""
      set counter to 0
      repeat with p in matches
        if counter ≥ ${limit} then exit repeat
        set pName to name of p
        set pOrg to ""
        try
          set pOrg to organization of p as string
        end try
        set phoneList to ""
        try
          set phoneValues to value of phones of p
          set AppleScript's text item delimiters to "${VALUE_SEP}"
          set phoneList to phoneValues as string
          set AppleScript's text item delimiters to ""
        end try
        set emailList to ""
        try
          set emailValues to value of emails of p
          set AppleScript's text item delimiters to "${VALUE_SEP}"
          set emailList to emailValues as string
          set AppleScript's text item delimiters to ""
        end try
        set output to output & pName & "${FIELD_SEP}" & pOrg & "${FIELD_SEP}" & phoneList & "${FIELD_SEP}" & emailList & "${ROW_SEP}"
        set counter to counter + 1
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
      const [name, organization, phones, emails] = row.split(FIELD_SEP);
      return {
        name: name ?? "",
        organization: organization ?? "",
        phones: phones ? phones.split(VALUE_SEP).filter(Boolean) : [],
        emails: emails ? emails.split(VALUE_SEP).filter(Boolean) : [],
      };
    });
}
