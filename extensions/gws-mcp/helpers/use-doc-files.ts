import { parseGwsError } from "./gws.js";
import { useState, useEffect } from "react";
import { execGws, driveToken } from "./gws.js";

export interface DocFile {
  id: string;
  name: string;
}

interface UseDocFilesResult {
  docs: DocFile[];
  isLoading: boolean;
  error: string;
}

export function useDocFiles(): UseDocFilesResult {
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = {
          q: 'mimeType="application/vnd.google-apps.document"',
          fields: "files(id,name)",
          pageSize: 50,
        };
        const stdout = await execGws(
          ["drive", "files", "list", "--params", JSON.stringify(params)],
          driveToken()
        );
        const data = JSON.parse(stdout) as { files?: DocFile[] };
        setDocs(data.files ?? []);
      } catch (e) {
        setError(parseGwsError(e));
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return { docs, isLoading, error };
}
