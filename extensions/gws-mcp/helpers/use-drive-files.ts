import { parseGwsError } from "./gws.js";
import { useState, useEffect } from "react";
import { execGws, driveToken } from "./gws.js";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface UseDriveFilesResult {
  files: DriveFile[];
  isLoading: boolean;
  error: string;
}

export function useDriveFiles(): UseDriveFilesResult {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = { fields: "files(id,name,mimeType)", pageSize: 50 };
        const stdout = await execGws(
          ["drive", "files", "list", "--params", JSON.stringify(params)],
          driveToken()
        );
        const data = JSON.parse(stdout) as { files?: DriveFile[] };
        setFiles(data.files ?? []);
      } catch (e) {
        setError(parseGwsError(e));
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return { files, isLoading, error };
}
