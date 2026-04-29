import { parseGwsError } from "./gws.js";
import { useState, useEffect } from "react";
import { execGws, driveToken } from "./gws.js";

export interface SlidesFile {
  id: string;
  name: string;
}

interface UseSlidesFilesResult {
  presentations: SlidesFile[];
  isLoading: boolean;
  error: string;
}

export function useSlidesFiles(): UseSlidesFilesResult {
  const [presentations, setPresentations] = useState<SlidesFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = {
          q: 'mimeType="application/vnd.google-apps.presentation"',
          fields: "files(id,name)",
          pageSize: 50,
        };
        const stdout = await execGws(
          ["drive", "files", "list", "--params", JSON.stringify(params)],
          driveToken()
        );
        const data = JSON.parse(stdout) as { files?: SlidesFile[] };
        setPresentations(data.files ?? []);
      } catch (e) {
        setError(parseGwsError(e));
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return { presentations, isLoading, error };
}
