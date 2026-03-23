import { useEffect, useState } from "react";

import { useAppleScript, useLogger } from "@eney/api";

export type NoteItem = {
  id: string;
  title: string;
  folder: string;
};

export type FolderItem = {
  name: string;
  parent: string;
};

const NOTE_SEPARATOR = "|";

const DELETED_TRANSLATIONS = [
  "Recently Deleted",
  "Nylig slettet",
  "Senast raderade",
  "Senest slettet",
  "Zuletzt gelöscht",
  "Supprimés récemment",
  "Eliminados recientemente",
  "Eliminati di recente",
  "Recent verwijderd",
  "Ostatnio usunięte",
  "Apagados recentemente",
  "Apagadas recentemente",
  "最近删除",
  "最近刪除",
  "最近削除した項目",
  "최근 삭제된 항목",
  "Son Silinenler",
  "Äskettäin poistetut",
  "Nedávno smazané",
  "Πρόσφατα διαγραμμένα",
  "Nemrég töröltek",
  "Șterse recent",
  "Nedávno vymazané",
  "เพิ่งลบ",
  "Đã xóa gần đây",
  "Нещодавно видалені",
];

const deletedSet = `{${DELETED_TRANSLATIONS.map((t) => `"${t}"`).join(", ")}}`;

const notesScript = `
set deletedTranslations to ${deletedSet}

tell application "Notes"
    set notesList to {}
    repeat with eachFolder in folders
        set folderName to name of eachFolder
        if folderName is not in deletedTranslations then
            set folderNotes to notes of eachFolder
            if (count of folderNotes) > 0 then
                set noteIDs to id of every note of eachFolder
                set noteNames to name of every note of eachFolder
                repeat with i from 1 to count of noteIDs
                    set end of notesList to (item i of noteIDs) & "${NOTE_SEPARATOR}" & folderName & "${NOTE_SEPARATOR}" & (item i of noteNames)
                end repeat
            end if
        end if
    end repeat
    set AppleScript's text item delimiters to "\n"
    set output to notesList as string
    set AppleScript's text item delimiters to ""
    return output
end tell
`;

const FOLDER_SEPARATOR = "|||";

const foldersScript = `
tell application "Notes"
	set output to ""
	repeat with f in every folder
		set fName to name of f
		try
			set c to container of f
			set cClass to class of c as text
			if cClass is "folder" then
				set parentName to name of c
			else
				set parentName to ""
			end if
		on error
			set parentName to ""
		end try
		set output to output & fName & "${FOLDER_SEPARATOR}" & parentName & linefeed
	end repeat
	return output
end tell
`;

export function parseFolders(raw: string): FolderItem[] {
  if (!raw.trim()) return [];

  const folders: FolderItem[] = [];

  for (const line of raw.split("\n")) {
    if (!line) continue;
    const parts = line.split(FOLDER_SEPARATOR, 2);
    if (parts.length < 2) continue;

    const [name, parent] = parts;
    folders.push({ name: name.trim(), parent: parent.trim() });
  }

  return folders;
}

export function parseNotes(raw: string): NoteItem[] {
  if (!raw.trim()) return [];

  const seen = new Set<string>();
  const notes: NoteItem[] = [];

  for (const line of raw.split("\n")) {
    if (!line) continue;
    const parts = line.split(NOTE_SEPARATOR, 3);
    if (parts.length < 3) continue;

    const [id, folder, title] = parts;
    if (seen.has(id)) continue;
    seen.add(id);

    notes.push({ id: id.trim(), folder: folder.trim(), title: title.trim() });
  }

  return notes;
}

export const useNotes = () => {
  const logger = useLogger();
  const runScript = useAppleScript();

  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    let cancelled = false;

    Promise.all([runScript(notesScript), runScript(foldersScript)])
      .then(([notesRaw, foldersRaw]) => {
        if (cancelled) return;
        const parsedNotes = parseNotes(notesRaw);
        const parsedFolders = parseFolders(foldersRaw);
        setNotes(parsedNotes);
        setFolders(parsedFolders);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    data: { allNotes: notes, allFolders: folders },
    isLoading,
    error,
  };
};
