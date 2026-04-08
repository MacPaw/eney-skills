import { useState, useEffect } from "react";
import { execGws, driveToken } from "./gws.js";

export interface DriveFolder {
  id: string;
  name: string;
}

interface UseDriveFoldersResult {
  folders: DriveFolder[];
  isLoading: boolean;
  error: string;
}

export function useDriveFolders(): UseDriveFoldersResult {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = {
          q: 'mimeType="application/vnd.google-apps.folder"',
          fields: "files(id,name)",
          pageSize: 50,
          orderBy: "name",
        };
        const stdout = await execGws(
          `drive files list --params '${JSON.stringify(params)}'`,
          driveToken()
        );
        const data = JSON.parse(stdout) as { files?: DriveFolder[] };
        setFolders(data.files ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return { folders, isLoading, error };
}
