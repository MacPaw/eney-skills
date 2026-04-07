import { useState, useEffect } from "react";
import { useLogger } from "@eney/api";
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
  const logger = useLogger();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = { fields: "files(id,name,mimeType)", pageSize: 50 };
        const stdout = await execGws(
          `drive files list --params '${JSON.stringify(params)}'`,
          driveToken(),
          logger
        );
        const data = JSON.parse(stdout) as { files?: DriveFile[] };
        setFiles(data.files ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return { files, isLoading, error };
}
