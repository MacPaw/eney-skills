import { homedir } from "os";
import { resolve } from "path";

import { useLogger, useSQL } from "@eney/api";

export type NoteItem = {
  id: string;
  pk: number;
  UUID: string;
  title: string;
  modifiedAt?: Date;
  folder: string;
  snippet: string;
  account: string;
};

const NOTES_DB = resolve(
  homedir(),
  "Library/Group Containers/group.com.apple.notes/NoteStore.sqlite",
);

const query = `
    SELECT
        'x-coredata://' || zmd.z_uuid || '/ICNote/p' || note.z_pk AS id,
        note.z_pk AS pk,
        note.ztitle1 AS title,
        folder.ztitle2 AS folder,
        datetime(note.zmodificationdate1 + 978307200, 'unixepoch') AS modifiedAt,
        note.zsnippet AS snippet,
        acc.zname AS account,
        note.zidentifier AS UUID
    FROM
        ziccloudsyncingobject AS note
    INNER JOIN ziccloudsyncingobject AS folder
        ON note.zfolder = folder.z_pk
    LEFT JOIN ziccloudsyncingobject AS acc
        ON note.zaccount4 = acc.z_pk
    LEFT JOIN z_metadata AS zmd ON 1=1
    WHERE
        note.ztitle1 IS NOT NULL AND
        note.zmodificationdate1 IS NOT NULL AND
        note.z_pk IS NOT NULL AND
        note.zmarkedfordeletion != 1 AND
        folder.zmarkedfordeletion != 1 AND
        folder.ztitle2 != 'Recently Deleted'
    ORDER BY
        note.zmodificationdate1 DESC
`;

export const useNotes = () => {
  const logger = useLogger();

  const { data, ...rest } = useSQL<NoteItem[]>(NOTES_DB, query);

  logger.debug(`Fetched ${data?.length ?? 0} notes from the database`);

  const seen = new Set<string>();
  const notes =
    data?.filter((x) => {
      if (seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    }) ?? [];

  return {
    data: { allNotes: notes },
    ...rest,
  };
};
