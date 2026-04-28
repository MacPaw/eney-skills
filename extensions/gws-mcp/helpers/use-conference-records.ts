import { useState, useEffect } from "react";
import { execGws, meetToken } from "./gws.js";

export interface ConferenceRecord {
  name: string;
  startTime?: string;
  endTime?: string;
  space?: string;
}

interface UseConferenceRecordsResult {
  records: ConferenceRecord[];
  uniqueSpaces: string[];
  isLoading: boolean;
  error: string;
}

export function useConferenceRecords(): UseConferenceRecordsResult {
  const [records, setRecords] = useState<ConferenceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const params = { pageSize: 20 };
        const stdout = await execGws(
          ["meet", "conferenceRecords", "list", "--params", JSON.stringify(params)],
          meetToken()
        );
        const data = JSON.parse(stdout) as { conferenceRecords?: ConferenceRecord[] };
        setRecords(data.conferenceRecords ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  const uniqueSpaces = Array.from(
    new Set(records.map((r) => r.space).filter((s): s is string => !!s))
  );

  return { records, uniqueSpaces, isLoading, error };
}
